import type { ModeId } from './api'

// Nama detektor dalam bahasa biasa. "Foto contoh" = foto latih yang bendanya sudah ditandai kotak oleh
// manusia (foto berlabel). Nama teknis tetap ada untuk dosen yang ingin tahu.
interface InfoMode {
  angka: string
  judul: string
  pendek: string
  teknis: string
  model: 'YOLOE-26s' | 'YOLO26s' // ditampilkan langsung di kartu, bukan hanya tooltip
  metode: string
  tumpukan: number
}

export const MODE_AWAM: Record<ModeId, InfoMode> = {
  zs: {
    angka: '0',
    judul: 'Belum diberi contoh',
    pendek: 'Hanya tahu nama bendanya',
    teknis: 'YOLOE-26s zero-shot',
    model: 'YOLOE-26s',
    metode: 'zero-shot',
    tumpukan: 0,
  },
  lp10: {
    angka: '39',
    judul: 'Diberi 39 foto contoh',
    pendek: '10 contoh untuk tiap jenis benda',
    teknis: 'YOLOE-26s linear probing, k = 10',
    model: 'YOLOE-26s',
    metode: 'linear probing, k = 10',
    tumpukan: 1,
  },
  lp30: {
    angka: '109',
    judul: 'Diberi 109 foto contoh',
    pendek: '30 contoh untuk tiap jenis benda',
    teknis: 'YOLOE-26s linear probing, k = 30',
    model: 'YOLOE-26s',
    metode: 'linear probing, k = 30',
    tumpukan: 2,
  },
  y10: {
    angka: '39',
    judul: 'Diberi 39 foto contoh',
    pendek: '10 contoh untuk tiap jenis benda',
    teknis: 'YOLO26s fine-tune, k = 10',
    model: 'YOLO26s',
    metode: 'dilatih, k = 10',
    tumpukan: 1,
  },
  y30: {
    angka: '109',
    judul: 'Diberi 109 foto contoh',
    pendek: '30 contoh untuk tiap jenis benda',
    teknis: 'YOLO26s fine-tune, k = 30',
    model: 'YOLO26s',
    metode: 'dilatih, k = 30',
    tumpukan: 2,
  },
  full: {
    angka: '4.986',
    judul: 'Diberi 4.986 foto contoh',
    pendek: 'Seluruh foto latih',
    teknis: 'YOLO26s, data penuh SH17',
    model: 'YOLO26s',
    metode: 'dilatih penuh',
    tumpukan: 4,
  },
}

// Tabel pemilih: baris = model, kolom = jumlah foto contoh. null = sel kosong dengan alasannya.
export const KOLOM = ['0', '39', '109', '4.986'] as const
export const BARIS: { model: 'YOLOE-26s' | 'YOLO26s'; sel: (ModeId | null)[] }[] = [
  { model: 'YOLOE-26s', sel: ['zs', 'lp10', 'lp30', null] },
  { model: 'YOLO26s', sel: [null, 'y10', 'y30', 'full'] },
]
export const ALASAN_KOSONG: Record<string, string> = {
  'YOLOE-26s-3': 'Tidak dipakai: dilatih dengan seluruh foto, YOLOE-26s setara YOLO26s (nilai 61,3 vs 61,0)',
  'YOLO26s-0': 'Tidak bisa: detektor biasa harus dilatih dulu dengan contoh',
}

// Pembanding untuk kalimat "dibanding ..." di panel hasil. YOLO26s dibandingkan dengan YOLOE-26s pada
// jumlah foto contoh yang SAMA, karena itulah pertanyaan penelitiannya (rumusan masalah 2).
export const PEMBANDING: Record<ModeId, ModeId | null> = { zs: null, lp10: 'zs', lp30: 'lp10', y10: 'lp10', y30: 'lp30', full: 'y30' }
export const namaPendek = (m: ModeId) => `${MODE_AWAM[m].model} dengan ${MODE_AWAM[m].angka} foto contoh`

// Keterangan dua keluarga model, ditampilkan di atas kartu pemilih.
export const KELUARGA = {
  'YOLOE-26s': { nama: 'YOLOE-26s', jenis: 'detektor open-vocabulary', isi: 'bisa mencari benda dari namanya saja' },
  'YOLO26s': { nama: 'YOLO26s', jenis: 'detektor biasa', isi: 'harus dilatih dulu' },
} as const

// Nama ramah untuk foto demo; foto lain memakai nomor filenya.
export const NAMA_FOTO: Record<string, string> = {
  'image1003.jpg': 'Pekerja di atap gedung',
  'image548.jpg': 'Tiga pekerja proyek',
  'image58.jpeg': 'Teknisi di atas tangga',
}
export const namaFoto = (f: string) => NAMA_FOTO[f] ?? `Foto uji ${f.replace(/\D/g, '')}`
