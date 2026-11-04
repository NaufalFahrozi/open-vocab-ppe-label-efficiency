// Warna dan nama tampilan kelas. Warna mengikuti KELOMPOK kelas (APD, bagian tubuh, lainnya),
// bukan tiap kelas, supaya 17 kelas tidak butuh 17 warna yang mustahil dibedakan.

export type Kelompok = 'APD' | 'Bagian tubuh' | 'Lainnya' | 'Kelas baru'

export const WARNA_KELOMPOK: Record<Kelompok, string> = {
  APD: 'var(--grp-apd)',
  'Bagian tubuh': 'var(--grp-tubuh)',
  Lainnya: 'var(--grp-lain)',
  'Kelas baru': 'var(--grp-baru)',
}

// Teks di atas warna kelompok: kuning dan merah muda terlalu terang untuk teks putih.
export const TEKS_DI_ATAS: Record<Kelompok, string> = {
  APD: '#ffffff',
  'Bagian tubuh': '#1c2430',
  Lainnya: '#ffffff',
  'Kelas baru': '#1c2430',
}

// Nama Indonesia untuk tampilan; nama asli SH17 tetap ditampilkan kecil di tabel.
export const NAMA_ID: Record<string, string> = {
  person: 'orang',
  ear: 'telinga',
  'ear-mufs': 'pelindung telinga',
  face: 'wajah',
  'face-guard': 'pelindung wajah',
  'face-mask': 'masker',
  foot: 'kaki',
  tool: 'alat',
  glasses: 'kacamata',
  gloves: 'sarung tangan',
  helmet: 'helm',
  hands: 'tangan telanjang',
  head: 'kepala',
  'medical-suit': 'baju medis',
  shoes: 'sepatu',
  'safety-suit': 'baju pelindung',
  'safety-vest': 'rompi',
}

export function kelompokDari(kelas: string, kelompok: Record<string, string[]>): Kelompok {
  for (const [k, daftar] of Object.entries(kelompok)) if (daftar.includes(kelas)) return k as Kelompok
  return 'Kelas baru'
}

export const namaTampil = (kelas: string) => NAMA_ID[kelas] ?? kelas
