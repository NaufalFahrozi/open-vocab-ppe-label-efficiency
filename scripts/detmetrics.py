"""Evaluator terpadu untuk prediksi dari model APA PUN (Ultralytics, Hugging Face, dll.).

Agar angka Grounding DINO / OWLv2 bisa dibandingkan langsung dengan YOLO, evaluator ini
tidak menulis ulang rumus mAP, tetapi memanggil komponen Ultralytics apa adanya:
- BaseValidator.match_predictions : pencocokan prediksi-GT per ambang IoU 0,50:0,95
- box_iou                         : IoU antar kotak
- DetMetrics / ap_per_class       : kurva PR, AP (interpolasi 101 titik), P & R pada F1 maksimum
Pengaturan sama dengan `model.val()`: maksimal 300 deteksi per gambar, confidence >= 0,001.
Kesetaraannya diuji dengan memasukkan prediksi YOLOE-26s dan membandingkan dengan val().
"""
from pathlib import Path

import numpy as np
import torch
from PIL import Image

from ultralytics.data.utils import img2label_paths
from ultralytics.engine.validator import BaseValidator
from ultralytics.utils.metrics import DetMetrics, box_iou

MAX_DET, MIN_CONF = 300, 0.001


class _Matcher:
    iouv = torch.linspace(0.5, 0.95, 10)
    match_predictions = BaseValidator.match_predictions


def load_gt(image_list, class_map=None):
    """GT per gambar dalam piksel xyxy. class_map: {kelas_asal: kelas_tujuan}; kelas lain dibuang."""
    gt = {}
    for p in image_list:
        p = Path(p)
        with Image.open(p) as im:
            w, h = im.size
        lp = Path(img2label_paths([str(p)])[0])  # images/x.jpg (SH17) dan images/test/x.jpg (Construction-PPE)
        rows = np.array([r.split() for r in lp.read_text().splitlines() if r.strip()], dtype=np.float64) \
            if lp.exists() else np.zeros((0, 5))
        rows = rows.reshape(-1, 5)
        cls = rows[:, 0].astype(int)
        if class_map is not None:
            keep = np.isin(cls, list(class_map))
            rows, cls = rows[keep], np.array([class_map[c] for c in cls[keep]], dtype=int)
        cx, cy, bw, bh = rows[:, 1] * w, rows[:, 2] * h, rows[:, 3] * w, rows[:, 4] * h
        boxes = np.stack([cx - bw / 2, cy - bh / 2, cx + bw / 2, cy + bh / 2], 1)
        gt[str(p)] = (boxes.astype(np.float32), cls.astype(np.float32), (w, h))
    return gt


def compute_metrics(preds, gt, names):
    """preds: {path: (boxes_xyxy[N,4], scores[N], cls[N])}. Mengembalikan DetMetrics yang sudah diproses."""
    m = DetMetrics(names=dict(enumerate(names)))
    for img, (gboxes, gcls, _) in gt.items():
        pb, ps, pc = preds.get(img, (np.zeros((0, 4)), np.zeros(0), np.zeros(0)))
        order = np.argsort(-ps, kind="stable")[:MAX_DET]
        order = order[ps[order] >= MIN_CONF]
        pb, ps, pc = pb[order], ps[order].astype(np.float32), pc[order].astype(np.float32)
        if len(gcls) == 0 or len(pc) == 0:
            tp = np.zeros((len(pc), 10), dtype=bool)
        else:
            iou = box_iou(torch.from_numpy(gboxes), torch.from_numpy(pb.astype(np.float32)))
            tp = _Matcher().match_predictions(torch.from_numpy(pc), torch.from_numpy(gcls), iou).numpy()
        m.update_stats({"tp": tp, "conf": ps, "pred_cls": pc, "target_cls": gcls,
                        "target_img": np.unique(gcls), "im_name": Path(img).name})
    m.process()
    return m


def ultralytics_predictions(model, image_list, imgsz=640, batch=16):
    """Prediksi model Ultralytics dengan pengaturan setara val(rect=False)."""
    preds = {}
    for i in range(0, len(image_list), batch):
        chunk = image_list[i:i + batch]
        for p, r in zip(chunk, model.predict(chunk, imgsz=imgsz, conf=MIN_CONF, max_det=MAX_DET,
                                             device=0, verbose=False, half=False, rect=False)):
            b = r.boxes
            preds[str(p)] = (b.xyxy.cpu().numpy(), b.conf.cpu().numpy(), b.cls.cpu().numpy())
    return preds
