# Status gerbang (otomatis dari scripts/15_gate.py)

## Gerbang 1: teknis

### Determinisme (run ulang proses baru, worker sama, AP per kelas sampai 6 desimal)

| Metode | mAP50 run 1 | mAP50 run 2 | Hasil |
|---|---|---|---|
| yoloe-lp | 0.397421 | 0.397421 | identik |
| yolo26 | 0.297529 | 0.297529 | identik |

Kriteria: **LOLOS**

### Uji batch dan worker, satu epoch data penuh

Worker 12 gagal dan tidak punya baris: memori virtual Windows habis (WinError 1455), lalu run menggantung.

| Run | Batch | Worker | Waktu (mnt) | VRAM (GB) | RAM bebas min (GB) | Suhu GPU maks |
|---|---|---|---|---|---|---|
| full_seed0_yolo26s_ujiw1 | 16 | 1 | 1,90 | 5,11 | 4,11 | 80 |
| full_seed0_yolo26s_ujiw2 | 16 | 2 | 2,04 | 5,11 | 2,08 | 78 |
| full_seed0_yolo26s_ujiw4 | 16 | 4 | 2,30 | 5,10 | 0,05 | 78 |
| full_seed0_yolo26s_ujiw6 | 16 | 6 | 2,64 | 5,10 | 0,04 | 77 |
| full_seed0_yolo26s_ujiw8 | 16 | 8 | 3,05 | 5,10 | 0,01 | 75 |

Dengan worker 1, seluruh run training: VRAM puncak 5,14 GB (batas 5,2), RAM bebas terendah 1,63 GB (batas 2,5). Kriteria: **GAGAL**

### Uji jadwal di dev set (seed 0, rata-rata k = 1 dan 10)

| Metode | A: nbs 64, 100 epoch | B: nbs 8, 100 epoch | C: nbs 8, 300 epoch | Terpilih |
|---|---|---|---|---|
| yoloe-lp | 37,2 | 36,3 | 33,4 | A |
| yolo26 | 22,3 | 21,1 | 19,1 | A |

| Metode | k | A | B | C | Optimizer |
|---|---|---|---|---|---|
| yoloe-lp | 1 | 35,8 | 32,8 | 28,4 | AdamW |
| yoloe-lp | 10 | 38,6 | 39,7 | 38,4 | AdamW |
| yolo26 | 1 | 12,8 | 12,5 | 10,6 | AdamW |
| yolo26 | 10 | 31,7 | 29,8 | 27,6 | AdamW |

common.py: (64, 100) untuk yoloe-lp, (64, 100) untuk yolo26 dan yoloe-ft, batch few-shot 8, batch penuh 16, worker 1. Sesuai pilihan: True.

### Estimasi dengan kecepatan nyata

| Tahap | Jam |
|---|---|
| tahap2 | 0,0 |
| tahap3 | 0,7 |
| tahap4 | 2,2 |

Sisa GPU: 3,0 jam. Sampai GO/NO-GO: 0,7 jam. Data penuh dihitung sampai epoch maksimum; patience bisa membuatnya lebih pendek.

**Gerbang 1: BELUM LOLOS.**

## Gerbang 2: sinyal (3 seed)

### 1. Seri: D_LP(k) dan D_FT(k) = mAP50 linear probing atau fine-tune penuh − YOLO26, poin persen

| Kelompok | D | k | Nilai | Per seed | Sinyal (≥ 2 dan searah) |
|---|---|---|---|---|---|
| Seluruh kelas | D_LP | 1 | 23,0 | 25,1 / 23,8 / 20,2 | ya |
| Seluruh kelas | D_LP | 5 | 14,7 | 14,8 / 16,4 / 13,0 | ya |
| Seluruh kelas | D_LP | 10 | 9,6 | 9,2 / 12,1 / 7,4 | ya |
| Seluruh kelas | D_LP | 30 | 2,4 | 1,8 / 3,8 / 1,6 | ya |
| Seluruh kelas | D_FT | 1 | 0,6 | 1,6 / -0,6 / 0,7 | – |
| Seluruh kelas | D_FT | 5 | 1,8 | 1,8 / 2,9 / 0,7 | – |
| Seluruh kelas | D_FT | 10 | 1,4 | 1,8 / 1,7 / 0,7 | – |
| Seluruh kelas | D_FT | 30 | 1,3 | 0,0 / 1,6 / 2,3 | – |
| APD | D_LP | 1 | 31,2 | 32,1 / 34,3 / 27,2 | ya |
| APD | D_LP | 5 | 27,5 | 28,1 / 29,3 / 25,0 | ya |
| APD | D_LP | 10 | 20,7 | 20,9 / 23,8 / 17,2 | ya |
| APD | D_LP | 30 | 11,5 | 11,0 / 13,4 / 10,1 | ya |
| APD | D_FT | 1 | 1,2 | 2,4 / 1,4 / -0,2 | – |
| APD | D_FT | 5 | 3,4 | 4,3 / 4,3 / 1,7 | ya |
| APD | D_FT | 10 | 2,2 | 3,4 / 1,9 / 1,1 | ya |
| APD | D_FT | 30 | 2,8 | 1,1 / 3,3 / 4,1 | ya |
| Bagian tubuh | D_LP | 1 | 8,9 | 14,3 / 5,2 / 7,1 | ya |
| Bagian tubuh | D_LP | 5 | -9,6 | -10,5 / -8,1 / -10,1 | ya |
| Bagian tubuh | D_LP | 10 | -12,8 | -15,3 / -10,6 / -12,6 | ya |
| Bagian tubuh | D_LP | 30 | -18,1 | -18,9 / -17,6 / -17,9 | ya |
| Bagian tubuh | D_FT | 1 | 2,8 | 2,8 / 0,6 / 5,1 | ya |
| Bagian tubuh | D_FT | 5 | 0,8 | -0,7 / 2,5 / 0,6 | – |
| Bagian tubuh | D_FT | 10 | 1,4 | 0,1 / 2,6 / 1,4 | – |
| Bagian tubuh | D_FT | 30 | -0,1 | -0,6 / -0,3 / 0,5 | – |
| Lainnya | D_LP | 1 | 17,6 | 17,1 / 17,6 / 18,1 | ya |
| Lainnya | D_LP | 5 | 11,8 | 11,7 / 12,9 / 10,7 | ya |
| Lainnya | D_LP | 10 | 10,3 | 12,0 / 10,2 / 8,6 | ya |
| Lainnya | D_LP | 30 | 8,1 | 7,5 / 9,3 / 7,7 | ya |
| Lainnya | D_FT | 1 | -8,0 | -5,4 / -13,3 / -5,3 | ya |
| Lainnya | D_FT | 5 | -3,7 | -4,8 / -2,8 / -3,6 | ya |
| Lainnya | D_FT | 10 | -2,3 | -2,1 / -1,8 / -2,8 | ya |
| Lainnya | D_FT | 30 | -2,8 | -3,7 / -2,3 / -2,3 | ya |

Berhenti karena seri: tidak

### 2. Bising: SD antar seed pada k = 10: yoloe-lp 0,6, yolo26 2,8 poin. Berhenti: tidak

### 3. Zero-shot: terbaik zeroshot_owlv2-large, rata-rata AP50 kelompok APD 53,7. Berhenti: tidak

**Gerbang 2: LANJUT.**

## Gerbang 3: akhir (5 seed)

- G1 YOLO26s data penuh 61,0 mAP50 (≥ 58): **LOLOS**
- G2 selisih zero-shot terbaik (zeroshot_owlv2-large, 55,4) vs YOLO26 penuh: 5,7 poin; bukti per kelas di ringkasan.md
- G3 k dengan CI D_LP(k) atau D_FT(k) tidak memuat 0 dan |D| ≥ 2: **LOLOS**: D_LP seluruh kelas k=1 (22,9 ± 6,9); D_LP seluruh kelas k=5 (14,0 ± 2,0); D_LP seluruh kelas k=10 (9,6 ± 2,1); D_LP seluruh kelas k=30 (2,9 ± 1,4); D_LP seluruh kelas k=100 (-4,8 ± 1,2); D_FT seluruh kelas k=10 (2,0 ± 1,3); D_LP APD k=1 (31,0 ± 4,3); D_LP APD k=5 (26,6 ± 2,5); D_LP APD k=10 (21,2 ± 3,1); D_LP APD k=30 (12,2 ± 2,0); D_FT APD k=5 (3,4 ± 1,6); D_FT APD k=10 (3,4 ± 2,5); D_FT APD k=30 (3,5 ± 2,1); D_LP Bagian tubuh k=5 (-10,4 ± 2,8); D_LP Bagian tubuh k=10 (-14,0 ± 2,9); D_LP Bagian tubuh k=30 (-18,1 ± 0,6); D_LP Bagian tubuh k=100 (-20,9 ± 1,0); D_FT Bagian tubuh k=1 (2,3 ± 2,2); D_LP Lainnya k=1 (18,5 ± 5,3); D_LP Lainnya k=5 (11,8 ± 1,0); D_LP Lainnya k=10 (10,5 ± 1,5); D_LP Lainnya k=30 (8,4 ± 0,9); D_LP Lainnya k=100 (6,0 ± 0,4); D_FT Lainnya k=1 (-8,0 ± 4,5); D_FT Lainnya k=5 (-3,9 ± 1,1); D_FT Lainnya k=10 (-2,9 ± 1,2); D_FT Lainnya k=30 (-2,5 ± 0,9)
- G4 kelas zero-shot AP50 < 20: 2, ≥ 50: 11; uji no_helmet dan no_gloves ada: True. **GAGAL**
- G5 paper baru yang menggugurkan Gerbang 0: dinilai manual
