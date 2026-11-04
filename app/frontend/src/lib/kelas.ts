// Nama, warna, dan ikon tiap kelas. Warna mengikuti KELOMPOK kelas (APD, bagian tubuh, lainnya),
// bukan tiap kelas, supaya 17 kelas tidak butuh 17 warna yang mustahil dibedakan.
import {
  BriefcaseMedical,
  Ear,
  Footprints,
  Glasses,
  Hand,
  HardHat,
  Headphones,
  PersonStanding,
  ScanFace,
  Shield,
  Shirt,
  Sparkles,
  User,
  Wrench,
  type LucideIcon,
} from 'lucide-react'

export type Kelompok = 'APD' | 'Bagian tubuh' | 'Lainnya' | 'Kelas baru'

export const WARNA_KELOMPOK: Record<Kelompok, string> = {
  APD: 'var(--grp-apd)',
  'Bagian tubuh': 'var(--grp-tubuh)',
  Lainnya: 'var(--grp-lain)',
  'Kelas baru': 'var(--grp-baru)',
}

// Warna teks di atas label kotak, dipilih supaya kontrasnya cukup.
export const TEKS_DI_ATAS: Record<Kelompok, string> = {
  APD: '#ffffff',
  'Bagian tubuh': '#101820',
  Lainnya: '#101820',
  'Kelas baru': '#101820',
}

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

export const IKON_KELAS: Record<string, LucideIcon> = {
  person: User,
  ear: Ear,
  'ear-mufs': Headphones,
  face: ScanFace,
  'face-guard': Shield,
  'face-mask': ScanFace,
  foot: Footprints,
  tool: Wrench,
  glasses: Glasses,
  gloves: Hand,
  helmet: HardHat,
  hands: Hand,
  head: PersonStanding,
  'medical-suit': BriefcaseMedical,
  shoes: Footprints,
  'safety-suit': Shirt,
  'safety-vest': Shirt,
}

export const ikonKelas = (kelas: string): LucideIcon => IKON_KELAS[kelas] ?? Sparkles

export function kelompokDari(kelas: string, kelompok: Record<string, string[]>): Kelompok {
  for (const [k, daftar] of Object.entries(kelompok)) if (daftar.includes(kelas)) return k as Kelompok
  return 'Kelas baru'
}

export const namaTampil = (kelas: string) => NAMA_ID[kelas] ?? kelas
