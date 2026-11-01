"""Hitung kriteria gerbang dari hasil yang sudah ada, tulis results/hasil/gerbang.md.

Gerbang 1 (teknis) dari results/runs_dev/; Gerbang 2 (sinyal, 3 seed) dan bagian otomatis
Gerbang 3 (5 seed) dari results/runs/. Bagian yang datanya belum ada ditulis "belum ada data".
G2 (bukti per kelas) dan G5 (paper baru) perlu dinilai manusia, jadi hanya ditandai.

Aturan pilih jadwal ditulis sebelum hasil keluar (rencana_eksperimen.md): mAP50 dev rata-rata
tertinggi per metode; selisih di bawah 1 poin dianggap seri dan jadwal lebih pendek yang dipilih.
"""
import importlib
import json
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).parent))
from common import CLASS_GROUPS, FEWSHOT_BATCH, FULL_BATCH, RESULTS, SCHEDULE, WORKERS  # noqa: E402

an = importlib.import_module("13_analyze")
OUT = RESULTS / "hasil" / "gerbang.md"
METODE = ["yoloe-lp", "yolo26"]
JADWAL = ["A", "B", "C"]  # dari yang terpendek
VRAM_MAKS, RAM_MIN, SERI_JADWAL = 5.2, 3.0, 0.01
KS_G2 = [1, 5, 10, 30]  # Gerbang 2 berhenti di k = 30; k = 100 baru jalan di Tahap 3
D = {"D_LP": "yoloe-lp", "D_FT": "yoloe-ft"}  # selisih mAP50 terhadap yolo26


def num(x, d=1):
    return f"{x:.{d}f}".replace(".", ",")


def lolos(b):
    return "**LOLOS**" if b else "**GAGAL**"


def pilih_jadwal(dev):
    """{metode: (jadwal terpilih, {jadwal: mAP50 rata-rata k=1 & k=10})}; None kalau belum lengkap."""
    hasil = {}
    for m in METODE:
        skor = {}
        for j in JADWAL:
            rs = [dev.get(f"k{k}_seed0_{m}s_jadwal{j}") for k in (1, 10)]
            if not all(rs):
                return None
            skor[j] = float(np.mean([r["mAP50"] for r in rs]))
        top = max(skor.values())
        hasil[m] = (next(j for j in JADWAL if top - skor[j] < SERI_JADWAL), skor)
    return hasil


def determinisme(dev):
    baris, ok = [], True
    for m in METODE:
        a, b = dev.get(f"k10_seed0_{m}s_jadwalB"), dev.get(f"k10_seed0_{m}s_jadwalB_rep")
        if not a or not b:
            return None, False
        sama = a["mAP50"] == b["mAP50"] and a["mAP50-95"] == b["mAP50-95"] and all(
            a["per_class"][c][x] == b["per_class"][c][x] for c in a["per_class"] for x in ("AP50", "AP50-95"))
        ok &= sama
        baris.append([m, f"{a['mAP50']:.6f}", f"{b['mAP50']:.6f}", "identik" if sama else "BEDA"])
    return baris, ok


def gerbang1(dev):
    md = ["## Gerbang 1: teknis", ""]
    if not dev:
        return md + ["Belum ada data.", ""]
    rows, ok_det = determinisme(dev)
    md += ["### Determinisme (run ulang proses baru, worker sama, AP per kelas sampai 6 desimal)", ""]
    md += [an.table(["Metode", "mAP50 run 1", "mAP50 run 2", "Hasil"], rows) if rows else "Belum ada data.", "",
           f"Kriteria: {lolos(ok_det)}", ""]

    terlatih = {t: r for t, r in dev.items() if "train_telemetry" in r}
    worker = {t: r for t, r in terlatih.items() if "_ujiw" in t}
    if worker:
        md += ["### Uji batch dan worker, satu epoch data penuh", "",
               an.table(["Run", "Batch", "Worker", "Waktu (mnt)", "VRAM (GB)", "RAM bebas min (GB)", "Suhu GPU maks"],
                        [[t, r["batch"], r["workers"], num(r["train_time_min"], 2), num(r["train_peak_vram_GB"], 2),
                          num(r["train_telemetry"]["ram_free_GB_min"], 2), r["train_telemetry"]["gpu_temp_C_max"]]
                         for t, r in sorted(worker.items())]), ""]
    vram = max((r["train_peak_vram_GB"] for r in terlatih.values() if r.get("workers") == WORKERS), default=None)
    ram = min((r["train_telemetry"]["ram_free_GB_min"] for r in terlatih.values() if r.get("workers") == WORKERS),
              default=None)
    ok_sumber = vram is not None and vram <= VRAM_MAKS and ram >= RAM_MIN
    if vram is not None:
        md += [f"Dengan worker {WORKERS}, seluruh run training: VRAM puncak {num(vram, 2)} GB (batas {num(VRAM_MAKS)}), "
               f"RAM bebas terendah {num(ram, 2)} GB (batas {num(RAM_MIN)}). Kriteria: {lolos(ok_sumber)}", ""]

    pilih = pilih_jadwal(dev)
    ok_jadwal = False
    if pilih:
        md += ["### Uji jadwal di dev set (seed 0, rata-rata k = 1 dan 10)", "",
               an.table(["Metode", "A: nbs 64, 100 epoch", "B: nbs 8, 100 epoch", "C: nbs 8, 300 epoch", "Terpilih"],
                        [[m, *[num(s[j] * 100) for j in JADWAL], j_] for m, (j_, s) in pilih.items()]), ""]
        rinci = [[m, k, *[num(dev[f"k{k}_seed0_{m}s_jadwal{j}"]["mAP50"] * 100) for j in JADWAL],
                  dev[f"k{k}_seed0_{m}s_jadwalB"].get("optimizer", "–")] for m in METODE for k in (1, 10)]
        md += [an.table(["Metode", "k", "A", "B", "C", "Optimizer"], rinci), ""]
        q = importlib.import_module("09_queue")
        kunci = all(SCHEDULE[m] == q.JADWAL[pilih[m][0]] for m in METODE) and SCHEDULE["yoloe-ft"] == SCHEDULE["yolo26"]
        ok_jadwal = kunci
        md += [f"common.py: {SCHEDULE['yoloe-lp']} untuk yoloe-lp, {SCHEDULE['yolo26']} untuk yolo26 dan yoloe-ft, batch few-shot "
               f"{FEWSHOT_BATCH}, batch penuh {FULL_BATCH}, worker {WORKERS}. Sesuai pilihan: {kunci}.", ""]

    total = None
    try:
        est = importlib.import_module("14_estimasi").hitung(["tahap2", "tahap3", "tahap4"])
        total = sum(est.values()) / 60
        md += ["### Estimasi dengan kecepatan nyata", "",
               an.table(["Tahap", "Jam"], [[n, num(v / 60)] for n, v in est.items()]), "",
               f"Sisa GPU: {num(total)} jam. Sampai GO/NO-GO: {num((est['tahap2'] + est['tahap3']) / 60)} jam. "
               "Data penuh dihitung sampai epoch maksimum; patience bisa membuatnya lebih pendek.", ""]
    except (FileNotFoundError, StopIteration, ValueError, KeyError) as e:
        md += [f"Estimasi belum bisa dihitung: {e}", ""]

    ok = ok_det and ok_sumber and ok_jadwal and total is not None
    md += [f"**Gerbang 1: {'LOLOS' if ok else 'BELUM LOLOS'}.**", ""]
    return md


def nilai(r, grup):
    return r["mAP50"] if grup is None else an.group_ap(r, grup)


def gerbang2(fs, runs):
    md = ["## Gerbang 2: sinyal (3 seed)", ""]
    seeds = {s: None for s in (0, 1, 2)}
    if not all(s in fs.get((m, k), {}) for m in [*METODE, "yoloe-ft"] for k in KS_G2 for s in seeds):
        return md + ["Belum ada data.", ""]
    rows, ada_sinyal = [], False
    for grup in [None, *CLASS_GROUPS]:
        for nama, m in D.items():
            for k in KS_G2:
                d = np.array([nilai(fs[(m, k)][s], grup) - nilai(fs[("yolo26", k)][s], grup) for s in seeds]) * 100
                konsisten = (d > 0).all() or (d < 0).all()
                sinyal = abs(d.mean()) >= 2 and konsisten
                ada_sinyal |= sinyal and grup != "Lainnya"
                rows.append([grup or "Seluruh kelas", nama, k, num(d.mean()), " / ".join(num(x) for x in d),
                             "ya" if sinyal else "–"])
    md += ["### 1. Seri: D_LP(k) dan D_FT(k) = mAP50 linear probing atau fine-tune penuh − YOLO26, poin persen", "",
           an.table(["Kelompok", "D", "k", "Nilai", "Per seed", "Sinyal (≥ 2 dan searah)"], rows), "",
           f"Berhenti karena seri: {'tidak' if ada_sinyal else 'YA'}", ""]
    sd = {m: float(np.std([fs[(m, 10)][s]["mAP50"] for s in seeds], ddof=1)) * 100 for m in METODE}
    bising = any(v > 5 for v in sd.values())
    md += [f"### 2. Bising: SD antar seed pada k = 10: " + ", ".join(f"{m} {num(v)}" for m, v in sd.items())
           + f" poin. Berhenti: {'YA' if bising else 'tidak'}", ""]
    zs = {t: an.group_ap(r, "APD") * 100 for t, r in runs.items()
          if t.startswith("zeroshot_") and "_det_" not in t and "limit" not in t}
    terbaik = max(zs, key=zs.get)
    gagal = zs[terbaik] < 20
    md += [f"### 3. Zero-shot: terbaik {terbaik}, rata-rata AP50 kelompok APD {num(zs[terbaik])}. "
           f"Berhenti: {'YA' if gagal else 'tidak'}", ""]
    md += [f"**Gerbang 2: {'BERHENTI, evaluasi' if (not ada_sinyal or bising or gagal) else 'LANJUT'}.**", ""]
    return md


def gerbang3(fs, runs, vio):
    md = ["## Gerbang 3: akhir (5 seed)", ""]
    full = runs.get("full_seed0_yolo26s")
    if not full or not all(len(fs.get((m, k), {})) == 5 for m in [*METODE, "yoloe-ft"] for k in an.KS):
        return md + ["Belum ada data.", ""]
    md += [f"- G1 YOLO26s data penuh {num(full['mAP50'] * 100)} mAP50 (≥ 58): {lolos(full['mAP50'] >= 0.58)}"]
    zs = {t: r for t, r in runs.items() if t.startswith("zeroshot_") and "_det_" not in t}
    best = max(zs, key=lambda t: zs[t]["mAP50"])
    md += [f"- G2 selisih zero-shot terbaik ({best}, {num(zs[best]['mAP50'] * 100)}) vs YOLO26 penuh: "
           f"{num((full['mAP50'] - zs[best]['mAP50']) * 100)} poin; bukti per kelas di ringkasan.md"]
    ok_g3 = []
    for grup in [None, *CLASS_GROUPS]:
        for nama, metode in D.items():
            for k in an.KS:
                d = [nilai(fs[(metode, k)][s], grup) - nilai(fs[("yolo26", k)][s], grup) for s in range(5)]
                m, h, _ = an.ci(d)
                if abs(m) >= 0.02 and abs(m) > h:
                    ok_g3.append(f"{nama} {grup or 'seluruh kelas'} k={k} ({num(m * 100)} ± {num(h * 100)})")
    md += [f"- G3 k dengan CI D_LP(k) atau D_FT(k) tidak memuat 0 dan |D| ≥ 2: {lolos(bool(ok_g3))}: " + ("; ".join(ok_g3) or "tidak ada")]
    ap = [v["AP50"] for v in zs[best]["per_class"].values()]
    rendah, tinggi = sum(a < 0.2 for a in ap), sum(a >= 0.5 for a in ap)
    pel = {k: any(t.startswith(f"cppe_{k}_") for t in vio) for k in ("no_helmet", "no_gloves")}
    md += [f"- G4 kelas zero-shot AP50 < 20: {rendah}, ≥ 50: {tinggi}; uji no_helmet dan no_gloves ada: {all(pel.values())}. "
           f"{lolos(rendah >= 3 and tinggi >= 3 and all(pel.values()))}",
           "- G5 paper baru yang menggugurkan Gerbang 0: dinilai manual", ""]
    return md


def main():
    OUT.parent.mkdir(exist_ok=True)
    dev, runs, vio = an.load("runs_dev"), an.load("runs"), an.load("runs_violation")
    fs = an.fewshot(runs)
    md = ["# Status gerbang (otomatis dari scripts/15_gate.py)", ""]
    md += gerbang1(dev) + gerbang2(fs, runs) + gerbang3(fs, runs, vio)
    OUT.write_text("\n".join(md), encoding="utf-8")
    print("\n".join(md))


if __name__ == "__main__":
    main()
