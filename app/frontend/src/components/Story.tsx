import { ChevronDown } from 'lucide-react'

import type { DetectResponse, ModeId, ModelsResponse } from '@/lib/api'
import { ClassMatrix } from './ClassMatrix'
import { KurvaLabel } from './KurvaLabel'

// Bagian bawah halaman: temuan penelitian dalam angka besar, kurva, dan tabel rinci untuk yang ingin
// memeriksa. Semua angka dari results/hasil/ringkasan.md dan laporan_pendahuluan.md.

const FAKTA_UTAMA = [
  { angka: '38', satuan: 'nilai', isi: 'tanpa satu pun foto contoh. Detektor cukup diberi kata seperti "helmet" dan "safety vest".' },
  { angka: '109–338', satuan: 'foto contoh', isi: 'baru membuat detektor biasa (YOLO26) menyusul detektor open-vocabulary yang diberi foto sama.' },
  { angka: '61', satuan: 'nilai', isi: 'dengan seluruh 4.986 foto contoh. Hasil terbaik, sekaligus biaya pelabelan terbesar.' },
]

const FAKTA_LAIN = [
  { angka: '6,4%', isi: 'telinga, wajah, tangan, dan kaki yang ditemukan detektor tanpa contoh (YOLOE-26s). Benda APD mudah dikenali, bagian tubuh tidak.' },
  { angka: '90 vs 57', isi: 'nilai menemukan kepala tanpa helm: cocokkan helm ke kepala, lawan langsung mencari "kepala tanpa helm". Sorot memakai cara pertama.' },
  { angka: '60 vs 32', isi: 'nilai di kumpulan foto lain (Construction-PPE): detektor tanpa contoh (Grounding DINO) mengalahkan YOLO26 yang dilatih penuh.' },
]

interface Props {
  mode: ModeId
  onMode: (m: ModeId) => void
  hasil: DetectResponse | null
  models: ModelsResponse | null
  sorot: string | null
  onSorot: (k: string | null) => void
}

export function Story({ mode, onMode, hasil, models, sorot, onSorot }: Props) {
  return (
    <section aria-labelledby="judul-cerita" className="mx-auto max-w-[1440px] px-4 pt-20 pb-12 sm:px-6">
      <div className="grid gap-x-12 gap-y-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <h2 id="judul-cerita" className="text-4xl leading-[1.05] font-semibold sm:text-5xl">
          Membuat foto contoh itu mahal. Seberapa banyak yang benar-benar perlu?
        </h2>
        <p className="max-w-2xl self-end text-[15px] leading-relaxed text-ink-2">
          Setiap foto contoh harus ditandai kotak satu per satu oleh manusia: helm di sini, rompi di sana. Penelitian ini
          membandingkan detektor open-vocabulary, yang bisa mencari benda dari namanya saja, dengan detektor biasa, pada
          jumlah foto contoh yang sama. Semua detektor diuji pada 1.620 foto yang sama.
        </p>
      </div>

      <div className="mt-10 rounded-2xl bg-surface p-4 sm:p-6">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-base font-semibold">Nilai detektor menurut jumlah foto contoh</h3>
          <p className="text-xs text-ink-3">Tunjuk grafik untuk melihat angkanya, klik lingkaran besar untuk mencoba detektornya</p>
        </div>
        <KurvaLabel
          aktif={mode}
          onPilih={(m) => {
            onMode(m)
            window.scrollTo({ top: 0, behavior: 'smooth' })
          }}
        />
        <p className="mt-3 text-xs text-ink-3">
          Nilai = mAP50, skor ketepatan deteksi dari 0 sampai 100. Detektor dengan sedikit foto contoh adalah rata-rata 5
          ulangan dengan pilihan foto contoh berbeda.
        </p>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {FAKTA_UTAMA.map((f) => (
          <div key={f.angka} className="rounded-2xl bg-surface p-6">
            <p className="text-5xl leading-none font-semibold">
              {f.angka} <span className="text-lg font-medium text-ink-2">{f.satuan}</span>
            </p>
            <p className="mt-3 text-sm leading-relaxed text-ink-2">{f.isi}</p>
          </div>
        ))}
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        {FAKTA_LAIN.map((f) => (
          <div key={f.angka} className="rounded-2xl border border-line p-5">
            <p className="text-2xl leading-none font-semibold">{f.angka}</p>
            <p className="mt-2 text-sm leading-relaxed text-ink-2">{f.isi}</p>
          </div>
        ))}
      </div>

      {hasil && models && (
        <details className="group mt-10">
          <summary className="flex cursor-pointer items-center gap-2 text-sm font-semibold select-none">
            <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden />
            Rincian per jenis benda untuk keempat model pada foto ini
          </summary>
          <div className="mt-3">
            <ClassMatrix hasil={hasil} modes={models.modes} kelompok={models.kelompok_kelas} sorot={sorot} onSorot={onSorot} />
          </div>
        </details>
      )}
    </section>
  )
}
