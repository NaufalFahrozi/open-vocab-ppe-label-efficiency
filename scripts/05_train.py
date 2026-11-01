"""Adaptasi model dengan data berlabel (k-shot atau data penuh), lalu evaluasi.

- yoloe-vp : YOLOE-26 dengan VISUAL PROMPT, tanpa training. Kotak berlabel di gambar k-shot
             dijadikan contoh visual; embedding-nya dirata-rata per kelas.
- yoloe-lp : YOLOE-26 linear probing. Backbone, neck, dan hampir seluruh head dibekukan; yang
             dilatih hanya conv terakhir cabang klasifikasi (cv3), diinisialisasi dari embedding
             teks nama kelas. Resep dari dokumentasi Ultralytics.
- yoloe-ft : YOLOE-26 fine-tune penuh. Bersama yolo26, ini memisahkan efek bobot awal dari cara melatih.
- yolow-ft : YOLO-World-v2 fine-tune penuh lewat WorldTrainer resmi (metode tambahan, Tahap 4).
- yolo26   : YOLO26 pretrained COCO, fine-tune penuh.

Few-shot tidak memakai validation set untuk early stopping: menyisihkan ratusan gambar berlabel
bertentangan dengan premisnya. Jadwal dikunci dari dev set (Tahap 1) dan yang dievaluasi last.pt.

Data penuh mengikuti tabel protokol: pool sebagai train, dev untuk memilih best.pt. Kalau job
terputus, run ini melanjutkan dari last.pt selama optimizer-nya masih ada; kalau last.pt rusak,
dari last_backup.pt (disalin 09_queue.py tiap kali berubah).

Update bobot terjadi setiap round(nbs / batch) batch (trainer.py), jadi nbs menentukan jumlah
update yang sebenarnya, bukan hanya skala weight decay.
"""
import argparse
import json
import math
import os
import shutil
import sys
import time
from pathlib import Path

import torch

sys.path.insert(0, str(Path(__file__).parent))
from common import (FEWSHOT_BATCH, FULL_BATCH, PROMPTS, RESULTS, ROOT, RUNS, SCHEDULE, SPLITS, WORKERS,  # noqa: E402
                    make_yaml)
from evalutil import IMGSZ, evaluate  # noqa: E402
from telemetry import GpuMonitor, keep_awake  # noqa: E402

from ultralytics import YOLO, YOLOE, YOLOWorld
from ultralytics.models.yolo.yoloe import YOLOEPETrainer

FULL_NBS, FULL_EPOCHS, FULL_PATIENCE = 64, 200, 30
# Ditulis eksplisit: mode auto baru memilih MuSGD di atas 10.000 iterasi, dan run ini tepat di bawahnya.
FULL_OPT = dict(optimizer="MuSGD", lr0=0.01, momentum=0.9, warmup_bias_lr=0.0)


def linear_probe_freeze(model):
    """Daftar layer yang dibekukan, persis mengikuti contoh Linear Probing di dokumentasi."""
    head_index = len(model.model.model) - 1
    freeze = [str(i) for i in range(head_index)]
    for name, _ in model.model.model[-1].named_children():
        if "cv3" in name:  # cv3, plus one2one_cv3 pada YOLOE-26 end-to-end
            freeze.extend(f"{head_index}.{name}.{i}.{j}" for i in range(3) for j in (0, 1))
        else:
            freeze.append(f"{head_index}.{name}")
    return freeze


def base_yoloe(size):
    # Bobot rilis YOLOE-26 semuanya model segmentasi; versi deteksi dibangun dari yaml.
    return YOLOE(f"yoloe-26{size}.yaml").load(f"yoloe-26{size}-seg.pt")


def read_state(path):
    """None kalau file tidak ada atau rusak (listrik mati saat menulis)."""
    if not path.exists():
        return None
    try:
        ck = torch.load(path, map_location="cpu", weights_only=False)
    except Exception as e:
        print(f"{path.name} tidak terbaca ({e})")
        return None
    return "lanjut" if ck.get("optimizer") is not None else "selesai"


def checkpoint_state(last):
    """None: mulai baru. 'lanjut': optimizer masih ada. 'selesai': training tuntas, tinggal evaluasi."""
    state = read_state(last)
    backup = last.with_name("last_backup.pt")
    if state is None and last.exists() and read_state(backup):
        print("last.pt rusak, memakai last_backup.pt")
        shutil.copyfile(backup, last)
        state = read_state(last)
    return state


MODEL_CLS = {"yolo26": YOLO, "yoloe-lp": YOLOE, "yoloe-ft": YOLOE, "yolow-ft": YOLOWorld}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", required=True, choices=["yoloe-vp", "yoloe-lp", "yoloe-ft", "yolow-ft", "yolo26"])
    ap.add_argument("--size", default="s")
    ap.add_argument("--k", type=int, default=10)
    ap.add_argument("--full", action="store_true", help="pakai seluruh pool, bukan k-shot")
    ap.add_argument("--seed", type=int, default=0)
    ap.add_argument("--batch", type=int, default=None)
    ap.add_argument("--workers", type=int, default=WORKERS)
    ap.add_argument("--suffix", default="", help="penanda run, mis. _rep2 atau _jadwalB")
    ap.add_argument("--nbs", type=int, default=None, help="default: jadwal terkunci (common.SCHEDULE)")
    ap.add_argument("--epochs", type=int, default=None, help="default: jadwal terkunci (common.SCHEDULE)")
    ap.add_argument("--eval-split", default="test", choices=["dev", "test"])
    a = ap.parse_args()
    if a.full and a.model == "yoloe-vp":
        ap.error("visual prompt data penuh tidak ada di protokol")
    keep_awake()

    if a.full:
        shot, summary = f"full_seed{a.seed}", None
        unique = train_list = SPLITS / "pool.txt"
        val_list = SPLITS / "dev.txt"
    else:
        shot = f"k{a.k}_seed{a.seed}"
        summary = json.loads((SPLITS / "fewshot" / f"{shot}.json").read_text())
        unique = val_list = SPLITS / "fewshot" / f"{shot}.txt"  # val = sumber contoh visual yoloe-vp
        train_list = SPLITS / "fewshot" / f"{shot}_train.txt"
    n_img = sum(1 for l in open(unique) if l.strip())
    n_list = sum(1 for l in open(train_list) if l.strip())
    data = make_yaml(f"sh17_{shot}", train_list, val_list, PROMPTS)
    tag = f"{shot}_{a.model}{a.size}{a.suffix}"
    out_dir = RESULTS / ("runs" if a.eval_split == "test" else "runs_dev")
    info = {"model": a.model, "size": a.size, "skenario": "full" if a.full else f"{a.k}-shot",
            "k": None if a.full else a.k, "seed": a.seed, "n_train_images": n_img, "n_train_list": n_list,
            "fewshot_summary": summary, "eval_split": a.eval_split, "workers": a.workers}
    ev = dict(split=a.eval_split, workers=a.workers, out_dir=out_dir)

    os.chdir(ROOT / "weights")
    if a.model == "yoloe-vp":
        evaluate(base_yoloe(a.size), tag, val_kwargs=dict(load_vp=True, refer_data=data),
                 extra={**info, "trainable_params": 0}, **ev)
        return

    batch = a.batch or (FULL_BATCH if a.full else FEWSHOT_BATCH)
    default_nbs, default_epochs = (FULL_NBS, FULL_EPOCHS) if a.full else SCHEDULE[a.model]
    nbs, epochs = a.nbs or default_nbs, a.epochs or default_epochs
    nb = math.ceil(n_list / batch)
    wdir = RUNS / "train" / tag / "weights"
    state = checkpoint_state(wdir / "last.pt") if a.full else None  # few-shot singkat: ulang saja

    train_args = dict(data=data, epochs=epochs, imgsz=IMGSZ, batch=batch, nbs=nbs, device=0, seed=a.seed,
                      deterministic=True, val=a.full, plots=False, workers=a.workers,
                      project=str(RUNS / "train"), name=tag, exist_ok=True)
    if a.full:
        train_args.update(patience=FULL_PATIENCE, **FULL_OPT)
    if a.model == "yolo26":
        model = YOLO(f"yolo26{a.size}.pt")
    elif a.model == "yolow-ft":
        model = YOLOWorld(f"yolov8{a.size}-worldv2.pt")  # trainer resmi: WorldTrainer lewat task_map
    else:
        model = base_yoloe(a.size)
        train_args["trainer"] = YOLOEPETrainer
        if a.model == "yoloe-lp":
            train_args["freeze"] = linear_probe_freeze(model)

    info.update({"resumed": state == "lanjut", "nbs": nbs, "batch": batch, "epochs_planned": epochs})
    if state != "selesai":
        if state == "lanjut":
            # Kelas model dan trainer harus sama dengan run awal; resume hanya memulihkan argumen.
            resume_args = dict(resume=True)
            if "trainer" in train_args:
                resume_args["trainer"] = train_args["trainer"]
            model, train_args = MODEL_CLS[a.model](str(wdir / "last.pt")), resume_args
        torch.cuda.reset_peak_memory_stats()
        t0 = time.time()
        with GpuMonitor() as mon:
            model.train(**train_args)
        train_time = time.time() - t0
        tr = model.trainer
        params = list(tr.model.parameters())
        done = tr.epoch + 1
        info.update({
            "epochs": done, "steps": done * nb,
            "weight_updates_approx": done * nb // max(round(nbs / batch), 1),
            "optimizer": type(tr.optimizer).__name__,
            "lr0_actual": tr.optimizer.param_groups[0].get("initial_lr"),
            "trainable_params": sum(p.numel() for p in params if p.requires_grad),
            "total_params": sum(p.numel() for p in params),
            "train_time_min": round(train_time / 60, 2),
            "train_peak_vram_GB": round(torch.cuda.max_memory_reserved() / 1024**3, 2),
            "train_telemetry": mon.summary(),
        })

    if not a.full:
        (wdir / "best.pt").unlink(missing_ok=True)  # tanpa val, best.pt = last.pt; hemat disk
    ckpt = wdir / ("best.pt" if a.full else "last.pt")
    trained = MODEL_CLS[a.model](str(ckpt))
    evaluate(trained, tag, extra=info, **ev)


if __name__ == "__main__":
    main()
