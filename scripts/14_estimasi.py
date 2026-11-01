"""Perkiraan waktu Tahap 2-4, dari durasi nyata di results/logs/queue_*.log dan results/runs_dev/.

Few-shot memakai run uji jadwal pada jadwal terkunci: waktu k = 1 dan 10 terukur langsung, dan k lain
dihitung dari garis lurus waktu vs jumlah batch per epoch. Data penuh dihitung dari waktu satu epoch
data penuh yang terukur, dikali epoch maksimum (patience bisa membuatnya lebih pendek). Job lain memakai
durasi terukur kalau ada, kalau belum memakai angka awal dari uji kelayakan.

Contoh: python scripts/14_estimasi.py            (semua tahap)
        python scripts/14_estimasi.py tahap2
"""
import importlib
import json
import math
import re
import statistics
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from common import FEWSHOT_BATCH, RESULTS, SCHEDULE, SPLITS, WORKERS  # noqa: E402

q = importlib.import_module("09_queue")

EVAL_TEST_MNT = 0.7  # evaluasi 1.620 gambar test, dari log uji kelayakan
VP_MNT = 1.5
FULL_EPOCHS = 200
AWAL = {"zeroshot_gdino-base": 25, "zeroshot_owlv2-base": 12, "zeroshot_owlv2-large": 30, "prompt_ablation": 6,
        "cross_zeroshot": 45, "cross_zeroshot_l": 30, "cross_trained": 15, "violation": 25, "negasi_ov": 90,
        "analisis": 1, "gerbang": 0.2}
POLA = re.compile(r"DONE \[\d+/\d+\] (\S+) .*\(([\d.]+) mnt\)")
FS = re.compile(r"^k(\d+)_seed\d+_(yoloe-vp|yoloe-lp|yoloe-ft|yolow-ft|yolo26)s$")


def terukur():
    d = {}
    for f in (RESULTS / "logs").glob("queue_*.log"):
        for line in f.read_text(encoding="utf-8", errors="ignore").splitlines():
            m = POLA.search(line)
            if m:
                d.setdefault(m.group(1), []).append(float(m.group(2)))
    return {k: statistics.median(v) for k, v in d.items()}


def n_batch(k):
    n = statistics.mean(sum(1 for _ in open(p)) for p in (SPLITS / "fewshot").glob(f"k{k}_seed*_train.txt"))
    return math.ceil(n / FEWSHOT_BATCH)


def dev_run(tag):
    return json.loads((RESULTS / "runs_dev" / f"{tag}.json").read_text())


def fewshot_mnt(model, k):
    """Waktu latih + evaluasi test untuk satu run pada jadwal terkunci."""
    if model == "yoloe-vp":
        return VP_MNT
    # YOLO-World belum diukur di Tahap 1; dianggap setara fine-tune YOLOE yang juga melatih semua layer.
    ukur = "yoloe-ft" if model == "yolow-ft" else model
    faktor = 1.0
    if ukur == "yoloe-ft":  # hanya diukur pada jadwal B; skala dengan epoch jadwal terkunci
        faktor, jadwal = SCHEDULE[ukur][1] / q.JADWAL["B"][1], "B"
    else:
        jadwal = next(j for j, v in q.JADWAL.items() if v == SCHEDULE[ukur])
    r = {kk: dev_run(f"k{kk}_seed0_{ukur}s_jadwal{jadwal}") for kk in (1, 10)}
    x = {kk: math.ceil(v["n_train_list"] / FEWSHOT_BATCH) for kk, v in r.items()}
    y = {kk: v["train_time_min"] * faktor for kk, v in r.items()}
    b = (y[10] - y[1]) / max(x[10] - x[1], 1)
    return y[1] + b * (n_batch(k) - x[1]) + EVAL_TEST_MNT


def full_mnt(tag):
    """Waktu satu epoch terukur dikali epoch maksimum."""
    uji = "full_seed0_yoloe-fts_ujift" if "yoloe" in tag else f"full_seed0_yolo26s_ujiw{WORKERS}"
    return dev_run(uji)["train_time_min"] * FULL_EPOCHS + EVAL_TEST_MNT


def perkiraan(tag, ukur):
    m = FS.match(tag)
    if m:
        return fewshot_mnt(m.group(2), int(m.group(1)))
    if tag.startswith("full_seed0_"):
        return full_mnt(tag)
    if tag in ukur:
        return ukur[tag]
    if tag in AWAL:
        return AWAL[tag]
    if tag.startswith("fps_"):
        return 2.0 if any(x in tag for x in ("gdino", "owlv2")) else 1.0
    return 1.5  # zero-shot lewat Ultralytics


def jam(menit):
    return f"{int(menit // 60)} j {int(round(menit % 60)):02d} m"


def hitung(tahap):
    ukur = terukur()
    return {n: sum(perkiraan(t, ukur) for t, _, r in q.paket()[n] if not r.exists() or r.name == "_never_")
            for n in tahap}


def main():
    try:
        res = hitung(sys.argv[1:] or ["tahap2", "tahap3", "tahap4"])
    except (FileNotFoundError, StopIteration, KeyError) as e:
        sys.exit(f"Estimasi belum bisa dihitung, Tahap 1 belum selesai atau jadwal belum terkunci: {e}")
    for n, menit in res.items():
        print(f"{n:<8} {jam(menit)}")
    if "tahap2" in res and "tahap3" in res:
        print(f"Sampai GO/NO-GO {jam(res['tahap2'] + res['tahap3'])}")
    print(f"TOTAL    {jam(sum(res.values()))}")


if __name__ == "__main__":
    main()
