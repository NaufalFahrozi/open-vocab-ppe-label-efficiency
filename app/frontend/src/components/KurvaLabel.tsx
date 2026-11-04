import { useEffect, useRef, useState } from 'react'
import { area, curveMonotoneX, line } from 'd3-shape'

import { MODE_ORDER, type ModeId } from '@/lib/api'
import { fmtID, KURVA_YOLO26, KURVA_YOLOE_LP, POSISI_MODE, symlog, type Titik } from '@/lib/kurva'
import { MODE_AWAM } from '@/lib/mode'
import { cn } from '@/lib/utils'

// Kurva kebutuhan label: mAP50 terhadap jumlah foto berlabel (skala log). Satu warna utama untuk
// model open-vocabulary (yang dibahas skripsi), abu tua untuk pembanding. Zona di antara kedua kurva
// diarsir selama open-vocabulary unggul. Titik setara ditandai sebagai PITA 109 sampai 338 foto, bukan
// satu titik, karena eksperimen hanya mengukur k = 30 dan k = 100.

const OWL = 55.4
const XS = [0, 6, 20, 39, 109, 338, 4986] // posisi yang benar-benar diukur
const K_DARI_X: Record<number, string> = { 0: 'zero-shot', 6: 'k = 1', 20: 'k = 5', 39: 'k = 10', 109: 'k = 30', 338: 'k = 100', 4986: 'data penuh' }

const nilaiDi = (kurva: Titik[], x: number) => kurva.find((p) => p.gambar === x)?.map50

// Interpolasi linear di ruang symlog, hanya untuk mengisi arsiran di antara titik terukur.
function interp(kurva: Titik[], x: number) {
  const lx = symlog(x)
  for (let i = 0; i < kurva.length - 1; i++) {
    const a = kurva[i]
    const b = kurva[i + 1]
    if (x >= a.gambar && x <= b.gambar) {
      const t = (lx - symlog(a.gambar)) / (symlog(b.gambar) - symlog(a.gambar) || 1)
      return a.map50 + t * (b.map50 - a.map50)
    }
  }
  return undefined
}

interface Props {
  aktif: ModeId
  onPilih: (m: ModeId) => void
}

export function KurvaLabel({ aktif, onPilih }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [w, setW] = useState(0)
  const [hover, setHover] = useState<number | null>(null)
  useEffect(() => {
    if (!ref.current) return
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width))
    ro.observe(ref.current)
    return () => ro.disconnect()
  }, [])

  const sempit = w < 560
  const H = sempit ? 280 : 360
  const M = { l: 40, r: sempit ? 12 : 24, t: 28, b: 44 }
  const sx = (n: number) => M.l + (symlog(n) / symlog(4986)) * (w - M.l - M.r)
  const sy = (v: number) => M.t + (1 - v / 70) * (H - M.t - M.b)
  const garis = line<Titik>()
    .x((d) => sx(d.gambar))
    .y((d) => sy(d.map50))
    .curve(curveMonotoneX)

  // arsiran "zona hemat label": dari k = 1 sampai k = 30, saat YOLOE masih di atas YOLO26
  const sampel = Array.from({ length: 40 }, (_, i) => 6 * Math.pow(109 / 6, i / 39))
  const zona = area<number>()
    .x((x) => sx(x))
    .y0((x) => sy(interp(KURVA_YOLO26, x) ?? 0))
    .y1((x) => sy(interp(KURVA_YOLOE_LP, x) ?? 0))
    .curve(curveMonotoneX)(sampel)

  const dekat = (px: number) => XS.reduce((a, b) => (Math.abs(sx(b) - px) < Math.abs(sx(a) - px) ? b : a))

  return (
    <div ref={ref} className="relative">
      {w > 0 && (
        <svg width={w} height={H} role="img" aria-labelledby="kurva-judul kurva-isi" className="block overflow-visible">
          <title id="kurva-judul">Kurva mAP50 terhadap jumlah foto berlabel</title>
          <desc id="kurva-isi">
            YOLOE-26s dengan linear probing mulai dari 38,4 tanpa label dan naik pelan sampai 45,2 pada 338 foto. YOLO26s mulai
            dari 15,4 pada 6 foto, menyusul di antara 109 dan 338 foto, dan mencapai 61,0 dengan 4.986 foto.
          </desc>

          {/* pita titik setara */}
          <rect x={sx(109)} y={M.t} width={sx(338) - sx(109)} height={H - M.t - M.b} fill="var(--row)" />
          <text x={(sx(109) + sx(338)) / 2} y={M.t - 10} textAnchor="middle" fontSize={11} fontWeight={600} fill="var(--ink-2)">
            titik setara
          </text>

          {/* grid */}
          {[20, 40, 60].map((v) => (
            <g key={v}>
              <line x1={M.l} x2={w - M.r} y1={sy(v)} y2={sy(v)} stroke="var(--line)" />
              <text x={M.l - 10} y={sy(v)} dy="0.32em" textAnchor="end" fontSize={11} fill="var(--ink-3)">
                {v}
              </text>
            </g>
          ))}
          <line x1={M.l} x2={w - M.r} y1={sy(0)} y2={sy(0)} stroke="var(--ink-3)" />
          {[0, 10, 100, 1000, 4986].map((t) => (
            <text key={t} x={sx(t)} y={sy(0) + 18} textAnchor={t === 4986 ? 'end' : t === 0 ? 'start' : 'middle'} fontSize={11} fill="var(--ink-2)">
              {t.toLocaleString('id-ID')}
            </text>
          ))}
          <text x={M.l} y={H - 4} fontSize={11} fill="var(--ink-3)">
            foto berlabel, skala log
          </text>
          <text x={M.l - 10} y={M.t - 10} textAnchor="end" fontSize={11} fill="var(--ink-3)">
            mAP50
          </text>

          {/* zona hemat label */}
          <path d={zona ?? ''} fill="var(--grp-apd)" opacity={0.12} />
          {!sempit && (
            <text x={sx(14)} y={sy(31)} fontSize={12} fontWeight={600} fill="var(--grp-apd)">
              zona hemat label
            </text>
          )}

          {/* acuan zero-shot terbaik */}
          <line x1={M.l} x2={w - M.r} y1={sy(OWL)} y2={sy(OWL)} stroke="var(--ink-3)" strokeDasharray="4 4" />
          <text x={sx(6)} y={sy(OWL) - 7} fontSize={11} fill="var(--ink-2)">
            {sempit ? 'OWLv2-L zero-shot 55,4' : 'OWLv2-L zero-shot 55,4, akurat tapi hanya 0,6 foto per detik'}
          </text>

          {/* kurva */}
          <path d={garis(KURVA_YOLO26) ?? ''} fill="none" stroke="var(--ink-2)" strokeWidth={2.5} strokeLinecap="round" />
          <path d={garis(KURVA_YOLOE_LP) ?? ''} fill="none" stroke="var(--grp-apd)" strokeWidth={3} strokeLinecap="round" />
          {KURVA_YOLO26.map((p) => (
            <circle key={'y' + p.gambar} cx={sx(p.gambar)} cy={sy(p.map50)} r={3.5} fill="var(--ink-2)" stroke="var(--surface)" strokeWidth={2} />
          ))}
          {KURVA_YOLOE_LP.map((p) => (
            <circle key={'e' + p.gambar} cx={sx(p.gambar)} cy={sy(p.map50)} r={3.5} fill="var(--grp-apd)" stroke="var(--surface)" strokeWidth={2} />
          ))}
          <text x={sx(338) + 10} y={sy(45.2) + 4} fontSize={12} fontWeight={600} fill="var(--grp-apd)" display={sempit ? 'none' : undefined}>
            YOLOE-26s
          </text>
          <text x={sx(4986) - 12} y={sy(61) + 22} textAnchor="end" fontSize={12} fontWeight={600} fill="var(--ink-2)">
            YOLO26s
          </text>

          {/* crosshair */}
          {hover !== null && (
            <line x1={sx(hover)} x2={sx(hover)} y1={M.t} y2={sy(0)} stroke="var(--ink)" strokeWidth={1} strokeDasharray="2 3" />
          )}

          {/* empat model yang bisa dicoba: bisa diklik */}
          {MODE_ORDER.map((m) => {
            const p = POSISI_MODE[m]
            const on = m === aktif
            const warna = p.kurva === 'yoloe' ? 'var(--grp-apd)' : 'var(--ink-2)'
            return (
              <g key={m} className="cursor-pointer" onClick={() => onPilih(m)} role="button" aria-label={`Pilih model ${MODE_AWAM[m].judul}`}>
                <circle cx={sx(p.gambar)} cy={sy(p.map50)} r={16} fill="transparent" />
                <circle cx={sx(p.gambar)} cy={sy(p.map50)} r={on ? 8 : 6.5} fill={on ? warna : 'var(--surface)'} stroke={warna} strokeWidth={3} />
                {on && (
                  <text x={sx(p.gambar) + (m === 'full' ? -14 : m === 'zs' ? 4 : 0)} y={sy(p.map50) - 15} textAnchor={m === 'full' ? 'end' : m === 'zs' ? 'start' : 'middle'} fontSize={13} fontWeight={700} fill="var(--ink)">
                    {fmtID(p.map50)}
                  </text>
                )}
              </g>
            )
          })}

          {/* area penangkap kursor */}
          <rect
            x={M.l}
            y={M.t}
            width={w - M.l - M.r}
            height={H - M.t - M.b}
            fill="transparent"
            style={{ pointerEvents: 'all' }}
            onPointerMove={(e) => {
              const r = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect()
              setHover(dekat(e.clientX - r.left))
            }}
            onPointerLeave={() => setHover(null)}
            onClick={() => {
              const m = MODE_ORDER.find((x) => POSISI_MODE[x].gambar === hover)
              if (m) onPilih(m)
            }}
          />
        </svg>
      )}

      {hover !== null && (
        <div
          className={cn('pointer-events-none absolute top-6 z-10 w-48 rounded-xl bg-ink px-3 py-2.5 text-xs text-white shadow-lg', sx(hover) > w * 0.6 ? '-translate-x-[calc(100%+12px)]' : 'translate-x-3')}
          style={{ left: sx(hover) }}
        >
          <p className="font-semibold">
            {hover.toLocaleString('id-ID')} foto berlabel <span className="font-normal text-white/60">({K_DARI_X[hover]})</span>
          </p>
          <p className="mt-1.5 flex justify-between">
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-apd" /> YOLOE-26s
            </span>
            <b>{nilaiDi(KURVA_YOLOE_LP, hover) !== undefined ? fmtID(nilaiDi(KURVA_YOLOE_LP, hover)!) : '–'}</b>
          </p>
          <p className="mt-0.5 flex justify-between">
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-white/60" /> YOLO26s
            </span>
            <b>{nilaiDi(KURVA_YOLO26, hover) !== undefined ? fmtID(nilaiDi(KURVA_YOLO26, hover)!) : '–'}</b>
          </p>
        </div>
      )}
    </div>
  )
}
