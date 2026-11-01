"""Cek duplikat cepat dengan perceptual hash (pHash) sebelum membagi data.

Urutan pipeline: 01_prepare -> 02_dedup (pada gambar asli) -> 02b_resize.

Alasan pakai pHash: murah (tanpa GPU), tahan terhadap resize/kompresi ulang,
dan cukup untuk menangkap gambar yang sama yang diunggah ulang. Near-duplicate
yang lebih halus (crop, sudut lain) butuh embedding (mis. CLIP); itu tahap lanjut.

Keluaran:
- results/dedup_pairs.csv : semua pasangan dengan jarak Hamming <= THRESH
- data/splits/train_dedup.txt : train resmi minus (a) gambar yang mirip dengan
  gambar test (mencegah kebocoran) dan (b) duplikat di dalam train (sisakan satu)
"""
import csv
import os
import sys

os.environ.setdefault("OPENBLAS_NUM_THREADS", "1")  # sebelum numpy/scipy di-import
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

import imagehash
import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).parent))
from common import RESULTS, SPLITS  # noqa: E402

THRESH = 6  # dari 64 bit; <= 6 umumnya gambar yang sama setelah resize/kompresi


def phash(path):
    with Image.open(path) as im:
        im.draft("L", (256, 256))  # decode JPEG versi kecil, jauh lebih cepat
        return int(str(imagehash.phash(im.convert("L"))), 16)


def read_list(p):
    return [l.strip() for l in open(p) if l.strip()]


def main():
    train = read_list(SPLITS / "train_official.txt")
    test = read_list(SPLITS / "test.txt")
    paths = train + test
    split = ["train"] * len(train) + ["test"] * len(test)

    # Batasi jumlah proses: tiap proses memuat scipy dan men-decode JPEG besar,
    # 16 proses sekaligus menghabiskan RAM laptop 16 GB.
    with ProcessPoolExecutor(max_workers=6) as ex:
        hashes = list(ex.map(phash, paths, chunksize=64))
    h = np.array(hashes, dtype=np.uint64)

    # Jarak Hamming semua pasangan, per baris agar hemat memori.
    pairs = []
    for i in range(len(h) - 1):
        x = np.bitwise_xor(h[i], h[i + 1:])
        d = np.unpackbits(x.view(np.uint8).reshape(-1, 8), axis=1).sum(1)
        for j in np.nonzero(d <= THRESH)[0]:
            pairs.append((i, i + 1 + int(j), int(d[j])))

    RESULTS.mkdir(exist_ok=True)
    with open(RESULTS / "dedup_pairs.csv", "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["split_a", "img_a", "split_b", "img_b", "hamming"])
        for i, j, d in pairs:
            w.writerow([split[i], Path(paths[i]).name, split[j], Path(paths[j]).name, d])

    drop = set()
    n_cross = n_train = n_test = 0
    for i, j, _ in pairs:
        si, sj = split[i], split[j]
        if si == sj == "test":
            n_test += 1  # test resmi tidak diubah agar tetap sebanding dengan paper
        elif si != sj:
            n_cross += 1
            drop.add(i if si == "train" else j)
        else:
            n_train += 1
            drop.add(j)  # sisakan yang pertama
    keep = [p for k, p in enumerate(train) if k not in drop]
    (SPLITS / "train_dedup.txt").write_text("\n".join(keep) + "\n")

    print(f"Gambar diperiksa       : {len(paths)} (train {len(train)}, test {len(test)})")
    print(f"Pasangan mirip (<= {THRESH}) : {len(pairs)}")
    print(f"  train-test (bocor)   : {n_cross}")
    print(f"  train-train          : {n_train}")
    print(f"  test-test            : {n_test} (dibiarkan)")
    print(f"Train setelah dedup    : {len(keep)} (dibuang {len(drop)})")


if __name__ == "__main__":
    main()
