"""Dedup tahap kedua dengan embedding CLIP ViT-B/32, setelah pHash (02_dedup.py).

pHash hanya menangkap gambar yang sama setelah resize atau kompresi. Foto dari satu sesi
(orang dan tempat sama, sudut sedikit beda) lolos dari pHash, padahal bisa membuat test
terlihat lebih mudah. Embedding menilai kemiripan isi, jadi pasangan seperti itu tertangkap.

Aturan: hanya gambar train yang dibuang, test resmi tidak disentuh (tetap sebanding dengan
paper). Train dibuang kalau mirip gambar test mana pun, atau mirip gambar train lain yang
sudah disimpan (greedy, urut daftar), sehingga tidak ada pasangan tersisa di atas ambang.

Keluaran:
- results/dedup_embedding.csv        : semua pasangan cosine >= 0,90
- results/dedup_embedding.npz        : embedding, supaya ganti ambang tidak perlu GPU lagi
- results/hasil/dedup_embedding_contoh.jpg : contoh pasangan sekitar ambang untuk cek visual
- data/splits/train_final.txt        : train setelah dedup

Contoh: python scripts/02c_dedup_embedding.py --thr 0.95
"""
import argparse
import csv
import random
import sys
from pathlib import Path

import numpy as np
import torch
from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).parent))
from common import RESULTS, ROOT, SPLITS, read_list  # noqa: E402

CSV_MIN = 0.90
BANDS = [(0.90, 0.93), (0.93, 0.95), (0.95, 0.97), (0.97, 0.99), (0.99, 1.01)]


class Images(torch.utils.data.Dataset):
    def __init__(self, paths, tf):
        self.paths, self.tf = paths, tf

    def __len__(self):
        return len(self.paths)

    def __getitem__(self, i):
        with Image.open(self.paths[i]) as im:
            return self.tf(im.convert("RGB"))


def embed(paths):
    import clip
    model, tf = clip.load("ViT-B/32", device="cuda", download_root=str(ROOT / "weights"))
    loader = torch.utils.data.DataLoader(Images(paths, tf), batch_size=64, num_workers=4)
    out = []
    with torch.inference_mode():
        for x in loader:
            e = model.encode_image(x.cuda().type(model.dtype)).float()
            out.append(torch.nn.functional.normalize(e, dim=-1).cpu())
    return torch.cat(out).numpy().astype(np.float32)


def contact_sheet(rows, paths, path, per_band=5, thumb=220):
    """Tiap baris: beberapa pasangan dari satu rentang cosine, supaya ambang bisa dinilai mata."""
    rng = random.Random(0)
    h = thumb + 22
    sheet = Image.new("RGB", (per_band * (2 * thumb + 16), len(BANDS) * h), "white")
    draw = ImageDraw.Draw(sheet)
    for r, (lo, hi) in enumerate(BANDS):
        band = [x for x in rows if lo <= x[2] < hi]
        for c, (i, j, s) in enumerate(rng.sample(band, min(per_band, len(band)))):
            x = c * (2 * thumb + 16)
            for n, idx in enumerate((i, j)):
                with Image.open(paths[idx]) as im:
                    im = im.convert("RGB")
                    im.thumbnail((thumb, thumb))
                    sheet.paste(im, (x + n * thumb, r * h + 20))
            draw.text((x + 2, r * h + 4), f"{s:.3f} ({len(band)} pasangan di {lo:.2f}-{min(hi, 1):.2f})", fill="black")
    sheet.save(path, quality=85)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--thr", type=float, default=0.95)
    a = ap.parse_args()

    train, test = read_list(SPLITS / "train_dedup.txt"), read_list(SPLITS / "test.txt")
    paths = train + test
    n_train = len(train)
    npz = RESULTS / "dedup_embedding.npz"
    if npz.exists() and np.load(npz)["emb"].shape[0] == len(paths):
        emb = np.load(npz)["emb"].astype(np.float32)
    else:
        emb = embed(paths)
        np.savez_compressed(npz, emb=emb)  # float32: float16 menggeser cosine dan mengubah hasil di sekitar ambang

    rows = []
    for i in range(len(paths) - 1):  # per baris agar RAM aman
        s = emb[i + 1:] @ emb[i]
        rows += [(i, i + 1 + int(j), float(s[j])) for j in np.nonzero(s >= CSV_MIN)[0]]
    split = lambda i: "train" if i < n_train else "test"  # noqa: E731
    with open(RESULTS / "dedup_embedding.csv", "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["split_a", "img_a", "split_b", "img_b", "cosine"])
        w.writerows((split(i), Path(paths[i]).name, split(j), Path(paths[j]).name, f"{s:.4f}") for i, j, s in rows)
    (RESULTS / "hasil").mkdir(exist_ok=True)
    contact_sheet(rows, paths, RESULTS / "hasil" / "dedup_embedding_contoh.jpg")

    near = {}
    for i, j, s in rows:
        if s >= a.thr:
            near.setdefault(i, []).append(j)
            near.setdefault(j, []).append(i)
    bocor = {i for i in range(n_train) if any(j >= n_train for j in near.get(i, []))}
    keep = []
    kept = set()
    for i in range(n_train):
        if i not in bocor and not kept.intersection(near.get(i, [])):
            keep.append(train[i])
            kept.add(i)
    (SPLITS / "train_final.txt").write_text("\n".join(keep) + "\n")

    print(f"Pasangan cosine >= {CSV_MIN}: {len(rows)}; >= {a.thr}: {sum(s >= a.thr for *_, s in rows)}")
    print(f"Train masuk {n_train}, dibuang karena mirip test {len(bocor)}, "
          f"karena mirip train {n_train - len(bocor) - len(keep)}, sisa {len(keep)}")


if __name__ == "__main__":
    main()
