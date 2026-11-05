"""Server FastAPI prototipe deteksi APD.

Jalankan dari root repo:
    .venv/Scripts/python -m uvicorn app.backend.main:app --port 8000
"""
import logging
import time
from contextlib import asynccontextmanager

import cv2
import numpy as np
import torch
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from . import compliance, config
from .experiment import CLASS_GROUPS
from .models import registry

log = logging.getLogger("app")
MIN_CONF_EVAL = 0.001  # sama dengan detmetrics.MIN_CONF; dipakai kalau pemeriksaan kepatuhan diminta
MAX_UPLOAD_MB = 25


@asynccontextmanager
async def lifespan(app: FastAPI):
    t0 = time.perf_counter()
    registry.load_all()
    log.warning("model termuat dalam %.1f detik di device %s; gagal: %s",
                time.perf_counter() - t0, config.DEVICE, registry.errors or "tidak ada")
    yield


app = FastAPI(title="Prototipe Deteksi APD", lifespan=lifespan)


@app.get("/api/health")
def health():
    gpu = None
    if torch.cuda.is_available():
        gpu = {"nama": torch.cuda.get_device_name(0),
               "vram_terpakai_mb": round(torch.cuda.memory_allocated(0) / 2**20)}
    return {"status": "ok", "device": config.DEVICE, "torch": torch.__version__, "gpu": gpu,
            "model_termuat": list(registry.models), "model_gagal": registry.errors}


@app.get("/api/models")
def models():
    return {"modes": registry.info(), "kelompok_kelas": CLASS_GROUPS, "conf_tampil": config.CONF_TAMPIL,
            "prompt_baru": registry.prompt_baru, "ambang_pelanggaran": compliance.AMBANG_PELANGGARAN}


def _decode(data: bytes):
    if len(data) > MAX_UPLOAD_MB * 2**20:
        raise HTTPException(413, f"file lebih dari {MAX_UPLOAD_MB} MB")
    img = cv2.imdecode(np.frombuffer(data, np.uint8), cv2.IMREAD_COLOR)  # BGR, orientasi EXIF diterapkan
    if img is None:
        raise HTTPException(400, "file bukan gambar yang bisa dibaca")
    return img


@app.post("/api/detect")
def detect(file: UploadFile = File(...), modes: str = Form("zs,lp10,lp30,full"),
           conf: float = Form(config.CONF_TAMPIL), kepatuhan: bool = Form(False),
           ambang: float = Form(compliance.AMBANG_PELANGGARAN)):
    """Deteksi satu gambar dengan beberapa mode sekaligus, untuk ditampilkan berdampingan."""
    if not 0.01 <= conf <= 0.99 or not 0.01 <= ambang <= 0.99:
        raise HTTPException(422, "conf dan ambang harus di antara 0,01 dan 0,99")
    daftar = [m for m in modes.split(",") if m]
    salah = [m for m in daftar if m not in registry.models]
    if salah or not daftar:
        raise HTTPException(422, f"mode tidak tersedia: {salah or 'kosong'}")
    img = _decode(file.file.read())
    h, w = img.shape[:2]

    registry.bangunkan(daftar)
    hasil = {}
    for mode in daftar:
        p = registry.predict(mode, img, MIN_CONF_EVAL if kepatuhan else conf)
        tampil = p.scores >= conf
        item = {
            "deteksi": [{"kelas": p.names[c], "id": int(c), "skor": round(float(s), 3),
                         "box": [round(float(v), 1) for v in b]}
                        for b, s, c in zip(p.boxes[tampil], p.scores[tampil], p.cls[tampil])],
            "ms_model": round(p.ms_model, 1),
            "ms_total": round(p.ms_total, 1),
        }
        if kepatuhan:
            item["kepatuhan"] = compliance.check(p.boxes, p.scores, p.cls, conf, ambang)
        hasil[mode] = item
    return {"lebar": w, "tinggi": h, "conf": conf, "hasil": hasil}


@app.get("/api/samples")
def samples():
    """Gambar test Construction-PPE untuk demo. Tidak dipakai training mana pun, dan tidak ikut ke git."""
    if not config.SAMPLES.exists():
        return {"gambar": []}
    ext = {".jpg", ".jpeg", ".png"}
    return {"gambar": sorted((p.name for p in config.SAMPLES.iterdir() if p.suffix.lower() in ext),
                             key=lambda n: (len(n), n))}


@app.get("/api/samples/{nama}")
def sample(nama: str):
    f = (config.SAMPLES / nama).resolve()
    if not f.is_relative_to(config.SAMPLES.resolve()) or not f.is_file():
        raise HTTPException(404, "gambar contoh tidak ada")
    return FileResponse(f)


class PromptBaru(BaseModel):
    kelas: list[str]


@app.get("/api/prompts")
def get_prompts():
    return {"prompt_baru": registry.prompt_baru, "maks": config.MAX_PROMPT_BARU}


@app.put("/api/prompts")
def put_prompts(body: PromptBaru):
    """Fitur 2: tambah jenis APD baru cukup dengan mengetik nama, khusus mode zero-shot."""
    try:
        t0 = time.perf_counter()
        baru = registry.set_prompt_baru(body.kelas)
    except (ValueError, RuntimeError) as e:
        raise HTTPException(422, str(e))
    return {"prompt_baru": baru, "kelas_zs": registry.names["zs"],
            "ms_set_classes": round((time.perf_counter() - t0) * 1000)}


# Hasil build frontend (npm run build) disajikan dari server yang sama, supaya demo cukup satu perintah.
if config.FRONTEND_DIST.exists():
    app.mount("/assets", StaticFiles(directory=config.FRONTEND_DIST / "assets"), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    def spa(path: str):
        dist = config.FRONTEND_DIST.resolve()
        f = (dist / path).resolve()
        aman = f.is_relative_to(dist) and f.is_file()  # cegah path traversal (../)
        if path and aman:
            return FileResponse(f)
        # index.html tidak boleh disimpan browser: isinya menunjuk ke file JS terbaru setelah setiap build.
        # File di /assets/ aman disimpan lama karena namanya berisi hash.
        return FileResponse(dist / "index.html", headers={"Cache-Control": "no-cache"})
