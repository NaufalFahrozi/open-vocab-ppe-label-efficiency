# Rencana Studi Kelayakan Topik

Disusun 1 November 2026, versi lengkap. Menggantikan semua rencana sebelumnya, termasuk versi ±12 jam.

**Tujuan:** memutuskan apakah topik ini layak diajukan sebagai judul skripsi. Judul belum diajukan dan
skripsi belum dimulai. Kalau hasilnya GO, laporan dibawa ke dosen pembimbing bersama usulan judul.
Kalau NO-GO, topik ditinggalkan. Kriteria ditulis di sini **sebelum hasil keluar** supaya keputusannya
tidak terpengaruh waktu yang sudah terpakai.

Tidak ada batas durasi; isi eksperimen tidak dipotong demi waktu, dan pengerjaannya dicicil. Tahap 2 ke atas baru jalan setelah Nopal menulis "gas".

## Alur keputusan

| Gerbang | Kapan | GPU kumulatif | Pertanyaan |
|---|---|---|---|
| 0. Literatur (lolos) | Selesai | 0 | Apakah penelitian yang sama sudah ada? |
| 1. Teknis | Setelah Tahap 1 | ±1,5 jam | Apakah pipeline sah dan jadwal training sudah benar? |
| 2. Sinyal | Setelah Tahap 2 | ±6 jam | Apakah kurvanya informatif, atau semua metode seri? |
| 3. Akhir | Setelah Tahap 3 | ±22 jam | GO atau NO-GO, dengan bukti lengkap |

Setiap tahap adalah bagian dari protokol lengkap, jadi hasil yang sudah ada tetap terpakai saat
lanjut. Kalau gerbang gagal, GPU berhenti di situ. Tahap 4 hanya jalan kalau Gerbang 3 GO.

## Gerbang 0: literatur

Hasil pencarian 1 November 2026: **belum ditemukan** studi yang memetakan zero-shot → few-shot → data
penuh dengan detektor open-vocabulary untuk APD. Pencarian ini terbatas, jadi belum membuktikan
studinya tidak ada.

| Paper (sudah dibaca bagian intinya) | Isi | Dampak |
|---|---|---|
| Essien & Frimpong 2026, Sensors 26(17):5646 | Personel tambang, satu kelas. YOLO-World, Grounding DINO, OWL-ViT, OWLv2 vs YOLO fine-tuned, 25.117 gambar latih. Zero-shot AP50 0,25–0,51; fine-tuned 0,88–0,91 | Bukan APD dan tanpa kurva few-shot. Topik ini mengisi bagian tengah yang tidak mereka uji, dengan banyak kelas. Pencarian prompt dan multi-kelas disebut sebagai pekerjaan lanjutan |
| Çarklı Yavuz 2026, Electronics 15(6):1146 | YOLO26 vs YOLOv11 pada CHV, SHEL5K, SH17. Satu kali run per konfigurasi | Tanpa model open-vocabulary, tanpa zero-shot, tanpa protokol k per kelas. "Few-shot" di sini berarti dataset kecil. **Bukan duplikat** |

Dua catatan untuk laporan:
- **Jangan pakai angka SH17 dari Electronics sebagai acuan G1.** Paper itu menulis SH17 berisi 1.620 gambar latih, padahal 1.620 adalah ukuran split val resmi dari total 8.099 gambar. YOLO26s-nya 76,5 mAP50, jauh di atas YOLOv8s 63,7 di paper asli SH17. Pembagian datanya perlu diperjelas sebelum dibandingkan.
- **Perbedaan arah literatur:** Essien & Frimpong dan Gil & Lee berbeda tugas, jadi bukan konflik langsung. Yang lebih tepat dibandingkan: Roboflow100-VL (zero-shot umumnya di bawah fine-tuned) dan Madan dkk. (Grounding DINO zero-shot mengalahkan beberapa detektor few-shot di COCO), keduanya dikutip Essien & Frimpong. Sumber aslinya masih perlu dibaca.

**Status: lolos (1 November 2026).** Nopal sudah melakukan studi literatur di sesi Claude chat, yang menjadi dasar rencana ini; cek manual tambahan tidak diperlukan.

Aturan yang tetap berlaku kalau kelak ditemukan paper baru:
- **NO-GO:** ada paper dengan APD, detektor open-vocabulary, dan kurva zero/few/full yang sama, dan tidak
  ada sudut baru.
- **Lanjut:** tidak ada, atau hanya tumpang tindih sebagian.

## Protokol yang dikunci

| Topik | Keputusan | Alasan |
|---|---|---|
| Test set | Val resmi SH17 (1.620 gambar), tidak diubah | Sama dengan baseline paper |
| Dedup | pHash yang ada + embedding CLIP (mulai cosine ≥ 0,95, cek visual). Hanya gambar train yang dibuang | Foto satu sesi bisa bocor dan lolos dari pHash |
| Dev set | 10% train diacak dengan seed tetap | Memilih jadwal dan memantau data penuh tanpa menyentuh test set |
| Sampel k-shot | k = 1, 5, 10, 30, 100; seed 0–4; nested; tiap kelas ≥ k objek (kelas yang objeknya kurang dari k memakai semua yang tersedia, dan dicatat); semua anotasi dipertahankan | Nested mengikuti kode TFA. Beda dari TFA yang hanya menyimpan anotasi kelas sasaran: SH17 padat objek, jadi objek yang dibuang akan terbaca sebagai latar |
| Metode | **Utama:** YOLOE-26s linear probing dan fine-tune penuh, masing-masing vs YOLO26s. **Tambahan:** YOLOE-26s visual prompt; YOLO-World-v2 S fine-tune (Tahap 4) | Linear probing membekukan hampir semua layer, jadi bisa kalah karena dibekukan. Fine-tune penuh vs YOLO26 memisahkan efek bobot awal dari cara melatih |
| Oversampling | Daftar gambar k kecil diulang sampai satu epoch ≥ 5 batch | Jadwal k = 1, 5, 10 jadi seragam dan overhead per epoch tidak membengkak |
| Jadwal few-shot | Dipilih di dev set pada Tahap 1, lalu dikunci | Lihat bagian "Masalah jadwal" |
| Data penuh | YOLO26s (Tahap 3) dan YOLOE-26s fine-tune (Tahap 4); train minus dev; batch 16; 640 px; 200 epoch; patience 30; val di dev; `best.pt`; MuSGD lr 0,01, momentum 0,9, `warmup_bias_lr` 0 | Paper SH17 memakai 640 px dan 200 epoch. Optimizer ditulis eksplisit agar tidak bergantung pada ambang 10.000 iterasi mode `auto` |
| Preprocessing evaluasi | `rect=False` di semua evaluasi YOLO | Hasil tidak bergantung pada susunan batch, dan visual prompt memang memakai mode ini |
| Evaluator | Model YOLO lewat `val()`; Grounding DINO dan OWLv2 lewat `detmetrics.py` (fungsi AP Ultralytics) | Target selisih YOLOE-26s antar jalur < 0,2 poin; kalau lebih, dilaporkan |
| Prompt utama | Nama kelas yang dirapikan (`common.PROMPTS`) | Ablation tidak boleh mengganti prompt utama |
| Kelompok kelas | APD: ear-mufs, face-guard, face-mask, glasses, gloves, helmet, medical-suit, safety-suit, safety-vest, shoes. Bagian tubuh: ear, face, foot, hands, head. Lainnya: person, tool | Pola awal menunjukkan dua kelompok ini bisa berlawanan |
| Kelas pelanggaran | SH17: `ear, face, hands, foot`, recall dan mAP50. Construction-PPE: `no_helmet` (485 kotak) dan `no_gloves` (556 kotak) | Construction-PPE punya label pelanggaran asli, sedangkan SH17 hanya turunan |
| Lintas dataset | Semua split Construction-PPE (±1.416 gambar), tidak dipakai training | Sesuai desain awal. Implementasi lama hanya memakai 141 gambar test |
| Statistik | Rata-rata ± 95% CI distribusi t; selisih berpasangan per seed | Sampel gambar sama antar metode per seed |

`D_LP(k)` dan `D_FT(k)` = mAP50 linear probing atau fine-tune penuh − mAP50 YOLO26 pada k yang sama, berpasangan per seed. Keduanya dilaporkan apa adanya; tidak dipilih yang terbaik setelah melihat test.

## Masalah jadwal

`trainer.py:324` memakai `accumulate = round(nbs / batch)`. Dengan `nbs` 64 dan batch 8, bobot diperbarui
setiap 8 batch. "500 langkah" di uji kelayakan sebenarnya hanya **±62 update bobot**. Perbandingan
YOLOE vs YOLO26 di laporan itu belum boleh disimpulkan.

Uji di dev set, seed 0, k = 1 dan 10, untuk linear probing dan YOLO26s. Fine-tune penuh YOLOE memakai jadwal YOLO26:

| Jadwal | nbs | Epoch | Update bobot (k ≤ 10) |
|---|---|---|---|
| A (default) | 64 | 100 | ±62 |
| B | 8 | 100 | ±500 |
| C | 8 | 300 | ±1.500 |

Pilih mAP50 dev rata-rata tertinggi per metode. Selisih di bawah 1 poin dianggap seri dan jadwal lebih
pendek yang dipilih. Kalau C menang, estimasi waktu dihitung ulang sebelum "gas". `SCHEDULE` di `common.py` saat ini baru nilai awal dan harus ditulis dari hasil uji ini.

## Tahapan

Estimasi memakai jadwal B dan log laptop. Kecepatan data penuh belum pernah diukur, jadi diukur di Tahap 1,
dan Claude melaporkan estimasi terbaru dari `scripts/14_estimasi.py`.

| Tahap | Isi | Estimasi GPU |
|---|---|---|
| 1. Persiapan | Dedup, dev set, sampel, uji batch dan worker, determinisme, kecepatan data penuh (1 epoch), uji jadwal | ±1,5 jam |
| 2. Sinyal | Zero-shot: YOLOE n–x, YOLO-World S–X, YOLOE s/l di 1280 px, Grounding DINO-B, OWLv2-B, ablation prompt (±1 jam). Few-shot seed 0–2 × k = 1, 5, 10, 30 × visual prompt, linear probing, fine-tune YOLOE, YOLO26, 48 run (±3,4 jam). Hasil Grounding DINO-T dipakai ulang | ±4,5 jam |
| 3. Inti lengkap | Seed 3–4 × 4 k × 4 metode, 32 run (±2,3 jam). k = 100 × 5 seed × 4 metode, 20 run (±5 jam). YOLO26s data penuh 200 epoch (±7 jam, bisa lebih pendek kalau patience berhenti). Lintas dataset, pelanggaran, FPS di mode Performance (±1,5 jam) | ±16 jam |
| **Sampai keputusan GO/NO-GO** | | **±22 jam** |
| 4. Pelengkap, hanya kalau GO | YOLOE-26s fine-tune data penuh (±7 jam). YOLO-World-v2 S fine-tune × k = 1, 5, 10, 30 × 5 seed (±2,5 jam). OWLv2-L zero-shot dan lintas dataset (±1 jam). Prompt negasi Grounding DINO-B dan OWLv2-B (±1,5 jam) | ±12 jam |
| **Total lengkap** | | **±34 jam** |

## Kontrol lewat chat

Nopal tidak menjalankan skrip sendiri. Semua perintah lewat chat di sesi utama, lalu Claude yang menjalankan:

| Nopal bilang | Yang dilakukan Claude |
|---|---|
| "gas" | Cek charger, suhu, disk, dan tidak ada proses lain, lalu mulai atau lanjutkan tahap berikutnya di background |
| "pause" atau mau pergi | Few-shot diselesaikan dulu; data penuh langsung dihentikan dan lanjut dari epoch terakhir. Claude memberi tahu kapan laptop aman ditutup |
| "lanjut" | Menjalankan tahap yang sama; job yang selesai dilewati |
| "progres?" | Membaca log sekali, melaporkan sisa pekerjaan dan estimasi |

Kalau mati listrik atau laptop mati, cukup bilang "lanjut". Paling banyak mengulang satu run few-shot atau satu
epoch data penuh. Claude tidak memantau berkala, dan hanya satu sesi yang menjalankan GPU pada satu waktu.

## Pembagian sesi Claude

Sesi utama memegang kontrol GPU. Sesi terpisah hanya untuk pekerjaan yang butuh banyak token, dan membaca
`CLAUDE.md` serta dokumen ini sehingga konteksnya tetap ada.

| Sesi | Isi | Effort |
|---|---|---|
| A | Kode dan Tahap 1, sampai Gerbang 1 | Medium |
| Utama | Menjalankan, menjeda, dan melanjutkan Tahap 2–4; meneruskan hasil gerbang | Sesuai pilihan Nopal |
| Baru | Membaca Gerbang 2 dan 3, jika perlu analisis mendalam | High |
| Baru | Laporan GO/NO-GO dan usulan judul | High |

## Kriteria gerbang

`scripts/15_gate.py` menghitung kriteria 1–3 otomatis dan menulis `results/hasil/gerbang.md`.

**Gerbang 1 (teknis)**, harus lolos semua:
- Run ulang dengan worker baru menghasilkan AP identik sampai 6 desimal.
- VRAM puncak ≤ 5,2 GB, RAM bebas ≥ 3 GB.
- Jadwal terkunci, dan estimasi total diperbarui dengan kecepatan nyata.

**Gerbang 2 (sinyal, 3 seed, k ≤ 30)**, berhenti dan evaluasi kalau salah satu terjadi:
1. **Seri:** di semua k, |D_LP(k)| dan |D_FT(k)| < 2 poin atau arahnya tidak konsisten di 3 seed, baik untuk
   seluruh kelas maupun per kelompok APD dan bagian tubuh.
2. **Terlalu bising:** SD mAP50 antar seed pada k = 10 > 5 poin untuk linear probing atau YOLO26.
3. **Zero-shot tak berguna:** model open-vocabulary terbaik punya rata-rata AP50 kelompok APD < 20.

**Gerbang 3 (akhir, 5 seed)**, GO kalau semua terpenuhi:

| No | Kriteria | Menjawab |
|---|---|---|
| G1 | YOLO26s data penuh ≥ 58 mAP50. Acuan paper: YOLOv8s 63,7, YOLOv9s 65,3, YOLOv10s 62,7 (200 epoch, data train lebih banyak). Kalau kurang, debug dulu, jangan langsung simpulkan | Validitas pipeline |
| G2 | Selisih zero-shot terbaik vs YOLO26 penuh bisa dilaporkan, dengan bukti per kelas | RM 1 |
| G3 | Ada k dengan 95% CI D_LP(k) atau D_FT(k) tidak memuat 0 dan \|D\| ≥ 2 poin, untuk seluruh kelas atau satu kelompok | RM 2 |
| G4 | Minimal 3 kelas zero-shot AP50 < 20 dan 3 kelas ≥ 50, dan uji `no_helmet` serta `no_gloves` menghasilkan AP | RM 3 |
| G5 | Tidak ada paper baru yang menggugurkan Gerbang 0 | Kebaruan |

**Arti hasilnya:**

| Pola | Keputusan |
|---|---|
| YOLOE unggul di k kecil dan YOLO26 menyusul di k ≤ 100 | **GO kuat.** RM 2 punya jawaban angka yang jelas |
| YOLOE tetap unggul sampai k = 100, YOLO26 baru menang di data penuh | **GO** |
| Linear probing kalah tetapi fine-tune penuh setara atau unggul | **GO**: bobot awal open-vocabulary berguna, pembekuan yang membatasi |
| Rata-rata seri, tetapi APD dan bagian tubuh berlawanan | **GO dengan fokus per kelompok kelas**; judul mungkin perlu disesuaikan |
| YOLO26 unggul sejak k = 1 | **GO sempit:** zero-shot hanya berguna saat label nol. Tetap jawaban sah, tapi bahas dengan dosen apakah cukup menarik |
| G3 gagal di semua level, atau G5 gagal | **NO-GO** |

GO berarti topik layak diajukan. Persetujuan tetap di tangan dosen, termasuk apakah studi komparatif tanpa
pembuatan sistem diterima di prodi; hal itu tidak bisa dijawab eksperimen.

## Spesifikasi perubahan kode (Tahap 1)

1. `02c_dedup_embedding.py`: CLIP ViT-B/32, simpan `results/dedup_embedding.csv` dan satu lembar contoh
   pasangan sekitar ambang untuk dicek visual. Keluaran `data/splits/train_final.txt`.
2. Dev set: `data/splits/dev.txt` dan `pool.txt`, seed tetap. Cek setiap kelas punya objek di dev.
3. `04_sample_fewshot.py`: per seed satu permutasi pool, proses k menaik mulai dari sampel k sebelumnya,
   kelas rarest-first. Assert nested. Tulis `kK_seedS.txt` (unik) dan `kK_seedS_train.txt` (diulang).
4. `05_train.py`: argumen `--nbs`, `--epochs`, dan `--eval-split dev|test`. Yaml `train` memakai daftar yang diulang,
   `val` memakai daftar unik (sumber visual prompt). Mode data penuh sesuai tabel protokol, termasuk
   `resume=True` kalau `last.pt` masih berisi optimizer. Catat `resumed` dan optimizer ke JSON. Ganti
   `--time-hours` dan logika `{SISA_JAM}`; keduanya dihapus.
5. `evalutil.py`, `detmetrics.py`: `rect=False` di semua jalur. Parameter `imgsz` untuk uji 1280 px.
6. `03_zeroshot_yoloe.py`: dukung YOLO-World lewat `val()`. Cek hasilnya mendekati nilai lama.
7. `09_queue.py`: fase `tahap1`, `tahap2`, `tahap3`. Pantau charger tiap 20 detik; kalau AC hilang > 60 detik,
   matikan job, tunggu listrik, ulangi job. Jeda sebelum job berikutnya kalau GPU ≥ 90 °C. Timeout 90 menit
   untuk Grounding DINO/OWLv2, 12 jam untuk data penuh, 45 menit untuk lainnya. Timeout lama akan
   membunuh run data penuh, jadi ini wajib diperbaiki.
8. `11_cross_dataset.py`: semua split, ulangi cek pHash terhadap SH17. Model terlatih: k = 10 dan 30, 5 seed,
   linear probing dan YOLO26, plus data penuh. Tetap catat 5 kelas sepadan.
9. `12_violation.py`: tambah GT asli Construction-PPE. `no_helmet`: aturan head-helmet vs prompt
   `head without helmet` dan `bare head`. `no_gloves`: kelas `hands` vs prompt `hand without gloves`. Cek
   visual dulu bahwa kotak `no_helmet` memang seukuran kepala. GT turunan SH17 tetap ada sebagai pelengkap.
10. `13_analyze.py`: tabel per kelompok kelas, jumlah gambar dan kotak berlabel per k, titik setara otomatis.
    `15_gate.py` baru. `14_estimasi.py` dan `README.md` diperbarui. Hapus `07_summarize.py`.
11. Perbarui `requirements-lock.txt`. Hasil few-shot lama pindah ke arsip, jangan masuk tabel baru.

12. Kode sudah ditulis sesi sebelumnya; perbarui agar sesuai versi lengkap ini: `KS` tambah 100 di `04`, `09`, `13`, `15`
    (Gerbang 2 tetap k ≤ 30); `yoloe-ft` masuk metode Tahap 2 dan 3; data penuh 200 epoch; fase `tahap2`, `tahap3`,
    `tahap4`; timeout 90 menit untuk k = 100 dan 24 jam untuk data penuh; `15_gate.py` memakai D_LP dan D_FT.
13. Runner bisa dijeda dengan rapi lewat `09_queue.py --jeda` (menulis file penanda): few-shot selesai dulu, data penuh
    dihentikan. Runner menyalin `last.pt` ke `last_backup.pt` tiap kali berubah; kalau `last.pt` rusak saat lanjut,
    pakai cadangan. Tidak perlu file .bat untuk pengguna.
14. Tahap 4: YOLO-World lewat trainer resmi Ultralytics (cek dokumentasi, jangan ditebak). Kalau tidak jalan, catat
    sebagai temuan dan lewati; inti penelitian tetap utuh.

Uji kecil setelah kode selesai, sebelum Tahap 1 dijalankan: satu run k = 1 dengan daftar yang diulang, satu epoch
data penuh, satu job yang dihentikan paksa lalu dilanjutkan, satu kali `--jeda`.

## Pemakaian GPU dan pengaman

Laptop didedikasikan untuk eksperimen, jadi batas dinaikkan berdasarkan pengukuran:
- **Data penuh:** batch 16; turun ke 12 kalau VRAM puncak > 5,2 GB.
- **Few-shot:** batch 8. Dataset kecil dan yang membatasi CPU, bukan GPU.
- **Worker:** coba 12, dengan RAM bebas ≥ 3 GB; kalau tidak, pakai 8. Nilai yang terpilih dipakai di semua run.
- **Satu run dalam satu waktu**, supaya VRAM aman dan waktu latih sah.

## Checklist sebelum "gas"

- Mode Performance (Fn+Q), charger terpasang, lid terbuka.
- Windows Update dijeda.
- Disk ≥ 10 GB (1 November 2026: 20,3 GB bebas).
- Internet ada di awal Tahap 2 kalau model OWLv2 atau Grounding DINO belum lengkap terunduh.

## Cara kerja hemat token

Jam training tidak memakai token. Token terpakai saat Claude membaca dan menjawab, jadi hindari memantau
berkala dan jangan pakai ultracode. Effort per sesi ada di tabel "Pembagian sesi Claude".

## Yang dibawa ke dosen kalau GO

Laporan singkat: usulan judul, gap dan posisi terhadap literatur, protokol, kurva hasil, keterbatasan. Disebut
sebagai studi pendahuluan. Kalau dosen mengubah test set, dedup, dev set, atau cara sampling, few-shot harus
diulang; zero-shot tidak terpengaruh perubahan selain test set.
