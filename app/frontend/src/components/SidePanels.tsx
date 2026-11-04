import { motion } from 'motion/react'
import { ArrowRight, CircleAlert, CircleCheck, CircleHelp } from 'lucide-react'

import { MODE_ORDER, type DetectResponse, type ModeId, type Orang, type Status } from '@/lib/api'
import { ikonKelas, kelompokDari, namaTampil, WARNA_KELOMPOK, type Kelompok } from '@/lib/kelas'
import { MODE_AWAM } from '@/lib/mode'
import { cn } from '@/lib/utils'
import { Angka } from './Angka'
import { WARNA_STATUS } from './PhotoOverlay'

// Panel hasil di samping foto: satu kalimat yang menjawab, lalu daftar benda berikon.
// Perbandingan antardetektor sudah terlihat di kartu pemilih, jadi tidak diulang di sini.

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

// ---------- Benda APD ----------

interface DeteksiProps {
  mode: ModeId
  hasil: DetectResponse
  kelompok: Record<string, string[]>
  sorot: string | null
  onSorot: (k: string | null) => void
  onMode: (m: ModeId) => void
}

const URUT: Kelompok[] = ['APD', 'Kelas baru', 'Bagian tubuh', 'Lainnya']
const JUDUL_KELOMPOK: Record<Kelompok, string> = { APD: 'Alat pelindung diri', 'Kelas baru': 'Benda baru', 'Bagian tubuh': 'Bagian tubuh', Lainnya: 'Lainnya' }

export function PanelDeteksi({ mode, hasil, kelompok, sorot, onSorot, onMode }: DeteksiProps) {
  const ini = hitung(hasil, mode)
  const i = MODE_ORDER.indexOf(mode)
  const sebelum = i > 0 ? MODE_ORDER[i - 1] : null
  const lama = sebelum ? hitung(hasil, sebelum) : null
  const apd = [...ini.entries()].filter(([k]) => kelompokDari(k, kelompok) === 'APD').reduce((s, [, v]) => s + v.n, 0)

  const kelompokIsi = URUT.map((g) => ({
    g,
    item: [...ini.entries()].filter(([k]) => kelompokDari(k, kelompok) === g).sort((a, b) => b[1].n - a[1].n),
  })).filter((x) => x.item.length)
  const berubah = lama
    ? [...new Set([...ini.keys(), ...lama.keys()])]
        .map((k) => ({ k, d: (ini.get(k)?.n ?? 0) - (lama.get(k)?.n ?? 0) }))
        .filter((x) => x.d !== 0)
    : []

  return (
    <div className="space-y-5">
      <p className="text-2xl leading-tight font-semibold">
        <Angka nilai={apd} /> alat pelindung diri ditemukan
      </p>

      {lama && (
        <p className="rounded-xl bg-row px-3 py-2.5 text-sm text-ink-2">
          {berubah.length ? (
            <>
              Dibanding detektor yang {sebelum === 'zs' ? 'belum diberi contoh' : `diberi ${MODE_AWAM[sebelum!].angka} foto contoh`}:{' '}
              {berubah.map(({ k, d }, j) => (
                <span key={k}>
                  {j > 0 && ', '}
                  <b className="font-semibold text-ink">
                    {d > 0 ? `+${d}` : `−${-d}`} {namaTampil(k)}
                  </b>
                </span>
              ))}
            </>
          ) : (
            'Sama persis dengan detektor sebelumnya untuk foto ini.'
          )}
        </p>
      )}

      <div className="space-y-4" onMouseLeave={() => onSorot(null)}>
        {kelompokIsi.map(({ g, item }) => (
          <div key={g}>
            <p className="mb-1.5 flex items-center gap-2 text-xs font-medium text-ink-2">
              <span className="inline-block h-2.5 w-3.5 rounded-[3px] border-2" style={{ borderColor: WARNA_KELOMPOK[g], borderStyle: g === 'Kelas baru' ? 'dashed' : 'solid' }} aria-hidden />
              {JUDUL_KELOMPOK[g]}
            </p>
            <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
              {item.map(([k, v]) => {
                const Ikon = ikonKelas(k)
                return (
                  <motion.li key={k} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
                    <button
                      onMouseEnter={() => onSorot(k)}
                      onFocus={() => onSorot(k)}
                      onBlur={() => onSorot(null)}
                      className={cn('flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors', sorot === k ? 'bg-brand-soft' : 'hover:bg-row')}
                    >
                      <Ikon className="size-[18px] shrink-0 text-ink-2" strokeWidth={1.75} aria-hidden />
                      <span className="flex-1 text-sm font-medium">{namaTampil(k)}</span>
                      <span className="text-xs text-ink-3">yakin {Math.round(v.maks * 100)}%</span>
                      <span className="w-6 text-right text-base font-semibold">{v.n}</span>
                    </button>
                  </motion.li>
                )
              })}
            </ul>
          </div>
        ))}
        {kelompokIsi.length === 0 && <p className="text-sm text-ink-2">Detektor ini tidak menemukan apa pun di foto ini.</p>}
      </div>

      {i === 0 && (
        <button onClick={() => onMode('lp10')} className="flex w-full items-center justify-between rounded-xl bg-brand px-4 py-3 text-left text-ink">
          <span>
            <span className="block text-sm font-semibold">Coba detektor yang diberi 39 foto contoh</span>
            <span className="block text-xs text-ink/70">Lihat apa yang bertambah</span>
          </span>
          <ArrowRight className="size-5" aria-hidden />
        </button>
      )}
      <p className="text-xs text-ink-3">Arahkan kursor ke nama benda untuk menyorotnya di foto.</p>
    </div>
  )
}

// ---------- Kepatuhan pekerja ----------

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
  const orang = hasil.hasil[mode]?.kepatuhan?.orang ?? []
  const patuh = orang.filter((o) => o.status === 'patuh').length
  const semuaBelum = orang.length > 0 && orang.every((o) => o.status === 'tidak diketahui')
  const bisa = MODE_ORDER.find((m) => hasil.hasil[m]?.kepatuhan?.orang.some((o) => o.status !== 'tidak diketahui'))

  return (
    <div className="space-y-5">
      <p className="text-2xl leading-tight font-semibold">
        {orang.length ? (
          <>
            <Angka nilai={patuh} /> dari {orang.length} pekerja memakai APD dengan benar
          </>
        ) : (
          'Tidak ada pekerja yang terdeteksi'
        )}
      </p>

      {semuaBelum && (
        <div className="rounded-xl bg-row p-4">
          <p className="text-sm font-semibold">Detektor ini belum bisa menilai karena kepala pekerja tidak terlihat olehnya</p>
          <p className="mt-1 text-sm text-ink-2">
            Tanpa foto contoh, detektor mengenali helm dan rompi tapi hampir tidak mengenali bagian tubuh. Ini salah satu
            temuan penelitian ini.
          </p>
          {bisa && bisa !== mode && (
            <button onClick={() => onMode(bisa)} className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-ink">
              Coba detektor yang {MODE_AWAM[bisa].judul.toLowerCase()} <ArrowRight className="size-4" aria-hidden />
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
                <span className="grid size-7 shrink-0 place-items-center rounded-full text-sm font-semibold text-white" style={{ background: WARNA_STATUS[o.status] }}>
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 text-sm font-semibold" style={{ color: WARNA_STATUS[o.status] }}>
                    <Ikon className="size-4" aria-hidden /> {TEKS_STATUS[o.status]}
                  </span>
                  <span className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-ink-2">
                    {rincian(o).map(([t, teks]) => (
                      <span key={teks}>
                        <b className={cn('font-semibold', t === 'ya' ? 'text-ok' : t === 'tidak' ? 'text-bad' : 'text-ink-3')}>{t === 'ya' ? '✓' : t === 'tidak' ? '✗' : '?'}</b> {teks}
                      </span>
                    ))}
                  </span>
                </span>
              </button>
            </li>
          )
        })}
      </ol>
      <p className="text-xs leading-relaxed text-ink-3">
        Nomor pekerja sama dengan nomor di foto. Helm dianggap terpakai kalau kotaknya berada di dalam kotak kepala.
      </p>
    </div>
  )
}

// ---------- Cari benda lain ----------

interface BaruProps {
  hasil: DetectResponse | null
  kelompok: Record<string, string[]>
  aktif: string[]
  children: React.ReactNode
}

export function PanelBaru({ hasil, kelompok, aktif, children }: BaruProps) {
  const per = new Map<string, number[]>()
  for (const d of hasil?.hasil.zs?.deteksi ?? []) if (kelompokDari(d.kelas, kelompok) === 'Kelas baru') per.set(d.kelas, [...(per.get(d.kelas) ?? []), d.skor])

  return (
    <div className="space-y-4">
      <div>
        <p className="text-2xl leading-tight font-semibold">Cari benda apa pun, tanpa satu foto contoh pun</p>
        <p className="mt-1.5 text-sm text-ink-2">Ketik nama bendanya dalam bahasa Inggris, lalu detektor langsung mencarinya di foto.</p>
      </div>
      {children}
      {aktif.length > 0 && (
        <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface" aria-label="Hasil pencarian">
          {aktif.map((k) => {
            const s = per.get(k)
            return (
              <li key={k} className="flex items-center justify-between px-3 py-2.5">
                <span className="text-sm font-medium">{k}</span>
                {s ? (
                  <span className="text-sm">
                    <b className="font-semibold">{s.length} ditemukan</b> <span className="text-xs text-ink-3">yakin {Math.round(Math.max(...s) * 100)}%</span>
                  </span>
                ) : (
                  <span className="text-xs text-ink-3">tidak ada di foto ini</span>
                )}
              </li>
            )
          })}
        </ul>
      )}
      <p className="text-xs leading-relaxed text-ink-3">
        Hanya detektor yang belum diberi contoh yang bisa mencari benda baru. Tiga detektor lain sudah terkunci pada 17 jenis
        benda yang diajarkan. Hasilnya bisa keliru, misalnya tali kartu identitas pernah dikira safety harness.
      </p>
    </div>
  )
}
