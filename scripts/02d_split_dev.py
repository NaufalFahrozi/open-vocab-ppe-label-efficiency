"""Pisahkan 10% train_final menjadi dev set (seed tetap), sisanya pool untuk sampling dan data penuh.

Dev set dipakai memilih jadwal dan memantau training data penuh, supaya test set tidak ikut
memengaruhi keputusan apa pun. Keluaran: data/splits/dev.txt dan pool.txt.
"""
import random
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from common import SH17_NAMES, SPLITS, label_counts, read_list  # noqa: E402

SEED, FRAC = 2026, 0.10


def main():
    train = read_list(SPLITS / "train_final.txt")
    n_dev = round(len(train) * FRAC)
    dev = set(random.Random(SEED).sample(train, n_dev))
    pool = [p for p in train if p not in dev]
    (SPLITS / "dev.txt").write_text("\n".join(p for p in train if p in dev) + "\n")
    (SPLITS / "pool.txt").write_text("\n".join(pool) + "\n")

    per = Counter()
    for c in label_counts(dev).values():
        per.update(c)
    kosong = [n for i, n in enumerate(SH17_NAMES) if per[i] == 0]
    print(f"train_final {len(train)} -> dev {n_dev}, pool {len(pool)}")
    print("Objek per kelas di dev:", {n: per[i] for i, n in enumerate(SH17_NAMES)})
    assert not kosong, f"Kelas tanpa objek di dev: {kosong}"


if __name__ == "__main__":
    main()
