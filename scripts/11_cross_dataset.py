"""Uji lintas dataset: model dari skenario SH17 dinilai di semua split Construction-PPE (±1.416 gambar).

Construction-PPE (Ultralytics, AGPL-3.0) TIDAK dipakai untuk training apa pun. Hanya lima
kelas yang padanannya ada di SH17 yang dinilai:
    helmet -> helmet, gloves -> gloves, vest -> safety-vest, boots -> shoes, goggles -> glasses
Kelas lain (Person, none, no_helmet, ...) dibuang dari GT. Prediksi model tetap 17 kelas
SH17; AP hanya dihitung untuk kelas yang punya GT, jadi prediksi kelas lain tidak dihitung.

Catatan semantik (perlu dibahas di skripsi): "boots" lebih sempit dari "shoes" SH17, dan
"goggles" lebih sempit dari "glasses" SH17 (yang juga mencakup kacamata biasa).

Semua split dipakai karena dataset ini tidak ikut training sama sekali, dan 141 gambar test saja
terlalu sedikit untuk kelas jarang. Sebelum dinilai, gambar yang hampir identik dengan gambar SH17 (pHash <= 6) dibuang,
supaya tidak ada kebocoran antar dataset.

Contoh: python scripts/11_cross_dataset.py zeroshot [model ...]   |   python scripts/11_cross_dataset.py trained
"""
import importlib
import json
import os
import re
import sys
from pathlib import Path

import imagehash
import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).parent))
from common import DATA, RESULTS, ROOT, RUNS, SH17_NAMES, SPLITS, read_list  # noqa: E402
from detmetrics import compute_metrics, load_gt, ultralytics_predictions  # noqa: E402
from evalutil import metrics_to_dict, save_result  # noqa: E402
from telemetry import keep_awake  # noqa: E402

CPPE = DATA / "construction-ppe"
CLASS_MAP = {0: 10, 1: 9, 2: 16, 3: 14, 4: 8}
ZEROSHOT = ["yoloe-26s", "yoloe-26l", "yolov8s-worldv2", "yolov8l-worldv2", "gdino-base", "owlv2-base"]
TRAINED = re.compile(r"^k(10|30)_seed[0-4]_(yoloe-lp|yolo26)s$")
OUT = RESULTS / "runs_cross"


def phash(p):
    with Image.open(p) as im:
        im.draft("L", (256, 256))
        return int(str(imagehash.phash(im.convert("L"))), 16)


def test_images():
    """Semua split Construction-PPE minus gambar yang hampir identik dengan gambar SH17 mana pun."""
    cache = RESULTS / "cross_dataset_images_all.json"
    if cache.exists():
        return json.loads(cache.read_text())["kept"]
    imgs = sorted(str(p) for s in ("train", "val", "test") for p in (CPPE / "images" / s).iterdir())
    sh17 = read_list(SPLITS / "train_official.txt") + read_list(SPLITS / "test.txt")
    hs = np.array([phash(p) for p in sh17], dtype=np.uint64)
    kept, dropped = [], []
    for p in imgs:
        x = np.bitwise_xor(np.uint64(phash(p)), hs)
        d = np.unpackbits(x.view(np.uint8).reshape(-1, 8), axis=1).sum(1)
        (dropped if d.min() <= 6 else kept).append(p)
    cache.write_text(json.dumps({"kept": kept, "dropped": dropped}, indent=1))
    print(f"Construction-PPE: {len(imgs)} gambar, dibuang karena mirip SH17: {len(dropped)}")
    return kept


def trained_checkpoints():
    """Model terlatih yang masuk protokol: k = 10 dan 30, 5 seed, plus YOLO26s data penuh."""
    out = [w for w in sorted((RUNS / "train").glob("*/weights/last.pt")) if TRAINED.match(w.parent.parent.name)]
    full = RUNS / "train" / "full_seed0_yolo26s" / "weights" / "best.pt"
    return out + ([full] if full.exists() else [])


def run_zeroshot(*models):
    zs = importlib.import_module("08_zeroshot_ov")
    imgs = test_images()
    for name in models or ZEROSHOT:
        tag = f"cross_zeroshot_{name}"
        if (OUT / f"{tag}.json").exists():
            continue
        zs.run(name, tag=tag, image_list=imgs, class_map=CLASS_MAP, extra={"dataset": "construction-ppe"})
        OUT.mkdir(parents=True, exist_ok=True)
        (RESULTS / "runs" / f"{tag}.json").replace(OUT / f"{tag}.json")


def run_trained():
    from ultralytics import YOLO, YOLOE
    keep_awake()
    imgs = test_images()
    gt = load_gt(imgs, CLASS_MAP)
    os.chdir(ROOT / "weights")
    for w in trained_checkpoints():
        tag = w.parent.parent.name
        if (OUT / f"cross_{tag}.json").exists():
            continue
        model = (YOLO if "yolo26" in tag else YOLOE)(str(w))
        m = compute_metrics(ultralytics_predictions(model, imgs), gt, SH17_NAMES)
        save_result(metrics_to_dict(m, f"cross_{tag}", {"dataset": "construction-ppe",
                                                       "evaluator": "detmetrics"}), OUT)


if __name__ == "__main__":
    {"zeroshot": run_zeroshot, "trained": run_trained, "images": test_images}[sys.argv[1]](*sys.argv[2:])
