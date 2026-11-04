import { useEffect, useRef, useState } from 'react'

import type { HasilMode, Orang, Status } from '@/lib/api'
import { kelompokDari, namaTampil, TEKS_DI_ATAS, WARNA_KELOMPOK } from '@/lib/kelas'
import { cn } from '@/lib/utils'

// Foto dengan kotak deteksi di atasnya. Dipakai untuk tampilan besar dan tampilan berdampingan.

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
  sorot?: string | null // kelas yang disorot dari daftar di samping
  sorotOrang?: number | null // pekerja yang disorot di tab kepatuhan
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

export function labelOrang(o: Orang, i: number) {
  if (o.status === 'patuh') return `${i + 1} Patuh`
  if (o.status === 'tidak diketahui') return `${i + 1} ?`
  const r = []
  if (o.helm === 'tidak') r.push('tanpa helm')
  if (o.sarung_tangan === 'tidak') r.push('tangan')
  return `${i + 1} ${r.join(', ')}`
}

type Pos = { x: number; y: number; w: number; teks: string }

// Label diletakkan dari yang paling penting; label yang akan menimpa label lain dilewati, supaya foto
// yang ramai tidak tertutup tulisan. Nama objek yang labelnya dilewati tetap ada di daftar samping.
function tempatkan(kandidat: { i: number; box: number[]; teks: string; prioritas: number }[], fs: number, s: number, lebar: number) {
  const pos = new Map<number, Pos>()
  const h = fs * 1.5
  const terpakai: number[][] = []
  for (const k of [...kandidat].sort((a, b) => b.prioritas - a.prioritas)) {
    const w = k.teks.length * fs * 0.56 + 8 * s
    const x = Math.max(0, Math.min(k.box[0], lebar - w))
    const y = k.box[1] - h >= 0 ? k.box[1] - h : k.box[1]
    const r = [x, y, x + w, y + h]
    if (terpakai.some((q) => r[0] < q[2] && r[2] > q[0] && r[1] < q[3] && r[3] > q[1])) continue
    terpakai.push(r)
    pos.set(k.i, { x, y, w, teks: k.teks })
  }
  return pos
}

const Kotak = ({ b, ...p }: { b: number[] } & React.SVGProps<SVGRectElement>) => (
  <rect x={b[0]} y={b[1]} width={b[2] - b[0]} height={b[3] - b[1]} fill="none" {...p} />
)

export function PhotoOverlay({ gambar, hasil, tampilan, kelompok, sorot = null, sorotOrang = null, memuat, kecil, className, style }: Props) {
  const wrap = useRef<HTMLDivElement>(null)
  const [lebarTampil, setLebarTampil] = useState(1)
  useEffect(() => {
    if (!wrap.current) return
    const ro = new ResizeObserver(([e]) => setLebarTampil(e.contentRect.width || 1))
    ro.observe(wrap.current)
    return () => ro.disconnect()
  }, [])

  const s = gambar.lebar / lebarTampil // satu piksel layar dalam satuan piksel gambar
  const fs = (kecil ? 10 : 12) * s
  const kp = hasil?.kepatuhan
  const det = hasil?.deteksi ?? []

  const fokus = (kelas: string) => {
    if (tampilan === 'baru') return kelompokDari(kelas, kelompok) === 'Kelas baru'
    if (sorot) return kelas === sorot
    return true
  }

  const labelDet =
    tampilan !== 'kepatuhan'
      ? tempatkan(
          det.flatMap((d, i) => (fokus(d.kelas) ? [{ i, box: d.box, teks: `${namaTampil(d.kelas)} ${Math.round(d.skor * 100)}%`, prioritas: d.skor }] : [])),
          fs,
          s,
          gambar.lebar,
        )
      : new Map<number, Pos>()
  const prioritas: Record<Status, number> = { 'tidak patuh': 3, patuh: 2, 'tidak diketahui': 1 }
  const labelOrg =
    tampilan === 'kepatuhan' && kp
      ? tempatkan(
          kp.orang.map((o, i) => ({ i, box: o.box, teks: labelOrang(o, i), prioritas: (sorotOrang === i ? 10 : 0) + prioritas[o.status] })),
          fs,
          s,
          gambar.lebar,
        )
      : new Map<number, Pos>()

  return (
    <div
      ref={wrap}
      className={cn('relative overflow-hidden rounded-md bg-plate', className)}
      style={{ aspectRatio: `${gambar.lebar}/${gambar.tinggi}`, ...style }}
    >
      <img src={gambar.url} alt="" className="absolute inset-0 h-full w-full object-contain" draggable={false} />
      {hasil && (
        <svg
          viewBox={`0 0 ${gambar.lebar} ${gambar.tinggi}`}
          className={cn('absolute inset-0 h-full w-full transition-opacity duration-150', memuat && 'opacity-30')}
          aria-hidden
        >
          {tampilan !== 'kepatuhan' &&
            det.map((d, i) => {
              const g = kelompokDari(d.kelas, kelompok)
              const on = fokus(d.kelas)
              const lab = labelDet.get(i)
              return (
                <g key={i} opacity={on ? 1 : 0.15}>
                  <title>{`${namaTampil(d.kelas)}, yakin ${Math.round(d.skor * 100)}%`}</title>
                  <Kotak b={d.box} stroke={WARNA_KELOMPOK[g]} strokeWidth={(on && (sorot || tampilan === 'baru') ? 3 : 2) * s} strokeDasharray={g === 'Kelas baru' ? `${6 * s} ${3 * s}` : undefined} />
                  {lab && (
                    <>
                      <rect x={lab.x} y={lab.y} width={lab.w} height={fs * 1.5} rx={2 * s} fill={WARNA_KELOMPOK[g]} />
                      <text x={lab.x + 4 * s} y={lab.y + fs * 1.1} fontSize={fs} fill={TEKS_DI_ATAS[g]} fontWeight={500}>
                        {lab.teks}
                      </text>
                    </>
                  )}
                </g>
              )
            })}

          {tampilan === 'kepatuhan' &&
            kp?.orang.map((o, i) => {
              const warna = WARNA_STATUS[o.status]
              const redup = sorotOrang !== null && sorotOrang !== i
              const lab = labelOrg.get(i)
              return (
                <g key={i} opacity={redup ? 0.2 : 1}>
                  <Kotak b={o.box} stroke={warna} strokeWidth={3 * s} />
                  {o.kepala.filter((k) => k.tanpa_helm).map((k, j) => (
                    <Kotak key={`k${j}`} b={k.box} stroke="var(--bad)" strokeWidth={2 * s} strokeDasharray={`${4 * s} ${3 * s}`} />
                  ))}
                  {o.tangan.filter((t) => t.tanpa_sarung_tangan).map((t, j) => (
                    <Kotak key={`t${j}`} b={t.box} stroke="var(--bad)" strokeWidth={2 * s} strokeDasharray={`${4 * s} ${3 * s}`} />
                  ))}
                  {lab && (
                    <>
                      <rect x={lab.x} y={lab.y} width={lab.w} height={fs * 1.5} rx={2 * s} fill={warna} />
                      <text x={lab.x + 4 * s} y={lab.y + fs * 1.1} fontSize={fs} fill="#fff" fontWeight={500}>
                        {lab.teks}
                      </text>
                    </>
                  )}
                </g>
              )
            })}
          {tampilan === 'kepatuhan' &&
            kp?.lepas.kepala.filter((k) => k.tanpa_helm).map((k, j) => (
              <Kotak key={`lk${j}`} b={k.box} stroke="var(--bad)" strokeWidth={2 * s} strokeDasharray={`${4 * s} ${3 * s}`} />
            ))}
        </svg>
      )}
    </div>
  )
}
