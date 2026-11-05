# Sorot

Aplikasi lokal yang memperlihatkan temuan studi pendahuluan: satu foto diperiksa empat model yang dilatih dengan jumlah
data berlabel berbeda, dari nol sampai seluruh data latih SH17. Prototipe akademik, bukan sistem produksi.

Nama "Sorot" dari cara detektor menyorot APD di foto. Logonya sudut kotak deteksi (⌜ ⌟) dengan titik kuning K3;
nomor langkah memakai lingkaran kuning seperti rambu. Huruf: Plus Jakarta Sans.

## Menjalankan

Semua perintah dijalankan dari root repo. Backend memakai `.venv` yang sudah ada.

1. Bangun tampilan sekali (ulangi setiap kali kode `app/frontend` berubah):

   ```bash
   cd app/frontend && npm install && npm run build
   ```

2. Jalankan server:

   ```bash
   .venv/Scripts/python -m uvicorn app.backend.main:app --port 8000
   ```

3. Buka http://127.0.0.1:8000. Keempat model termuat dalam ±8 detik saat start.

Untuk mengembangkan tampilan dengan hot reload, jalankan `npm run dev` di `app/frontend` (port 5173) sambil server di
atas tetap hidup. Permintaan `/api` diteruskan ke port 8000.

Jangan jalankan aplikasi bersamaan dengan training lain di GPU. Kalau GPU sedang dipakai, jalankan dengan
`APP_DEVICE=cpu` (lebih lambat, ±70 ms per model per gambar).

### Dependensi yang ditambahkan ke `.venv`

`fastapi`, `uvicorn[standard]`, `python-multipart`, dan `pytest`, dipasang dengan
`uv pip install --python .venv/Scripts/python.exe ...` tanpa `-U`, supaya PyTorch CUDA tidak tertimpa. Setelah
memasang, `torch` tetap `2.15.0+cu132` dan `torch.cuda.is_available()` tetap `True`.

## Fitur dan dasarnya dari eksperimen

| Fitur | Yang terlihat di aplikasi | Dasar di `results/hasil/ringkasan.md` |
|---|---|---|
| Penggeser jumlah foto berlabel | Satu foto, empat model (zero-shot YOLOE-26s, linear probing k = 10 dan k = 30, YOLO26s data penuh); bisa juga berdampingan | Kurva efisiensi label (§2) dan zero-shot (§1) |
| Daftar "yang ditemukan" | Jumlah objek per jenis untuk model yang dipilih, dan perbandingan jumlah APD antarmodel | AP per kelas dan pola APD vs bagian tubuh (§2b, heatmap) |
| Bagian penjelasan | Kurva mAP50 terhadap jumlah gambar berlabel dan tabel per jenis objek | Tabel §2, titik k = 1 sampai 100 dan data penuh |
| Kelas baru tanpa label | Ketik nama APD, hanya zero-shot yang mencarinya | Zero-shot YOLOE-26s 38,4 mAP50 tanpa satu label |
| Kepatuhan per orang | Status patuh, tidak patuh, atau tidak diketahui di atas tiap orang | Aturan asosiasi AP50 90,3 vs prompt negasi 57,2 (`scripts/12_violation.py`) |

Waktu per gambar diukur langsung saat aplikasi berjalan (praproses, inferensi, pascaproses menurut Ultralytics). Di
RTX 4050: zero-shot ±11 sampai 24 ms, linear probing ±10 sampai 23 ms, YOLO26s ±11 sampai 23 ms per gambar 640 px.

## Keputusan teknis dan alasannya

- **Bobot seed 0**, bukan seed dengan skor test tertinggi, supaya demo jujur. Lokasinya di `backend/config.py`.
- **Satu kunci GPU untuk semua model.** Permintaan yang datang bersamaan antre, tidak berebut VRAM 6 GB. Keempat
  model memakai ±240 MB VRAM.
- **Pemanasan GPU otomatis.** GPU laptop menurunkan clock saat menganggur, sehingga gambar pertama setelah jeda 3
  sampai 7 kali lebih lambat. Kalau GPU menganggur lebih dari 2 detik, backend menjalankan tiga prediksi kosong dulu
  (tidak diukur), supaya waktu yang tampil adalah kondisi stabil seperti `scripts/06_fps.py`.
- **Nama kelas, prompt, dan aturan asosiasi diimpor dari `scripts/`** (`backend/experiment.py`), tidak disalin,
  supaya aplikasi memakai logika yang sama persis dengan evaluasi. Skrip aslinya tidak diubah.
- **Kepatuhan dihitung dari prediksi conf ≥ 0,001**, sama seperti evaluasi, lalu yang ditampilkan disaring dengan skor
  minimum di layar. Helm berskor 0,1 tidak terlihat di layar tetapi tetap mengurangi skor pelanggaran kepala.

## Bagian yang baru di aplikasi dan belum dievaluasi

Bagian ini heuristik. Kalau dipakai di naskah, sebut sebagai rancangan sistem, bukan hasil eksperimen.

- **Asosiasi orang–kepala.** Kepala dianggap milik orang yang kotaknya memuat ≥ 80% luas kepala; tangan ≥ 50%,
  karena tangan yang terentang sering menempel di tepi kotak orang.
- **Tangan–sarung tangan memakai rumus kepala–helm**, yaitu `s_tangan × (1 − s_sarung)`. Eksperimen memakai skor
  `hands` apa adanya. Alasannya ada pada foto uji `image1003`: pekerja bersarung tangan, tetapi YOLO26 mengeluarkan
  `hands` 0,69 dan `gloves` 0,49 di kotak yang sama. Dengan skor mentah pekerja itu dinyatakan tidak patuh.
- **Ambang pelanggaran default 0,5**, bisa digeser di layar.
- **Kelas baru di zero-shot** ikut bersaing dengan 17 kelas SH17. Angka 38,4 diukur dengan 17 kelas saja, jadi skor
  kelas lama bisa sedikit berubah setelah kelas baru ditambahkan.

## Skenario demo untuk dosen (±3 menit)

Tiga foto pertama di deretan contoh selalu sama dan disiapkan untuk skenario ini.

Layar utama mengikuti tiga langkah bernomor: ① pilih foto, ② pilih detektor, ③ lihat yang ditemukan. Detektor dipilih
lewat tabel enam kartu: baris = model (YOLOE-26s open-vocabulary, YOLO26s biasa), kolom = jumlah foto contoh
(0, 39, 109, 4.986). Membaca satu kolom ke bawah menjawab rumusan masalah 2. Dua sel sengaja kosong dengan alasannya:
YOLO26s tanpa contoh (tidak mungkin) dan YOLOE-26s dengan seluruh foto (setara YOLO26s, 61,3 vs 61,0). Tiap kartu
menampilkan nilainya (mAP50, dibulatkan) dan hasilnya untuk foto yang sedang dibuka; mengarahkan kursor ke kartu
memperlihatkan hasil detektor itu di foto (pratinjau). Tab di kanan atas: Benda APD, Kepatuhan pekerja, Cari benda lain.

| Kartu | Bobot (seed 0) | nilai (mAP50) |
|---|---|---|
| YOLOE-26s, 0 foto | `weights/yoloe-26s-seg.pt` (zero-shot) | 38,4 |
| YOLOE-26s, 39 foto | `runs/train/k10_seed0_yoloe-lps/weights/last.pt` (linear probing) | 41,1 |
| YOLOE-26s, 109 foto | `runs/train/k30_seed0_yoloe-lps/weights/last.pt` (linear probing) | 43,2 |
| YOLO26s, 39 foto | `runs/train/k10_seed0_yolo26s/weights/last.pt` | 31,5 |
| YOLO26s, 109 foto | `runs/train/k30_seed0_yolo26s/weights/last.pt` | 40,3 |
| YOLO26s, 4.986 foto | `runs/train/full_seed0_yolo26s/weights/best.pt` | 61,0 |

1. **Benda APD, "Pekerja di atap gedung".** Baris YOLOE-26s menunjukkan 3, 6, 6 APD; baris YOLO26s 2, 5, 6. Pada 39
   foto contoh, YOLOE-26s menemukan 6 APD dan YOLO26s hanya 2, dan panel kanan menuliskan bedanya. Tanpa contoh,
   detektor sudah menemukan helm dan rompi, tetapi hampir tidak menemukan bagian tubuh (recall bagian tubuh terbuka 6,4%).
2. **Kepatuhan pekerja, "Tiga pekerja proyek".** Kartu menunjukkan 1/3, 3/3, 3/3, lalu 0/2 pekerja patuh. Pada 4.986 foto berlabel YOLO26 menyatakan "Tanpa helm" karena helm di foto ini hanya mendapat
   skor 0,13 dan 0,002. Ini contoh nyata hasil uji lintas dataset: YOLO26s turun ke 32,0 mAP50 di Construction-PPE,
   sedangkan bobot open-vocabulary lebih tahan pindah domain.
3. **Cari benda lain, "Teknisi di atas tangga".** Klik saran `ladder`. Zero-shot menemukan tangga (81%); kartu lain
   terkunci karena model itu hanya mengenal 17 jenis yang dilatihkan.
4. **Batas zero-shot (opsional).** Tambah `safety harness` lalu buka foto uji 169: zero-shot menandai tali kartu
   identitas sebagai harness (60%). Ini alasan untuk tetap memberi contoh berlabel pada jenis yang penting.

Di bawah layar utama ada bagian penjelasan: grafik nilai menurut jumlah foto contoh (bisa ditunjuk dan diklik), enam angka temuan, dan
tabel per jenis benda untuk keempat model.

## Pengujian

```bash
.venv/Scripts/python -m pytest app/backend/tests -q
```

11 tes aturan kepatuhan dengan kotak buatan, tanpa model dan tanpa GPU.

## Batasan

- Hanya foto. Video, webcam, adaptasi few-shot dari aplikasi, dan panel rekomendasi belum dibuat (langkah 5 sampai 7
  di `rencana_prototipe.md`).
- Foto contoh diambil dari `data/construction-ppe/images/test/` dan tidak ikut ke git.
- Ekspor TensorRT belum dicoba. Catatannya ada di rencana teknis: exporter Ultralytics menggabungkan embedding teks
  ke head YOLOE saat ekspor, jadi kelas terkunci di file `.engine`.

## Lisensi

Prototipe ini hanya untuk keperluan akademik. Ultralytics berlisensi AGPL-3.0, dan dataset SH17 berlisensi
CC BY-NC-SA 4.0 (non-komersial). Construction-PPE dari Ultralytics berlisensi AGPL-3.0.
