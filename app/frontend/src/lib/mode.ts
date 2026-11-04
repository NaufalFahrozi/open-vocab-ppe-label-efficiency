import type { ModeId } from './api'

// Nama mode dalam bahasa awam. Nama teknisnya tetap ada untuk dosen yang ingin tahu.
export const MODE_AWAM: Record<ModeId, { angka: string; judul: string; pendek: string; teknis: string }> = {
  zs: {
    angka: '0',
    judul: 'Tanpa foto berlabel',
    pendek: 'Cukup diberi nama benda',
    teknis: 'YOLOE-26s zero-shot',
  },
  lp10: {
    angka: '39',
    judul: '39 foto berlabel',
    pendek: '10 contoh per jenis benda',
    teknis: 'YOLOE-26s linear probing, k = 10',
  },
  lp30: {
    angka: '109',
    judul: '109 foto berlabel',
    pendek: '30 contoh per jenis benda',
    teknis: 'YOLOE-26s linear probing, k = 30',
  },
  full: {
    angka: '4.986',
    judul: '4.986 foto berlabel',
    pendek: 'Seluruh data latih',
    teknis: 'YOLO26s, data penuh SH17',
  },
}

// Nama ramah untuk foto demo; foto lain memakai nomor filenya.
export const NAMA_FOTO: Record<string, string> = {
  'image1003.jpg': 'Pekerja di atap gedung',
  'image548.jpg': 'Tiga pekerja proyek',
  'image58.jpeg': 'Teknisi di atas tangga',
}
export const namaFoto = (f: string) => NAMA_FOTO[f] ?? `Foto uji ${f.replace(/\D/g, '')}`
