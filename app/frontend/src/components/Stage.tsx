import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Columns2, Pause, Play } from 'lucide-react'

import { MODE_ORDER, type DetectResponse, type ModeId } from '@/lib/api'
import { fmtID, POSISI_MODE } from '@/lib/kurva'
import { MODE_AWAM } from '@/lib/mode'
import { cn } from '@/lib/utils'
import { PhotoOverlay, type Gambar, type Tampilan } from './PhotoOverlay'

// Panggung gelap seperti monitor CCTV: foto di tengah, penggeser jumlah foto berlabel di bawahnya.

function useUkuran<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [u, setU] = useState({ w: 0, h: 0 })
  useEffect(() => {
    if (!ref.current) return
    const ro = new ResizeObserver(([e]) => setU({ w: e.contentRect.width, h: e.contentRect.height }))
    ro.observe(ref.current)
    return () => ro.disconnect()
  }, [])
  return [ref, u] as const
}

interface Props {
  gambar: Gambar | null
  hasil: DetectResponse | null
  kelompok: Record<string, string[]>
  tab: Tampilan
  mode: ModeId
  onMode: (m: ModeId) => void
  terkunci: ModeId[]
  memuat: boolean
  sorot: string | null
  sorotOrang: number | null
  banding: boolean
  onBanding: (v: boolean) => void
  putar: boolean
  onPutar: (v: boolean) => void
  isi: boolean // true di layar lebar: panggung mengisi tinggi layar; false di HP: tinggi mengikuti foto
}

export function Stage(p: Props) {
  const [area, ukuran] = useUkuran<HTMLDivElement>()
  const [garis, setGaris] = useState(50) // posisi pembatas pembanding, persen dari kiri
  const seret = useRef(false)

  // Foto diperbesar sebesar mungkin di dalam area tanpa terpotong.
  const rasio = p.gambar ? p.gambar.lebar / p.gambar.tinggi : 4 / 3
  const BINGKAI = 16 // ruang untuk sudut kuning di sekeliling foto
  const lebarFoto = Math.max(0, Math.min(ukuran.w - BINGKAI, (ukuran.h - BINGKAI) * rasio))
  const kiri: ModeId = 'zs'
  const kanan: ModeId = p.mode === 'zs' ? 'full' : p.mode
  const animKey = `${p.gambar?.nama}-${p.tab}-${p.banding ? 'b' : p.mode}-${p.hasil?.conf}`

  const geserGaris = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    setGaris(Math.min(96, Math.max(4, ((e.clientX - r.left) / r.width) * 100)))
  }

  return (
    <section aria-label="Foto dan hasil deteksi" className="relative flex h-full min-h-0 flex-col rounded-2xl bg-stage p-3 text-on-stage sm:p-4">
      {/* kepala panggung: di layar lebar melayang di sudut atas, supaya tinggi panggung dipakai foto */}
      <div className={cn('flex items-start justify-between gap-3 px-1 pb-3', p.isi && 'pointer-events-none absolute inset-x-4 top-4 z-10 [&_button]:pointer-events-auto')}>
        <div className="min-w-0">
          <p className="text-xs text-on-stage-2">{p.banding ? 'Bandingkan dua model' : 'Model ini dilatih dengan'}</p>
          <AnimatePresence mode="wait" initial={false}>
            <motion.h2
              key={p.banding ? 'banding' : p.mode}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18 }}
              className="font-display truncate text-xl leading-tight font-semibold text-white sm:text-2xl"
            >
              {p.banding ? `0 vs ${MODE_AWAM[kanan].angka} foto berlabel` : MODE_AWAM[p.mode].judul}
            </motion.h2>
          </AnimatePresence>
        </div>
        <div className="flex shrink-0 gap-1.5">
          <button
            onClick={() => p.onPutar(!p.putar)}
            disabled={p.terkunci.length > 0 || p.banding}
            className="flex h-9 items-center gap-1.5 rounded-lg bg-stage-2 px-3 text-sm font-medium text-on-stage transition-colors hover:bg-stage-line disabled:opacity-40"
            aria-pressed={p.putar}
          >
            {p.putar ? <Pause className="size-4" aria-hidden /> : <Play className="size-4" aria-hidden />}
            <span className="hidden sm:inline">{p.putar ? 'Jeda' : 'Putar'}</span>
          </button>
          <button
            onClick={() => p.onBanding(!p.banding)}
            disabled={p.terkunci.length > 0}
            className={cn(
              'flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium transition-colors disabled:opacity-40',
              p.banding ? 'bg-hivis text-stage' : 'bg-stage-2 text-on-stage hover:bg-stage-line',
            )}
            aria-pressed={p.banding}
          >
            <Columns2 className="size-4" aria-hidden />
            <span className="hidden sm:inline">Bandingkan</span>
          </button>
        </div>
      </div>

      {/* foto */}
      <div
        ref={area}
        className={cn('relative grid place-items-center', p.isi ? 'min-h-[240px] flex-1' : 'w-full')}
        style={p.isi ? undefined : { aspectRatio: `${rasio}` }}
      >
        {!p.gambar ? (
          <p className="text-sm text-on-stage-2">Memuat foto…</p>
        ) : (
          <div className="sudut relative p-2" style={{ width: lebarFoto + BINGKAI }}>
            <div className="relative">
              <PhotoOverlay
                gambar={p.gambar}
                hasil={p.hasil?.hasil[p.banding ? kanan : p.mode]}
                tampilan={p.tab}
                kelompok={p.kelompok}
                animKey={animKey}
                sorot={p.sorot}
                sorotOrang={p.sorotOrang}
                memuat={p.memuat}
                className="rounded-md"
              />
              {p.banding && (
                <>
                  <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - garis}% 0 0)` }}>
                    <PhotoOverlay gambar={p.gambar} hasil={p.hasil?.hasil[kiri]} tampilan={p.tab} kelompok={p.kelompok} animKey={animKey + 'k'} sorot={p.sorot} className="rounded-md" />
                  </div>
                  <div
                    className="absolute inset-0 cursor-ew-resize touch-none"
                    onPointerDown={(e) => {
                      seret.current = true
                      e.currentTarget.setPointerCapture(e.pointerId)
                      geserGaris(e)
                    }}
                    onPointerMove={(e) => seret.current && geserGaris(e)}
                    onPointerUp={() => (seret.current = false)}
                    role="slider"
                    aria-label="Pembatas pembanding"
                    aria-valuenow={Math.round(garis)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'ArrowLeft') setGaris((g) => Math.max(4, g - 5))
                      if (e.key === 'ArrowRight') setGaris((g) => Math.min(96, g + 5))
                    }}
                  >
                    <div className="absolute inset-y-0 w-0.5 -translate-x-1/2 bg-hivis" style={{ left: `${garis}%` }}>
                      <div className="absolute top-1/2 left-1/2 grid size-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-hivis text-stage shadow-md">
                        <Columns2 className="size-4" aria-hidden />
                      </div>
                    </div>
                    <span className="absolute top-2 left-2 rounded-md bg-stage/85 px-2 py-1 text-xs font-medium">0 foto berlabel</span>
                    <span className="absolute top-2 right-2 rounded-md bg-stage/85 px-2 py-1 text-xs font-medium">{MODE_AWAM[kanan].angka} foto berlabel</span>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* penggeser */}
      <LabelSlider nilai={p.banding ? kanan : p.mode} onPilih={(m) => p.onMode(m)} terkunci={p.banding ? ['zs', ...p.terkunci] : p.terkunci} />
    </section>
  )
}

// ---------- penggeser jumlah foto berlabel ----------

interface SliderProps {
  nilai: ModeId
  onPilih: (m: ModeId) => void
  terkunci: ModeId[]
}

function LabelSlider({ nilai, onPilih, terkunci }: SliderProps) {
  const jalur = useRef<HTMLDivElement>(null)
  const tombol = useRef<(HTMLButtonElement | null)[]>([])
  const seret = useRef(false)
  const idx = MODE_ORDER.indexOf(nilai)

  // Titik terdekat dari posisi kursor, supaya penggeser bisa diseret, bukan hanya diklik.
  const dariKursor = (x: number) => {
    const r = jalur.current!.getBoundingClientRect()
    const i = Math.round(((x - r.left) / r.width) * 4 - 0.5)
    const m = MODE_ORDER[Math.min(3, Math.max(0, i))]
    if (!terkunci.includes(m) && m !== nilai) onPilih(m)
  }
  const geser = (arah: number) => {
    let i = idx
    do i += arah
    while (i >= 0 && i < 4 && terkunci.includes(MODE_ORDER[i]))
    if (i < 0 || i > 3) return
    onPilih(MODE_ORDER[i])
    tombol.current[i]?.focus()
  }

  return (
    <div className="mt-3 rounded-xl bg-stage-2 px-2 pt-3 pb-2">
      <p className="px-2 text-xs text-on-stage-2">Geser untuk menambah foto berlabel. Foto berlabel adalah foto yang tiap bendanya sudah ditandai kotak oleh manusia</p>
      <div
        ref={jalur}
        role="radiogroup"
        aria-label="Jumlah foto berlabel"
        className="relative mt-3 grid touch-none grid-cols-4 select-none"
        onPointerDown={(e) => {
          seret.current = true
          e.currentTarget.setPointerCapture(e.pointerId)
          dariKursor(e.clientX)
        }}
        onPointerMove={(e) => seret.current && dariKursor(e.clientX)}
        onPointerUp={() => (seret.current = false)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') (e.preventDefault(), geser(1))
          if (e.key === 'ArrowLeft') (e.preventDefault(), geser(-1))
        }}
      >
        <div className="absolute top-[9px] right-[12.5%] left-[12.5%] h-1 rounded-full bg-stage-line" aria-hidden />
        <motion.div
          className="absolute top-[9px] left-[12.5%] h-1 rounded-full bg-hivis"
          animate={{ width: `${(idx / 3) * 75}%` }}
          transition={{ type: 'spring', stiffness: 380, damping: 36 }}
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
              title={kunci ? 'Model ini hanya mengenal 17 jenis benda yang dilatihkan' : MODE_AWAM[m].teknis}
              tabIndex={on ? 0 : -1}
              onClick={() => !kunci && m !== nilai && onPilih(m)} // keyboard (Enter/Spasi) dan pembaca layar
              className={cn('relative flex flex-col items-center rounded-lg pb-1 outline-none focus-visible:ring-2 focus-visible:ring-hivis', kunci ? 'cursor-not-allowed opacity-35' : 'cursor-pointer')}
            >
              <span className={cn('relative z-10 size-[22px] rounded-full border-[3px]', on ? 'border-hivis bg-stage' : i < idx ? 'border-hivis bg-hivis' : 'border-stage-line bg-stage-2')} aria-hidden />
              <span className={cn('font-display mt-2 text-2xl leading-none font-semibold sm:text-[28px]', on ? 'text-white' : 'text-on-stage-2')}>{MODE_AWAM[m].angka}</span>
              <span className={cn('mt-1 hidden text-xs sm:block', on ? 'text-on-stage' : 'text-on-stage-2')}>{MODE_AWAM[m].pendek}</span>
              <span className="mt-0.5 text-[11px] text-on-stage-2">mAP50 {fmtID(POSISI_MODE[m].map50)}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
