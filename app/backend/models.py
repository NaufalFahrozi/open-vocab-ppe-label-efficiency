"""Memuat keempat model sekali saat aplikasi start, lalu menjalankan prediksi bergantian.

Kenapa satu kunci (lock) untuk semua model: laptop hanya punya satu GPU 6 GB, dan aturan
proyek ini adalah satu pekerjaan GPU pada satu waktu. Permintaan yang datang bersamaan
akan antre, bukan berebut VRAM.
"""
import contextlib
import os
import threading
import time
from dataclasses import dataclass

import numpy as np

from . import config
from .experiment import PROMPTS, SH17_NAMES


@dataclass
class Prediksi:
    boxes: np.ndarray  # [n, 4] xyxy dalam piksel gambar asli
    scores: np.ndarray  # [n]
    cls: np.ndarray  # [n] indeks kelas (int)
    names: list[str]  # nama kelas untuk indeks di atas
    ms_model: float  # preprocess + inference + postprocess menurut Ultralytics
    ms_total: float  # termasuk konversi hasil di aplikasi


@contextlib.contextmanager
def _folder_weights():
    """set_classes mencari mobileclip2_b.ts relatif terhadap folder kerja (CLAUDE.md)."""
    lama = os.getcwd()
    os.chdir(config.WEIGHTS)
    try:
        yield
    finally:
        os.chdir(lama)


class Registry:
    def __init__(self):
        self.models = {}
        self.names = {}  # nama kelas tampilan per mode
        self.prompt_baru: list[str] = []
        self.lock = threading.Lock()
        self.errors = {}
        self._terakhir = 0.0  # waktu prediksi terakhir, untuk mendeteksi GPU yang menganggur

    # ---------- pemuatan ----------
    def load_all(self):
        from ultralytics import YOLO, YOLOE

        for mode, info in config.MODES.items():
            try:
                if not info["file"].exists():
                    raise FileNotFoundError(f"bobot tidak ditemukan: {info['file']}")
                if mode == "zs":
                    # Bobot rilis YOLOE-26 adalah model segmentasi; versi deteksi dibangun dari yaml,
                    # sama seperti scripts/03_zeroshot_yoloe.py.
                    with _folder_weights():
                        m = YOLOE("yoloe-26s.yaml").load(info["file"].name)
                        m.set_classes(list(PROMPTS))
                    self.names[mode] = list(SH17_NAMES)
                elif mode.startswith("lp"):
                    # Checkpoint linear probing sudah membawa 17 kelas SH17 (seperti 11_cross_dataset.py).
                    m = YOLOE(str(info["file"]))
                    self.names[mode] = _sh17_names(m.names)
                else:
                    m = YOLO(str(info["file"]))
                    self.names[mode] = _sh17_names(m.names)
                self.models[mode] = m
                self._warmup(mode)
            except Exception as e:  # satu model gagal tidak boleh mematikan aplikasi
                self.errors[mode] = f"{type(e).__name__}: {e}"

    def _warmup(self, mode):
        # Prediksi pertama jauh lebih lambat (inisialisasi CUDA, cuDNN autotune). Dilakukan saat start
        # supaya FPS yang ditampilkan ke dosen tidak tercemar waktu pemanasan.
        dummy = np.zeros((640, 640, 3), dtype=np.uint8)
        for _ in range(2):
            self._predict_raw(mode, dummy, 0.5)

    # ---------- prompt zero-shot (fitur 2) ----------
    def set_prompt_baru(self, daftar: list[str]):
        """Tambahkan kelas baru ke model zero-shot. 17 kelas SH17 selalu dipertahankan."""
        if "zs" not in self.models:
            raise RuntimeError("model zero-shot tidak termuat")
        bersih = []
        for t in daftar:
            t = " ".join(t.strip().lower().split())
            if t and t not in bersih and t not in PROMPTS:
                bersih.append(t)
        if len(bersih) > config.MAX_PROMPT_BARU:
            raise ValueError(f"maksimal {config.MAX_PROMPT_BARU} kelas baru")
        with self.lock, _folder_weights():
            self.models["zs"].set_classes(list(PROMPTS) + bersih)
            self._predict_raw("zs", np.zeros((640, 640, 3), dtype=np.uint8), 0.5)  # pemanasan ulang
        self.prompt_baru = bersih
        self.names["zs"] = list(SH17_NAMES) + bersih
        return bersih

    # ---------- prediksi ----------
    def _predict_raw(self, mode, img_bgr, conf):
        return self.models[mode].predict(img_bgr, imgsz=config.IMGSZ, conf=conf, max_det=config.MAX_DET,
                                         device=config.DEVICE, verbose=False)[0]

    def bangunkan(self, modes):
        """GPU laptop menurunkan clock saat menganggur, sehingga gambar pertama setelah jeda 3 sampai 7 kali
        lebih lambat (terukur: 45 sampai 87 ms vs 10 sampai 21 ms). Supaya waktu yang tampil adalah waktu
        kondisi stabil, seperti pengukuran 06_fps.py, GPU dipanaskan dulu kalau sudah menganggur > 2 detik.
        Pemanasan ini tidak ikut diukur."""
        if config.DEVICE == "cpu" or time.perf_counter() - self._terakhir < 2:
            return
        dummy = np.zeros((640, 640, 3), dtype=np.uint8)
        with self.lock:
            for _ in range(3):
                for m in modes:
                    self._predict_raw(m, dummy, 0.5)

    def predict(self, mode, img_bgr, conf) -> Prediksi:
        with self.lock:
            t0 = time.perf_counter()
            r = self._predict_raw(mode, img_bgr, conf)
            b = r.boxes
            out = Prediksi(
                boxes=b.xyxy.cpu().numpy().astype(np.float32),
                scores=b.conf.cpu().numpy().astype(np.float32),
                cls=b.cls.cpu().numpy().astype(int),
                names=self.names[mode],
                ms_model=float(sum(r.speed.values())),
                ms_total=(time.perf_counter() - t0) * 1000,
            )
            self._terakhir = time.perf_counter()
        return out

    def info(self):
        return {
            mode: {
                **{k: v for k, v in config.MODES[mode].items() if k != "file"},
                "termuat": mode in self.models,
                "error": self.errors.get(mode),
                "kelas": self.names.get(mode, []),
            }
            for mode in config.MODES
        }


def _sh17_names(names):
    """Checkpoint hasil training menyimpan nama kelas versi prompt ("safety vest", "earmuffs"), yaitu
    PROMPTS di common.py. Supaya keempat mode memakai nama yang sama di layar, nama diganti dengan
    SH17_NAMES menurut indeks, setelah dipastikan urutannya sama dengan PROMPTS."""
    lst = [names[i] for i in sorted(names)] if isinstance(names, dict) else list(names)
    if lst != list(PROMPTS):
        raise ValueError(f"urutan kelas checkpoint tidak cocok dengan SH17: {lst}")
    return list(SH17_NAMES)


registry = Registry()
