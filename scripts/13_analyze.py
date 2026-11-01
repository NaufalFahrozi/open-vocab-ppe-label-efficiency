"""Analisis semua hasil: tabel mean ± 95% CI, uji berpasangan, grafik, ringkasan Markdown.

Statistik (protokol TFA, Wang dkk. 2020): untuk setiap k, 5 seed menghasilkan 5 sampel
k-shot berbeda. Dilaporkan rata-rata ± setengah lebar 95% CI distribusi t (df = n-1).
Perbandingan antar metode memakai selisih BERPASANGAN per seed (sampel gambar sama),
dengan 95% CI selisih dan uji t berpasangan.

Bisa dijalankan kapan saja; hasil yang belum ada dilewati.
Keluaran: results/hasil/ringkasan.md dan results/hasil/*.png
"""
import json
import math
import sys
from pathlib import Path

import numpy as np
from scipy import stats

sys.path.insert(0, str(Path(__file__).parent))
from common import CLASS_GROUPS, RESULTS, SH17_NAMES, SPLITS, VIOLATION_CLASSES  # noqa: E402

OUT = RESULTS / "hasil"
KS = [1, 5, 10, 30, 100]
METHODS = {  # urutan = urutan warna kategorikal (palet tervalidasi untuk garis bersebelahan)
    "yoloe-vp": "YOLOE-26s visual prompt (tanpa training)",
    "yoloe-lp": "YOLOE-26s linear probing",
    "yoloe-ft": "YOLOE-26s fine-tune penuh",
    "yolow-ft": "YOLO-World-v2 S fine-tune penuh",
    "yolo26": "YOLO26s fine-tune penuh",
}
COLORS = {"yoloe-vp": "#2a78d6", "yoloe-lp": "#eb6834", "yoloe-ft": "#1baf7a", "yolow-ft": "#8e5bd0", "yolo26": "#eda100"}
MARKERS = {"yoloe-vp": "o", "yoloe-lp": "s", "yoloe-ft": "^", "yolow-ft": "v", "yolo26": "D"}
SURFACE, INK, INK2, GRID = "#fcfcfb", "#0b0b0b", "#52514e", "#e4e3df"
ZS_NAMES = {
    "yoloe-26n": "YOLOE-26n", "yoloe-26s": "YOLOE-26s", "yoloe-26m": "YOLOE-26m", "yoloe-26l": "YOLOE-26l",
    "yoloe-26x": "YOLOE-26x", "yolov8s-worldv2": "YOLO-World-v2 S", "yolov8m-worldv2": "YOLO-World-v2 M",
    "yolov8l-worldv2": "YOLO-World-v2 L", "yolov8x-worldv2": "YOLO-World-v2 X",
    "gdino-tiny": "Grounding DINO T", "gdino-base": "Grounding DINO B",
    "owlv2-base": "OWLv2 B/16", "owlv2-large": "OWLv2 L/14",
}


def load(d):
    p = RESULTS / d
    return {f.stem: json.loads(f.read_text()) for f in sorted(p.glob("*.json"))} if p.exists() else {}


def viol(r):
    """Recall pelanggaran dihitung ulang dari R per kelas dengan definisi terbaru (common.py)."""
    v = [r["per_class"][c]["R"] for c in VIOLATION_CLASSES if c in r.get("per_class", {})]
    return sum(v) / len(v) if v else float("nan")


def num(x, d=1, scale=100):
    """Angka gaya Indonesia: koma desimal."""
    if x is None or (isinstance(x, float) and math.isnan(x)):
        return "–"
    return f"{x * scale:.{d}f}".replace(".", ",")


def ci(xs):
    xs = np.asarray(xs, dtype=float)
    n = len(xs)
    if n < 2:
        return float(xs.mean()) if n else float("nan"), float("nan"), n
    h = stats.t.ppf(0.975, n - 1) * xs.std(ddof=1) / math.sqrt(n)
    return float(xs.mean()), float(h), n


def mci(xs, d=1):
    m, h, n = ci(xs)
    if n == 0:
        return "–"
    return num(m, d) if math.isnan(h) else f"{num(m, d)} ± {num(h, d)}"


def table(header, rows):
    out = ["| " + " | ".join(header) + " |", "|" + "---|" * len(header)]
    out += ["| " + " | ".join(str(c) for c in r) + " |" for r in rows]
    return "\n".join(out)


def fewshot(runs):
    """{(method, k): {seed: result}}"""
    res = {}
    for tag, r in runs.items():
        parts = tag.split("_")
        if not tag.startswith("k") or len(parts) != 3 or "rep" in tag:
            continue
        k, seed, meth = int(parts[0][1:]), int(parts[1][4:]), parts[2][:-1]  # buang akhiran ukuran 's'
        res.setdefault((meth, k), {})[seed] = r
    return res


def group_ap(r, group):
    """Rata-rata AP50 satu kelompok kelas; kelas tanpa hasil dihitung 0."""
    return sum(r["per_class"].get(c, {}).get("AP50", 0) for c in CLASS_GROUPS[group]) / len(CLASS_GROUPS[group])


def titik_setara(fs, a, b, get=lambda r: r["mAP50"]):
    """k terkecil saat a dan b setara: selisih < 2 poin atau tandanya berbalik dari k terkecil."""
    awal = None
    for k in KS:
        A, B = fs.get((a, k), {}), fs.get((b, k), {})
        seeds = sorted(set(A) & set(B))
        if not seeds:
            continue
        d = float(np.mean([get(A[s]) - get(B[s]) for s in seeds]))
        if abs(d) < 0.02 or (awal is not None and d * awal < 0):
            return k
        awal = d if awal is None else awal
    return None


def setup_mpl():
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    plt.rcParams.update({
        "figure.facecolor": SURFACE, "axes.facecolor": SURFACE, "savefig.facecolor": SURFACE,
        "axes.edgecolor": GRID, "axes.labelcolor": INK2, "xtick.color": INK2, "ytick.color": INK2,
        "text.color": INK, "font.size": 10, "axes.spines.top": False, "axes.spines.right": False,
        "axes.grid": True, "grid.color": GRID, "grid.linewidth": 0.8, "axes.axisbelow": True,
        "legend.frameon": False,
    })
    return plt


def plot_curve(fs, zs_val, full, metric, ylabel, fname, title):
    plt = setup_mpl()
    fig, ax = plt.subplots(figsize=(8.2, 4.8), dpi=200)
    xs = {0: 0, 1: 1, 5: 2, 10: 3, 30: 4, 100: 5, "full": 6.2}
    get = (lambda r: viol(r)) if metric == "viol" else (lambda r: r[metric])
    for meth, label in METHODS.items():
        px, py, pe = [], [], []
        if meth.startswith("yoloe") and zs_val is not None:  # semua cara YOLOE berangkat dari zero-shot
            px.append(xs[0]); py.append(get(zs_val) * 100); pe.append(0)
        for k in KS:
            seeds = fs.get((meth, k), {})
            if seeds:
                m, h, _ = ci([get(r) for r in seeds.values()])
                px.append(xs[k]); py.append(m * 100); pe.append(0 if math.isnan(h) else h * 100)
        if not px:
            continue
        ax.errorbar(px, py, yerr=pe, color=COLORS[meth], marker=MARKERS[meth], markersize=6, lw=2,
                    capsize=3, elinewidth=1.2, label=label, zorder=3)
        if meth in full:
            fy = get(full[meth]) * 100
            ax.plot([px[-1], xs["full"]], [py[-1], fy], color=COLORS[meth], lw=1.2, ls=(0, (2, 2)), zorder=2)
            ax.plot([xs["full"]], [fy], color=COLORS[meth], marker=MARKERS[meth], markersize=7, zorder=3,
                    markeredgecolor=SURFACE, markeredgewidth=1.2)
        # label langsung di ujung kanan seri (identitas tidak bergantung pada warna saja)
        lx, ly = (xs["full"], get(full[meth]) * 100) if meth in full else (px[-1], py[-1])
        ax.annotate(label.replace("YOLOE-26s ", "").replace("YOLO26s ", "YOLO26 "), (lx, ly),
                    xytext=(8, 0), textcoords="offset points", va="center", fontsize=8, color=INK2)
    n_full = sum(1 for l in open(SPLITS / "pool.txt") if l.strip())
    ax.set_xticks(list(xs.values()), ["0\n(zero-shot)", "1", "5", "10", "30", "100",
                                      f"Data penuh\n({n_full:,} gambar)".replace(",", ".")])
    ax.set_xlim(-0.3, 8.4)
    ax.set_xlabel("Jumlah data berlabel per kelas (k-shot)")
    ax.set_ylabel(ylabel)
    ax.set_title(title, loc="left", fontsize=11, color=INK)
    ax.legend(loc="upper left", fontsize=8)
    fig.text(0.01, 0.01, "Titik k-shot: rata-rata 5 seed, garis galat = 95% CI. Data penuh: 1 run.",
             fontsize=7.5, color=INK2)
    fig.tight_layout(rect=(0, 0.03, 1, 1))
    fig.savefig(OUT / fname)
    plt.close(fig)


def plot_heatmap(cols, fname):
    """cols: [(judul kolom, {kelas: AP50})] -> heatmap biru satu hue, angka di tiap sel."""
    if not cols:
        return
    plt = setup_mpl()
    from matplotlib.colors import LinearSegmentedColormap
    ramp = ["#f0efec", "#cde2fb", "#9ec5f4", "#6da7ec", "#3987e5", "#256abf", "#184f95", "#0d366b"]
    cmap = LinearSegmentedColormap.from_list("biru", ramp)
    order = sorted(SH17_NAMES, key=lambda c: -cols[0][1].get(c, 0))
    data = np.array([[col.get(c, np.nan) * 100 for _, col in cols] for c in order])
    fig, ax = plt.subplots(figsize=(1.15 * len(cols) + 2.6, 6.4), dpi=200)
    ax.grid(False)
    ax.imshow(data, cmap=cmap, vmin=0, vmax=100, aspect="auto")
    for i in range(data.shape[0]):
        for j in range(data.shape[1]):
            v = data[i, j]
            if not np.isnan(v):
                ax.text(j, i, f"{v:.0f}", ha="center", va="center", fontsize=8,
                        color="#ffffff" if v >= 55 else INK)
    ax.set_xticks(range(len(cols)), [c for c, _ in cols], rotation=30, ha="right", fontsize=8)
    ax.set_yticks(range(len(order)), order, fontsize=8.5)
    ax.tick_params(length=0)
    for s in ax.spines.values():
        s.set_visible(False)
    ax.set_title("AP50 per kelas (%), diurutkan dari zero-shot YOLOE-26s", loc="left", fontsize=10.5)
    fig.tight_layout()
    fig.savefig(OUT / fname)
    plt.close(fig)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    runs, cross, vio, fps = load("runs"), load("runs_cross"), load("runs_violation"), load("runs_fps")
    fs = fewshot(runs)
    zs_val = runs.get("zeroshot_yoloe-26s")
    full = {t.split("_")[2][:-1]: r for t, r in runs.items() if t.startswith("full_seed0_")}
    md = ["# Hasil eksperimen (otomatis dari scripts/13_analyze.py)", "",
          f"Kelas pelanggaran untuk recall: {', '.join(VIOLATION_CLASSES)} (lihat alasan di scripts/common.py).", ""]

    # 1. Zero-shot semua model open-vocabulary
    rows = []
    for key, name in ZS_NAMES.items():
        r = runs.get(f"zeroshot_{key}")
        if r:
            rows.append([name, num(r["mAP50"]), num(r["mAP50-95"]), num(viol(r)),
                         num(r.get("infer_peak_vram_GB"), 2, 1), num(r.get("infer_ms_per_img_incl_io"), 0, 1)])
    if rows:
        md += ["## 1. Zero-shot, prompt = nama kelas (evaluator terpadu)", "",
               table(["Model", "mAP50", "mAP50-95", "Recall pelanggaran", "VRAM puncak (GB)",
                      "ms/gambar (termasuk baca file)"], rows), ""]
        if zs_val and "zeroshot_det_yoloe-26s" in runs:
            a, b = zs_val["mAP50"], runs["zeroshot_det_yoloe-26s"]["mAP50"]
            md += [f"Cek evaluator: YOLOE-26s lewat `val()` Ultralytics = {num(a, 2)}, lewat evaluator terpadu = "
                   f"{num(b, 2)} mAP50 (selisih {num(abs(a - b), 2)} poin; target < 0,2).", ""]

    # 2. Kurva few-shot
    rows = []
    for k in KS:
        for meth, label in METHODS.items():
            seeds = fs.get((meth, k), {})
            if not seeds:
                continue
            v = list(seeds.values())
            rows.append([k, label, len(v), mci([r["mAP50"] for r in v]), mci([r["mAP50-95"] for r in v]),
                         mci([viol(r) for r in v]),
                         num(np.mean([r.get("train_time_min", 0) for r in v]), 1, 1) if meth != "yoloe-vp" else "0",
                         num(max(r.get("train_peak_vram_GB", 0) for r in v), 2, 1) if meth != "yoloe-vp" else "–",
                         num(np.mean([r["n_train_images"] for r in v]), 0, 1)])
    for meth, r in full.items():
        ep = "" if meth == "yoloe-vp" else f" ({r.get('epochs')} epoch)"
        rows.append([f"penuh{ep}", METHODS[meth], 1, num(r["mAP50"]), num(r["mAP50-95"]), num(viol(r)),
                     num(r.get("train_time_min"), 0, 1) if meth != "yoloe-vp" else "0",
                     num(r.get("train_peak_vram_GB"), 2, 1) if meth != "yoloe-vp" else "–", r["n_train_images"]])
    if rows:
        md += ["## 2. Efisiensi label: k-shot (rata-rata ± 95% CI, 5 seed)", ""]
        if zs_val:
            md += [f"Titik awal (k = 0): YOLOE-26s zero-shot = {num(zs_val['mAP50'])} mAP50, "
                   f"{num(zs_val['mAP50-95'])} mAP50-95, recall pelanggaran {num(viol(zs_val))} (lewat `val()`).", ""]
        md += [table(["k", "Metode", "n seed", "mAP50", "mAP50-95", "Recall pelanggaran", "Waktu latih (mnt)",
                      "VRAM puncak (GB)", "Gambar latih"], rows), "",
               "Baseline paper SH17 (YOLOv9-e, data penuh, protokol berbeda): 70,9 mAP50 / 48,7 mAP50-95.", ""]
        for metric, ylab, fname, title in [
                ("mAP50", "mAP50 (%)", "kurva_k_map50.png", "mAP50 pada test set SH17 vs jumlah label per kelas"),
                ("mAP50-95", "mAP50-95 (%)", "kurva_k_map50-95.png", "mAP50-95 pada test set SH17 vs jumlah label"),
                ("viol", "Recall kelas pelanggaran (%)", "kurva_k_recall_pelanggaran.png",
                 "Recall rata-rata kelas pelanggaran (ear, face, hands, foot)")]:
            plot_curve(fs, zs_val, full, metric, ylab, fname, title)
        md += ["![mAP50](kurva_k_map50.png)", "", "![mAP50-95](kurva_k_map50-95.png)", "",
               "![recall pelanggaran](kurva_k_recall_pelanggaran.png)", ""]

    # 2b. Kurva per kelompok kelas dan jumlah label sebenarnya
    rows = [[k, label, *[mci([group_ap(r, g) for r in fs[(meth, k)].values()]) for g in CLASS_GROUPS]]
            for k in KS for meth, label in METHODS.items() if fs.get((meth, k))]
    if rows:
        md += ["## 2b. AP50 per kelompok kelas (rata-rata ± 95% CI)", "",
               table(["k", "Metode", *CLASS_GROUPS], rows), ""]
    rows = []
    for k in KS:
        info = [json.loads(p.read_text()) for p in sorted((SPLITS / "fewshot").glob(f"k{k}_seed*.json"))]
        if info:
            rows.append([k, num(np.mean([i["n_images"] for i in info]), 1, 1),
                         num(np.mean([i["n_boxes"] for i in info]), 0, 1)])
    if rows:
        md += ["## 2c. Biaya label per k (rata-rata 5 seed)", "", table(["k", "Gambar", "Kotak berlabel"], rows), ""]
    for m, nama in [("yoloe-lp", "linear probing"), ("yoloe-ft", "fine-tune penuh YOLOE")]:
        setara = [("Seluruh kelas", titik_setara(fs, m, "yolo26"))]
        setara += [(g, titik_setara(fs, m, "yolo26", lambda r, g=g: group_ap(r, g))) for g in CLASS_GROUPS]
        if any(fs.get((m, k)) for k in KS):
            md += [f"## 2d. Titik setara {nama} vs YOLO26", "",
                   table(["Kelompok", "k setara (selisih < 2 poin atau berbalik)"],
                         [[n, k if k else f"belum ada sampai k = {KS[-1]}"] for n, k in setara]), ""]

    # 3. Uji berpasangan per k
    rows = []
    pairs = [("yoloe-lp", "yolo26"), ("yoloe-ft", "yolo26"), ("yoloe-vp", "yolo26"), ("yolow-ft", "yolo26"), ("yoloe-ft", "yoloe-lp")]
    for k in KS:
        for a, b in pairs:
            A, B = fs.get((a, k), {}), fs.get((b, k), {})
            common_seeds = sorted(set(A) & set(B))
            if len(common_seeds) < 2:
                continue
            d = np.array([A[s]["mAP50"] - B[s]["mAP50"] for s in common_seeds])
            m, h, n = ci(d)
            p = stats.ttest_rel([A[s]["mAP50"] for s in common_seeds], [B[s]["mAP50"] for s in common_seeds]).pvalue
            menang = sum(d > 0)
            rows.append([k, f"{METHODS[a]} − {METHODS[b]}", n, f"{num(m)} ± {num(h)}",
                         f"{p:.3f}".replace(".", ","), f"{menang}/{n}"])
    if rows:
        md += ["## 3. Selisih berpasangan mAP50 (poin persen, per seed dengan sampel yang sama)", "",
               table(["k", "Perbandingan", "n", "Selisih ± 95% CI", "p (uji t berpasangan)", "Seed menang"], rows),
               "", "CI yang tidak memuat 0 berarti selisih konsisten di semua sampel. Dengan n = 5, uji ini "
               "berdaya rendah; CI lebih informatif daripada p.", ""]

    # 4. Per kelas
    cols = []
    if "zeroshot_yoloe-26s" in runs:
        cols.append(("Zero-shot\nYOLOE-26s", {c: v["AP50"] for c, v in runs["zeroshot_yoloe-26s"]["per_class"].items()}))
    for key, lab in [("gdino-base", "Zero-shot\nGDINO B"), ("owlv2-base", "Zero-shot\nOWLv2 B")]:
        if f"zeroshot_{key}" in runs:
            cols.append((lab, {c: v["AP50"] for c, v in runs[f"zeroshot_{key}"]["per_class"].items()}))
    for meth, lab in [("yoloe-vp", "10-shot\nYOLOE VP"), ("yoloe-lp", "10-shot\nYOLOE LP"),
                      ("yoloe-ft", "10-shot\nYOLOE FT"), ("yolo26", "10-shot\nYOLO26")]:
        seeds = fs.get((meth, 10), {})
        if seeds:
            cols.append((lab, {c: np.mean([r["per_class"].get(c, {}).get("AP50", 0) for r in seeds.values()])
                               for c in SH17_NAMES}))
    for meth, lab in [("yolo26", "Penuh\nYOLO26"), ("yoloe-ft", "Penuh\nYOLOE FT")]:
        if meth in full:
            cols.append((lab, {c: v["AP50"] for c, v in full[meth]["per_class"].items()}))
    if cols:
        plot_heatmap(cols, "heatmap_ap50_per_kelas.png")
        order = sorted(SH17_NAMES, key=lambda c: -cols[0][1].get(c, 0))
        md += ["## 4. AP50 per kelas (%)", "", "![heatmap](heatmap_ap50_per_kelas.png)", "",
               table(["Kelas"] + [c.replace("\n", " ") for c, _ in cols],
                     [[c] + [num(col.get(c)) for _, col in cols] for c in order]), ""]

    # 5. Ablation prompt
    rows = [[r["prompt_variant"], num(r["mAP50"]), num(r["mAP50-95"]), num(viol(r))]
            for t, r in runs.items() if t.startswith("prompt_yoloe26s_")]
    if rows:
        md += ["## 5. Ablation prompt teks (YOLOE-26s zero-shot)", "",
               table(["Varian prompt", "mAP50", "mAP50-95", "Recall pelanggaran"], rows), ""]
        rp = {t.split("_")[-1]: r for t, r in runs.items() if t.startswith("prompt_yoloe26s_")}
        if "rapi" in rp and "deskriptif" in rp:
            gain = sorted(((rp["deskriptif"]["per_class"].get(c, {}).get("AP50", 0)
                            - rp["rapi"]["per_class"].get(c, {}).get("AP50", 0), c) for c in SH17_NAMES))
            md += ["Perubahan AP50 per kelas, deskriptif − rapi: " +
                   ", ".join(f"{c} {num(g)}" for g, c in gain[::-1]), ""]

    # 6. Lintas dataset
    rows = []
    for t, r in cross.items():
        rows.append([t.replace("cross_", ""), num(r["mAP50"]), num(r["mAP50-95"])] +
                    [num(r["per_class"].get(c, {}).get("AP50")) for c in
                     ["helmet", "safety-vest", "gloves", "shoes", "glasses"]])
    if rows:
        md += ["## 6. Uji lintas dataset: test Construction-PPE, 5 kelas sepadan", "",
               table(["Model / run", "mAP50", "mAP50-95", "helmet", "vest", "gloves", "boots→shoes",
                      "goggles→glasses"], rows), ""]

    # 7. Pelanggaran kepala tanpa helm
    rows = [[r.get("pelanggaran"), r.get("pendekatan"), r.get("model"), r.get("prompt", "–"), r.get("n_gt"),
             num(r["mAP50"]), num(r["mAP50-95"]), num(r.get("R"))] for t, r in vio.items() if t.startswith("cppe_")]
    if rows:
        md += ["## 7b. Pelanggaran dengan label asli Construction-PPE", "",
               table(["Kelas", "Pendekatan", "Model / run", "Prompt", "Kotak GT", "AP50", "AP50-95", "Recall"], rows), ""]
    vio = {t: r for t, r in vio.items() if not t.startswith("cppe_")}
    rows = [[r.get("pendekatan"), r.get("model"), r.get("prompt", "–"), num(r["mAP50"]), num(r["mAP50-95"]),
             num(r.get("R"))] for t, r in vio.items()]
    if rows:
        n_gt = next(iter(vio.values())).get("n_gt")
        md += [f"## 7. Kepala tanpa helm: prompt negasi vs aturan asosiasi (GT turunan, {n_gt} kotak)", "",
               table(["Pendekatan", "Model / run", "Prompt", "AP50", "AP50-95", "Recall"], rows), ""]

    # 8. FPS
    rows = [[r["model"], num(r.get("fps_e2e"), 0, 1), num(r.get("e2e_ms"), 1, 1), num(r.get("fps_forward"), 0, 1),
             num(r["telemetry"].get("gpu_power_limit_W_min"), 0, 1) + "–" +
             num(r["telemetry"].get("gpu_power_limit_W_max"), 0, 1), "ya" if r["telemetry"].get("ac_power") else "tidak"]
            for t, r in fps.items()]
    if rows:
        md += ["## 8. Kecepatan inferensi (batch 1, FP32, 640 px untuk YOLO)", "",
               table(["Model", "FPS end-to-end", "ms/gambar", "FPS forward saja", "Batas daya GPU (W)",
                      "Charger"], rows), ""]

    # 9. Kondisi perangkat selama training
    tel = [r["train_telemetry"] for r in runs.values() if "train_telemetry" in r]
    if tel:
        lim = [t["gpu_power_limit_W_min"] for t in tel if "gpu_power_limit_W_min" in t] + \
              [t["gpu_power_limit_W_max"] for t in tel if "gpu_power_limit_W_max" in t]
        md += ["## 9. Kondisi perangkat selama training", "",
               f"{len(tel)} run training. Charger terpasang di semua run: {all(t.get('ac_power') for t in tel)}. "
               f"Batas daya GPU teramati {num(min(lim), 0, 1)}–{num(max(lim), 0, 1)} W. "
               f"Rata-rata utilisasi GPU per run {num(min(t.get('gpu_util_pct_mean', 0) for t in tel), 0, 1)}–"
               f"{num(max(t.get('gpu_util_pct_mean', 0) for t in tel), 0, 1)}%. "
               f"Suhu GPU maksimum {max(t.get('gpu_temp_C_max', 0) for t in tel)} °C.", ""]

    (OUT / "ringkasan.md").write_text("\n".join(md), encoding="utf-8")
    print("\n".join(md))


if __name__ == "__main__":
    main()
