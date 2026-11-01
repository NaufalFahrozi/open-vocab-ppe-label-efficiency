"""Ablation deteksi pelanggaran "kepala tanpa helm": prompt negasi vs deteksi + aturan asosiasi.

SH17 tidak punya kelas "kepala tanpa helm". Dari analisis label train, kotak head dibuat
untuk SEMUA kepala (79% helm berada di dalam kotak head). Jadi GT pelanggaran diturunkan:
    kepala tanpa helm = kotak head GT yang tidak berisi kotak helmet GT
                        (luas helm yang berada di dalam kotak head < 50% luas helm).

Dua pendekatan yang dibandingkan:
A. Aturan asosiasi: model mendeteksi head dan helmet (17 kelas biasa). Untuk setiap prediksi
   head dengan skor s_h, ambil skor helm tertinggi s_m di antara prediksi helmet yang >= 50%
   luasnya berada di dalam kotak head itu. Skor pelanggaran = s_h * (1 - s_m).
B. Prompt negasi: model open-vocabulary langsung diberi prompt "head without helmet" atau
   "bare head" (satu kelas).
Keduanya dinilai dengan evaluator terpadu terhadap GT turunan di atas (AP50, AP50-95).

Construction-PPE punya label pelanggaran asli (no_helmet, no_gloves), jadi di sana GT tidak perlu
diturunkan. no_helmet: aturan asosiasi vs prompt negasi. no_gloves: kelas hands (= tangan telanjang
di SH17) vs prompt "hand without gloves". Sebelum dipakai, `12_violation.py cek` menggambar contoh
kotak no_helmet untuk memastikan ukurannya memang seukuran kepala, karena aturan asosiasi
membandingkan kotak kepala.

Catatan untuk pembahasan: banyak gambar SH17 bukan lokasi wajib helm (kantor, lab), jadi
"kepala tanpa helm" di sini adalah tugas deteksi, belum tentu pelanggaran sesungguhnya.
"""
import importlib
import os
import re
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).parent))
from common import PROMPTS, RESULTS, ROOT, RUNS, SH17_NAMES, SPLITS  # noqa: E402
from detmetrics import compute_metrics, load_gt, ultralytics_predictions  # noqa: E402
from evalutil import save_result  # noqa: E402
from telemetry import keep_awake  # noqa: E402

HEAD, HELMET, HANDS = SH17_NAMES.index("head"), SH17_NAMES.index("helmet"), SH17_NAMES.index("hands")
CPPE_NO_HELMET, CPPE_NO_GLOVES = 7, 9
OUT = RESULTS / "runs_violation"
NAMES = ["kepala tanpa helm"]


def ioa(heads, helmets):
    """Fraksi luas tiap helm yang berada di dalam tiap kepala -> [n_head, n_helmet]."""
    x1 = np.maximum(heads[:, None, 0], helmets[None, :, 0])
    y1 = np.maximum(heads[:, None, 1], helmets[None, :, 1])
    x2 = np.minimum(heads[:, None, 2], helmets[None, :, 2])
    y2 = np.minimum(heads[:, None, 3], helmets[None, :, 3])
    inter = np.clip(x2 - x1, 0, None) * np.clip(y2 - y1, 0, None)
    area = (helmets[:, 2] - helmets[:, 0]) * (helmets[:, 3] - helmets[:, 1])
    return inter / np.maximum(area[None, :], 1e-9)


def bare_head_gt(images):
    gt = {}
    for p, (boxes, cls, wh) in load_gt(images).items():
        heads, helmets = boxes[cls == HEAD], boxes[cls == HELMET]
        bare = heads if len(helmets) == 0 else heads[(ioa(heads, helmets) >= 0.5).sum(1) == 0]
        gt[p] = (bare, np.zeros(len(bare), dtype=np.float32), wh)
    return gt


def rule_predictions(preds):
    """Aturan asosiasi pada prediksi 17 kelas -> prediksi 1 kelas 'kepala tanpa helm'."""
    out = {}
    for p, (boxes, scores, cls) in preds.items():
        h, m = cls == HEAD, cls == HELMET
        hb, hs = boxes[h], scores[h]
        if m.any() and len(hb):
            inside = ioa(hb, boxes[m]) >= 0.5
            sm = np.where(inside, scores[m][None, :], 0).max(1)
        else:
            sm = np.zeros(len(hb))
        out[p] = (hb, hs * (1 - sm), np.zeros(len(hb), dtype=np.float32))
    return out


def load_npz(tag):
    d = np.load(RESULTS / "preds" / f"{tag}.npz")
    root = SPLITS / "test.txt"
    paths = {Path(l.strip()).name: l.strip() for l in open(root) if l.strip()}
    return {paths[k]: (v[:, :4], v[:, 4], v[:, 5]) for k, v in d.items()}


def score(preds, gt, tag, extra):
    m = compute_metrics(preds, gt, NAMES)
    p, r, ap50, ap = (float(x) for x in m.box.class_result(0))
    return save_result({"tag": tag, "mAP50": round(ap50, 6), "mAP50-95": round(ap, 6),
                        "P": round(p, 6), "R": round(r, 6), "recall_pelanggaran_mean": None,
                        "per_class": {}, **extra}, OUT)


def cross_mod():
    return importlib.import_module("11_cross_dataset")


def cek_no_helmet():
    """Lembar contoh kotak no_helmet dan statistik ukurannya dibanding kotak helmet."""
    from PIL import Image, ImageDraw
    images = cross_mod().test_images()
    gt = load_gt(images, {CPPE_NO_HELMET: 0, 0: 1})
    rel = {0: [], 1: []}
    contoh = []
    for p, (boxes, cls, (w, h)) in gt.items():
        for b, c in zip(boxes, cls):
            rel[int(c)].append(((b[2] - b[0]) * (b[3] - b[1])) / (w * h))
        if (cls == 0).any():
            contoh.append(p)
    print(f"Median luas relatif no_helmet {np.median(rel[0]):.5f} ({len(rel[0])} kotak), "
          f"helmet {np.median(rel[1]):.5f} ({len(rel[1])} kotak)")
    sheet = Image.new("RGB", (6 * 300, 3 * 300), "white")
    step = max(len(contoh) // 18, 1)
    for n, p in enumerate(contoh[::step][:18]):
        im = Image.open(p).convert("RGB")
        d = ImageDraw.Draw(im)
        boxes, cls, _ = gt[p]
        for b in boxes[cls == 0]:
            d.rectangle([float(x) for x in b], outline="red", width=max(im.width // 200, 2))
        im.thumbnail((296, 296))
        sheet.paste(im, ((n % 6) * 300, (n // 6) * 300))
    sheet.save(RESULTS / "hasil" / "cek_no_helmet.jpg", quality=85)


def hands_predictions(preds):
    out = {}
    for p, (boxes, scores, cls) in preds.items():
        h = cls == HANDS
        out[p] = (boxes[h], scores[h], np.zeros(int(h.sum()), dtype=np.float32))
    return out


def run_cppe():
    """Pelanggaran dengan GT asli Construction-PPE; semua split, sama dengan uji lintas dataset."""
    from ultralytics import YOLO, YOLOE
    images = cross_mod().test_images()
    zs_mod = importlib.import_module("08_zeroshot_ov")
    gts = {"no_helmet": load_gt(images, {CPPE_NO_HELMET: 0}), "no_gloves": load_gt(images, {CPPE_NO_GLOVES: 0})}
    extra = {k: {"n_gt": sum(len(v[0]) for v in g.values()), "dataset": "construction-ppe", "pelanggaran": k}
             for k, g in gts.items()}
    fungsi = {"no_helmet": ("aturan asosiasi", rule_predictions), "no_gloves": ("kelas hands", hands_predictions)}

    def nilai(sumber, label):
        tags = {k: f"cppe_{k}_{label}" for k in fungsi}
        if all((OUT / f"{t}.json").exists() for t in tags.values()):
            return
        preds = sumber()
        for k, (pendekatan, f) in fungsi.items():
            score(f(preds), gts[k], tags[k], {**extra[k], "pendekatan": pendekatan, "model": label})

    for name in ["yoloe-26s", "yoloe-26l"]:
        nilai(lambda: zs_mod.predictions(name, images, list(PROMPTS)), f"zeroshot_{name}")
    os.chdir(ROOT / "weights")
    for w in cross_mod().trained_checkpoints():
        run = w.parent.parent.name
        if run.startswith("k30"):
            continue
        nilai(lambda: ultralytics_predictions((YOLO if "yolo26" in run else YOLOE)(str(w)), images), run)
    for name in ["yoloe-26s", "yoloe-26l"]:
        for k, prompt in [("no_helmet", "head without helmet"), ("no_helmet", "bare head"),
                          ("no_gloves", "hand without gloves")]:
            tag = f"cppe_{k}_negasi_{name}_{prompt.replace(' ', '-')}"
            if not (OUT / f"{tag}.json").exists():
                score(zs_mod.predictions(name, images, [prompt]), gts[k], tag,
                      {**extra[k], "pendekatan": "prompt negasi", "model": name, "prompt": prompt})


def run_negasi_ov():
    """Tahap 4: prompt negasi Grounding DINO-B dan OWLv2-B, di SH17 (GT turunan) dan Construction-PPE (GT asli)."""
    keep_awake()
    zs_mod = importlib.import_module("08_zeroshot_ov")
    sh17 = [l.strip() for l in open(SPLITS / "test.txt") if l.strip()]
    cppe = cross_mod().test_images()
    gt_sh17, gt_helm = bare_head_gt(sh17), load_gt(cppe, {CPPE_NO_HELMET: 0})
    gt_glove = load_gt(cppe, {CPPE_NO_GLOVES: 0})
    jobs = [("negasi", sh17, gt_sh17, "head without helmet", {}), ("negasi", sh17, gt_sh17, "bare head", {}),
            ("cppe_no_helmet_negasi", cppe, gt_helm, "head without helmet", {"pelanggaran": "no_helmet"}),
            ("cppe_no_helmet_negasi", cppe, gt_helm, "bare head", {"pelanggaran": "no_helmet"}),
            ("cppe_no_gloves_negasi", cppe, gt_glove, "hand without gloves", {"pelanggaran": "no_gloves"})]
    for name in ["gdino-base", "owlv2-base"]:
        for prefix, imgs, gt, prompt, extra in jobs:
            tag = f"{prefix}_{name}_{prompt.replace(' ', '-')}"
            if not (OUT / f"{tag}.json").exists():
                score(zs_mod.predictions(name, imgs, [prompt]), gt, tag,
                      {"n_gt": sum(len(v[0]) for v in gt.values()), "pendekatan": "prompt negasi", "model": name,
                       "prompt": prompt, "skenario": "zero-shot", **extra})


def main():
    keep_awake()
    images = [l.strip() for l in open(SPLITS / "test.txt") if l.strip()]
    gt = bare_head_gt(images)
    n_bare = sum(len(v[0]) for v in gt.values())
    print(f"GT kepala tanpa helm: {n_bare} kotak di {sum(len(v[0]) > 0 for v in gt.values())} gambar")
    base = {"n_gt": n_bare}

    # A. aturan asosiasi pada prediksi zero-shot yang sudah tersimpan
    for zs in ["yoloe-26s", "yoloe-26l", "gdino-tiny", "gdino-base", "owlv2-base"]:
        tag = f"rule_zeroshot_{zs}"
        src = f"zeroshot_det_{zs}" if zs.startswith("yoloe") else f"zeroshot_{zs}"  # YOLOE utama lewat val(), tanpa npz
        if not (OUT / f"{tag}.json").exists() and (RESULTS / "preds" / f"{src}.npz").exists():
            score(rule_predictions(load_npz(src)), gt, tag,
                  {**base, "pendekatan": "aturan asosiasi", "model": zs, "skenario": "zero-shot"})

    # A. aturan asosiasi pada model hasil training (10-shot semua seed, dan data penuh)
    from ultralytics import YOLO, YOLOE
    os.chdir(ROOT / "weights")
    ckpts = sorted((RUNS / "train").glob("k10_seed*/weights/last.pt")) + \
        sorted((RUNS / "train").glob("full_seed0_yolo26s/weights/best.pt"))
    for w in ckpts:
        name = w.parent.parent.name
        tag = f"rule_{name}"
        # hanya run protokol: run uji jadwal (akhiran _jadwalX) memakai jadwal yang belum tentu terpilih
        if not re.fullmatch(r"(k10_seed\d_(yoloe-lp|yolo26)s|full_seed0_yolo26s)", name) or (OUT / f"{tag}.json").exists():
            continue
        model = (YOLO if "yolo26" in name else YOLOE)(str(w))
        score(rule_predictions(ultralytics_predictions(model, images)), gt, tag,
              {**base, "pendekatan": "aturan asosiasi", "model": name})

    # B. prompt negasi (satu kelas), zero-shot. YOLOE di sini; Grounding DINO dan OWLv2 di Tahap 4 (run_negasi_ov).
    zs_mod = importlib.import_module("08_zeroshot_ov")
    for model_name in ["yoloe-26s", "yoloe-26l"]:
        for prompt in ["head without helmet", "bare head"]:
            tag = f"negasi_{model_name}_{prompt.replace(' ', '-')}"
            if (OUT / f"{tag}.json").exists():
                continue
            preds = zs_mod.predictions(model_name, images, [prompt])
            score(preds, gt, tag, {**base, "pendekatan": "prompt negasi", "model": model_name,
                                   "prompt": prompt, "skenario": "zero-shot"})
    run_cppe()


if __name__ == "__main__":
    {"cek": cek_no_helmet, "negasi-ov": run_negasi_ov}.get(next(iter(sys.argv[1:]), ""), main)()
