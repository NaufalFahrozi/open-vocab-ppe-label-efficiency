"""Zero-shot YOLOE-26 dan YOLO-World lewat val() Ultralytics, dengan prompt teks nama kelas.

Bobot rilis YOLOE-26 semuanya model segmentasi (yoloe-26*-seg.pt). Karena SH17 hanya punya
bounding box, kita bangun versi deteksi dari yaml-nya lalu muat bobot seg dengan skala sama
(resep resmi di dokumentasi Ultralytics). Cabang mask dibuang.

Validator YOLOE otomatis mengubah nama kelas di data yaml (= PROMPTS di common.py) menjadi
embedding teks MobileCLIP2. YOLO-World perlu set_classes dulu (encoder teks CLIP ViT-B/32).

Contoh: python scripts/03_zeroshot_yoloe.py --model yoloe-26s --imgsz 1280
"""
import argparse
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from common import PROMPTS, ROOT  # noqa: E402
from evalutil import IMGSZ, evaluate  # noqa: E402

from ultralytics import YOLOE, YOLOWorld


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", default="yoloe-26s", help="yoloe-26{n,s,m,l,x} atau yolov8{s,m,l,x}-worldv2")
    ap.add_argument("--imgsz", type=int, default=IMGSZ)
    ap.add_argument("--batch", type=int, default=8)
    a = ap.parse_args()

    os.chdir(ROOT / "weights")  # bobot & encoder teks diunduh/dibaca di sini
    if a.model.startswith("yoloe-26"):
        model = YOLOE(f"{a.model}.yaml").load(f"{a.model}-seg.pt")
    else:
        model = YOLOWorld(f"{a.model}.pt")
        model.set_classes(list(PROMPTS))
    tag = f"zeroshot_{a.model}" + (f"_{a.imgsz}" if a.imgsz != IMGSZ else "")
    evaluate(model, tag, imgsz=a.imgsz, batch=a.batch,
             extra={"model": a.model, "skenario": "zero-shot", "imgsz": a.imgsz})


if __name__ == "__main__":
    main()
