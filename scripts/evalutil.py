"""Evaluasi seragam di test set SH17 untuk semua model, plus pencatatan hasil."""
import json
import sys
import time
from pathlib import Path

import torch

sys.path.insert(0, str(Path(__file__).parent))
from common import PROMPTS, RESULTS, RUNS, SPLITS, VIOLATION_CLASSES, SH17_NAMES, WORKERS, make_yaml  # noqa: E402

IMGSZ = 640  # sama dengan protokol baseline SH17


def eval_yaml(split="test"):
    # 'val' di yaml ini menunjuk ke split evaluasi; train tidak dipakai saat evaluasi.
    t = SPLITS / f"{split}.txt"
    return make_yaml(f"sh17_{split}", t, t, PROMPTS)


def metrics_to_dict(m, tag, extra=None):
    """Ringkas DetMetrics (dari val() maupun detmetrics.compute_metrics) ke format hasil yang sama."""
    per_class = {}
    for i, c in enumerate(m.box.ap_class_index):
        p, r, ap50, ap = m.box.class_result(i)
        per_class[SH17_NAMES[int(c)]] = {"P": round(float(p), 6), "R": round(float(r), 6),
                                         "AP50": round(float(ap50), 6), "AP50-95": round(float(ap), 6)}
    viol = [per_class[c]["R"] for c in VIOLATION_CLASSES if c in per_class]
    return {
        "tag": tag,
        "mAP50": round(float(m.box.map50), 6),
        "mAP50-95": round(float(m.box.map), 6),
        "recall_pelanggaran_mean": round(sum(viol) / len(viol), 6) if viol else None,
        "per_class": per_class,
        **(extra or {}),
    }


def save_result(out, out_dir=None):
    d = out_dir or RESULTS / "runs"
    d.mkdir(parents=True, exist_ok=True)
    (d / f"{out['tag']}.json").write_text(json.dumps(out, indent=2))
    print(f"[{out['tag']}] mAP50={out['mAP50']:.4f}  mAP50-95={out['mAP50-95']:.4f}  "
          f"recall pelanggaran={out['recall_pelanggaran_mean']}")
    return out


def evaluate(model, tag, extra=None, val_kwargs=None, out_dir=None, split="test", imgsz=IMGSZ, batch=8,
             workers=WORKERS):
    """Jalankan val di split evaluasi, simpan mAP50, mAP50-95, AP & recall per kelas.

    Hasil per run ditulis ke results/runs/<tag>.json (6 desimal, supaya uji determinisme
    bisa membandingkan angka persis). rect=False agar hasil tidak bergantung pada susunan
    batch, dan sama dengan mode yang dipakai visual prompt."""
    torch.cuda.reset_peak_memory_stats()
    t0 = time.time()
    m = model.val(data=eval_yaml(split), imgsz=imgsz, batch=batch, workers=workers, rect=False, device=0, plots=False,
                  project=str(RUNS / "val"), name=tag, exist_ok=True, verbose=False,
                  **(val_kwargs or {}))
    elapsed = time.time() - t0

    out = metrics_to_dict(m, tag, {
        "speed_ms_per_img": {k: round(v, 2) for k, v in m.speed.items()},
        "val_time_s": round(elapsed, 1),
        "val_peak_vram_GB": round(torch.cuda.max_memory_reserved() / 1024**3, 2),
        "evaluator": "ultralytics.val", "eval_imgsz": imgsz,
        **(extra or {}),
    })
    return save_result(out, out_dir)
