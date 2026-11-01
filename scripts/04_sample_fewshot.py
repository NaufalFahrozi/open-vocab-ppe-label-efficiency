"""Ambil sampel k-shot bersarang (nested) dari pool, untuk semua k dan seed sekaligus.

Definisi k-shot di sini: himpunan gambar sehingga SETIAP kelas punya minimal k objek berlabel,
dengan SEMUA anotasi di gambar terpilih tetap dipertahankan.

Alasan tidak memotong anotasi menjadi tepat k objek (seperti file few-shot TFA untuk COCO):
SH17 rata-rata ~9 objek per gambar. Kalau anotasi dibuang, objek yang masih terlihat akan
dianggap latar belakang saat training (false negative buatan). Konsekuensinya, kelas yang sering
muncul punya lebih dari k objek; jumlah sebenarnya dicatat di file ringkasan.

Nested mengikuti kode TFA: per seed satu permutasi pool, k diproses menaik mulai dari sampel k
sebelumnya, kelas paling jarang lebih dulu. Jadi sampel k = 5 selalu memuat seluruh sampel k = 1,
dan perbedaan antar k tidak tercampur dengan keberuntungan pengambilan gambar.

Kelas yang objeknya di pool kurang dari k memakai semua yang tersedia dan dicatat di "kelas_kurang".

Oversampling: daftar gambar diulang utuh sampai satu epoch >= MIN_BATCH batch. Tanpa ini k kecil
hanya punya 1-2 batch per epoch, sehingga jumlah update bobot dan overhead tiap epoch tidak seragam.

Keluaran di data/splits/fewshot/: kK_seedS.txt (unik), kK_seedS_train.txt (diulang), kK_seedS.json.
"""
import json
import math
import random
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from common import FEWSHOT_BATCH, SH17_NAMES, SPLITS, label_counts, read_list  # noqa: E402

KS, SEEDS = [1, 5, 10, 30, 100], [0, 1, 2, 3, 4]
MIN_BATCH = 5


def sample_nested(counts, seed):
    """{k: (daftar gambar, jumlah objek)} untuk satu seed; assert memastikan tiap k memuat k sebelumnya."""
    total = Counter()
    for c in counts.values():
        total.update(c)
    order = sorted(range(len(SH17_NAMES)), key=lambda c: total[c])
    perm = list(counts)
    random.Random(seed).shuffle(perm)

    chosen, have, hasil = [], Counter(), {}
    for k in KS:
        prev = set(chosen)
        for c in order:
            for p in perm:
                if have[c] >= k:
                    break
                if counts[p][c] > 0 and p not in chosen:
                    chosen.append(p)
                    have.update(counts[p])
        assert prev <= set(chosen), "sampel tidak nested"
        assert all(have[c] >= min(k, total[c]) for c in order), f"ada kelas dengan objek < {k}"
        hasil[k] = (list(chosen), Counter(have))
    return hasil


def main():
    pool = read_list(SPLITS / "pool.txt")
    counts = label_counts(pool)
    out = SPLITS / "fewshot"
    out.mkdir(exist_ok=True)
    print("seed " + " ".join(f"k{k:<4}" for k in KS) + " (jumlah gambar unik)")
    for seed in SEEDS:
        res = sample_nested(counts, seed)
        for k, (chosen, have) in res.items():
            name = f"k{k}_seed{seed}"
            ulang = math.ceil(MIN_BATCH * FEWSHOT_BATCH / len(chosen))
            (out / f"{name}.txt").write_text("\n".join(chosen) + "\n")
            (out / f"{name}_train.txt").write_text("\n".join(chosen * ulang) + "\n")
            (out / f"{name}.json").write_text(json.dumps({
                "k": k, "seed": seed, "n_images": len(chosen), "n_boxes": sum(have.values()), "ulang": ulang,
                "kelas_kurang": {SH17_NAMES[c]: have[c] for c in range(len(SH17_NAMES)) if have[c] < k},
                "instances_per_class": {SH17_NAMES[c]: have[c] for c in range(len(SH17_NAMES))}}, indent=2))
        print(f"{seed:<4} " + " ".join(f"{len(res[k][0]):<5}" for k in KS))


if __name__ == "__main__":
    main()
