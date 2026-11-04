import { useState } from 'react'

import type { ModeId } from '@/lib/api'
import { MODE_ORDER } from '@/lib/api'
import { fmtID, KURVA_YOLO26, KURVA_YOLOE_LP, POSISI_MODE, symlog, type Titik } from '@/lib/kurva'

// Penggaris jumlah label: kurva hasil eksperimen digambar di atas, lalu tiap mode demo
// dihubungkan ke panelnya di bawah. Lebar dan posisi kolom datang dari App supaya garis
// penghubung tepat mengenai tengah panel.

interface Props {
  width: number
  columns: number // jumlah kolom panel; penghubung hanya digambar kalau 4 kolom
  gap: number
  aktif: ModeId | null
  onHover: (m: ModeId | null) => void
}

const H_CHART = 150
const H_LINK = 46
const PAD = { l: 44, r: 20, t: 14, b: 30 }
const Y_MAX = 70
const OWL = 55.4 // OWLv2-L zero-shot, model zero-shot terbaik

export function LabelRuler({ width, columns, gap, aktif, onHover }: Props) {
  const [tip, setTip] = useState<{ x: number; y: number; teks: string } | null>(null)
  if (width < 200) return null

  const link = columns === 4
  const sempit = width < 640 // di HP: label dipendekkan, angka tengah disembunyikan supaya tidak bertumpuk
  const H = H_CHART + (link ? H_LINK : 0)
  const x0 = PAD.l
  const x1 = width - PAD.r
  const maxX = symlog(4986)
  const sx = (n: number) => x0 + (symlog(n) / maxX) * (x1 - x0)
  const sy = (v: number) => PAD.t + (1 - v / Y_MAX) * (H_CHART - PAD.t - PAD.b)
  const path = (pts: Titik[]) => pts.map((p, i) => `${i ? 'L' : 'M'}${sx(p.gambar).toFixed(1)},${sy(p.map50).toFixed(1)}`).join('')
  const colW = (width - gap * (columns - 1)) / columns
  const panelX = (i: number) => i * (colW + gap) + colW / 2

  const ticks = [0, 10, 100, 1000, 4986]
  const titikTip = (p: Titik, seri: string) =>
    `${seri}: ${p.k === 0 ? 'zero-shot' : p.k ? `k = ${p.k}` : 'data penuh'}, ±${p.gambar.toLocaleString('id-ID')} gambar, mAP50 ${fmtID(p.map50)}`

  return (
    <div className="relative" onMouseLeave={() => setTip(null)}>
      <svg width={width} height={H} role="img" aria-labelledby="ruler-title ruler-desc" className="block overflow-visible">
        <title id="ruler-title">Kurva mAP50 terhadap jumlah gambar berlabel</title>
        <desc id="ruler-desc">
          Linear probing YOLOE-26s mulai dari 38,4 tanpa label dan naik pelan sampai 45,2 pada ±338 gambar. YOLO26s
          mulai dari 15,4 dan menyusul di antara ±109 dan ±338 gambar, lalu mencapai 61,0 dengan data penuh.
        </desc>

        {/* grid horizontal yang samar */}
        {[20, 40, 60].map((v) => (
          <g key={v}>
            <line x1={x0} x2={x1} y1={sy(v)} y2={sy(v)} stroke="var(--rule)" strokeWidth={1} />
            <text x={x0 - 8} y={sy(v)} dy="0.32em" textAnchor="end" fontSize={11} fill="var(--ink-3)">
              {v}
            </text>
          </g>
        ))}
        <text x={x0 - 8} y={PAD.t - 2} textAnchor="end" fontSize={11} fill="var(--ink-2)">
          mAP50
        </text>

        {/* sumbu x: jumlah gambar berlabel */}
        <line x1={x0} x2={x1} y1={sy(0)} y2={sy(0)} stroke="var(--ink-3)" strokeWidth={1} />
        {ticks.map((t) => (
          <g key={t}>
            <line x1={sx(t)} x2={sx(t)} y1={sy(0)} y2={sy(0) + 4} stroke="var(--ink-3)" />
            <text x={sx(t)} y={sy(0) + 16} textAnchor={t === 4986 ? 'end' : 'middle'} fontSize={11} fill="var(--ink-2)">
              {t.toLocaleString('id-ID')}
            </text>
          </g>
        ))}
        <text
          display={sempit ? 'none' : undefined}
          x={(sx(100) + sx(1000)) / 2}
          y={sy(0) + 16}
          textAnchor="middle"
          fontSize={11}
          fill="var(--ink-3)"
          stroke="var(--paper)"
          strokeWidth={4}
          paintOrder="stroke"
        >
          gambar berlabel, skala log
        </text>

        {/* acuan: zero-shot terbaik tetapi lambat */}
        <line x1={x0} x2={x1} y1={sy(OWL)} y2={sy(OWL)} stroke="var(--ink-3)" strokeDasharray="3 4" strokeWidth={1} />
        <text x={x0 + 6} y={sy(OWL) - 5} fontSize={11} fill="var(--ink-2)">
          {sempit ? 'OWLv2-L zero-shot 55,4' : 'OWLv2-L zero-shot 55,4, tanpa label tetapi ±0,6 gambar per detik'}
        </text>

        {/* kurva */}
        <path d={path(KURVA_YOLOE_LP)} fill="none" stroke="var(--curve-yoloe)" strokeWidth={2} />
        <path d={path(KURVA_YOLO26)} fill="none" stroke="var(--curve-yolo26)" strokeWidth={2} />
        {[
          { pts: KURVA_YOLOE_LP, warna: 'var(--curve-yoloe)', seri: 'YOLOE-26s linear probing' },
          { pts: KURVA_YOLO26, warna: 'var(--curve-yolo26)', seri: 'YOLO26s' },
        ].map(({ pts, warna, seri }) =>
          pts.map((p) => (
            <circle
              key={seri + p.gambar}
              cx={sx(p.gambar)}
              cy={sy(p.map50)}
              r={3.5}
              fill={warna}
              stroke="var(--paper)"
              strokeWidth={2}
              onMouseEnter={() => setTip({ x: sx(p.gambar), y: sy(p.map50), teks: titikTip(p, seri) })}
              onMouseLeave={() => setTip(null)}
            >
              <title>{titikTip(p, seri)}</title>
            </circle>
          )),
        )}
        {/* label langsung di ujung kurva */}
        {/* Label diletakkan di ruang kosong di bawah kurvanya sendiri, jauh dari titik persilangan
            (antara ±109 dan ±338 gambar) dan dari garis OWLv2. */}
        <g fontSize={12} fontWeight={500} fill="var(--ink)" stroke="var(--paper)" strokeWidth={4} paintOrder="stroke">
          <text x={sx(sempit ? 3 : 1.5)} y={sempit ? sy(49.5) : sy(38.4) + 16}>
            <tspan fill="var(--curve-yoloe)">●</tspan> YOLOE-26s linear probing
          </text>
          <text x={sempit ? sx(500) : sx(1000)} y={sempit ? sy(12) : sy(48)} textAnchor="middle">
            <tspan fill="var(--curve-yolo26)">●</tspan> YOLO26s
          </text>
        </g>

        {/* mode demo: cincin besar + penghubung ke panel */}
        {MODE_ORDER.map((m, i) => {
          const p = POSISI_MODE[m]
          const cx = sx(p.gambar)
          const cy = sy(p.map50)
          const on = aktif === m
          const warna = p.kurva === 'yoloe' ? 'var(--curve-yoloe)' : 'var(--curve-yolo26)'
          return (
            <g key={m} onMouseEnter={() => onHover(m)} onMouseLeave={() => onHover(null)} className="cursor-default">
              {link && (
                <path
                  d={`M${cx},${sy(0)} C${cx},${H_CHART + 8} ${panelX(i)},${H_CHART + 4} ${panelX(i)},${H - 2}`}
                  fill="none"
                  stroke={on ? 'var(--ink)' : 'var(--ink-3)'}
                  strokeWidth={on ? 1.5 : 1}
                  strokeDasharray={on ? undefined : '2 3'}
                />
              )}
              <line x1={cx} x2={cx} y1={cy + 7} y2={sy(0)} stroke="var(--ink-3)" strokeWidth={1} strokeDasharray="2 3" />
              <circle cx={cx} cy={cy} r={on ? 8 : 6.5} fill="var(--paper)" stroke={warna} strokeWidth={2.5} />
              <circle cx={cx} cy={cy} r={12} fill="transparent" />
              <text
                display={sempit && (m === 'lp10' || m === 'lp30') && !on ? 'none' : undefined}
                x={cx + (m === 'full' ? -12 : 0)}
                y={cy - 13}
                textAnchor={m === 'full' ? 'end' : m === 'zs' ? 'start' : 'middle'}
                fontSize={13}
                fontWeight={700}
                fill="var(--ink)"
                className="font-wide"
              >
                {fmtID(p.map50)}
              </text>
            </g>
          )
        })}
      </svg>
      {tip && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-md bg-ink px-2 py-1 text-xs whitespace-nowrap text-white shadow"
          style={{ left: tip.x, top: tip.y - 10 }}
        >
          {tip.teks}
        </div>
      )}
    </div>
  )
}
