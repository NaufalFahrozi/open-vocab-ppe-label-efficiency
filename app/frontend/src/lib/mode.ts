import type { ModeId } from './api'

// Nama detektor dalam bahasa biasa. "Foto contoh" = foto latih yang bendanya sudah ditandai kotak oleh
// manusia (foto berlabel). Nama teknis tetap ada untuk dosen yang ingin tahu.
export const MODE_AWAM: Record<ModeId, { angka: string; judul: string; pendek: string; teknis: string; tumpukan: number }> = {
  zs: {
    angka: '0',
    judul: 'Belum diberi contoh',
    pendek: 'Hanya tahu nama bendanya',
    teknis: 'YOLOE-26s zero-shot',
    tumpukan: 0,
  },
  lp10: {
    angka: '39',
    judul: 'Diberi 39 foto contoh',
    pendek: '10 contoh untuk tiap jenis benda',
    teknis: 'YOLOE-26s linear probing, k = 10',
    tumpukan: 1,
  },
  lp30: {
    angka: '109',
    judul: 'Diberi 109 foto contoh',
    pendek: '30 contoh untuk tiap jenis benda',
    teknis: 'YOLOE-26s linear probing, k = 30',
    tumpukan: 2,
  },
  full: {
    angka: '4.986',
    judul: 'Diberi 4.986 foto contoh',
    pendek: 'Seluruh foto latih',
    teknis: 'YOLO26s, data penuh SH17',
    tumpukan: 4,
  },
}

// Nama ramah untuk foto demo; foto lain memakai nomor filenya.
export const NAMA_FOTO: Record<string, string> = {
  'image1003.jpg': 'Pekerja di atap gedung',
  'image548.jpg': 'Tiga pekerja proyek',
  'image58.jpeg': 'Teknisi di atas tangga',
}
export const namaFoto = (f: string) => NAMA_FOTO[f] ?? `Foto uji ${f.replace(/\D/g, '')}`
