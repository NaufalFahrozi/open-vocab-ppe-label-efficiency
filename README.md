# Efisiensi Label Deteksi APD: Open-Vocabulary vs YOLO26

Studi pendahuluan untuk calon skripsi S1 Informatika. Pertanyaannya: **berapa banyak data berlabel yang benar-benar dibutuhkan untuk mendeteksi Alat Pelindung Diri (APD)?** Detektor open-vocabulary bisa mendeteksi objek hanya dari nama kelasnya, sedangkan detektor biasa perlu dilatih dengan contoh.

Repo ini memetakan kurva **zero-shot → few-shot → data penuh** pada dataset SH17, dengan protokol multi-seed dan kriteria keputusan yang ditulis sebelum hasil keluar.

> **Status:** sedang berjalan. Tahap 1 (validasi pipeline dan pemilihan jadwal) belum selesai, dan belum ada kesimpulan penelitian. Topik belum diajukan ke dosen pembimbing.

## Rumusan masalah

1. Bagaimana performa model open-vocabulary secara zero-shot dibandingkan YOLO26 yang dilatih penuh?
2. Berapa data berlabel per kelas yang dibutuhkan agar keduanya setara?
3. Kelas APD mana, terutama kelas pelanggaran, yang paling sulit dideteksi tanpa data berlabel?

## Desain

| Komponen | Isi |
|---|---|
| Dataset utama | SH17 (17 kelas). Val resmi dipakai sebagai test set, tidak diubah |
| Uji lintas dataset | Construction-PPE, tidak ikut training |
| Model open-vocabulary | YOLOE-26, YOLO-World-v2, Grounding DINO, OWLv2 |
| Pembanding | YOLO26s |
| Skenario | Zero-shot; k = 1, 5, 10, 30, 100 per kelas; data penuh |
| Pengulangan | 5 seed, rata-rata ± 95% CI, selisih berpasangan per seed |
| Metrik | mAP50, mAP50-95, AP per kelas, recall kelas pelanggaran, FPS |

Rincian protokol dan kriteria GO/NO-GO ada di [`rencana_eksperimen.md`](rencana_eksperimen.md). Urutan dan fungsi skrip ada di [`scripts/README.md`](scripts/README.md).

## Isi repo

| Lokasi | Isi |
|---|---|
| `scripts/` | Pipeline: dedup, sampling, training, evaluasi, antrean tahan pemadaman listrik, analisis |
| `data/splits/`, `data/yaml/` | Daftar nama gambar per split dan sampel k-shot, supaya pembagian datanya bisa diperiksa |
| `results/runs*/`, `results/hasil/` | Metrik per run dan ringkasan |

**Gambar dataset dan bobot model tidak disertakan.** Unduh dataset dari sumber resminya. Daftar split memakai path lokal, jadi perlu disesuaikan kalau dijalankan di komputer lain.

## Menjalankan

Python 3.13, PyTorch 2.15 dengan CUDA, dan Ultralytics 8.4. Versi lengkap ada di `requirements-lock.txt`. Pasang PyTorch dari index CUDA dulu, lalu `ultralytics` tanpa `-U`.

```
python scripts/09_queue.py tahap1
python scripts/09_queue.py tahap1 --list
python scripts/09_queue.py --jeda
python scripts/14_estimasi.py
```

## Sumber dan lisensi pihak ketiga

- **SH17:** Ahmad & Rahimi (2024), arXiv:2407.04590, CC BY-NC-SA 4.0.
- **Construction-PPE:** Ultralytics, AGPL-3.0.
- **Ultralytics (YOLO26, YOLOE-26, YOLO-World):** AGPL-3.0. Skrip di repo ini memakainya, jadi perhatikan syarat lisensi tersebut kalau memakai ulang.
- **Grounding DINO dan OWLv2:** bobot dari Hugging Face, mengikuti lisensi masing-masing.
