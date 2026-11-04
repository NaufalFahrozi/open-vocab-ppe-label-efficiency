import { motion } from 'motion/react'
import { ArrowRight, CircleAlert, CircleCheck, CircleHelp } from 'lucide-react'

import { MODE_ORDER, type DetectResponse, type ModeId, type Orang, type Status } from '@/lib/api'
import { ikonKelas, kelompokDari, namaTampil, WARNA_KELOMPOK, type Kelompok } from '@/lib/kelas'
import { fmtID, POSISI_MODE } from '@/lib/kurva'
import { MODE_AWAM } from '@/lib/mode'
import { cn } from '@/lib/utils'
import { Angka } from './Angka'
import { WARNA_STATUS } from './PhotoOverlay'

// Panel di samping panggung. Satu kalimat besar menjawab pertanyaan utama, lalu ubin berikon.
// Penjelasan teknis disimpan di bagian cerita di bawah halaman, bukan di sini.

const IKON_STATUS: Record<Status, typeof CircleCheck> = { patuh: CircleCheck, 'tidak patuh': CircleAlert, 'tidak diketahui': CircleHelp }
const TEKS_STATUS: Record<Status, string> = { patuh: 'Patuh', 'tidak patuh': 'Tidak patuh', 'tidak diketahui': 'Belum bisa dinilai' }

function hitung(hasil: DetectResponse, m: ModeId) {
  const c = new Map<string, { n: number; maks: number }>()
  for (const d of hasil.hasil[m]?.deteksi ?? []) {
    const x = c.get(d.kelas) ?? { n: 0, maks: 0 }
    c.set(d.kelas, { n: x.n + 1, maks: Math.max(x.maks, d.skor) })
  }
  return c
}

function Meta({ mode, ms }: { mode: ModeId; ms?: number }) {
  return (
    <p className="text-xs text-ink-3" title={MODE_AWAM[mode].teknis}>
      mAP50 {fmtID(POSISI_MODE[mode].map50)} di foto uji SH17{ms !== undefined && `, ${fmtID(ms, 0)} ms per foto`}
    </p>
  )
}

// ---------- Tab deteksi ----------

interface DeteksiProps {
  mode: ModeId
  hasil: DetectResponse
  kelompok: Record<string, string[]>
  sorot: string | null
  onSorot: (k: string | null) => void
  onMode: (m: ModeId) => void
  pembanding?: ModeId // model pembanding untuk angka perubahan; bawaan: titik sebelumnya di penggeser
}

const URUT: Kelompok[] = ['APD', 'Kelas baru', 'Bagian tubuh', 'Lainnya']

export function PanelDeteksi({ mode, hasil, kelompok, sorot, onSorot, onMode, pembanding }: DeteksiProps) {
  const ini = hitung(hasil, mode)
  const i = MODE_ORDER.indexOf(mode)
  const banding: ModeId | null = pembanding ?? (i > 0 ? MODE_ORDER[i - 1] : null)
  const sebelum = banding ? hitung(hasil, banding) : null
  const jumlahApd = (m: ModeId) => (hasil.hasil[m]?.deteksi ?? []).filter((d) => kelompokDari(d.kelas, kelompok) === 'APD').length
  const apd = jumlahApd(mode)
  const deltaApd = banding ? apd - jumlahApd(banding) : null

  const ubin = [...ini.entries()]
    .map(([k, v]) => ({ k, ...v, g: kelompokDari(k, kelompok), d: sebelum ? v.n - (sebelum.get(k)?.n ?? 0) : 0 }))
    .sort((a, b) => URUT.indexOf(a.g) - URUT.indexOf(b.g) || b.n - a.n)
  const hilang = sebelum ? [...sebelum.keys()].filter((k) => !ini.has(k)) : []

  return (
    <div className="space-y-5">
      <div>
        <p className="font-display text-[44px] leading-none font-semibold">
          <Angka nilai={apd} /> <span className="text-2xl font-medium">APD ditemukan</span>
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {deltaApd !== null && (
            <span className="rounded-full bg-ink px-2.5 py-1 text-xs font-semibold text-white">
              {deltaApd > 0 ? `+${deltaApd}` : deltaApd < 0 ? `−${-deltaApd}` : '±0'} dibanding {MODE_AWAM[banding!].angka} foto berlabel
            </span>
          )}
          <Meta mode={mode} ms={hasil.hasil[mode]?.ms_model} />
        </div>
      </div>

      <ul className="grid grid-cols-2 gap-2" onMouseLeave={() => onSorot(null)} aria-label="Benda yang ditemukan">
        <>
          {ubin.map(({ k, n, maks, g, d }) => {
            const Ikon = ikonKelas(k)
            return (
              <motion.li key={k} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }}>
                <button
                  onMouseEnter={() => onSorot(k)}
                  onFocus={() => onSorot(k)}
                  onBlur={() => onSorot(null)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-xl border bg-surface p-3 text-left transition-colors',
                    sorot === k ? 'border-ink' : 'border-line hover:border-ink-3',
                  )}
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg" style={{ background: `color-mix(in oklab, ${WARNA_KELOMPOK[g]} 16%, white)`, color: g === 'Lainnya' ? 'var(--ink-2)' : WARNA_KELOMPOK[g] }}>
                    <Ikon className="size-[18px]" strokeWidth={1.75} aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{namaTampil(k)}</span>
                    <span className="block text-xs text-ink-3">yakin {Math.round(maks * 100)}%</span>
                  </span>
                  <span className="text-right">
                    <Angka nilai={n} className="font-display block text-xl leading-none font-semibold" />
                    {d !== 0 && <span className="block text-[11px] font-semibold text-ink-2">{d > 0 ? `+${d}` : `−${-d}`}</span>}
                  </span>
                </button>
              </motion.li>
            )
          })}
        </>
      </ul>
      {ubin.length === 0 && <p className="text-sm text-ink-2">Model ini tidak menemukan apa pun di foto ini.</p>}
      {hilang.length > 0 && <p className="text-xs text-ink-3">Tidak lagi terdeteksi: {hilang.map(namaTampil).join(', ')}</p>}

      {i === 0 ? (
        <button onClick={() => onMode('lp10')} className="group flex w-full items-center justify-between rounded-xl bg-ink px-4 py-3 text-left text-white">
          <span>
            <span className="block text-sm font-semibold">Beri model 39 foto berlabel</span>
            <span className="block text-xs text-white/70">Lihat apa yang bertambah</span>
          </span>
          <ArrowRight className="size-5 transition-transform group-hover:translate-x-0.5" aria-hidden />
        </button>
      ) : (
        <div>
          <p className="mb-2 text-xs text-ink-3">Jumlah APD yang ditemukan tiap model di foto ini</p>
          <div className="grid grid-cols-4 gap-1.5">
            {MODE_ORDER.map((m) => (
              <button
                key={m}
                onClick={() => onMode(m)}
                aria-pressed={m === mode}
                className={cn('rounded-lg border px-2 py-2 text-center', m === mode ? 'border-ink bg-ink text-white' : 'border-line bg-surface hover:border-ink-3')}
              >
                <span className="font-display block text-lg leading-none font-semibold">{jumlahApd(m)}</span>
                <span className={cn('mt-1 block text-[11px]', m === mode ? 'text-white/70' : 'text-ink-3')}>{MODE_AWAM[m].angka} foto</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ---------- Tab kepatuhan ----------

function rincian(o: Orang): [string, string][] {
  const helm = { ya: ['ya', 'Helm terpakai'], tidak: ['tidak', 'Tanpa helm'], 'tidak terlihat': ['?', 'Kepala tidak terlihat'] }[o.helm]
  const tangan = { ya: ['ya', 'Sarung tangan terpakai'], tidak: ['tidak', 'Tangan telanjang'], 'tidak terlihat': ['?', 'Tangan tidak terlihat'] }[o.sarung_tangan]
  return [helm, tangan] as [string, string][]
}

interface KepatuhanProps {
  mode: ModeId
  hasil: DetectResponse
  sorotOrang: number | null
  onSorotOrang: (i: number | null) => void
  onMode: (m: ModeId) => void
}

export function PanelKepatuhan({ mode, hasil, sorotOrang, onSorotOrang, onMode }: KepatuhanProps) {
  const kp = hasil.hasil[mode]?.kepatuhan
  const orang = kp?.orang ?? []
  const patuh = orang.filter((o) => o.status === 'patuh').length
  const semuaBelum = orang.length > 0 && orang.every((o) => o.status === 'tidak diketahui')
  const bisa = MODE_ORDER.find((m) => hasil.hasil[m]?.kepatuhan?.orang.some((o) => o.status !== 'tidak diketahui'))

  return (
    <div className="space-y-5">
      <div>
        {orang.length ? (
          <p className="font-display text-[44px] leading-none font-semibold">
            <Angka nilai={patuh} /> <span className="text-2xl font-medium">dari {orang.length} pekerja patuh</span>
          </p>
        ) : (
          <p className="font-display text-2xl leading-tight font-semibold">Tidak ada pekerja yang terdeteksi</p>
        )}
        <div className="mt-2">
          <Meta mode={mode} ms={hasil.hasil[mode]?.ms_model} />
        </div>
      </div>

      {semuaBelum && (
        <div className="rounded-xl border border-line bg-surface p-4">
          <p className="text-sm font-semibold">Kepala pekerja tidak terlihat oleh model ini</p>
          <p className="mt-1 text-sm text-ink-2">
            Tanpa foto berlabel, model mengenali helm dan rompi, tapi hampir buta terhadap bagian tubuh. Di eksperimen hanya
            6,4% telinga, wajah, tangan, dan kaki yang ditemukan.
          </p>
          {bisa && bisa !== mode && (
            <button onClick={() => onMode(bisa)} className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-ink px-3 py-2 text-sm font-semibold text-white">
              Nilai dengan {MODE_AWAM[bisa].judul.toLowerCase()} <ArrowRight className="size-4" aria-hidden />
            </button>
          )}
        </div>
      )}

      <ol className="space-y-2" onMouseLeave={() => onSorotOrang(null)} aria-label="Pekerja">
        {orang.map((o, i) => {
          const Ikon = IKON_STATUS[o.status]
          return (
            <li key={i}>
              <button
                onMouseEnter={() => onSorotOrang(i)}
                onFocus={() => onSorotOrang(i)}
                onBlur={() => onSorotOrang(null)}
                className={cn('flex w-full items-start gap-3 rounded-xl border bg-surface p-3 text-left transition-colors', sorotOrang === i ? 'border-ink' : 'border-line hover:border-ink-3')}
              >
                <span className="grid size-8 shrink-0 place-items-center rounded-full text-sm font-bold text-white" style={{ background: WARNA_STATUS[o.status] }}>
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 text-sm font-semibold" style={{ color: WARNA_STATUS[o.status] }}>
                    <Ikon className="size-4" aria-hidden /> {TEKS_STATUS[o.status]}
                  </span>
                  <span className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-ink-2">
                    {rincian(o).map(([t, teks]) => (
                      <span key={teks}>
                        <b className={cn('font-bold', t === 'ya' ? 'text-ok' : t === 'tidak' ? 'text-bad' : 'text-ink-3')}>{t === 'ya' ? '✓' : t === 'tidak' ? '✗' : '?'}</b> {teks}
                      </span>
                    ))}
                  </span>
                </span>
              </button>
            </li>
          )
        })}
      </ol>

      <div>
        <p className="mb-2 text-xs text-ink-3">Kesimpulan tiap model untuk foto yang sama</p>
        <div className="grid grid-cols-4 gap-1.5">
          {MODE_ORDER.map((m) => {
            const r = hasil.hasil[m]?.kepatuhan?.ringkasan
            const n = (hasil.hasil[m]?.kepatuhan?.orang ?? []).length
            return (
              <button
                key={m}
                onClick={() => onMode(m)}
                aria-pressed={m === mode}
                className={cn('rounded-lg border px-1.5 py-2 text-center', m === mode ? 'border-ink bg-ink text-white' : 'border-line bg-surface hover:border-ink-3')}
              >
                <span className="font-display block text-lg leading-none font-semibold">
                  {r ? r.patuh : '–'}
                  <span className="text-xs font-medium opacity-70">/{n}</span>
                </span>
                <span className={cn('mt-1 block text-[11px]', m === mode ? 'text-white/70' : 'text-ink-3')}>{MODE_AWAM[m].angka} foto</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ---------- Tab jenis APD baru ----------

interface BaruProps {
  hasil: DetectResponse | null
  kelompok: Record<string, string[]>
  aktif: string[]
  children: React.ReactNode
}

export function PanelBaru({ hasil, kelompok, aktif, children }: BaruProps) {
  const temuan = (hasil?.hasil.zs?.deteksi ?? []).filter((d) => kelompokDari(d.kelas, kelompok) === 'Kelas baru')
  const per = new Map<string, number[]>()
  for (const d of temuan) per.set(d.kelas, [...(per.get(d.kelas) ?? []), d.skor])

  return (
    <div className="space-y-5">
      <div>
        <p className="font-display text-3xl leading-tight font-semibold">Cari benda apa pun, tanpa melabeli satu foto pun</p>
        <p className="mt-2 text-sm text-ink-2">Ketik nama bendanya dalam bahasa Inggris. Model tanpa label langsung mencarinya.</p>
      </div>
      {children}
      {aktif.length > 0 && (
        <ul className="space-y-2" aria-label="Hasil pencarian">
          {aktif.map((k) => {
            const s = per.get(k)
            return (
              <li key={k} className={cn('flex items-center justify-between rounded-xl border p-3', s ? 'border-baru bg-surface' : 'border-line bg-surface')}>
                <span className="text-sm font-medium">{k}</span>
                {s ? (
                  <span className="text-right">
                    <span className="font-display text-xl font-semibold">{s.length}</span>
                    <span className="ml-1.5 text-xs text-ink-3">yakin {Math.round(Math.max(...s) * 100)}%</span>
                  </span>
                ) : (
                  <span className="text-xs text-ink-3">tidak ditemukan di foto ini</span>
                )}
              </li>
            )
          })}
        </ul>
      )}
      <p className="text-xs leading-relaxed text-ink-3">
        Hanya model tanpa label yang bisa mencari benda baru; tiga model lain sudah terkunci pada 17 jenis benda SH17. Hasilnya
        bisa keliru, misalnya tali kartu identitas pernah dikira safety harness.
      </p>
    </div>
  )
}
