# Pipeline eksperimen

Semua perintah dijalankan dari folder proyek dengan Python dari `.venv`:

```
.venv\Scripts\python.exe scripts\<nama skrip> [argumen]
```

Rencana dan kriteria keputusan ada di `rencana_eksperimen.md`. Nopal memberi perintah lewat chat dan Claude yang menjalankan: `09_queue.py tahap2` untuk mulai, `09_queue.py --jeda` untuk berhenti dengan rapi, `14_estimasi.py` untuk sisa waktu.

## Urutan

| Langkah | Skrip | Fungsi |
|---|---|---|
| 0 | `00_check_env.py` | Cek versi Python, PyTorch, Ultralytics, CUDA, VRAM |
| 1 | `01_prepare_sh17.py` | Periksa SH17 asli, buat `data/splits/train_official.txt` dan `test.txt` (val resmi = test) |
| 2 | `02_dedup.py` | Cek duplikat pHash → `train_dedup.txt` |
| 2b | `02b_resize_sh17.py` | Salin SH17 ke 1280 px (`data/sh17_1280`) dan arahkan semua split ke sana |
| 2c | `02c_dedup_embedding.py` | Dedup embedding CLIP ViT-B/32 → `train_final.txt`, CSV, dan lembar cek visual |
| 2d | `02d_split_dev.py` | 10% jadi `dev.txt`, sisanya `pool.txt` |
| 3 | `03_zeroshot_yoloe.py --model M [--imgsz N]` | YOLOE-26 dan YOLO-World zero-shot lewat `val()` |
| 4 | `04_sample_fewshot.py` | Sampel k-shot nested, semua k dan seed; daftar unik dan daftar diulang |
| 5 | `05_train.py --model M --k K --seed S` atau `--full` | Adaptasi lalu evaluasi. `--eval-split dev` menulis ke `results/runs_dev/` |
| 6 | `06_fps.py --model M --tag T` | Ukur FPS dengan protokol seragam |
| 8 | `08_zeroshot_ov.py --model M` | Zero-shot Grounding DINO, OWLv2, dan evaluator terpadu |
| 9 | `09_queue.py tahap1\|tahap2\|tahap3\|tahap4 [--list]`, `09_queue.py --jeda` | Antrean: tahan pemadaman listrik, bisa dijeda dengan rapi |
| 10 | `10_prompt_ablation.py` | Ablation varian prompt teks |
| 11 | `11_cross_dataset.py zeroshot [model ...]\|trained` | Uji lintas dataset di semua split Construction-PPE |
| 12 | `12_violation.py [cek\|negasi-ov]` | Pelanggaran: GT turunan SH17 dan GT asli Construction-PPE. `cek` = lembar cek kotak `no_helmet`; `negasi-ov` = prompt negasi Grounding DINO-B dan OWLv2-B (Tahap 4) |
| 13 | `13_analyze.py` | Semua tabel (mean ± 95% CI), kelompok kelas, titik setara, grafik → `results/hasil/` |
| 14 | `14_estimasi.py [tahap]` | Perkiraan waktu dari kecepatan yang terukur |
| 15 | `15_gate.py` | Kriteria gerbang → `results/hasil/gerbang.md` |

Modul pendukung: `common.py` (path, kelas, prompt, kelompok kelas, **jadwal, batch, dan worker yang dikunci**),
`evalutil.py` (evaluasi `val()`), `detmetrics.py` (evaluator terpadu berbasis komponen Ultralytics),
`telemetry.py` (daya, suhu, RAM, cegah sleep).

## Lokasi hasil

- `results/runs/*.json`: hasil di test set, satu file per run
- `results/runs_dev/*.json`: hasil di dev set (uji jadwal, determinisme, uji worker)
- `results/runs_cross/`, `runs_violation/`, `runs_fps/`: hasil analisis tambahan
- `results/preds/*.npz`: prediksi mentah zero-shot
- `results/logs/`: log tiap run dan log antrean
- `results/hasil/`: ringkasan, grafik, gerbang
- `results/arsip_uji_kelayakan/`: hasil uji kelayakan lama; tidak dipakai di tabel baru
- `runs/train/<run>/weights/`: bobot. Few-shot memakai `last.pt`, data penuh `best.pt`

## Reproduksi

Antrean bisa dilanjutkan: job yang file hasilnya sudah ada dilewati, dan run data penuh melanjutkan dari
`last.pt` (atau `last_backup.pt` kalau rusak). Hasil training deterministik selama jumlah worker dan versi paket (`requirements-lock.txt`) sama.
