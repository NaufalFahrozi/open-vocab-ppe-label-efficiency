"""Periksa SH17 hasil ekstrak: struktur folder, format label, daftar kelas, dan split.

SH17 dari Kaggle sudah menyediakan label format YOLO (labels/*.txt) beserta
train_files.txt dan val_files.txt. Split "val" resmi kita pakai sebagai TEST SET,
karena angka baseline paper (YOLOv9-e 70,9 mAP50) dilaporkan di split itu,
jadi hasil kita bisa langsung dibandingkan.
"""
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from common import SH17_ORIG as SH17, SH17_NAMES, SPLITS  # noqa: E402  (data asli, sebelum diperkecil)

IMG_EXT = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}


def label_path(img: Path) -> Path:
    return SH17 / "labels" / (img.stem + ".txt")


def resolve(lines, images):
    """Daftar split resmi berisi nama/path relatif; ubah jadi path absolut lokal."""
    by_name = {p.name: p for p in images}
    out, missing = [], []
    for l in lines:
        name = Path(l.strip().replace("\\", "/")).name
        if not name:
            continue
        (out if name in by_name else missing).append(by_name.get(name, name))
    return out, missing


def stats(imgs):
    inst, img_has = Counter(), Counter()
    bad = 0
    for p in imgs:
        lp = label_path(p)
        if not lp.exists():
            continue
        seen = set()
        for row in lp.read_text().split("\n"):
            parts = row.split()
            if not parts:
                continue
            if len(parts) != 5:
                bad += 1
                continue
            c = int(parts[0])
            xywh = list(map(float, parts[1:]))
            if not (0 <= c < len(SH17_NAMES)) or any(v < 0 or v > 1.0001 for v in xywh):
                bad += 1
            inst[c] += 1
            seen.add(c)
        img_has.update(seen)
    return inst, img_has, bad


def main():
    print("Isi folder SH17:", sorted(p.name for p in SH17.iterdir()))
    images = sorted(p for p in (SH17 / "images").iterdir() if p.suffix.lower() in IMG_EXT)
    labels = list((SH17 / "labels").glob("*.txt"))
    print(f"Gambar: {len(images)} | file label: {len(labels)}")
    print("Contoh label:", labels[0].name)
    print(labels[0].read_text().strip().split("\n")[:3])

    no_label = [p for p in images if not label_path(p).exists()]
    print(f"Gambar tanpa file label: {len(no_label)}")

    SPLITS.mkdir(parents=True, exist_ok=True)
    out = {}
    for official, ours in [("train_files.txt", "train_official"), ("val_files.txt", "test")]:
        lines = (SH17 / official).read_text().splitlines()
        found, missing = resolve(lines, images)
        print(f"{official}: {len(lines)} baris, ditemukan {len(found)}, hilang {len(missing)}")
        (SPLITS / f"{ours}.txt").write_text("\n".join(str(p) for p in found) + "\n")
        out[ours] = found
    overlap = {p.name for p in out["train_official"]} & {p.name for p in out["test"]}
    print(f"Nama file yang ada di train dan test sekaligus: {len(overlap)}")

    for split, imgs in out.items():
        inst, img_has, bad = stats(imgs)
        print(f"\n[{split}] {len(imgs)} gambar, {sum(inst.values())} objek, baris label rusak: {bad}")
        print(f"{'id':>3} {'kelas':<14}{'objek':>8}{'gambar':>8}")
        for c, n in enumerate(SH17_NAMES):
            print(f"{c:>3} {n:<14}{inst[c]:>8}{img_has[c]:>8}")


if __name__ == "__main__":
    main()
