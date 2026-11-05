import { useEffect, useRef, useState } from 'react'

import type { DetectResponse, ModeId } from '@/lib/api'
import { MODE_AWAM } from '@/lib/mode'
import { cn } from '@/lib/utils'
import { PhotoOverlay, type Gambar, type Tampilan } from './PhotoOverlay'

// Foto dengan kotak deteksi, diperbesar sebesar mungkin di ruang yang tersedia tanpa terpotong.

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
  mode: ModeId // detektor yang ditampilkan (bisa pratinjau dari kursor)
  pratinjau: boolean
  memuat: boolean
  sorot: string | null
  sorotOrang: number | null
  ekstra: string[]
  isi: boolean // true di layar lebar: mengisi tinggi yang tersedia; false di HP: tinggi mengikuti foto
}

export function Stage(p: Props) {
  const [area, ukuran] = useUkuran<HTMLDivElement>()
  const rasio = p.gambar ? p.gambar.lebar / p.gambar.tinggi : 4 / 3
  const lebarFoto = Math.max(0, Math.min(ukuran.w, ukuran.h * rasio))

  return (
    <div
      ref={area}
      className={cn('relative grid place-items-center rounded-xl bg-plate', p.isi ? 'min-h-[240px] flex-1' : 'w-full')}
      style={p.isi ? undefined : { aspectRatio: `${rasio}` }}
    >
      {!p.gambar ? (
        <p className="text-sm text-ink-3">Memuat foto…</p>
      ) : (
        <div className="relative" style={{ width: lebarFoto }}>
          <PhotoOverlay
            gambar={p.gambar}
            hasil={p.hasil?.hasil[p.mode]}
            tampilan={p.tab}
            kelompok={p.kelompok}
            animKey={`${p.gambar.nama}-${p.tab}-${p.mode}-${p.hasil?.conf}`}
            sorot={p.sorot}
            sorotOrang={p.sorotOrang}
            ekstra={p.ekstra}
            memuat={p.memuat}
          />
          {/* keterangan detektor yang sedang tampil, supaya jelas hasil siapa yang dilihat */}
          <span className={cn('absolute top-2 left-2 rounded-lg px-2.5 py-1 text-xs font-semibold shadow-sm', p.pratinjau ? 'bg-ink text-white' : 'bg-brand text-ink')}>
            {p.pratinjau ? 'Pratinjau: ' : ''}
            {MODE_AWAM[p.mode].model}, {MODE_AWAM[p.mode].judul.toLowerCase()}
          </span>
        </div>
      )}
    </div>
  )
}
