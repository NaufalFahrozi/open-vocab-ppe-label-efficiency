import { useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'

import { MODE_ORDER, type ModeId } from '@/lib/api'
import { fmtID, POSISI_MODE } from '@/lib/kurva'
import { MODE_AWAM } from '@/lib/mode'
import { cn } from '@/lib/utils'

// Pemilih detektor: empat kartu pilihan (radio), bukan penggeser progres, karena pengguna MEMILIH satu
// dari empat detektor yang berbeda jumlah foto contohnya. Tiap kartu langsung menampilkan hasilnya untuk
// foto yang sedang dibuka, sehingga keempatnya bisa dibandingkan tanpa klik. Arahkan kursor = pratinjau.

export interface Ringkas {
  angka: string
  satuan: string
}

interface Props {
  nilai: ModeId
  onPilih: (m: ModeId) => void
  onPratinjau: (m: ModeId | null) => void
  terkunci: ModeId[]
  alasanKunci: string
  ringkas: Partial<Record<ModeId, Ringkas>>
}

// Tumpukan foto contoh: makin banyak contoh, makin tinggi tumpukannya. Tiap lembar punya kotak kecil,
// tanda bahwa fotonya sudah dilabeli.
function Tumpukan({ n, aktif }: { n: number; aktif: boolean }) {
  const garis = aktif ? 'var(--ink)' : 'var(--ink-3)'
  if (n === 0) {
    return (
      <svg width="44" height="40" viewBox="0 0 44 40" aria-hidden>
        <rect x="9" y="8" width="26" height="22" rx="3" fill="none" stroke={garis} strokeWidth="1.5" strokeDasharray="3 3" />
      </svg>
    )
  }
  return (
    <svg width="44" height="40" viewBox="0 0 44 40" aria-hidden>
      {Array.from({ length: n }, (_, i) => {
        const d = (n - 1 - i) * 3.5
        return (
          <g key={i} transform={`translate(${6 + d} ${12 - d * 0.9})`}>
            <rect width="26" height="22" rx="3" fill="var(--surface)" stroke={garis} strokeWidth="1.5" />
            {i === n - 1 && <rect x="7" y="5" width="11" height="11" rx="1.5" fill="none" stroke="var(--grp-apd)" strokeWidth="1.75" />}
          </g>
        )
      })}
    </svg>
  )
}

export function DetectorPicker({ nilai, onPilih, onPratinjau, terkunci, alasanKunci, ringkas }: Props) {
  const tombol = useRef<(HTMLButtonElement | null)[]>([])
  const [info, setInfo] = useState(false)

  const geser = (arah: number) => {
    let i = MODE_ORDER.indexOf(nilai)
    do i += arah
    while (i >= 0 && i < 4 && terkunci.includes(MODE_ORDER[i]))
    if (i < 0 || i > 3) return
    onPilih(MODE_ORDER[i])
    tombol.current[i]?.focus()
  }

  return (
    <div>
      <div
        role="radiogroup"
        aria-label="Pilih detektor"
        className="grid grid-cols-2 gap-2 xl:grid-cols-4"
        onMouseLeave={() => onPratinjau(null)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' || e.key === 'ArrowRight') (e.preventDefault(), geser(1))
          if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') (e.preventDefault(), geser(-1))
        }}
      >
        {MODE_ORDER.map((m, i) => {
          const on = m === nilai
          const kunci = terkunci.includes(m)
          const skor = POSISI_MODE[m].map50
          const r = ringkas[m]
          return (
            <button
              key={m}
              ref={(el) => {
                tombol.current[i] = el
              }}
              role="radio"
              aria-checked={on}
              aria-disabled={kunci}
              tabIndex={on ? 0 : -1}
              title={kunci ? alasanKunci : MODE_AWAM[m].teknis}
              onClick={() => !kunci && onPilih(m)}
              onMouseEnter={() => !kunci && onPratinjau(m)}
              onFocus={() => !kunci && onPratinjau(m)}
              onBlur={() => onPratinjau(null)}
              className={cn(
                'group flex flex-col gap-2 rounded-xl border-2 p-3 text-left transition-colors',
                on ? 'border-brand bg-brand-soft' : 'border-line bg-surface hover:border-ink-3',
                kunci && 'cursor-not-allowed opacity-45 hover:border-line',
              )}
            >
              <span className="flex items-start justify-between gap-2">
                <span className="flex items-center gap-2">
                  {/* tanda pilihan, seperti tombol radio biasa */}
                  <span className={cn('grid size-5 shrink-0 place-items-center rounded-full border-2 bg-surface', on ? 'border-ink' : 'border-ink-3')} aria-hidden>
                    {on && <span className="size-2.5 rounded-full bg-ink" />}
                  </span>
                  <Tumpukan n={MODE_AWAM[m].tumpukan} aktif={on} />
                </span>
                {r && (
                  <span className="text-right" title="Hasil detektor ini untuk foto yang sedang dibuka">
                    <span className="block text-xl leading-none font-semibold">{r.angka}</span>
                    <span className="mt-0.5 block text-[11px] text-ink-3">{r.satuan}</span>
                  </span>
                )}
              </span>
              <span className="min-w-0">
                <span className="block text-sm leading-snug font-semibold">{MODE_AWAM[m].judul}</span>
                <span className="block text-xs text-ink-3">{MODE_AWAM[m].pendek}</span>
                <span className="mt-2 flex items-center gap-2" title={`mAP50 ${fmtID(skor)}`}>
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-plate">
                    <span className="block h-full rounded-full bg-ink" style={{ width: `${skor}%` }} />
                  </span>
                  <span className="text-xs font-medium whitespace-nowrap text-ink-2">nilai {Math.round(skor)}</span>
                </span>
              </span>
            </button>
          )
        })}
      </div>

      <button onClick={() => setInfo(!info)} aria-expanded={info} className="mt-2 flex items-center gap-1 text-xs font-medium text-ink-2 hover:text-ink">
        <ChevronDown className={cn('size-3.5 transition-transform', info && 'rotate-180')} aria-hidden />
        Apa itu foto contoh dan nilai?
      </button>
      {info && (
        <div className="mt-2 space-y-1.5 rounded-xl bg-row p-3 text-xs leading-relaxed text-ink-2">
          <p>
            <b className="font-semibold text-ink">Foto contoh</b> adalah foto yang setiap helm, rompi, dan benda lainnya
            sudah ditandai kotak satu per satu oleh manusia. Membuatnya lama dan mahal, jadi makin sedikit makin hemat.
          </p>
          <p>
            <b className="font-semibold text-ink">Nilai</b> adalah skor ketepatan detektor saat diuji pada 1.620 foto lain
            yang belum pernah dilihatnya, dari 0 sampai 100 (istilah teknisnya mAP50).
          </p>
        </div>
      )}
    </div>
  )
}
