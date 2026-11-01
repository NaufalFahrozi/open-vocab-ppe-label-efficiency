"""Buat salinan SH17 dengan sisi terpanjang 1280 px, lalu arahkan semua split ke salinan itu.

Alasan:
- Gambar asli SH17 sampai 5760x3840 (22 MP). Decode JPEG sebesar itu di setiap
  iterasi membuat training lambat, dan solusi sebelumnya (cache="ram") membuat
  training tidak deterministik (peringatan resmi Ultralytics). Dengan gambar
  1280 px, training bisa jalan tanpa cache dan hasilnya bisa direproduksi.
- 1280 (bukan 640) agar masih ada ruang untuk eksperimen resolusi lebih tinggi
  dan untuk model seperti Grounding DINO (sisi pendek 800) atau OWLv2 (960).
- Label YOLO memakai koordinat ternormalisasi (0-1), jadi tidak perlu diubah.
- Semua gambar sudah diperiksa: JPEG RGB tanpa tag rotasi EXIF, jadi isi piksel
  tidak berputar. 18 file berekstensi .png sebenarnya JPEG; nama file dipertahankan.
"""
import shutil
import sys
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).parent))
from common import SH17, SH17_ORIG, SPLITS  # noqa: E402

LONG_SIDE = 1280


def resize(name):
    src, dst = SH17_ORIG / "images" / name, SH17 / "images" / name
    if dst.exists():
        return
    with Image.open(src) as im:
        w, h = im.size
        s = LONG_SIDE / max(w, h)
        size = (round(w * s), round(h * s))
        im.draft("RGB", (size[0] * 2, size[1] * 2))  # decode cepat via DCT scaling, tetap >= 2x target
        im = im.convert("RGB").resize(size, Image.LANCZOS)
        im.save(dst, format="JPEG", quality=95)


def main():
    (SH17 / "images").mkdir(parents=True, exist_ok=True)
    names = sorted(p.name for p in (SH17_ORIG / "images").iterdir())
    with ProcessPoolExecutor(max_workers=6) as ex:
        list(ex.map(resize, names, chunksize=32))
    if not (SH17 / "labels").exists():
        shutil.copytree(SH17_ORIG / "labels", SH17 / "labels")

    # Split yang sudah dibuat (termasuk hasil dedup pada gambar asli) cukup diarahkan
    # ke folder baru; isi dan urutannya sama persis.
    old, new = str(SH17_ORIG / "images"), str(SH17 / "images")
    for f in ["train_official.txt", "test.txt", "train_dedup.txt"]:
        p = SPLITS / f
        p.write_text(p.read_text().replace(old, new))
    print(f"Selesai: {len(names)} gambar -> {SH17 / 'images'}")


if __name__ == "__main__":
    main()
