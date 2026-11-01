"""Ablation prompt teks untuk YOLOE-26 zero-shot (semua varian dinilai evaluator terpadu).

Varian ditetapkan SEBELUM melihat hasil test. Hasil utama penelitian tetap memakai
"rapi" (nama kelas apa adanya) agar tidak ada pemilihan prompt berdasarkan test set;
tabel ini hanya analisis sensitivitas.

- asli       : nama persis dari sh17.yaml (ear-mufs, face-guard, ...)
- rapi       : '-' jadi spasi, typo ear-mufs dibetulkan (prompt utama, = common.PROMPTS)
- deskriptif : frasa yang menjelaskan semantik label SH17. Berdasarkan analisis tumpang
               tindih label TRAIN: tangan bersarung tangan dilabeli gloves (jadi hands =
               tangan telanjang), telinga tertutup earmuff tidak dilabeli ear, dst.
- template   : "a photo of a {rapi}" (template gaya CLIP)
- ensemble   : rata-rata embedding teks rapi + deskriptif + template (prompt ensembling)
"""
import os
import sys
from pathlib import Path

import torch

sys.path.insert(0, str(Path(__file__).parent))
from common import PROMPTS, ROOT, SH17_NAMES, SPLITS  # noqa: E402
from detmetrics import compute_metrics, load_gt, ultralytics_predictions  # noqa: E402
from evalutil import metrics_to_dict, save_result  # noqa: E402
from telemetry import keep_awake  # noqa: E402

from ultralytics import YOLOE

DESKRIPTIF = {
    "person": "person", "ear": "human ear", "ear-mufs": "ear protection earmuffs", "face": "human face",
    "face-guard": "face shield", "face-mask": "medical face mask", "foot": "bare foot",
    "tool": "hand tool", "glasses": "glasses", "gloves": "protective gloves", "helmet": "safety helmet",
    "hands": "bare hand", "head": "human head", "medical-suit": "medical scrubs",
    "shoes": "shoes", "safety-suit": "protective coverall", "safety-vest": "high visibility safety vest",
}
VARIANTS = {
    "asli": list(SH17_NAMES),
    "rapi": list(PROMPTS),
    "deskriptif": [DESKRIPTIF[n] for n in SH17_NAMES],
    "template": [f"a photo of a {p}" for p in PROMPTS],
}


def main(size="s"):
    keep_awake()
    os.chdir(ROOT / "weights")
    images = [l.strip() for l in open(SPLITS / "test.txt") if l.strip()]
    gt = load_gt(images)
    model = YOLOE(f"yoloe-26{size}.yaml").load(f"yoloe-26{size}-seg.pt")
    pes = {}
    for name, prompts in [*VARIANTS.items(), ("ensemble", None)]:
        if name == "ensemble":
            pe = torch.stack([pes["rapi"], pes["deskriptif"], pes["template"]]).mean(0)
            pe = torch.nn.functional.normalize(pe, dim=-1) * pes["rapi"].norm(dim=-1, keepdim=True)
            model.set_classes(list(PROMPTS), pe)
        else:
            pes[name] = model.get_text_pe(prompts)
            model.set_classes(prompts, pes[name])
        m = compute_metrics(ultralytics_predictions(model, images), gt, SH17_NAMES)
        save_result(metrics_to_dict(m, f"prompt_yoloe26{size}_{name}", {
            "model": f"yoloe-26{size}", "skenario": "zero-shot", "prompt_variant": name,
            "prompts": prompts or "mean(rapi, deskriptif, template)", "evaluator": "detmetrics"}))


if __name__ == "__main__":
    main(*(sys.argv[1:2] or ["s"]))
