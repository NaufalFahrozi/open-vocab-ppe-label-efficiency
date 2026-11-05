// Titik kurva efisiensi label dari results/hasil/ringkasan.md (mAP50 test SH17).
// Jumlah gambar per k adalah rata-rata 5 seed (k = 1: ±6, 5: ±20, 10: ±39, 30: ±109, 100: ±338).
// Few-shot = rata-rata 5 seed; zero-shot dan data penuh = satu run.

export interface Titik {
  gambar: number
  map50: number
  k?: number
}

export const KURVA_YOLOE_LP: Titik[] = [
  { gambar: 0, map50: 38.4, k: 0 },
  { gambar: 6, map50: 38.4, k: 1 },
  { gambar: 20, map50: 40.2, k: 5 },
  { gambar: 39, map50: 41.1, k: 10 },
  { gambar: 109, map50: 43.2, k: 30 },
  { gambar: 338, map50: 45.2, k: 100 },
]

export const KURVA_YOLO26: Titik[] = [
  { gambar: 6, map50: 15.4, k: 1 },
  { gambar: 20, map50: 26.2, k: 5 },
  { gambar: 39, map50: 31.5, k: 10 },
  { gambar: 109, map50: 40.3, k: 30 },
  { gambar: 338, map50: 50.0, k: 100 },
  { gambar: 4986, map50: 61.0 },
]

// Posisi tiap mode demo pada sumbu jumlah gambar berlabel.
export const POSISI_MODE = {
  zs: { gambar: 0, map50: 38.4, kurva: 'yoloe' },
  lp10: { gambar: 39, map50: 41.1, kurva: 'yoloe' },
  lp30: { gambar: 109, map50: 43.2, kurva: 'yoloe' },
  y10: { gambar: 39, map50: 31.5, kurva: 'yolo26' },
  y30: { gambar: 109, map50: 40.3, kurva: 'yolo26' },
  full: { gambar: 4986, map50: 61.0, kurva: 'yolo26' },
} as const

// Skala symlog: 0 tetap bisa digambar, dan 6 sampai 4.986 tersebar rata.
export const symlog = (n: number) => Math.log10(1 + n)

export const fmtID = (n: number, d = 1) => n.toLocaleString('id-ID', { minimumFractionDigits: d, maximumFractionDigits: d })
