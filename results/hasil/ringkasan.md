# Hasil eksperimen (otomatis dari scripts/13_analyze.py)

Kelas pelanggaran untuk recall: ear, face, hands, foot (lihat alasan di scripts/common.py).

## 1. Zero-shot, prompt = nama kelas (evaluator terpadu)

| Model | mAP50 | mAP50-95 | Recall pelanggaran | VRAM puncak (GB) | ms/gambar (termasuk baca file) |
|---|---|---|---|---|---|
| YOLOE-26n | 30,7 | 16,9 | 8,6 | – | – |
| YOLOE-26s | 38,4 | 22,5 | 6,4 | – | – |
| YOLOE-26m | 42,3 | 24,9 | 6,7 | – | – |
| YOLOE-26l | 43,2 | 25,8 | 6,4 | – | – |
| YOLOE-26x | 45,5 | 27,6 | 7,0 | – | – |
| YOLO-World-v2 S | 40,3 | 24,4 | 23,8 | – | – |
| YOLO-World-v2 M | 32,2 | 20,4 | 1,6 | – | – |
| YOLO-World-v2 L | 34,9 | 22,5 | 4,8 | – | – |
| YOLO-World-v2 X | 35,5 | 23,1 | 2,3 | – | – |
| Grounding DINO T | 49,1 | 32,7 | 48,9 | 5,59 | 411 |
| Grounding DINO B | 46,4 | 29,0 | 41,4 | 5,88 | 584 |
| OWLv2 B/16 | 50,1 | 29,3 | 27,3 | 0,85 | 320 |

Cek evaluator: YOLOE-26s lewat `val()` Ultralytics = 38,37, lewat evaluator terpadu = 37,45 mAP50 (selisih 0,91 poin; target < 0,2).

## 2. Efisiensi label: k-shot (rata-rata ± 95% CI, 5 seed)

Titik awal (k = 0): YOLOE-26s zero-shot = 38,4 mAP50, 22,5 mAP50-95, recall pelanggaran 6,4 (lewat `val()`).

| k | Metode | n seed | mAP50 | mAP50-95 | Recall pelanggaran | Waktu latih (mnt) | VRAM puncak (GB) | Gambar latih |
|---|---|---|---|---|---|---|---|---|
| 1 | YOLOE-26s visual prompt (tanpa training) | 3 | 24,8 ± 8,6 | 14,3 ± 5,1 | 8,1 ± 19,6 | 0 | – | 6 |
| 1 | YOLOE-26s linear probing | 3 | 38,7 ± 0,4 | 22,2 ± 0,5 | 22,3 ± 14,2 | 1,6 | 0,50 | 6 |
| 1 | YOLOE-26s fine-tune penuh | 3 | 16,2 ± 6,4 | 8,1 ± 4,1 | 21,2 ± 17,6 | 6,6 | 2,67 | 6 |
| 1 | YOLO26s fine-tune penuh | 3 | 15,7 ± 6,3 | 8,4 ± 3,5 | 17,7 ± 17,9 | 5,3 | 2,67 | 6 |
| 5 | YOLOE-26s visual prompt (tanpa training) | 3 | 32,7 ± 3,2 | 18,5 ± 2,1 | 14,2 ± 13,5 | 0 | – | 20 |
| 5 | YOLOE-26s linear probing | 3 | 40,3 ± 0,7 | 23,3 ± 0,6 | 20,0 ± 13,6 | 1,4 | 1,10 | 20 |
| 5 | YOLOE-26s fine-tune penuh | 3 | 27,3 ± 0,8 | 14,6 ± 0,9 | 38,3 ± 3,8 | 4,6 | 3,08 | 20 |
| 5 | YOLO26s fine-tune penuh | 3 | 25,5 ± 3,5 | 14,3 ± 2,3 | 36,3 ± 4,9 | 4,7 | 3,08 | 20 |
| 10 | YOLOE-26s visual prompt (tanpa training) | 3 | 34,5 ± 1,9 | 19,6 ± 1,8 | 16,8 ± 12,3 | 0 | – | 37 |
| 10 | YOLOE-26s linear probing | 3 | 41,6 ± 1,5 | 24,0 ± 0,8 | 22,7 ± 2,9 | 2,0 | 1,23 | 37 |
| 10 | YOLOE-26s fine-tune penuh | 3 | 33,5 ± 5,8 | 18,9 ± 3,8 | 43,6 ± 3,5 | 6,4 | 3,25 | 37 |
| 10 | YOLO26s fine-tune penuh | 3 | 32,0 ± 7,0 | 18,4 ± 4,8 | 42,2 ± 9,4 | 5,4 | 3,25 | 37 |
| 30 | YOLOE-26s visual prompt (tanpa training) | 3 | 36,4 ± 0,8 | 20,7 ± 0,7 | 18,7 ± 8,2 | 0 | – | 108 |
| 30 | YOLOE-26s linear probing | 3 | 43,1 ± 1,4 | 24,9 ± 0,9 | 23,8 ± 4,1 | 3,0 | 1,29 | 108 |
| 30 | YOLOE-26s fine-tune penuh | 3 | 42,0 ± 4,8 | 24,9 ± 4,3 | 48,5 ± 2,8 | 6,9 | 3,21 | 108 |
| 30 | YOLO26s fine-tune penuh | 3 | 40,7 ± 3,1 | 24,2 ± 2,2 | 49,7 ± 5,2 | 6,6 | 3,21 | 108 |

Baseline paper SH17 (YOLOv9-e, data penuh, protokol berbeda): 70,9 mAP50 / 48,7 mAP50-95.

![mAP50](kurva_k_map50.png)

![mAP50-95](kurva_k_map50-95.png)

![recall pelanggaran](kurva_k_recall_pelanggaran.png)

## 2b. AP50 per kelompok kelas (rata-rata ± 95% CI)

| k | Metode | APD | Bagian tubuh | Lainnya |
|---|---|---|---|---|
| 1 | YOLOE-26s visual prompt (tanpa training) | 21,5 ± 11,0 | 21,9 ± 16,2 | 48,9 ± 3,1 |
| 1 | YOLOE-26s linear probing | 36,4 ± 2,5 | 38,0 ± 3,7 | 52,0 ± 3,5 |
| 1 | YOLOE-26s fine-tune penuh | 6,3 ± 5,2 | 32,0 ± 15,6 | 26,5 ± 11,2 |
| 1 | YOLO26s fine-tune penuh | 5,2 ± 6,7 | 29,1 ± 14,2 | 34,4 ± 2,2 |
| 5 | YOLOE-26s visual prompt (tanpa training) | 31,8 ± 2,3 | 27,7 ± 7,6 | 49,3 ± 3,9 |
| 5 | YOLOE-26s linear probing | 38,6 ± 2,1 | 38,5 ± 1,3 | 52,8 ± 1,8 |
| 5 | YOLOE-26s fine-tune penuh | 14,5 ± 0,4 | 48,9 ± 1,4 | 37,3 ± 3,6 |
| 5 | YOLO26s fine-tune penuh | 11,1 ± 3,6 | 48,1 ± 4,5 | 41,1 ± 4,4 |
| 10 | YOLOE-26s visual prompt (tanpa training) | 34,4 ± 1,4 | 28,8 ± 2,2 | 49,6 ± 4,3 |
| 10 | YOLOE-26s linear probing | 39,6 ± 1,5 | 41,1 ± 1,8 | 52,9 ± 2,9 |
| 10 | YOLOE-26s fine-tune penuh | 21,1 ± 7,8 | 55,3 ± 3,6 | 40,4 ± 5,0 |
| 10 | YOLO26s fine-tune penuh | 19,0 ± 8,9 | 54,0 ± 6,7 | 42,6 ± 6,2 |
| 30 | YOLOE-26s visual prompt (tanpa training) | 37,0 ± 1,2 | 29,3 ± 1,7 | 50,7 ± 2,0 |
| 30 | YOLOE-26s linear probing | 40,8 ± 1,6 | 43,4 ± 1,1 | 54,2 ± 0,7 |
| 30 | YOLOE-26s fine-tune penuh | 32,1 ± 6,9 | 61,4 ± 1,5 | 43,3 ± 2,7 |
| 30 | YOLO26s fine-tune penuh | 29,2 ± 4,5 | 61,6 ± 0,7 | 46,1 ± 2,7 |

## 2c. Biaya label per k (rata-rata 5 seed)

| k | Gambar | Kotak berlabel |
|---|---|---|
| 1 | 5,8 | 72 |
| 5 | 20,2 | 285 |
| 10 | 39,0 | 518 |
| 30 | 109,2 | 1399 |
| 100 | 337,8 | 4406 |

## 2d. Titik setara linear probing vs YOLO26

| Kelompok | k setara (selisih < 2 poin atau berbalik) |
|---|---|
| Seluruh kelas | belum ada sampai k = 30 |
| APD | belum ada sampai k = 30 |
| Bagian tubuh | 5 |
| Lainnya | belum ada sampai k = 30 |

## 2d. Titik setara fine-tune penuh YOLOE vs YOLO26

| Kelompok | k setara (selisih < 2 poin atau berbalik) |
|---|---|
| Seluruh kelas | 1 |
| APD | 1 |
| Bagian tubuh | 5 |
| Lainnya | belum ada sampai k = 30 |

## 3. Selisih berpasangan mAP50 (poin persen, per seed dengan sampel yang sama)

| k | Perbandingan | n | Selisih ± 95% CI | p (uji t berpasangan) | Seed menang |
|---|---|---|---|---|---|
| 1 | YOLOE-26s linear probing − YOLO26s fine-tune penuh | 3 | 23,0 ± 6,2 | 0,004 | 3/3 |
| 1 | YOLOE-26s fine-tune penuh − YOLO26s fine-tune penuh | 3 | 0,6 ± 2,7 | 0,455 | 2/3 |
| 1 | YOLOE-26s visual prompt (tanpa training) − YOLO26s fine-tune penuh | 3 | 9,2 ± 2,9 | 0,005 | 3/3 |
| 1 | YOLOE-26s fine-tune penuh − YOLOE-26s linear probing | 3 | -22,5 ± 6,5 | 0,004 | 0/3 |
| 5 | YOLOE-26s linear probing − YOLO26s fine-tune penuh | 3 | 14,7 ± 4,2 | 0,004 | 3/3 |
| 5 | YOLOE-26s fine-tune penuh − YOLO26s fine-tune penuh | 3 | 1,8 ± 2,7 | 0,102 | 3/3 |
| 5 | YOLOE-26s visual prompt (tanpa training) − YOLO26s fine-tune penuh | 3 | 7,1 ± 5,1 | 0,026 | 3/3 |
| 5 | YOLOE-26s fine-tune penuh − YOLOE-26s linear probing | 3 | -12,9 ± 1,5 | 0,001 | 0/3 |
| 10 | YOLOE-26s linear probing − YOLO26s fine-tune penuh | 3 | 9,6 ± 5,9 | 0,020 | 3/3 |
| 10 | YOLOE-26s fine-tune penuh − YOLO26s fine-tune penuh | 3 | 1,4 ± 1,4 | 0,052 | 3/3 |
| 10 | YOLOE-26s visual prompt (tanpa training) − YOLO26s fine-tune penuh | 3 | 2,5 ± 5,3 | 0,179 | 3/3 |
| 10 | YOLOE-26s fine-tune penuh − YOLOE-26s linear probing | 3 | -8,2 ± 4,9 | 0,019 | 0/3 |
| 30 | YOLOE-26s linear probing − YOLO26s fine-tune penuh | 3 | 2,4 ± 3,0 | 0,073 | 3/3 |
| 30 | YOLOE-26s fine-tune penuh − YOLO26s fine-tune penuh | 3 | 1,3 ± 2,9 | 0,191 | 3/3 |
| 30 | YOLOE-26s visual prompt (tanpa training) − YOLO26s fine-tune penuh | 3 | -4,4 ± 3,4 | 0,032 | 0/3 |
| 30 | YOLOE-26s fine-tune penuh − YOLOE-26s linear probing | 3 | -1,1 ± 3,8 | 0,346 | 1/3 |

CI yang tidak memuat 0 berarti selisih konsisten di semua sampel. Dengan n = 5, uji ini berdaya rendah; CI lebih informatif daripada p.

## 4. AP50 per kelas (%)

![heatmap](heatmap_ap50_per_kelas.png)

| Kelas | Zero-shot YOLOE-26s | Zero-shot GDINO B | Zero-shot OWLv2 B | 10-shot YOLOE VP | 10-shot YOLOE LP | 10-shot YOLOE FT | 10-shot YOLO26 |
|---|---|---|---|---|---|---|---|
| person | 92,0 | 91,9 | 82,8 | 92,3 | 92,2 | 78,1 | 81,7 |
| helmet | 70,2 | 41,4 | 72,9 | 58,7 | 69,1 | 42,0 | 39,0 |
| glasses | 65,6 | 75,7 | 82,6 | 63,4 | 66,3 | 42,8 | 31,0 |
| head | 63,7 | 86,6 | 59,5 | 52,1 | 67,5 | 82,9 | 84,1 |
| shoes | 60,3 | 61,0 | 64,6 | 51,8 | 64,2 | 35,4 | 38,7 |
| gloves | 50,7 | 55,2 | 74,8 | 42,4 | 50,0 | 14,0 | 12,2 |
| face-mask | 48,7 | 66,5 | 68,1 | 47,7 | 50,9 | 26,3 | 20,7 |
| hands | 40,1 | 71,0 | 58,8 | 41,9 | 52,0 | 58,5 | 58,5 |
| safety-vest | 36,9 | 23,3 | 58,6 | 28,3 | 39,8 | 20,1 | 15,4 |
| face | 36,5 | 86,6 | 63,8 | 33,6 | 46,5 | 78,4 | 76,1 |
| ear | 28,3 | 60,5 | 35,4 | 9,5 | 32,6 | 53,1 | 47,9 |
| medical-suit | 16,1 | 1,5 | 18,1 | 12,0 | 17,7 | 13,2 | 11,5 |
| tool | 13,7 | 30,1 | 21,9 | 6,8 | 13,6 | 2,6 | 3,6 |
| face-guard | 12,1 | 3,4 | 12,1 | 20,7 | 18,8 | 5,6 | 6,4 |
| safety-suit | 10,7 | 1,5 | 29,9 | 9,2 | 11,7 | 7,4 | 8,6 |
| ear-mufs | 3,4 | 29,1 | 35,0 | 10,0 | 7,6 | 4,5 | 6,2 |
| foot | 3,1 | 3,2 | 13,5 | 6,8 | 7,0 | 3,9 | 3,2 |

## 5. Ablation prompt teks (YOLOE-26s zero-shot)

| Varian prompt | mAP50 | mAP50-95 | Recall pelanggaran |
|---|---|---|---|
| asli | 37,7 | 21,9 | 6,3 |
| deskriptif | 34,1 | 19,8 | 12,0 |
| ensemble | 37,2 | 21,8 | 13,7 |
| rapi | 37,5 | 21,7 | 6,1 |
| template | 32,4 | 19,0 | 11,8 |

Perubahan AP50 per kelas, deskriptif − rapi: medical-suit 4,3, foot 2,3, safety-vest 1,3, tool 0,5, ear-mufs 0,5, person 0,2, glasses 0,2, shoes -0,2, face-guard -1,4, hands -1,7, ear -1,9, safety-suit -3,5, face-mask -4,5, face -8,5, gloves -9,9, head -14,6, helmet -19,4

## 9. Kondisi perangkat selama training

36 run training. Charger terpasang di semua run: True. Batas daya GPU teramati 80–101 W. Rata-rata utilisasi GPU per run 15–51%. Suhu GPU maksimum 78 °C.
