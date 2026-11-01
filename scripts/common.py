"""Konstanta bersama: path, nama kelas SH17, dan prompt teks."""
import sys
from collections import Counter
from pathlib import Path

# Tanpa ini, print ke file log memakai cp1252 dan gagal pada tanda minus Unicode.
sys.stdout.reconfigure(encoding="utf-8")

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
SH17_ORIG = DATA / "sh17"  # hasil ekstrak zip Kaggle (images/, labels/, *_files.txt), resolusi asli
SH17 = DATA / "sh17_1280"  # salinan sisi terpanjang 1280 px (01b_resize_sh17.py), dipakai semua eksperimen
SPLITS = DATA / "splits"  # daftar gambar per split yang kita pakai
YAMLS = DATA / "yaml"
RUNS = ROOT / "runs"
RESULTS = ROOT / "results"

# Urutan indeks mengikuti sh17.yaml resmi (BUKAN urutan daftar di README).
SH17_NAMES = [
    "person", "ear", "ear-mufs", "face", "face-guard", "face-mask", "foot", "tool",
    "glasses", "gloves", "helmet", "hands", "head", "medical-suit", "shoes",
    "safety-suit", "safety-vest",
]

# Prompt teks zero-shot = nama kelas yang dirapikan seminimal mungkin:
# tanda '-' jadi spasi, dan salah ketik "ear-mufs" dibetulkan jadi "earmuffs"
# (encoder teks CLIP tidak mengenal kata "mufs"). Variasi prompt lain masuk ablation.
PROMPTS = [n.replace("-", " ") for n in SH17_NAMES]
PROMPTS[SH17_NAMES.index("ear-mufs")] = "earmuffs"

# Dikunci di Tahap 1 (lihat rencana_eksperimen.md).
FEWSHOT_BATCH, FULL_BATCH = 8, 16
WORKERS = 1  # terukur di Tahap 1: makin sedikit worker makin cepat dan makin hemat memori di laptop ini
# Jadwal A menang untuk yoloe-lp dan yolo26 di dev set; yoloe-ft dan yolow-ft mengikuti yolo26.
SCHEDULE = {"yoloe-lp": (64, 100), "yoloe-ft": (64, 100), "yolow-ft": (64, 100), "yolo26": (64, 100)}  # metode: (nbs, epoch)

# Kelompok kelas: pola awal menunjukkan APD dan bagian tubuh bisa berlawanan arah.
CLASS_GROUPS = {
    "APD": ["ear-mufs", "face-guard", "face-mask", "glasses", "gloves", "helmet", "medical-suit", "safety-suit",
            "safety-vest", "shoes"],
    "Bagian tubuh": ["ear", "face", "foot", "hands", "head"],
    "Lainnya": ["person", "tool"],
}


def read_list(p):
    return [l.strip() for l in open(p) if l.strip()]


def label_counts(paths):
    """{gambar: Counter(kelas)} dari file label SH17."""
    counts = {}
    for p in paths:
        lp = SH17 / "labels" / (Path(p).stem + ".txt")
        rows = lp.read_text().splitlines() if lp.exists() else []
        counts[p] = Counter(int(r.split()[0]) for r in rows if r.strip())
    return counts


def make_yaml(name, train, val, names):
    """Tulis data yaml Ultralytics berbasis daftar file (.txt berisi path absolut)."""
    YAMLS.mkdir(parents=True, exist_ok=True)
    lines = [f"train: {Path(train).as_posix()}", f"val: {Path(val).as_posix()}", "names:"]
    lines += [f"  {i}: {n}" for i, n in enumerate(names)]
    p = YAMLS / f"{name}.yaml"
    p.write_text("\n".join(lines) + "\n")
    return str(p)


# Kelas yang menandakan bagian tubuh TIDAK terlindungi (indikasi pelanggaran), untuk metrik
# "recall kelas pelanggaran". Ditentukan dari analisis tumpang tindih label train SH17:
# - hands: sarung tangan hampir tidak pernah di dalam kotak hands (2%) -> hands = tangan telanjang
# - ear  : earmuff hampir tidak pernah di dalam kotak ear (1%)          -> ear = telinga terbuka
# - face : masker/face-guard tidak tumpang tindih kotak face (0-1%)     -> face = wajah tanpa pelindung
# - foot : secara visual kaki telanjang, tapi 39% kotak foot tumpang tindih shoes (label ganda)
# - head TIDAK termasuk: 79% helm berada di dalam kotak head, jadi head dilabeli walau berhelm.
#   Pelanggaran "kepala tanpa helm" diturunkan lewat aturan asosiasi head-helmet (12_violation.py).
VIOLATION_CLASSES = ["ear", "face", "hands", "foot"]
