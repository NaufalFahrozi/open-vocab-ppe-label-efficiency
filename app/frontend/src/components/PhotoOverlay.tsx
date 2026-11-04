import { useEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'

import type { HasilMode, Orang, Status } from '@/lib/api'
import { kelompokDari, namaTampil, TEKS_DI_ATAS, WARNA_KELOMPOK } from '@/lib/kelas'
import { cn } from '@/lib/utils'

// Foto dengan kotak deteksi dan label nama benda.

export type Tampilan = 'deteksi' | 'kepatuhan' | 'baru'

export interface Gambar {
  blob: Blob
  url: string
  lebar: number
  tinggi: number
  nama: string
}

interface Props {
  gambar: Gambar
  hasil?: HasilMode
  tampilan: Tampilan
  kelompok: Record<string, string[]>
  animKey: string // berubah = kotak dipudarkan masuk lagi
  sorot?: string | null
  sorotOrang?: number | null
  memuat?: boolean
  kecil?: boolean
  className?: string
  style?: React.CSSProperties
}

export const WARNA_STATUS: Record<Status, string> = {
  patuh: 'var(--ok)',
  'tidak patuh': 'var(--bad)',
  'tidak diketahui': 'var(--unknown)',
}


type Pos = { x: number; y: number; w: number; teks: string }

// Label diletakkan dari yang paling penting; label yang akan menimpa label lain dilewati, supaya foto
// yang ramai tidak tertutup tulisan. Nama objek yang labelnya dilewati tetap ada di panel samping.
function tempatkan(kandidat: { i: number; box: number[]; teks: string; prioritas: number }[], fs: number, s: number, lebar: number) {
  const pos = new Map<number, Pos>()
  const h = fs * 1.6
  const terpakai: number[][] = []
  for (const k of [...kandidat].sort((a, b) => b.prioritas - a.prioritas)) {
    const w = k.teks.length * fs * 0.58 + 10 * s
    const x = Math.max(0, Math.min(k.box[0], lebar - w))
    const y = k.box[1] - h - 2 * s >= 0 ? k.box[1] - h - 2 * s : k.box[1] + 2 * s
    const r = [x, y, x + w, y + h]
    if (terpakai.some((q) => r[0] < q[2] && r[2] > q[0] && r[1] < q[3] && r[3] > q[1])) continue
    terpakai.push(r)
    pos.set(k.i, { x, y, w, teks: k.teks })
  }
  return pos
}

function labelOrang(o: Orang) {
  if (o.status === 'patuh') return 'Patuh'
  if (o.status === 'tidak diketahui') return 'Belum bisa dinilai'
  return [o.helm === 'tidak' && 'Tanpa helm', o.sarung_tangan === 'tidak' && 'Tangan telanjang'].filter(Boolean).join(', ')
}

const Kotak = ({ b, ...p }: { b: number[] } & React.SVGProps<SVGRectElement>) => (
  <rect x={b[0]} y={b[1]} width={b[2] - b[0]} height={b[3] - b[1]} fill="none" {...p} />
)

export function PhotoOverlay(p: Props) {
  const { gambar, hasil, tampilan, kelompok, animKey, sorot = null, sorotOrang = null, memuat, kecil, className, style } = p
  const wrap = useRef<HTMLDivElement>(null)
  const [lebarTampil, setLebarTampil] = useState(1)
  useEffect(() => {
    if (!wrap.current) return
    const ro = new ResizeObserver(([e]) => setLebarTampil(e.contentRect.width || 1))
    ro.observe(wrap.current)
    return () => ro.disconnect()
  }, [])

  const s = gambar.lebar / lebarTampil // satu piksel layar dalam satuan piksel gambar
  const fs = (kecil ? 10 : 12.5) * s
  const det = hasil?.deteksi ?? []
  const kp = hasil?.kepatuhan

  const fokus = (kelas: string) => {
    if (tampilan === 'baru') return kelompokDari(kelas, kelompok) === 'Kelas baru'
    return sorot ? kelas === sorot : true
  }

  const labelDet =
    tampilan !== 'kepatuhan'
      ? tempatkan(
          det.flatMap((d, i) => (fokus(d.kelas) ? [{ i, box: d.box, teks: `${namaTampil(d.kelas)} ${Math.round(d.skor * 100)}`, prioritas: d.skor }] : [])),
          fs,
          s,
          gambar.lebar,
        )
      : new Map<number, Pos>()

  return (
    <div ref={wrap} className={cn('relative overflow-hidden', className)} style={{ aspectRatio: `${gambar.lebar}/${gambar.tinggi}`, ...style }}>
      <img src={gambar.url} alt="" className="absolute inset-0 h-full w-full object-contain select-none" draggable={false} />
      {hasil && (
        <svg
          key={animKey}
          viewBox={`0 0 ${gambar.lebar} ${gambar.tinggi}`}
          className={cn('absolute inset-0 h-full w-full transition-opacity duration-200', memuat && 'opacity-30')}
          aria-hidden
        >
          {tampilan !== 'kepatuhan' &&
            det.map((d, i) => {
              const g = kelompokDari(d.kelas, kelompok)
              const on = fokus(d.kelas)
              const lab = labelDet.get(i)
              const tebal = on && (sorot || tampilan === 'baru') ? 3.5 : 2.25
              return (
                <motion.g
                  key={i}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: on ? 1 : 0.16 }}
                  transition={{ duration: 0.2 }}
                >
                  <title>{`${namaTampil(d.kelas)}, yakin ${Math.round(d.skor * 100)}%`}</title>
                  <Kotak b={d.box} stroke={WARNA_KELOMPOK[g]} strokeWidth={tebal * s} rx={3 * s} strokeDasharray={g === 'Kelas baru' ? `${7 * s} ${4 * s}` : undefined} />
                  {lab && (
                    <>
                      <rect x={lab.x} y={lab.y} width={lab.w} height={fs * 1.6} rx={4 * s} fill={WARNA_KELOMPOK[g]} />
                      <text x={lab.x + 5 * s} y={lab.y + fs * 1.15} fontSize={fs} fill={TEKS_DI_ATAS[g]} fontWeight={600} fontFamily="Plus Jakarta Sans Variable">
                        {lab.teks}
                      </text>
                    </>
                  )}
                </motion.g>
              )
            })}

          {tampilan === 'kepatuhan' &&
            kp?.orang.map((o, i) => {
              const warna = WARNA_STATUS[o.status]
              const redup = sorotOrang !== null && sorotOrang !== i
              const r = 11 * s
              const cx = o.box[0] + r + 4 * s
              const cy = o.box[1] + r + 4 * s
              const teks = labelOrang(o)
              const tw = teks.length * fs * 0.58 + 10 * s
              return (
                <motion.g key={i} initial={{ opacity: 0 }} animate={{ opacity: redup ? 0.2 : 1 }} transition={{ duration: 0.2 }}>
                  <Kotak b={o.box} stroke={warna} strokeWidth={3 * s} rx={4 * s} />
                  {o.kepala.filter((k) => k.tanpa_helm).map((k, j) => (
                    <Kotak key={`k${j}`} b={k.box} stroke="var(--bad)" strokeWidth={2.5 * s} strokeDasharray={`${5 * s} ${3 * s}`} rx={3 * s} />
                  ))}
                  {o.tangan.filter((t) => t.tanpa_sarung_tangan).map((t, j) => (
                    <Kotak key={`t${j}`} b={t.box} stroke="var(--bad)" strokeWidth={2.5 * s} strokeDasharray={`${5 * s} ${3 * s}`} rx={3 * s} />
                  ))}
                  {/* lencana nomor pekerja, sama dengan nomor di panel samping */}
                  <circle cx={cx} cy={cy} r={r} fill={warna} />
                  <text x={cx} y={cy} dy="0.35em" textAnchor="middle" fontSize={fs} fill="#fff" fontWeight={700} fontFamily="Plus Jakarta Sans Variable">
                    {i + 1}
                  </text>
                  {!kecil && sorotOrang === i && (
                    <>
                      <rect x={cx + r + 3 * s} y={cy - fs * 0.8} width={tw} height={fs * 1.6} rx={4 * s} fill={warna} />
                      <text x={cx + r + 8 * s} y={cy} dy="0.35em" fontSize={fs} fill="#fff" fontWeight={600} fontFamily="Plus Jakarta Sans Variable">
                        {teks}
                      </text>
                    </>
                  )}
                </motion.g>
              )
            })}
          {tampilan === 'kepatuhan' &&
            kp?.lepas.kepala.filter((k) => k.tanpa_helm).map((k, j) => (
              <Kotak key={`lk${j}`} b={k.box} stroke="var(--bad)" strokeWidth={2.5 * s} strokeDasharray={`${5 * s} ${3 * s}`} rx={3 * s} />
            ))}
        </svg>
      )}

    </div>
  )
}
