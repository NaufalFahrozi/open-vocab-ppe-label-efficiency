import { CircleAlert, CircleCheck, CircleHelp } from 'lucide-react'

import { MODE_ORDER, type DetectResponse, type ModeId, type Orang, type Status } from '@/lib/api'
import { kelompokDari, namaTampil, WARNA_KELOMPOK, type Kelompok } from '@/lib/kelas'
import { fmtID, POSISI_MODE } from '@/lib/kurva'
import { MODE_AWAM } from '@/lib/mode'
import { cn } from '@/lib/utils'
import { WARNA_STATUS } from './PhotoOverlay'

// Panel di samping foto. Isinya kalimat dan daftar biasa, bukan tabel teknis, supaya orang yang
// tidak ikut eksperimen tetap paham apa yang dilihat model.

const IKON_STATUS: Record<Status, typeof CircleCheck> = {
  patuh: CircleCheck,
  'tidak patuh': CircleAlert,
  'tidak diketahui': CircleHelp,
}
const TEKS_STATUS: Record<Status, string> = { patuh: 'Patuh', 'tidak patuh': 'Tidak patuh', 'tidak diketahui': 'Belum bisa dinilai' }

function Judul({ mode, ms }: { mode: ModeId; ms?: number }) {
  return (
    <div className="border-b border-rule pb-4">
      <h2 className="text-lg leading-snug font-semibold">{MODE_AWAM[mode].judul}</h2>
      <p className="mt-1 text-sm text-ink-2">{MODE_AWAM[mode].ringkas}</p>
      <p className="mt-2 text-xs text-ink-3">
        {MODE_AWAM[mode].teknis}. Skor mAP50 {fmtID(POSISI_MODE[mode].map50)} dari 100 pada 1.620 foto uji
        {ms !== undefined && `, ${fmtID(ms)} ms per foto di laptop ini`}.
      </p>
    </div>
  )
}

// Perbandingan kecil antarmodel untuk foto ini. Batang yang dipilih memakai tinta, sisanya abu.
function Banding({ judul, nilai, mode, onPilih, satuan }: { judul: string; nilai: Record<ModeId, number | null>; mode: ModeId; onPilih: (m: ModeId) => void; satuan: string }) {
  const maks = Math.max(1, ...MODE_ORDER.map((m) => nilai[m] ?? 0))
  return (
    <div>
      <p className="mb-2 text-sm font-medium">{judul}</p>
      <ul className="space-y-1">
        {MODE_ORDER.map((m) => {
          const v = nilai[m]
          return (
            <li key={m}>
              <button
                onClick={() => onPilih(m)}
                className={cn('grid w-full grid-cols-[88px_1fr_28px] items-center gap-2 rounded px-1 py-1 text-left text-sm hover:bg-row', m === mode && 'bg-row')}
                aria-pressed={m === mode}
              >
                <span className={cn('truncate text-xs', m === mode ? 'font-medium text-ink' : 'text-ink-2')}>{MODE_AWAM[m].angka} foto</span>
                <span className="h-2 overflow-hidden rounded-full bg-plate">
                  <span className={cn('block h-full rounded-full', m === mode ? 'bg-ink' : 'bg-ink-3/60')} style={{ width: `${((v ?? 0) / maks) * 100}%` }} />
                </span>
                <span className="text-right text-xs font-semibold">{v ?? '–'}</span>
              </button>
            </li>
          )
        })}
      </ul>
      <p className="mt-1 text-xs text-ink-3">{satuan}</p>
    </div>
  )
}

// Apa yang berubah dibanding titik sebelumnya di penggeser. Mata sulit membandingkan dua foto yang muncul
// bergantian, jadi perubahannya ditulis sebagai kalimat: "+1 sarung tangan, -1 masker".
function hitung(hasil: DetectResponse, m: ModeId) {
  const c = new Map<string, number>()
  for (const d of hasil.hasil[m]?.deteksi ?? []) c.set(d.kelas, (c.get(d.kelas) ?? 0) + 1)
  return c
}

function Perubahan({ mode, hasil, onPilihMode }: { mode: ModeId; hasil: DetectResponse; onPilihMode: (m: ModeId) => void }) {
  const i = MODE_ORDER.indexOf(mode)
  if (i === 0) {
    return (
      <div className="rounded-md border border-rule bg-white px-3 py-3">
        <p className="text-sm text-ink-2">Ini titik awal: model belum melihat satu pun foto berlabel.</p>
        <button onClick={() => onPilihMode('lp10')} className="mt-2 text-sm font-medium text-ink underline underline-offset-4 hover:text-ink-2">
          Bandingkan dengan 39 foto berlabel
        </button>
      </div>
    )
  }
  const sebelum = MODE_ORDER[i - 1]
  const a = hitung(hasil, sebelum)
  const b = hitung(hasil, mode)
  const beda = [...new Set([...a.keys(), ...b.keys()])]
    .map((k) => ({ k, d: (b.get(k) ?? 0) - (a.get(k) ?? 0) }))
    .filter((x) => x.d !== 0)
    .sort((x, y) => Math.abs(y.d) - Math.abs(x.d))
  return (
    <div className="rounded-md border border-rule bg-white px-3 py-3">
      <p className="text-sm font-medium">Dibanding {MODE_AWAM[sebelum].judul.toLowerCase()}</p>
      {beda.length ? (
        <ul className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {beda.map(({ k, d }) => (
            <li key={k}>
              {/* Netral, bukan hijau/merah: lebih banyak kotak belum tentu lebih baik (bisa salah deteksi). */}
              <b className="font-semibold">{d > 0 ? `+${d}` : `−${-d}`}</b> {namaTampil(k)}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-sm text-ink-2">Tidak ada perbedaan jumlah objek di foto ini.</p>
      )}
    </div>
  )
}

// ---------- Tab 1: deteksi ----------

interface DeteksiProps {
  mode: ModeId
  hasil: DetectResponse
  kelompok: Record<string, string[]>
  sorot: string | null
  onSorot: (k: string | null) => void
  onPilihMode: (m: ModeId) => void
}

const KELOMPOK_TAMPIL: { g: Kelompok; judul: string }[] = [
  { g: 'APD', judul: 'Alat pelindung diri' },
  { g: 'Bagian tubuh', judul: 'Bagian tubuh' },
  { g: 'Lainnya', judul: 'Lainnya' },
  { g: 'Kelas baru', judul: 'Jenis baru yang kamu tambahkan' },
]

export function PanelDeteksi({ mode, hasil, kelompok, sorot, onSorot, onPilihMode }: DeteksiProps) {
  const h = hasil.hasil[mode]
  const per = new Map<string, { n: number; maks: number }>()
  for (const d of h?.deteksi ?? []) {
    const x = per.get(d.kelas) ?? { n: 0, maks: 0 }
    per.set(d.kelas, { n: x.n + 1, maks: Math.max(x.maks, d.skor) })
  }
  const jumlahApd = Object.fromEntries(
    MODE_ORDER.map((m) => [m, hasil.hasil[m] ? hasil.hasil[m]!.deteksi.filter((d) => kelompokDari(d.kelas, kelompok) === 'APD').length : null]),
  ) as Record<ModeId, number | null>

  return (
    <div className="space-y-5">
      <Judul mode={mode} ms={h?.ms_model} />
      <Perubahan mode={mode} hasil={hasil} onPilihMode={onPilihMode} />
      <div className="space-y-4" onMouseLeave={() => onSorot(null)}>
        <p className="text-sm font-medium">Yang ditemukan di foto ini</p>
        {KELOMPOK_TAMPIL.map(({ g, judul }) => {
          const item = [...per.entries()].filter(([k]) => kelompokDari(k, kelompok) === g)
          if (g === 'Kelas baru' && !item.length) return null
          return (
            <div key={g}>
              <p className="mb-1 flex items-center gap-2 text-xs text-ink-2">
                <span className="inline-block h-2.5 w-3.5 rounded-[2px] border-2" style={{ borderColor: WARNA_KELOMPOK[g], borderStyle: g === 'Kelas baru' ? 'dashed' : 'solid' }} aria-hidden />
                {judul}
              </p>
              {item.length ? (
                <ul>
                  {item
                    .sort((a, b) => b[1].n - a[1].n)
                    .map(([k, v]) => (
                      <li key={k}>
                        <button
                          onMouseEnter={() => onSorot(k)}
                          onFocus={() => onSorot(k)}
                          onBlur={() => onSorot(null)}
                          className={cn('flex w-full items-baseline justify-between rounded px-2 py-1 text-left text-sm hover:bg-row', sorot === k && 'bg-row')}
                        >
                          <span>
                            {v.n} {namaTampil(k)}
                          </span>
                          <span className="text-xs text-ink-3">yakin {Math.round(v.maks * 100)}%</span>
                        </button>
                      </li>
                    ))}
                </ul>
              ) : (
                <p className="px-2 py-1 text-sm text-ink-3">Tidak ada yang ditemukan</p>
              )}
            </div>
          )
        })}
      </div>
      <Banding judul="Jumlah APD yang ditemukan tiap model di foto ini" nilai={jumlahApd} mode={mode} onPilih={onPilihMode} satuan="Klik satu baris untuk melihat hasil model itu." />
    </div>
  )
}

// ---------- Tab 2: kepatuhan ----------

function rincian(o: Orang) {
  const helm = { ya: ['ya', 'Helm terpakai'], tidak: ['tidak', 'Tidak memakai helm'], 'tidak terlihat': ['?', 'Kepala tidak terdeteksi'] }[o.helm]
  const tangan = {
    ya: ['ya', 'Sarung tangan terpakai'],
    tidak: ['tidak', 'Tangan tanpa sarung tangan'],
    'tidak terlihat': ['?', 'Tangan tidak terlihat'],
  }[o.sarung_tangan]
  return [helm, tangan] as [string, string][]
}

interface KepatuhanProps {
  mode: ModeId
  hasil: DetectResponse
  sorotOrang: number | null
  onSorotOrang: (i: number | null) => void
  onPilihMode: (m: ModeId) => void
}

export function PanelKepatuhan({ mode, hasil, sorotOrang, onSorotOrang, onPilihMode }: KepatuhanProps) {
  const kp = hasil.hasil[mode]?.kepatuhan
  const semuaBelum = !!kp && kp.orang.length > 0 && kp.orang.every((o) => o.status === 'tidak diketahui')
  // Model pertama (dari kiri) yang bisa menilai minimal satu pekerja, untuk tombol saran.
  const bisaMenilai = MODE_ORDER.find((m) => hasil.hasil[m]?.kepatuhan?.orang.some((o) => o.status !== 'tidak diketahui'))

  return (
    <div className="space-y-5">
      <Judul mode={mode} ms={hasil.hasil[mode]?.ms_model} />
      {semuaBelum && (
        // Bukan galat: ini temuan penelitian (RM 3). Model tanpa foto berlabel hampir tidak melihat bagian tubuh.
        <div className="rounded-md border border-rule bg-white px-3 py-3 text-sm">
          <p className="font-medium">Model ini belum bisa menilai, karena kepala pekerja tidak terdeteksi</p>
          <p className="mt-1 text-ink-2">
            Ini salah satu temuan penelitian: tanpa foto berlabel, model mengenali benda APD tetapi hampir tidak
            mengenali bagian tubuh. Di eksperimen, model ini hanya menemukan 6,4% telinga, wajah, tangan, dan kaki di foto uji.
          </p>
          {bisaMenilai && bisaMenilai !== mode && (
            <button onClick={() => onPilihMode(bisaMenilai)} className="mt-2 font-medium text-ink underline underline-offset-4 hover:text-ink-2">
              Lihat penilaian dengan {MODE_AWAM[bisaMenilai].judul.toLowerCase()}
            </button>
          )}
        </div>
      )}
      {!kp || kp.orang.length === 0 ? (
        <p className="text-sm text-ink-2">Model ini tidak menemukan orang di foto ini.</p>
      ) : (
        <>
          <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {(['patuh', 'tidak patuh', 'tidak diketahui'] as Status[]).map((st) => {
              const Ikon = IKON_STATUS[st]
              return (
                <span key={st} className="flex items-center gap-1.5">
                  <Ikon className="size-4" style={{ color: WARNA_STATUS[st] }} aria-hidden />
                  <b className="font-semibold">{kp.ringkasan[st]}</b> {TEKS_STATUS[st].toLowerCase()}
                </span>
              )
            })}
          </p>
          <ol className="space-y-2" onMouseLeave={() => onSorotOrang(null)}>
            {kp.orang.map((o, i) => {
              const Ikon = IKON_STATUS[o.status]
              return (
                <li key={i}>
                  <button
                    onMouseEnter={() => onSorotOrang(i)}
                    onFocus={() => onSorotOrang(i)}
                    onBlur={() => onSorotOrang(null)}
                    className={cn('w-full rounded-md border border-rule bg-white px-3 py-2.5 text-left hover:border-ink-3', sorotOrang === i && 'border-ink')}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold">Pekerja {i + 1}</span>
                      <span className="flex items-center gap-1 text-sm font-medium" style={{ color: WARNA_STATUS[o.status] }}>
                        <Ikon className="size-4" aria-hidden /> {TEKS_STATUS[o.status]}
                      </span>
                    </span>
                    <span className="mt-1.5 block space-y-0.5">
                      {rincian(o).map(([tanda, teks]) => (
                        <span key={teks} className="flex items-center gap-2 text-sm text-ink-2">
                          <span className={cn('w-4 text-center font-semibold', tanda === 'ya' ? 'text-ok' : tanda === 'tidak' ? 'text-bad' : 'text-ink-3')} aria-hidden>
                            {tanda === 'ya' ? '✓' : tanda === 'tidak' ? '✗' : '?'}
                          </span>
                          {teks}
                        </span>
                      ))}
                    </span>
                  </button>
                </li>
              )
            })}
          </ol>
          {kp.ringkasan.kepala_tanpa_helm_lepas > 0 && (
            <p className="text-xs text-ink-2">
              Ditambah {kp.ringkasan.kepala_tanpa_helm_lepas} kepala tanpa helm yang tidak masuk kotak orang mana pun.
            </p>
          )}
        </>
      )}
      <div>
        <p className="mb-2 text-sm font-medium">Kesimpulan tiap model untuk foto ini</p>
        <ul className="space-y-1">
          {MODE_ORDER.map((m) => {
            const r = hasil.hasil[m]?.kepatuhan?.ringkasan
            return (
              <li key={m}>
                <button
                  onClick={() => onPilihMode(m)}
                  aria-pressed={m === mode}
                  className={cn('grid w-full grid-cols-[88px_1fr] items-center gap-2 rounded px-1 py-1 text-left hover:bg-row', m === mode && 'bg-row')}
                >
                  <span className={cn('text-xs', m === mode ? 'font-medium text-ink' : 'text-ink-2')}>{MODE_AWAM[m].angka} foto</span>
                  <span className="flex gap-3 text-xs">
                    {(['patuh', 'tidak patuh', 'tidak diketahui'] as Status[]).map((st) => {
                      const Ikon = IKON_STATUS[st]
                      return (
                        <span key={st} className="flex items-center gap-1" title={TEKS_STATUS[st]}>
                          <Ikon className="size-3.5" style={{ color: WARNA_STATUS[st] }} aria-hidden />
                          <b className="font-semibold">{r ? r[st] : '–'}</b>
                          <span className="sr-only">{TEKS_STATUS[st]}</span>
                        </span>
                      )
                    })}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
        <p className="mt-1 text-xs text-ink-3">Model yang berbeda bisa memberi kesimpulan berbeda untuk foto yang sama.</p>
      </div>
      <p className="text-xs leading-relaxed text-ink-3">
        Cara menilai: helm dianggap terpakai kalau setidaknya separuh kotak helm berada di dalam kotak kepala. Aturan
        ini terbukti lebih akurat daripada meminta model langsung mencari "kepala tanpa helm" (AP50 90,3 lawan 57,2).
      </p>
    </div>
  )
}

// ---------- Tab 3: jenis APD baru ----------

interface BaruProps {
  hasil: DetectResponse | null
  kelompok: Record<string, string[]>
  aktif: string[]
  children: React.ReactNode // editor kelas baru
}

export function PanelBaru({ hasil, kelompok, aktif, children }: BaruProps) {
  const temuan = (hasil?.hasil.zs?.deteksi ?? []).filter((d) => kelompokDari(d.kelas, kelompok) === 'Kelas baru')
  const per = new Map<string, number[]>()
  for (const d of temuan) per.set(d.kelas, [...(per.get(d.kelas) ?? []), d.skor])

  return (
    <div className="space-y-5">
      <div className="border-b border-rule pb-4">
        <h2 className="text-lg leading-snug font-semibold">Cari jenis APD baru tanpa foto berlabel</h2>
        <p className="mt-1 text-sm text-ink-2">
          Ketik nama benda dalam bahasa Inggris. Hanya model tanpa foto berlabel yang bisa mencarinya, karena tiga model
          lain sudah dikunci pada 17 jenis objek yang dilatihkan.
        </p>
      </div>
      {children}
      {aktif.length > 0 && (
        <div>
          <p className="mb-1 text-sm font-medium">Hasil di foto ini</p>
          <ul>
            {aktif.map((k) => {
              const s = per.get(k)
              return (
                <li key={k} className="flex items-baseline justify-between px-2 py-1 text-sm">
                  <span>{k}</span>
                  {s ? (
                    <span>
                      <b className="font-semibold">{s.length}</b> <span className="text-xs text-ink-3">yakin {Math.round(Math.max(...s) * 100)}%</span>
                    </span>
                  ) : (
                    <span className="text-xs text-ink-3">tidak ditemukan</span>
                  )}
                </li>
              )
            })}
          </ul>
          <p className="mt-2 text-xs leading-relaxed text-ink-3">
            Hasil tanpa contoh bisa keliru. Misalnya pada foto image169, tali kartu identitas dikira safety harness. Di
            eksperimen, memberi 30 contoh berlabel per jenis menaikkan mAP50 rata-rata dari 38,4 ke 43,2.
          </p>
        </div>
      )}
    </div>
  )
}
