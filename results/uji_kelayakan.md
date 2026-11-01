# Uji Kelayakan Eksperimen: Efisiensi Label Deteksi APD

Tanggal: 30 Oktober 2026 · Perangkat: laptop RTX 4050 (6 GB VRAM), RAM 16 GB · Versi: deterministik
(gambar SH17 diperkecil ke 1280 px, training tanpa cache)

Tujuan: membuktikan seluruh rangkaian eksperimen (data → zero-shot → few-shot → evaluasi) bisa
dijalankan di perangkat yang ada. **Angka di bawah berasal dari satu seed dan belum boleh dipakai
untuk menarik kesimpulan.** Protokol penuh memakai 5 seed dengan 95% CI.

> **Koreksi 1 November 2026:** "500 langkah" di laporan ini adalah 500 batch, yaitu hanya ±62 update bobot
> (`nbs` 64, batch 8). Pipeline tetap terbukti jalan, tetapi perbandingan YOLOE vs YOLO26 di sini belum
> boleh disimpulkan. Jadwalnya diuji ulang di `rencana_eksperimen.md`.

## 1. Hasil utama (k = 10, seed 0)

| Skenario | Gambar berlabel | mAP50 | mAP50-95 | Recall kelas pelanggaran* | Parameter dilatih | Waktu latih | VRAM puncak | FPS forward** | FPS end-to-end** |
|---|---|---|---|---|---|---|---|---|---|
| YOLOE-26s zero-shot | 0 | 38,2 | 22,2 | 7,1 | 0 | – | 1,4 GB (evaluasi) | 80 | 48 |
| YOLOE-26s 10-shot, visual prompt (tanpa training) | 37 | 35,9 | 20,4 | 11,7 | 0 | – | 0,8 GB (evaluasi) | ≈ zero-shot | ≈ zero-shot |
| YOLOE-26s 10-shot, linear probing | 37 | 41,1 | 23,6 | 20,1 | 13.158 (0,13%) | 2,5 menit | 1,2 GB | 90 | 52 |
| YOLO26s 10-shot, fine-tune penuh | 37 | 34,5 | 20,0 | 43,3 | 9.961.022 (100%) | 3,7 menit | 3,2 GB | 110 | 62 |
| *Pembanding: YOLOv9-e, data penuh (paper SH17)* | *6.479* | *70,9* | *48,7* | | | | | | |

\* Rata-rata recall kelas *ear, face, hands, foot* (bagian tubuh terbuka) pada ambang confidence
dengan F1 maksimum. *head* tidak dihitung, alasannya di bagian 4.
\** Batch 1, FP32, 200 gambar test yang sudah dimuat ke memori (20 gambar pemanasan). Forward = model
saja; end-to-end = termasuk pra-proses (1280 → 640 px) dan pasca-proses. Diukur di mode daya Auto
(batas daya GPU 80–93 W) dengan charger terpasang; akan diukur ulang di mode Performance.

## 2. Bukti determinisme

Uji pertama memakai `cache="ram"`, yang menurut peringatan resmi Ultralytics membuat training tidak
deterministik. Setelah gambar diperkecil ke 1280 px dan cache dimatikan, setiap run diulang dua kali
dengan seed yang sama:

| Run (k = 10, seed 0) | mAP50 run 1 | mAP50 run 2 | AP per kelas identik |
|---|---|---|---|
| YOLOE-26s linear probing | 41,1399 | 41,1399 | ya |
| YOLO26s fine-tune penuh | 34,4901 | 34,4901 | ya |
| YOLOE-26s visual prompt | 35,9459 | 35,9459 | ya |

## 3. AP50 per kelas (%), diurutkan dari zero-shot

| Kelas | Zero-shot | 10-shot visual prompt | 10-shot linear probing | YOLO26 10-shot |
|---|---|---|---|---|
| person | 91,5 | 92,4 | 91,5 | 84,1 |
| helmet | 68,4 | 60,5 | 70,9 | 40,8 |
| glasses | 67,3 | 60,5 | 65,4 | 15,1 |
| head | 64,2 | 48,8 | 65,5 | 85,7 |
| shoes | 59,5 | 50,5 | 64,6 | 23,2 |
| gloves | 50,4 | 42,1 | 49,9 | 11,9 |
| face-mask | 48,0 | 50,3 | 48,1 | 40,4 |
| hands | 40,5 | 41,6 | 49,2 | 59,8 |
| face | 36,3 | 35,6 | 44,9 | 78,0 |
| safety-vest | 36,2 | 31,9 | 41,4 | 20,8 |
| ear | 28,6 | 16,0 | 32,2 | 53,0 |
| medical-suit | 15,5 | 18,7 | 16,1 | 29,2 |
| face-guard | 14,1 | 25,4 | 16,1 | 23,2 |
| tool | 13,9 | 5,2 | 15,8 | 0,8 |
| safety-suit | 8,5 | 14,0 | 14,9 | 13,4 |
| foot | 3,3 | 4,1 | 7,3 | 1,7 |
| ear-mufs | 3,1 | 13,6 | 5,6 | 5,4 |

## 4. Temuan dari analisis label SH17 (mengubah definisi "kelas pelanggaran")

Untuk setiap pasangan bagian tubuh–APD di label train, dihitung seberapa sering kotak APD berada di
dalam kotak bagian tubuh:

| Pasangan | Hasil | Artinya |
|---|---|---|
| helmet di dalam head | 79% | *head* dilabeli **walaupun memakai helm**, jadi bukan kelas pelanggaran |
| glasses di dalam face | 76% | *face* juga dilabeli walaupun berkacamata |
| gloves di dalam hands | 2% | tangan bersarung tangan dilabeli *gloves*; *hands* = tangan telanjang |
| ear-mufs di dalam ear | 1% | *ear* = telinga terbuka |
| face-mask / face-guard bertumpang tindih dengan face | 0–1% | *face* = wajah tanpa masker atau pelindung wajah |
| foot bertumpang tindih dengan shoes (IoU > 0,3) | 39% | sebagian kotak dilabeli ganda; *foot* ambigu |

Konsekuensinya, recall pelanggaran memakai *ear, face, hands, foot*. Pelanggaran "kepala tanpa helm"
diturunkan dengan aturan asosiasi (kotak head yang tidak berisi helm) dan akan dibandingkan dengan
prompt negasi seperti "head without helmet" di run malam.

## 5. Zero-shot model open-vocabulary lain (sempat selesai sebelum antrean dihentikan)

Semua model memakai prompt yang sama (nama kelas) dan dinilai dengan evaluator terpadu yang memakai
fungsi pencocokan dan perhitungan AP milik Ultralytics.

| Model | mAP50 | mAP50-95 | Recall pelanggaran | VRAM puncak | ms/gambar (termasuk baca file) |
|---|---|---|---|---|---|
| YOLOE-26n | 29,3 | 15,9 | 7,8 | 1,0 GB | 23 |
| YOLOE-26s | 37,5 | 21,7 | 6,1 | 1,1 GB | 23 |
| YOLOE-26m | 41,9 | 24,5 | 6,0 | 2,5 GB | 41 |
| YOLOE-26l | 42,4 | 25,3 | 5,2 | 2,6 GB | 48 |
| YOLOE-26x | 44,4 | 26,9 | 6,0 | 3,9 GB | 72 |
| YOLO-World-v2 S | 40,6 | 24,7 | 25,3 | 1,0 GB | 51 |
| YOLO-World-v2 M | 32,3 | 20,5 | 0,9 | 1,6 GB | 39 |
| YOLO-World-v2 L | 34,9 | 22,6 | 3,7 | 1,8 GB | 51 |
| YOLO-World-v2 X | 36,1 | 23,6 | 2,8 | 2,3 GB | 76 |
| Grounding DINO-T | 49,1 | 32,7 | 48,9 | 5,6 GB | 411 |

Catatan:
- YOLOE-26s di tabel ini 37,5, sedangkan lewat `val()` 38,2. Selisih 0,7 poin berasal dari cara padding
  gambar yang berbeda, jadi angka hanya dibandingkan di dalam tabel yang sama.
- Grounding DINO-T paling akurat dan satu-satunya yang recall pelanggarannya tinggi, tetapi ~18× lebih
  lambat dan VRAM-nya hampir menyentuh batas 6 GB.
- YOLO-World versi besar tidak lebih baik dari versi S; AP rompi turun drastis (40 → 6). Ini perlu
  dicek dengan ablation prompt.

## 6. Temuan awal (perlu dikonfirmasi dengan 5 seed)

1. **Eksperimen layak di laptop.** VRAM training paling tinggi 3,2 GB. Satu run 10-shot selesai dalam
   3–5 menit, dan hasilnya bisa direproduksi persis.
2. **Linear probing** menaikkan mAP50 zero-shot dari 38,2 ke 41,1 dengan melatih hanya 0,13% parameter.
3. **Visual prompt tanpa training** turun rata-rata (35,9), tetapi membantu kelas yang sulit dideskripsikan
   dengan kata-kata: earmuffs 3 → 14, face-guard 14 → 25, safety-suit 9 → 14.
4. **YOLO26 10-shot** kalah mAP50 dari YOLOE, tetapi unggul jauh di bagian tubuh. Dibanding YOLOE
   zero-shot: face 78 vs 36, ear 53 vs 29, hands 60 vs 41. Akibatnya recall pelanggarannya paling
   tinggi (43, sedangkan cara YOLOE 7–20). Sebaliknya YOLOE unggul
   jauh di benda APD (glasses, gloves, shoes, helmet, vest). Dugaan: konsep "helm" jelas bagi encoder
   teks, sedangkan batas kotak "telinga" atau "wajah" adalah konvensi anotasi SH17 yang harus dipelajari
   dari contoh.
5. **Kelas tersulit tanpa data berlabel:** ear-mufs (3,1), foot (3,3), safety-suit (8,5), tool (13,9).

## 7. Keputusan metodologi dan alasannya

| Keputusan | Alasan |
|---|---|
| Split *val* resmi SH17 (1.620 gambar) dipakai sebagai test set | Baseline paper (70,9 mAP50) dilaporkan di split ini |
| Dedup pHash (Hamming ≤ 6), 13 gambar train dibuang | Ada 6 pasangan train–test hampir identik (foto beruntun satu sesi). Test set tidak diubah |
| Gambar diperkecil ke 1280 px, training tanpa cache | Gambar asli sampai 22 MP; `cache="ram"` membuat training tidak deterministik |
| k-shot = gambar dipilih sampai tiap kelas punya ≥ k objek, semua anotasi dipertahankan | SH17 rata-rata ~9 objek/gambar; membuang anotasi membuat objek yang tampak dianggap latar |
| Tanpa validation set; epoch = max(100, 500 langkah), evaluasi `last.pt` | Validation set ratusan gambar bertentangan dengan premis few-shot; minimal 500 langkah agar k = 1 dan 5 tidak kalah hanya karena dioptimasi lebih sebentar |
| Hyperparameter identik untuk semua cara adaptasi (AdamW lr 0,000476 otomatis, batch 8, 640 px) | Perbedaan hasil hanya berasal dari model dan cara adaptasinya |
| Prompt = nama kelas, "-" jadi spasi, "ear-mufs" jadi "earmuffs" | Perubahan minimal. Variasi prompt adalah ablation tersendiri |
| YOLOE-26 dibangun dari `yoloe-26s.yaml` lalu memuat `yoloe-26s-seg.pt` | Semua bobot rilis YOLOE-26 adalah model segmentasi; ini resep resmi Ultralytics untuk deteksi |
| Laporan ini memakai 4 worker data; run malam memakai 8 | Training dibatasi CPU (utilisasi GPU 15–30%); 8 worker mempercepat. Keduanya deterministik, tetapi angka seed 0 bisa sedikit berbeda karena urutan augmentasi berubah |

## 8. Environment

Python 3.13.12 (sama dengan Colab, 3.13), PyTorch 2.15.0 + CUDA 13.2, Ultralytics 8.4.192,
transformers 5.22.0, encoder teks YOLOE MobileCLIP2-B. Versi lengkap ada di `requirements-lock.txt`.
Setiap run mencatat daya, clock, suhu, dan batas daya GPU serta status charger.