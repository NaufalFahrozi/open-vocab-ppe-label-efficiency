import { useCallback, useEffect, useRef, useState } from 'react'

import { DetectorPicker, type Ringkas } from '@/components/DetectorPicker'
import { Filmstrip } from '@/components/Filmstrip'
import { type Gambar, type Tampilan } from '@/components/PhotoOverlay'
import { PromptEditor } from '@/components/PromptEditor'
import { PanelBaru, PanelDeteksi, PanelKepatuhan } from '@/components/SidePanels'
import { Stage } from '@/components/Stage'
import { Story } from '@/components/Story'
import { api, MODE_ORDER, type DetectResponse, type ModeId, type ModelsResponse } from '@/lib/api'
import { kelompokDari } from '@/lib/kelas'
import { cn } from '@/lib/utils'

// Foto demo tetap di depan (lihat skenario demo di app/README.md).
const FOTO_DEMO = ['image1003.jpg', 'image548.jpg', 'image58.jpeg']

const TAB: { id: Tampilan; label: string; langkah3: string }[] = [
  { id: 'deteksi', label: 'Benda APD', langkah3: 'Lihat yang ditemukan' },
  { id: 'kepatuhan', label: 'Kepatuhan pekerja', langkah3: 'Lihat siapa yang patuh' },
  { id: 'baru', label: 'Cari benda lain', langkah3: 'Ketik benda yang dicari' },
]

// Ukuran foto dibaca dengan createImageBitmap, bukan img.decode(): decode() bisa ditunda browser saat tab
// tidak terlihat, sehingga deteksi pertama sempat baru jalan belasan detik setelah halaman dibuka.
async function muatGambar(blob: Blob, nama: string): Promise<Gambar> {
  const bmp = await createImageBitmap(blob)
  const g = { blob, url: URL.createObjectURL(blob), lebar: bmp.width, tinggi: bmp.height, nama }
  bmp.close()
  return g
}

function acak<T>(arr: T[], n: number) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a.slice(0, n)
}

function useLayarLebar() {
  const q = '(min-width: 1024px)'
  const [lebar, setLebar] = useState(() => window.matchMedia(q).matches)
  useEffect(() => {
    const m = window.matchMedia(q)
    const f = () => setLebar(m.matches)
    m.addEventListener('change', f)
    return () => m.removeEventListener('change', f)
  }, [])
  return lebar
}

// Logo: sudut kotak deteksi mengapit titik kuning, seperti detektor yang sedang menyorot sesuatu.
function Logo() {
  return (
    <span className="flex shrink-0 items-center gap-2">
      <svg width="26" height="26" viewBox="0 0 28 28" aria-hidden>
        <path d="M3 10V3h7M25 18v7h-7" fill="none" stroke="var(--ink)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="14" cy="14" r="4.5" fill="var(--brand)" />
      </svg>
      <span className="text-xl leading-none font-semibold tracking-tight">Sorot</span>
    </span>
  )
}

// Judul langkah dengan nomor di lingkaran kuning, seperti rambu: urutan yang harus diikuti.
function Langkah({ no, children, kanan }: { no: number; children: React.ReactNode; kanan?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <span className="grid size-6 place-items-center rounded-full bg-brand text-xs font-bold text-ink">{no}</span>
        {children}
      </h2>
      {kanan}
    </div>
  )
}

export default function App() {
  const [models, setModels] = useState<ModelsResponse | null>(null)
  const [contoh, setContoh] = useState<string[]>([])
  const [strip, setStrip] = useState<string[]>([])
  const [gambar, setGambar] = useState<Gambar | null>(null)
  const [hasil, setHasil] = useState<DetectResponse | null>(null)
  const [memuat, setMemuat] = useState(false)
  const [galat, setGalat] = useState<string | null>(null)
  const [tab, setTab] = useState<Tampilan>('deteksi')
  const [mode, setMode] = useState<ModeId>('zs')
  const [pratinjau, setPratinjau] = useState<ModeId | null>(null)
  const [sorot, setSorot] = useState<string | null>(null)
  const [sorotOrang, setSorotOrang] = useState<number | null>(null)
  const [promptSibuk, setPromptSibuk] = useState(false)
  const [seret, setSeret] = useState(false)
  const lebar = useLayarLebar()
  const abort = useRef<AbortController | null>(null)

  useEffect(() => {
    api.models().then(setModels).catch((e) => setGalat(`Server tidak bisa dihubungi: ${e.message}`))
    api
      .samples()
      .then(({ gambar }) => {
        setContoh(gambar)
        const depan = FOTO_DEMO.filter((g) => gambar.includes(g))
        setStrip([...depan, ...acak(gambar.filter((g) => !depan.includes(g)), 8 - depan.length)])
      })
      .catch(() => {})
  }, [])

  // Satu permintaan per foto mengambil hasil keempat detektor sekaligus, termasuk kepatuhan, sehingga
  // berganti detektor dan berpindah tab terasa instan.
  const deteksi = useCallback(async () => {
    if (!gambar || !models) return
    abort.current?.abort()
    const ac = new AbortController()
    abort.current = ac
    setMemuat(true)
    setGalat(null)
    try {
      const modes = MODE_ORDER.filter((m) => models.modes[m]?.termuat)
      setHasil(await api.detect(gambar.blob, { modes, conf: models.conf_tampil, kepatuhan: true, ambang: models.ambang_pelanggaran }, ac.signal))
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setGalat(`Deteksi gagal: ${(e as Error).message}`)
    } finally {
      if (abort.current === ac) setMemuat(false)
    }
  }, [gambar, models])

  useEffect(() => {
    deteksi()
  }, [deteksi])

  const pilihBlob = async (blob: Blob, nama: string) => {
    if (!blob.type.startsWith('image/')) return setGalat('File itu bukan gambar. Pilih foto JPG atau PNG.')
    try {
      const g = await muatGambar(blob, nama)
      setGambar((lama) => {
        if (lama) URL.revokeObjectURL(lama.url)
        return g
      })
      setSorotOrang(null)
    } catch {
      setGalat('Foto itu tidak bisa dibuka. Coba file JPG atau PNG lain.')
    }
  }
  const pilihContoh = async (nama: string) => pilihBlob(await (await fetch(api.sampleUrl(nama))).blob(), nama)

  useEffect(() => {
    if (!gambar && strip.length) pilihContoh(strip[0])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [strip])

  const gantiTab = (t: Tampilan) => {
    setTab(t)
    setSorot(null)
    setSorotOrang(null)
    setPratinjau(null)
    if (t === 'baru') setMode('zs') // hanya detektor tanpa contoh yang bisa mencari benda baru
  }

  const terapkanPrompt = async (kelas: string[]) => {
    setPromptSibuk(true)
    try {
      await api.setPrompts(kelas)
      setModels(await api.models())
    } catch (e) {
      setGalat(`Pencarian gagal: ${(e as Error).message}`)
    } finally {
      setPromptSibuk(false)
    }
  }

  const terkunci: ModeId[] = tab === 'baru' ? MODE_ORDER.filter((m) => m !== 'zs') : []
  const tampil = pratinjau ?? mode
  const kelompok = models?.kelompok_kelas ?? {}

  // Hasil singkat tiap detektor untuk foto ini, ditampilkan langsung di kartunya.
  const ringkas: Partial<Record<ModeId, Ringkas>> = {}
  if (hasil) {
    for (const m of MODE_ORDER) {
      const h = hasil.hasil[m]
      if (!h) continue
      if (tab === 'deteksi') ringkas[m] = { angka: String(h.deteksi.filter((d) => kelompokDari(d.kelas, kelompok) === 'APD').length), satuan: 'APD' }
      if (tab === 'kepatuhan') {
        const o = h.kepatuhan?.orang ?? []
        ringkas[m] = { angka: `${o.filter((x) => x.status === 'patuh').length}/${o.length}`, satuan: 'patuh' }
      }
      if (tab === 'baru' && m === 'zs') ringkas[m] = { angka: String(h.deteksi.filter((d) => kelompokDari(d.kelas, kelompok) === 'Kelas baru').length), satuan: 'ditemukan' }
    }
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        setSeret(true)
      }}
      onDragLeave={(e) => e.currentTarget === e.target && setSeret(false)}
      onDrop={(e) => {
        e.preventDefault()
        setSeret(false)
        const f = e.dataTransfer.files[0]
        if (f) pilihBlob(f, f.name)
      }}
    >
      <header className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-x-5 gap-y-3 px-4 pt-4 pb-3 sm:px-6 lg:h-16 lg:flex-nowrap lg:py-0">
        <Logo />
        <p className="min-w-0 text-sm text-ink-2 lg:truncate">
          Seberapa banyak foto contoh yang dibutuhkan komputer untuk mengenali alat pelindung diri?
        </p>
        <nav role="tablist" aria-label="Apa yang ingin dilihat" className="flex w-full shrink-0 gap-1 rounded-xl border border-line bg-surface p-1 lg:ml-auto lg:w-auto">
          {TAB.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => gantiTab(t.id)}
              className={cn('flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-colors lg:flex-none', tab === t.id ? 'bg-ink text-white' : 'text-ink-2 hover:bg-row hover:text-ink')}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      {galat && (
        <p role="alert" className="mx-auto mb-3 max-w-[1440px] px-4 text-sm text-bad sm:px-6">
          {galat}
        </p>
      )}

      <main className="mx-auto grid max-w-[1440px] grid-cols-[minmax(0,1fr)] gap-4 px-4 sm:px-6 lg:h-[calc(100vh-4.5rem)] lg:min-h-[640px] lg:grid-cols-[minmax(0,1fr)_380px] lg:pb-4">
        {/* langkah 1 dan 2: foto dan detektor */}
        <section className={cn('flex min-h-0 min-w-0 flex-col gap-4 rounded-2xl border border-line bg-surface p-4', seret && 'outline-2 outline-offset-2 outline-ring outline-dashed')}>
          <div className="flex min-w-0 flex-col gap-2 xl:flex-row xl:items-center xl:gap-4">
            <Langkah no={1}>Pilih foto</Langkah>
            <div className="min-w-0 flex-1">
              <Filmstrip
                daftar={strip}
                aktif={gambar?.nama ?? null}
                onPilih={pilihContoh}
                onUnggah={(f) => pilihBlob(f, f.name)}
                onAcak={contoh.length > 8 ? () => setStrip(acak(contoh, 8)) : undefined}
              />
            </div>
          </div>

          <Stage
            gambar={gambar}
            hasil={hasil}
            kelompok={kelompok}
            tab={tab}
            mode={tampil}
            pratinjau={pratinjau !== null && pratinjau !== mode}
            memuat={memuat}
            sorot={sorot}
            sorotOrang={sorotOrang}
            isi={lebar}
          />

          <div className="space-y-2">
            <Langkah no={2} kanan={<span className="hidden text-xs text-ink-3 sm:inline">Arahkan kursor untuk pratinjau, klik untuk memilih</span>}>
              Pilih detektor
            </Langkah>
            <DetectorPicker
              nilai={mode}
              onPilih={(m) => {
                setMode(m)
                setPratinjau(null)
              }}
              onPratinjau={setPratinjau}
              terkunci={terkunci}
              alasanKunci="Detektor ini hanya mengenal 17 jenis benda yang sudah diajarkan"
              ringkas={ringkas}
            />
          </div>
        </section>

        {/* langkah 3: hasil */}
        <aside className="min-h-0 min-w-0 space-y-3 rounded-2xl border border-line bg-surface p-4 lg:overflow-y-auto" aria-live="polite">
          <Langkah no={3}>{TAB.find((t) => t.id === tab)!.langkah3}</Langkah>
          {hasil && models ? (
            tab === 'deteksi' ? (
              <PanelDeteksi mode={tampil} hasil={hasil} kelompok={kelompok} sorot={sorot} onSorot={setSorot} onMode={setMode} />
            ) : tab === 'kepatuhan' ? (
              <PanelKepatuhan mode={tampil} hasil={hasil} sorotOrang={sorotOrang} onSorotOrang={setSorotOrang} onMode={setMode} />
            ) : (
              <PanelBaru hasil={hasil} kelompok={kelompok} aktif={models.prompt_baru}>
                <PromptEditor key={models.prompt_baru.join('|')} aktif={models.prompt_baru} maks={10} sibuk={promptSibuk} onTerapkan={terapkanPrompt} />
              </PanelBaru>
            )
          ) : (
            <div className="space-y-2" aria-label="Memuat hasil">
              <div className="h-8 w-3/4 rounded-lg bg-row" />
              <div className="h-24 rounded-xl bg-row" />
            </div>
          )}
        </aside>
      </main>

      <Story mode={mode} onMode={setMode} hasil={hasil} models={models} sorot={sorot} onSorot={setSorot} />

      <footer className="mx-auto max-w-[1440px] border-t border-line px-4 py-8 text-xs leading-relaxed text-ink-3 sm:px-6">
        <p>
          <span className="font-semibold text-ink-2">Sorot</span> adalah prototipe skripsi S1 Informatika Universitas Mulawarman tentang
          kebutuhan data berlabel pada deteksi alat pelindung diri. Foto contoh di atas adalah foto uji Construction-PPE yang
          tidak pernah dipakai melatih detektor.
        </p>
        <p className="mt-1">Hanya untuk keperluan akademik. Ultralytics berlisensi AGPL-3.0, dataset SH17 berlisensi CC BY-NC-SA 4.0.</p>
      </footer>
    </div>
  )
}
