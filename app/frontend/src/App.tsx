import { useCallback, useEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'

import { Filmstrip } from '@/components/Filmstrip'
import { type Gambar, type Tampilan } from '@/components/PhotoOverlay'
import { PromptEditor } from '@/components/PromptEditor'
import { PanelBaru, PanelDeteksi, PanelKepatuhan } from '@/components/SidePanels'
import { Stage } from '@/components/Stage'
import { Story } from '@/components/Story'
import { api, MODE_ORDER, type DetectResponse, type ModeId, type ModelsResponse } from '@/lib/api'
import { cn } from '@/lib/utils'

// Foto demo tetap di depan, satu untuk tiap langkah skenario demo (lihat app/README.md):
// image1003 pekerja lengkap APD, image548 helm yang gagal dikenali YOLO26 lintas dataset, image58 tangga.
const FOTO_DEMO = ['image1003.jpg', 'image548.jpg', 'image58.jpeg']
const JEDA_PUTAR = 1600 // ms per langkah saat tombol Putar ditekan

const TAB: { id: Tampilan; label: string }[] = [
  { id: 'deteksi', label: 'Deteksi APD' },
  { id: 'kepatuhan', label: 'Cek kepatuhan' },
  { id: 'baru', label: 'Cari benda baru' },
]

// Ukuran foto dibaca dengan createImageBitmap, bukan img.decode(): decode() bisa ditunda browser saat tab
// tidak terlihat, sehingga deteksi pertama sempat baru jalan belasan detik setelah halaman dibuka.
async function muatGambar(blob: Blob, nama: string): Promise<Gambar> {
  const bmp = await createImageBitmap(blob) // orientasi EXIF diterapkan, sama seperti cv2.imdecode di backend
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
    <span className="flex items-center gap-2.5">
      <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden>
        <path d="M3 10V3h7M25 18v7h-7" fill="none" stroke="var(--ink)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="14" cy="14" r="4.5" fill="var(--hivis)" />
      </svg>
      <span className="font-display text-[22px] leading-none font-bold">Sorot</span>
    </span>
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
  const [banding, setBanding] = useState(false)
  const [putar, setPutar] = useState(false)
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
        setStrip([...depan, ...acak(gambar.filter((g) => !depan.includes(g)), 9 - depan.length)])
      })
      .catch(() => {})
  }, [])

  // Satu permintaan per foto mengambil hasil keempat model sekaligus, termasuk kepatuhan, sehingga
  // menggeser jumlah foto berlabel dan berpindah tab terasa instan.
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

  // Tombol Putar: model "belajar" dari 0 sampai 4.986 foto berlabel, satu langkah tiap 1,6 detik.
  useEffect(() => {
    if (!putar) return
    const t = setInterval(() => {
      setMode((m) => {
        const i = MODE_ORDER.indexOf(m)
        if (i >= MODE_ORDER.length - 1) {
          setPutar(false)
          return m
        }
        return MODE_ORDER[i + 1]
      })
    }, JEDA_PUTAR)
    return () => clearInterval(t)
  }, [putar])

  const mulaiPutar = (v: boolean) => {
    if (v && mode === 'full') setMode('zs')
    setPutar(v)
  }
  const pilihMode = (m: ModeId) => {
    setPutar(false)
    setMode(m)
  }
  const gantiTab = (t: Tampilan) => {
    setTab(t)
    setPutar(false)
    setSorot(null)
    setSorotOrang(null)
    if (t === 'baru') {
      setMode('zs') // hanya model tanpa label yang bisa mencari benda baru
      setBanding(false)
    }
  }
  const aturBanding = (v: boolean) => {
    setPutar(false)
    setBanding(v)
    if (v && mode === 'zs') setMode('full')
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

  const terkunci: ModeId[] = tab === 'baru' ? ['lp10', 'lp30', 'full'] : []

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
      {/* bilah atas */}
      <header className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-x-6 gap-y-3 px-4 pt-4 pb-3 sm:px-6 lg:h-16 lg:flex-nowrap lg:py-0">
        <Logo />
        <p className="hidden min-w-0 truncate text-sm text-ink-2 xl:block">Berapa foto berlabel yang dibutuhkan untuk mengenali APD?</p>
        <nav role="tablist" aria-label="Tugas" className="order-last flex w-full rounded-xl bg-surface p-1 lg:order-none lg:ml-auto lg:w-auto">
          {TAB.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => gantiTab(t.id)}
              className={cn('relative flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-colors lg:flex-none lg:px-4', tab === t.id ? 'text-white' : 'text-ink-2 hover:text-ink')}
            >
              {tab === t.id && <motion.span layoutId="tab-aktif" className="absolute inset-0 rounded-lg bg-ink" transition={{ type: 'spring', stiffness: 420, damping: 36 }} />}
              <span className="relative">{t.label}</span>
            </button>
          ))}
        </nav>
      </header>

      {galat && (
        <p role="alert" className="mx-auto mb-3 max-w-[1440px] px-4 text-sm text-bad sm:px-6">
          {galat}
        </p>
      )}

      {/* layar utama: muat dalam satu layar laptop */}
      <main className="mx-auto grid max-w-[1440px] grid-cols-[minmax(0,1fr)] gap-5 px-4 sm:px-6 lg:h-[calc(100vh-4.5rem)] lg:min-h-[600px] lg:grid-cols-[minmax(0,1fr)_400px] lg:pb-4">
        <div className={cn('flex min-h-0 min-w-0 flex-col gap-3', seret && 'rounded-2xl outline-2 outline-offset-4 outline-ring outline-dashed')}>
          <div className={cn('min-h-0', lebar && 'flex-1')}>
            <Stage
              gambar={gambar}
              hasil={hasil}
              kelompok={models?.kelompok_kelas ?? {}}
              tab={tab}
              mode={mode}
              onMode={pilihMode}
              terkunci={terkunci}
              memuat={memuat}
              sorot={sorot}
              sorotOrang={sorotOrang}
              banding={banding}
              onBanding={aturBanding}
              putar={putar}
              onPutar={mulaiPutar}
              isi={lebar}
            />
          </div>
          <Filmstrip
            daftar={strip}
            aktif={gambar?.nama ?? null}
            onPilih={pilihContoh}
            onUnggah={(f) => pilihBlob(f, f.name)}
            onAcak={contoh.length > 9 ? () => setStrip(acak(contoh, 9)) : undefined}
          />
        </div>

        <aside className="min-h-0 min-w-0 pb-2 lg:overflow-y-auto lg:pr-1" aria-live="polite">
          {hasil && models ? (
            tab === 'deteksi' ? (
              <PanelDeteksi
                mode={mode}
                pembanding={banding ? 'zs' : undefined}
                hasil={hasil}
                kelompok={models.kelompok_kelas}
                sorot={sorot}
                onSorot={setSorot}
                onMode={pilihMode}
              />
            ) : tab === 'kepatuhan' ? (
              <PanelKepatuhan mode={mode} hasil={hasil} sorotOrang={sorotOrang} onSorotOrang={setSorotOrang} onMode={pilihMode} />
            ) : (
              <PanelBaru hasil={hasil} kelompok={models.kelompok_kelas} aktif={models.prompt_baru}>
                <PromptEditor key={models.prompt_baru.join('|')} aktif={models.prompt_baru} maks={10} sibuk={promptSibuk} onTerapkan={terapkanPrompt} />
              </PanelBaru>
            )
          ) : (
            <div className="space-y-3" aria-label="Memuat hasil">
              <div className="h-11 w-2/3 rounded-lg bg-surface" />
              <div className="grid grid-cols-2 gap-2">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="h-16 rounded-xl bg-surface" />
                ))}
              </div>
            </div>
          )}
        </aside>
      </main>

      <Story mode={mode} onMode={pilihMode} hasil={hasil} models={models} sorot={sorot} onSorot={setSorot} />

      <footer className="mx-auto max-w-[1440px] border-t border-line px-4 py-8 text-xs leading-relaxed text-ink-3 sm:px-6">
        <p>
          <span className="font-semibold text-ink-2">Sorot</span> adalah prototipe skripsi S1 Informatika Universitas Mulawarman tentang
          kebutuhan data berlabel pada deteksi alat pelindung diri. Bobot yang dimuat adalah ulangan pertama (seed 0); waktu per foto
          diukur langsung di laptop ini.
        </p>
        <p className="mt-1">Hanya untuk keperluan akademik. Ultralytics berlisensi AGPL-3.0, dataset SH17 berlisensi CC BY-NC-SA 4.0.</p>
      </footer>
    </div>
  )
}
