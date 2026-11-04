import type { ModeId } from './api'

// Nama mode dalam bahasa awam. Nama teknisnya tetap ditampilkan kecil, untuk dosen yang ingin tahu.
export const MODE_AWAM: Record<ModeId, { angka: string; judul: string; teknis: string; ringkas: string }> = {
  zs: {
    angka: '0',
    judul: 'Tanpa foto berlabel',
    teknis: 'YOLOE-26s zero-shot',
    ringkas: 'Model hanya diberi nama objek, misalnya "helmet", tanpa contoh gambar.',
  },
  lp10: {
    angka: '39',
    judul: '39 foto berlabel',
    teknis: 'YOLOE-26s linear probing, 10 contoh per jenis',
    ringkas: 'Model yang sama, lalu diajari dengan 10 contoh untuk tiap jenis objek.',
  },
  lp30: {
    angka: '109',
    judul: '109 foto berlabel',
    teknis: 'YOLOE-26s linear probing, 30 contoh per jenis',
    ringkas: 'Model yang sama, lalu diajari dengan 30 contoh untuk tiap jenis objek.',
  },
  full: {
    angka: '4.986',
    judul: '4.986 foto berlabel',
    teknis: 'YOLO26s, seluruh data latih SH17',
    ringkas: 'Detektor biasa yang dilatih dengan seluruh data latih.',
  },
}
