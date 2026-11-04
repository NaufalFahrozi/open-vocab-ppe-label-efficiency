import { useRef } from 'react'

import { MODE_ORDER, type ModeId } from '@/lib/api'
import { fmtID, POSISI_MODE } from '@/lib/kurva'
import { MODE_AWAM } from '@/lib/mode'
import { cn } from '@/lib/utils'

// Kontrol utama halaman: berapa foto berlabel yang dipakai model. Empat titik di satu garis, seperti
// penggeser. Bisa diklik atau digeser dengan tombol panah kiri dan kanan.

interface Props {
  nilai: ModeId
  onPilih: (m: ModeId) => void
  terkunci?: ModeId[] // titik yang tidak bisa dipilih (misalnya di tab APD baru)
  alasanKunci?: string
}

export function LabelStepper({ nilai, onPilih, terkunci = [], alasanKunci }: Props) {
  const tombol = useRef<(HTMLButtonElement | null)[]>([])
  const aktifIdx = MODE_ORDER.indexOf(nilai)

  const geser = (arah: number) => {
    let i = aktifIdx
    do i += arah
    while (i >= 0 && i < MODE_ORDER.length && terkunci.includes(MODE_ORDER[i]))
    if (i < 0 || i >= MODE_ORDER.length) return
    onPilih(MODE_ORDER[i])
    tombol.current[i]?.focus()
  }

  return (
    <div>
      <div
        role="radiogroup"
        aria-label="Jumlah foto berlabel yang dipakai untuk melatih model"
        className="relative grid grid-cols-4"
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') (e.preventDefault(), geser(1))
          if (e.key === 'ArrowLeft') (e.preventDefault(), geser(-1))
        }}
      >
        {/* garis lintasan, dari tengah titik pertama ke tengah titik terakhir */}
        <div className="absolute top-[11px] right-[12.5%] left-[12.5%] h-0.5 bg-rule" aria-hidden />
        <div
          className="absolute top-[11px] left-[12.5%] h-0.5 bg-ink"
          style={{ width: `${(aktifIdx / 3) * 75}%` }}
          aria-hidden
        />
        {MODE_ORDER.map((m, i) => {
          const on = m === nilai
          const kunci = terkunci.includes(m)
          return (
            <button
              key={m}
              ref={(el) => {
                tombol.current[i] = el
              }}
              role="radio"
              aria-checked={on}
              aria-disabled={kunci}
              aria-label={`${MODE_AWAM[m].judul}, mAP50 ${fmtID(POSISI_MODE[m].map50)}`}
              tabIndex={on ? 0 : -1}
              title={kunci ? alasanKunci : MODE_AWAM[m].teknis}
              onClick={() => !kunci && onPilih(m)}
              className={cn(
                'group relative flex flex-col items-center gap-1 rounded-md pb-1 text-center outline-none focus-visible:ring-2 focus-visible:ring-ring',
                kunci ? 'cursor-not-allowed opacity-40' : 'cursor-pointer',
              )}
            >
              <span
                className={cn(
                  'relative z-10 grid size-6 place-items-center rounded-full border-2',
                  on ? 'border-ink bg-ink' : i < aktifIdx ? 'border-ink bg-sheet' : 'border-ink-3 bg-sheet group-hover:border-ink',
                )}
                aria-hidden
              >
                {on && <span className="size-2 rounded-full bg-white" />}
              </span>
              <span className={cn('font-wide mt-1 text-xl leading-none font-semibold sm:text-2xl', on ? 'text-ink' : 'text-ink-3 group-hover:text-ink-2')}>
                {MODE_AWAM[m].angka}
              </span>
              <span className={cn('text-xs', on ? 'text-ink-2' : 'text-ink-3')}>
                mAP50 <b className="font-semibold">{fmtID(POSISI_MODE[m].map50)}</b>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
