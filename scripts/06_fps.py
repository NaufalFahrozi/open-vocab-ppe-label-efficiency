"""Ukur kecepatan inferensi (FPS) semua model dengan protokol yang sama.

Protokol: batch 1, FP32, GPU. 220 gambar test (1280 px) dimuat ke memori dulu; 20 pertama
pemanasan, 200 sisanya diukur. Waktu = end-to-end per gambar (pra-proses di CPU + forward
di GPU + pasca-proses), diukur dengan sinkronisasi CUDA. Untuk model Ultralytics juga
dicatat waktu forward saja (speed['inference']).

Gambar dimuat ke memori DULU: kalau JPEG di-decode di sela inferensi, GPU laptop sempat
menganggur dan turun clock, sehingga FPS terukur jauh di bawah kemampuan sebenarnya
(terbukti di uji pertama: ~26 FPS vs ~100 FPS).

Kondisi daya (batas daya GPU, AC, rencana daya) dicatat bersama hasil; idealnya dijalankan
dengan mode Performance Lenovo dan charger terpasang.
"""
import argparse
import json
import os
import sys
import time
from pathlib import Path

import numpy as np
import torch
from PIL import Image

sys.path.insert(0, str(Path(__file__).parent))
from common import PROMPTS, RESULTS, ROOT, RUNS, SPLITS  # noqa: E402
from telemetry import GpuMonitor, keep_awake  # noqa: E402

N_WARMUP, N_MEASURE = 20, 200
HF = {"gdino-tiny": "IDEA-Research/grounding-dino-tiny", "gdino-base": "IDEA-Research/grounding-dino-base",
      "owlv2-base": "google/owlv2-base-patch16-ensemble", "owlv2-large": "google/owlv2-large-patch14-ensemble"}


def ultralytics_fn(name):
    from ultralytics import YOLO, YOLOE, YOLOWorld
    if name.endswith(".pt"):
        m = (YOLOE if "yoloe" in name else YOLO)(str(RUNS / "train" / name.replace("/", os.sep)))
    elif name.startswith("yoloe-26"):
        m = YOLOE(f"{name}.yaml").load(f"{name}-seg.pt")
        m.set_classes(PROMPTS)  # embedding teks dihitung sekali, tidak masuk pengukuran
    else:
        m = YOLOWorld(f"{name}.pt")
        m.set_classes(PROMPTS)
    inf = []

    def fn(im):
        r = m.predict(np.ascontiguousarray(np.asarray(im)[:, :, ::-1]), imgsz=640, device=0, verbose=False)[0]
        inf.append(r.speed["inference"])
    return fn, inf


def hf_fn(name):
    from transformers import AutoProcessor, GroundingDinoForObjectDetection, Owlv2ForObjectDetection
    proc = AutoProcessor.from_pretrained(HF[name])
    cls = GroundingDinoForObjectDetection if name.startswith("gdino") else Owlv2ForObjectDetection
    model = cls.from_pretrained(HF[name]).to("cuda").eval()
    caption = " . ".join(PROMPTS) + " ."

    @torch.inference_mode()
    def fn(im):
        if name.startswith("gdino"):
            out = model(**proc(images=im, text=caption, return_tensors="pt").to("cuda"))
        else:
            out = model(**proc(text=[PROMPTS], images=im, return_tensors="pt").to("cuda"))
        out.logits[0].sigmoid().flatten().topk(300)
    return fn, None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", required=True, help="nama model zero-shot, atau <run>/weights/last.pt")
    ap.add_argument("--tag", required=True)
    a = ap.parse_args()
    keep_awake()
    paths = [l.strip() for l in open(SPLITS / "test.txt") if l.strip()][: N_WARMUP + N_MEASURE]
    frames = [Image.open(p).convert("RGB") for p in paths]
    os.chdir(ROOT / "weights")
    fn, inf = hf_fn(a.model) if a.model in HF else ultralytics_fn(a.model)

    times = []
    with GpuMonitor(interval=0.5) as mon:
        for i, im in enumerate(frames):
            torch.cuda.synchronize()
            t0 = time.perf_counter()
            fn(im)
            torch.cuda.synchronize()
            if i >= N_WARMUP:
                times.append(1000 * (time.perf_counter() - t0))
    e2e = float(np.mean(times))
    out = {"tag": a.tag, "model": a.model, "e2e_ms": round(e2e, 2), "fps_e2e": round(1000 / e2e, 1),
           "e2e_ms_p95": round(float(np.percentile(times, 95)), 2), "n_images": len(times),
           "telemetry": mon.summary()}
    if inf:
        f = float(np.mean(inf[N_WARMUP:]))
        out.update({"forward_ms": round(f, 2), "fps_forward": round(1000 / f, 1)})
    d = RESULTS / "runs_fps"
    d.mkdir(parents=True, exist_ok=True)
    (d / f"{a.tag}.json").write_text(json.dumps(out, indent=2))
    print(out)


if __name__ == "__main__":
    main()
