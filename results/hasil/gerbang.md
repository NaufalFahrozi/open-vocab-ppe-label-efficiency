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

Dengan worker 1, seluruh run training: VRAM puncak 5,14 GB (batas 5,2), RAM bebas terendah 2,91 GB (batas 2,5). Kriteria: **LOLOS**

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
| tahap2 | 4,0 |
| tahap3 | 12,5 |
| tahap4 | 11,3 |

Sisa GPU: 27,8 jam. Sampai GO/NO-GO: 16,5 jam. Data penuh dihitung sampai epoch maksimum; patience bisa membuatnya lebih pendek.

**Gerbang 1: LOLOS.**

## Gerbang 2: sinyal (3 seed)

Belum ada data.

## Gerbang 3: akhir (5 seed)

Belum ada data.
