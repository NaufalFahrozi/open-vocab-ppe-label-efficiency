import { useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'

import { MODE_ORDER, type ModeId } from '@/lib/api'
import { fmtID, POSISI_MODE } from '@/lib/kurva'
import { ALASAN_KOSONG, BARIS, KELUARGA, KOLOM, MODE_AWAM } from '@/lib/mode'
import { cn } from '@/lib/utils'

// Pemilih detektor berbentuk tabel: baris = model, kolom = jumlah foto contoh. Membaca satu kolom ke bawah
// menjawab rumusan masalah 2: pada jumlah foto contoh yang sama, model mana yang lebih baik.
// Tiap sel adalah pilihan (radio) yang langsung menampilkan hasilnya untuk foto yang sedang dibuka.
// Arahkan kursor = pratinjau di foto, klik = pilih.

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

export function DetectorPicker({ nilai, onPilih, onPratinjau, terkunci, alasanKunci, ringkas }: Props) {
  const tombol = useRef<Partial<Record<ModeId, HTMLButtonElement | null>>>({})
  const [info, setInfo] = useState(false)

  const geser = (arah: number) => {
    let i = MODE_ORDER.indexOf(nilai)
    do i += arah
    while (i >= 0 && i < MODE_ORDER.length && terkunci.includes(MODE_ORDER[i]))
    if (i < 0 || i >= MODE_ORDER.length) return
    onPilih(MODE_ORDER[i])
    tombol.current[MODE_ORDER[i]]?.focus()
  }

  const kartu = (m: ModeId) => {
    const on = m === nilai
    const kunci = terkunci.includes(m)
    const skor = POSISI_MODE[m].map50
    const r = ringkas[m]
    return (
      <button
        ref={(el) => {
          tombol.current[m] = el
        }}
        role="radio"
        aria-checked={on}
        aria-disabled={kunci}
        aria-label={`${MODE_AWAM[m].model}, ${MODE_AWAM[m].judul.toLowerCase()}, nilai ${Math.round(skor)}`}
        tabIndex={on ? 0 : -1}
        title={kunci ? alasanKunci : MODE_AWAM[m].teknis}
        onClick={() => !kunci && onPilih(m)}
        onMouseEnter={() => !kunci && onPratinjau(m)}
        onFocus={() => !kunci && onPratinjau(m)}
        onBlur={() => onPratinjau(null)}
        className={cn(
          'flex h-full w-full flex-col justify-between gap-2 rounded-xl border-2 px-3 py-2.5 text-left transition-colors',
          on ? 'border-brand bg-brand-soft' : 'border-line bg-surface hover:border-ink-3',
          kunci && 'cursor-not-allowed opacity-45 hover:border-line',
        )}
      >
        <span className="flex items-start justify-between gap-2">
          <span className={cn('mt-0.5 grid size-[18px] shrink-0 place-items-center rounded-full border-2 bg-surface', on ? 'border-ink' : 'border-ink-3')} aria-hidden>
            {on && <span className="size-2 rounded-full bg-ink" />}
          </span>
          {/* di HP nama model sudah ada di judul baris, jadi kartu cukup menyebut jumlah foto contohnya */}
          <span className="min-w-0 flex-1 text-xs leading-snug md:hidden">
            <b className="block text-sm font-semibold">{MODE_AWAM[m].angka}</b>
            <span className="text-ink-3">foto contoh</span>
          </span>
          <span className="hidden min-w-0 flex-1 text-xs text-ink-3 md:block">{MODE_AWAM[m].metode}</span>
          {r && (
            <span className="hidden text-right md:block" title="Hasil detektor ini untuk foto yang sedang dibuka">
              <span className="block text-lg leading-none font-semibold">{r.angka}</span>
              <span className="block text-[11px] text-ink-3">{r.satuan}</span>
            </span>
          )}
        </span>
        {r && (
          <span className="text-xs text-ink-2 md:hidden">
            <b className="text-base font-semibold text-ink">{r.angka}</b> {r.satuan}
          </span>
        )}
        <span className="flex items-center gap-2" title={`mAP50 ${fmtID(skor)}`}>
          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-plate">
            <span className={cn('block h-full rounded-full', MODE_AWAM[m].model === 'YOLOE-26s' ? 'bg-apd' : 'bg-ink-2')} style={{ width: `${skor}%` }} />
          </span>
          <span className="text-xs font-medium whitespace-nowrap text-ink-2">nilai {Math.round(skor)}</span>
        </span>
      </button>
    )
  }

  return (
    <div>
      <div
        role="radiogroup"
        aria-label="Pilih detektor"
        onMouseLeave={() => onPratinjau(null)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' || e.key === 'ArrowRight') (e.preventDefault(), geser(1))
          if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') (e.preventDefault(), geser(-1))
        }}
      >
        {/* tabel di layar sedang ke atas */}
        <div className="hidden grid-cols-[148px_repeat(4,minmax(0,1fr))] gap-2 md:grid">
          <span />
          {KOLOM.map((k) => (
            <p key={k} className="pb-0.5 text-center text-xs text-ink-2">
              <b className="text-sm font-semibold text-ink">{k}</b> foto contoh
            </p>
          ))}
          {BARIS.map(({ model, sel }) => (
            <Baris key={model} model={model} sel={sel} kartu={kartu} />
          ))}
        </div>

        {/* daftar di HP */}
        <div className="space-y-3 md:hidden">
          {BARIS.map(({ model, sel }) => (
            <div key={model}>
              <p className="mb-1.5 text-xs">
                <b className="font-semibold">{KELUARGA[model].nama}</b>
                <span className="text-ink-3">, {KELUARGA[model].jenis}</span>
              </p>
              <div className="grid grid-cols-3 gap-2">
                {sel.filter((m): m is ModeId => m !== null).map((m) => (
                  <div key={m} className="h-full">{kartu(m)}</div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <button onClick={() => setInfo(!info)} aria-expanded={info} className="mt-2 flex items-center gap-1 text-xs font-medium text-ink-2 hover:text-ink">
        <ChevronDown className={cn('size-3.5 transition-transform', info && 'rotate-180')} aria-hidden />
        Apa itu foto contoh, nilai, dan kedua model ini?
      </button>
      {info && (
        <div className="mt-2 grid gap-x-6 gap-y-1.5 rounded-xl bg-row p-3 text-xs leading-relaxed text-ink-2 md:grid-cols-2">
          <p>
            <b className="font-semibold text-ink">Foto contoh</b> adalah foto yang setiap helm, rompi, dan benda lainnya
            sudah ditandai kotak satu per satu oleh manusia. Membuatnya lama dan mahal, jadi makin sedikit makin hemat.
          </p>
          <p>
            <b className="font-semibold text-ink">Nilai</b> adalah skor ketepatan detektor saat diuji pada 1.620 foto lain
            yang belum pernah dilihatnya, dari 0 sampai 100 (mAP50, rata-rata 5 ulangan untuk 39 dan 109 foto).
          </p>
          <p>
            <b className="font-semibold text-ink">YOLOE-26s</b> adalah detektor open-vocabulary: sudah bisa mencari benda dari
            namanya. Dengan foto contoh, hanya lapisan terakhirnya yang diajari (linear probing).
          </p>
          <p>
            <b className="font-semibold text-ink">YOLO26s</b> adalah detektor biasa: belum tahu apa-apa sebelum dilatih, jadi
            seluruh lapisannya dilatih dengan foto contoh.
          </p>
        </div>
      )}
    </div>
  )
}

function Baris({ model, sel, kartu }: { model: "YOLOE-26s" | "YOLO26s"; sel: (ModeId | null)[]; kartu: (m: ModeId) => React.ReactElement }) {
  return (
    <>
      <div className="flex flex-col justify-center pr-1">
        <p className="text-sm font-semibold">{KELUARGA[model].nama}</p>
        <p className="text-xs leading-snug text-ink-3">
          {KELUARGA[model].jenis}, {KELUARGA[model].isi}
        </p>
      </div>
      {sel.map((m, j) =>
        m ? (
          <div key={m} className="h-full">{kartu(m)}</div>
        ) : (
          <div key={j} className="grid place-items-center rounded-xl border-2 border-dashed border-line px-3 py-2 text-center text-[11px] leading-snug text-ink-3">
            {ALASAN_KOSONG[`${model}-${j}`]}
          </div>
        ),
      )}
    </>
  )
}
