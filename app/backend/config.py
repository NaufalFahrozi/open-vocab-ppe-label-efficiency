"""Konfigurasi aplikasi: lokasi bobot, perangkat, dan ambang tampilan.

Semua path absolut dari root repo, karena pemuatan YOLOE zero-shot perlu pindah folder kerja
sementara (lihat models.py) dan path relatif akan ikut bergeser.
"""
import os
from pathlib import Path

import torch

ROOT = Path(__file__).resolve().parents[2]
WEIGHTS = ROOT / "weights"
RUNS = ROOT / "runs" / "train"
FRONTEND_DIST = ROOT / "app" / "frontend" / "dist"
SAMPLES = ROOT / "data" / "construction-ppe" / "images" / "test"  # uji lintas dataset, tidak ikut training

# Bobot seed 0, bukan seed dengan skor test tertinggi, supaya demo jujur (rencana_prototipe.md).
# Few-shot hanya menyimpan last.pt dan eksperimen memakai last.pt; data penuh memakai best.pt
# seperti scripts/11_cross_dataset.py.
MODES = {
    "zs": {
        "label": "Zero-shot YOLOE-26s",
        "keterangan": "Tanpa data berlabel, cukup prompt teks",
        "label_per_kelas": 0,
        "map50": 38.4,
        "file": WEIGHTS / "yoloe-26s-seg.pt",
    },
    "lp10": {
        "label": "Linear probing k = 10",
        "keterangan": "YOLOE-26s, lapisan klasifikasi dilatih dengan 10 objek per kelas (±39 gambar)",
        "label_per_kelas": 10,
        "map50": 41.1,
        "file": RUNS / "k10_seed0_yoloe-lps" / "weights" / "last.pt",
    },
    "lp30": {
        "label": "Linear probing k = 30",
        "keterangan": "YOLOE-26s, lapisan klasifikasi dilatih dengan 30 objek per kelas (±109 gambar)",
        "label_per_kelas": 30,
        "map50": 43.2,
        "file": RUNS / "k30_seed0_yoloe-lps" / "weights" / "last.pt",
    },
    "full": {
        "label": "YOLO26s data penuh",
        "keterangan": "Dilatih dengan seluruh 4.986 gambar latih SH17",
        "label_per_kelas": None,
        "map50": 61.0,
        "file": RUNS / "full_seed0_yolo26s" / "weights" / "best.pt",
    },
}
# mAP50 di atas adalah rata-rata 5 seed (few-shot) atau satu run (zero-shot, data penuh) pada test SH17,
# dari results/hasil/ringkasan.md. Bobot yang dimuat adalah seed 0, jadi skornya bisa sedikit berbeda.

# APP_DEVICE=cpu memaksa CPU, misalnya saat GPU sedang dipakai proses lain (aturan satu proses GPU).
DEVICE = os.environ.get("APP_DEVICE") or ("0" if torch.cuda.is_available() else "cpu")
IMGSZ = 640  # sama dengan eksperimen
MAX_DET = 300  # sama dengan evaluasi (detmetrics.py)
# Evaluasi memakai conf 0,001 supaya kurva PR lengkap. Untuk tampilan perlu ambang lebih tinggi,
# kalau tidak gambar penuh kotak berskor rendah.
CONF_TAMPIL = 0.25
MAX_PROMPT_BARU = 10  # batas jumlah kelas tambahan untuk zero-shot
