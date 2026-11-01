"""Zero-shot semua model open-vocabulary dengan prompt teks yang SAMA, dinilai evaluator terpadu.

Model:
- yoloe-26{n,s,m,l,x} : Ultralytics, head deteksi dari bobot seg (lihat 03_zeroshot_yoloe.py)
- yolo-world-v2 s/l   : Ultralytics yolov8{s,l}-worldv2.pt (encoder teks CLIP ViT-B/32)
- grounding-dino t/b  : Hugging Face IDEA-Research/grounding-dino-{tiny,base}
- owlv2 base/large    : Hugging Face google/owlv2-{base-patch16,large-patch14}-ensemble

Cara mengubah keluaran tiap model menjadi skor per kelas (agar adil, semua multi-label,
300 pasangan kotak-kelas teratas per gambar, sama seperti val() Ultralytics):
- Grounding DINO: prompt tunggal "person . ear . earmuffs . ..." (format resmi). Skor kelas =
  rata-rata probabilitas token-token frasa kelas itu, sama dengan evaluasi COCO resmi
  Grounding DINO (positive map dinormalisasi).
- OWLv2: satu query teks per kelas; skor = sigmoid logit kelas. Kotak OWLv2 relatif terhadap
  gambar yang sudah di-pad menjadi persegi (pad kanan/bawah), jadi dikali sisi terpanjang.

Contoh: python scripts/08_zeroshot_ov.py --model gdino-tiny
"""
import argparse
import os
import sys
import time
from pathlib import Path

import numpy as np
import torch
from PIL import Image

sys.path.insert(0, str(Path(__file__).parent))
from common import PROMPTS, RESULTS, ROOT, SH17_NAMES, SPLITS  # noqa: E402
from detmetrics import MAX_DET, compute_metrics, load_gt, ultralytics_predictions  # noqa: E402
from evalutil import metrics_to_dict, save_result  # noqa: E402
from telemetry import GpuMonitor, keep_awake  # noqa: E402

HF = {
    "gdino-tiny": "IDEA-Research/grounding-dino-tiny",
    "gdino-base": "IDEA-Research/grounding-dino-base",
    "owlv2-base": "google/owlv2-base-patch16-ensemble",
    "owlv2-large": "google/owlv2-large-patch14-ensemble",
}


def topk_multilabel(scores, boxes, k=MAX_DET):
    """scores [Q, C], boxes [Q, 4] -> k pasangan (kotak, kelas) dengan skor tertinggi."""
    flat = scores.flatten()
    k = min(k, flat.numel())
    s, idx = flat.topk(k)
    q, c = idx // scores.shape[1], idx % scores.shape[1]
    return boxes[q].cpu().numpy(), s.cpu().numpy(), c.cpu().numpy().astype(np.float32)


def cxcywh_to_xyxy(b, sx, sy):
    cx, cy, w, h = b.unbind(-1)
    return torch.stack([(cx - w / 2) * sx, (cy - h / 2) * sy, (cx + w / 2) * sx, (cy + h / 2) * sy], -1)


@torch.inference_mode()
def gdino_predictions(mid, images, prompts):
    from transformers import AutoProcessor, GroundingDinoForObjectDetection
    proc = AutoProcessor.from_pretrained(mid)
    model = GroundingDinoForObjectDetection.from_pretrained(mid).to("cuda").eval()
    caption = " . ".join(p.lower() for p in prompts) + " ."
    tok = proc.tokenizer(caption, return_offsets_mapping=True)
    spans, pos = [], 0
    for p in prompts:
        start = caption.index(p.lower(), pos)
        spans.append((start, start + len(p)))
        pos = start + len(p)
    pos_map = None
    preds = {}
    for path in images:
        im = Image.open(path).convert("RGB")
        w, h = im.size
        inputs = proc(images=im, text=caption, return_tensors="pt").to("cuda")
        assert inputs["input_ids"][0].tolist() == tok["input_ids"], "tokenisasi caption tidak konsisten"
        out = model(**inputs)
        prob = out.logits[0].sigmoid()  # [900 query, panjang teks]
        if pos_map is None:
            pos_map = torch.zeros(len(prompts), prob.shape[1], device="cuda")
            for c, (s, e) in enumerate(spans):
                toks = [j for j, (a, b) in enumerate(tok["offset_mapping"]) if b > a and a >= s and b <= e]
                pos_map[c, toks] = 1.0 / len(toks)
        scores = prob @ pos_map.T  # [900, C]
        boxes = cxcywh_to_xyxy(out.pred_boxes[0], w, h)
        preds[str(path)] = topk_multilabel(scores, boxes)
    return preds


@torch.inference_mode()
def owlv2_predictions(mid, images, prompts):
    from transformers import Owlv2ForObjectDetection, Owlv2Processor
    proc = Owlv2Processor.from_pretrained(mid)
    model = Owlv2ForObjectDetection.from_pretrained(mid).to("cuda").eval()
    preds = {}
    for path in images:
        im = Image.open(path).convert("RGB")
        w, h = im.size
        inputs = proc(text=[prompts], images=im, return_tensors="pt").to("cuda")
        out = model(**inputs)
        scores = out.logits[0].sigmoid()  # [patch, C]
        s = max(w, h)  # kotak relatif terhadap gambar persegi hasil padding kanan/bawah
        boxes = cxcywh_to_xyxy(out.pred_boxes[0], s, s)
        boxes[:, 0::2] = boxes[:, 0::2].clamp(0, w)
        boxes[:, 1::2] = boxes[:, 1::2].clamp(0, h)
        preds[str(path)] = topk_multilabel(scores, boxes)
    return preds


def predictions(name, images, prompts, imgsz=640):
    os.chdir(ROOT / "weights")
    if name.startswith("yoloe-26"):
        from ultralytics import YOLOE
        m = YOLOE(f"{name}.yaml").load(f"{name}-seg.pt")
        m.set_classes(prompts)
        return ultralytics_predictions(m, images, imgsz)
    if name.startswith("yolov8"):  # YOLO-World v2, mis. yolov8s-worldv2
        from ultralytics import YOLOWorld
        m = YOLOWorld(f"{name}.pt")
        m.set_classes(prompts)
        return ultralytics_predictions(m, images, imgsz)
    if name.startswith("gdino"):
        return gdino_predictions(HF[name], images, prompts)
    if name.startswith("owlv2"):
        return owlv2_predictions(HF[name], images, prompts)
    raise ValueError(name)


def run(name, prompts=PROMPTS, tag=None, image_list=None, class_map=None, names=SH17_NAMES, extra=None):
    keep_awake()
    images = image_list or [l.strip() for l in open(SPLITS / "test.txt") if l.strip()]
    tag = tag or f"zeroshot_{name}"
    gt = load_gt(images, class_map)
    torch.cuda.reset_peak_memory_stats()
    t0 = time.time()
    with GpuMonitor() as mon:
        preds = predictions(name, images, prompts)
    elapsed = time.time() - t0
    pdir = RESULTS / "preds"
    pdir.mkdir(parents=True, exist_ok=True)
    np.savez_compressed(pdir / f"{tag}.npz", **{Path(k).name: np.concatenate(
        [v[0], v[1][:, None], v[2][:, None]], 1).astype(np.float32) for k, v in preds.items()})
    m = compute_metrics(preds, gt, names)
    return save_result(metrics_to_dict(m, tag, {
        "model": name, "skenario": "zero-shot", "prompts": list(prompts), "evaluator": "detmetrics",
        "n_images": len(images), "infer_time_s": round(elapsed, 1),
        "infer_ms_per_img_incl_io": round(1000 * elapsed / len(images), 1),
        "infer_peak_vram_GB": round(torch.cuda.max_memory_reserved() / 1024**3, 2),
        "telemetry": mon.summary(), **(extra or {}),
    }))


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", required=True)
    ap.add_argument("--tag", default=None)
    ap.add_argument("--limit", type=int, default=0, help="uji cepat dengan N gambar pertama")
    a = ap.parse_args()
    imgs = [l.strip() for l in open(SPLITS / "test.txt") if l.strip()]
    run(a.model, image_list=imgs[: a.limit] if a.limit else None,
        tag=(a.tag or f"zeroshot_{a.model}") + (f"_limit{a.limit}" if a.limit else ""))
