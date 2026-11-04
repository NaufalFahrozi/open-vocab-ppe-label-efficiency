import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronDown, ImageUp, LayoutGrid, Square } from 'lucide-react'

import { ClassMatrix } from '@/components/ClassMatrix'
import { LabelRuler } from '@/components/LabelRuler'
import { LabelStepper } from '@/components/LabelStepper'
import { PhotoOverlay, type Gambar, type Tampilan } from '@/components/PhotoOverlay'
import { PromptEditor } from '@/components/PromptEditor'
import { PanelBaru, PanelDeteksi, PanelKepatuhan } from '@/components/SidePanels'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { api, MODE_ORDER, type DetectResponse, type ModeId, type ModelsResponse } from '@/lib/api'
import { fmtID } from '@/lib/kurva'
import { MODE_AWAM } from '@/lib/mode'
import { cn } from '@/lib/utils'

// Foto demo tetap di depan, satu untuk tiap langkah skenario demo (lihat app/README.md):
// image1003 pekerja lengkap APD, image548 helm yang gagal dikenali YOLO26 lintas dataset, image58 tangga.
const FOTO_DEMO = ['image1003.jpg', 'image548.jpg', 'image58.jpeg']

const TAB: { id: Tampilan; label: string }[] = [
  { id: 'deteksi', label: 'Deteksi APD' },
  { id: 'kepatuhan', label: 'Cek kepatuhan' },
  { id: 'baru', label: 'Tambah jenis APD' },
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

function useLebar<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [w, setW] = useState(0)
  useEffect(() => {
    if (!ref.current) return
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width))
    ro.observe(ref.current)
    return () => ro.disconnect()
  }, [])
  return [ref, w] as const
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
  const [berdampingan, setBerdampingan] = useState(false)
  const [sorot, setSorot] = useState<string | null>(null)
  const [sorotOrang, setSorotOrang] = useState<number | null>(null)
  const [conf, setConf] = useState(0.25)
  const [confGeser, setConfGeser] = useState(0.25)
  const [promptSibuk, setPromptSibuk] = useState(false)
  const [seret, setSeret] = useState(false)
  const [kurvaRef, lebarKurva] = useLebar<HTMLDivElement>()
  const abort = useRef<AbortController | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

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
      setHasil(await api.detect(gambar.blob, { modes, conf, kepatuhan: true, ambang: models.ambang_pelanggaran }, ac.signal))
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setGalat(`Deteksi gagal: ${(e as Error).message}`)
    } finally {
      if (abort.current === ac) setMemuat(false)
    }
  }, [gambar, models, conf])

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
      setGalat('Gambar tidak bisa dibuka oleh browser.')
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
    if (t === 'baru') setMode('zs') // hanya model tanpa label yang bisa mencari jenis baru
  }

  const terapkanPrompt = async (kelas: string[]) => {
    setPromptSibuk(true)
    try {
      await api.setPrompts(kelas)
      setModels(await api.models())
    } catch (e) {
      setGalat(`Jenis baru gagal diterapkan: ${(e as Error).message}`)
    } finally {
      setPromptSibuk(false)
    }
  }

  const terkunci: ModeId[] = tab === 'baru' ? ['lp10', 'lp30', 'full'] : []

  return (
    <div
      className="min-h-screen"
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
      <div className="mx-auto max-w-[1360px] px-4 pt-6 pb-16 sm:px-8">
        <header className="max-w-3xl">
          <h1 className="font-wide text-2xl leading-tight font-semibold">Deteksi APD dengan sedikit foto berlabel</h1>
          <p className="mt-1 text-[15px] text-ink-2">Pilih foto pekerja, ubah jumlah foto berlabel, lalu lihat apa yang berubah.</p>
        </header>

        <nav role="tablist" aria-label="Tugas" className="mt-4 flex gap-1 border-b border-rule">
          {TAB.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => gantiTab(t.id)}
              className={cn(
                '-mb-px border-b-2 px-3 py-2.5 text-sm font-medium transition-colors sm:px-4',
                tab === t.id ? 'border-ink text-ink' : 'border-transparent text-ink-2 hover:text-ink',
              )}
            >
              {t.label}
            </button>
          ))}
        </nav>

        {galat && (
          <p role="alert" className="mt-4 rounded-md border border-bad/40 bg-white px-3 py-2 text-sm text-bad">
            {galat}
          </p>
        )}

        {/* Urutan di layar sempit: foto, hasil, ganti foto. Di layar lebar hasil pindah ke kolom kanan. */}
        <div className="mt-4 grid gap-x-8 gap-y-6 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className={cn('min-w-0 rounded-lg border border-rule bg-sheet p-3 sm:p-4 lg:col-start-1 lg:row-start-1', seret && 'outline-2 outline-offset-2 outline-ring outline-dashed')}>
              {/* Kontrol utama diletakkan DI ATAS foto supaya selalu terlihat tanpa scroll di layar laptop
                  (1536 x 760 px): sebelumnya penggeser berada di bawah foto dan jatuh di luar layar. */}
              <div className="mb-4 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium">Berapa foto berlabel yang dipakai untuk melatih model?</p>
                  <p className="mt-0.5 text-xs text-ink-3">
                    Foto berlabel adalah foto yang setiap helm, rompi, dan benda lainnya sudah ditandai kotak satu per satu oleh
                    manusia. Pekerjaan ini lama, jadi makin sedikit makin hemat.
                  </p>
                </div>
                <div className="flex shrink-0 rounded-md border border-rule bg-white p-0.5" role="group" aria-label="Tampilan foto">
                  {[
                    { v: false, Ikon: Square, t: 'Satu model' },
                    { v: true, Ikon: LayoutGrid, t: 'Berdampingan' },
                  ].map(({ v, Ikon, t }) => (
                    <button
                      key={t}
                      onClick={() => setBerdampingan(v)}
                      aria-pressed={berdampingan === v}
                      className={cn('flex items-center gap-1.5 rounded px-2 py-1 text-xs', berdampingan === v ? 'bg-ink text-white' : 'text-ink-2 hover:text-ink')}
                    >
                      <Ikon className="size-3.5" aria-hidden />
                      <span className="hidden sm:inline">{t}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="mb-4 px-1">
                <LabelStepper nilai={mode} onPilih={setMode} terkunci={terkunci} alasanKunci="Model ini hanya mengenal 17 jenis objek yang dilatihkan" />
              </div>

              {!gambar || !models ? (
                <div className="grid aspect-[4/3] place-items-center rounded-md bg-plate text-sm text-ink-3">Memuat foto dan model…</div>
              ) : berdampingan ? (
                <div className="grid grid-cols-2 gap-3">
                  {MODE_ORDER.map((m) => (
                    <button
                      key={m}
                      onClick={() => {
                        if (terkunci.includes(m)) return
                        setMode(m)
                        setBerdampingan(false)
                      }}
                      className={cn('rounded-md p-1 text-left', m === mode ? 'ring-2 ring-ink' : 'hover:ring-1 hover:ring-ink-3', terkunci.includes(m) && 'opacity-40')}
                      aria-label={`Tampilkan ${MODE_AWAM[m].judul}`}
                    >
                      <PhotoOverlay gambar={gambar} hasil={hasil?.hasil[m]} tampilan={tab} kelompok={models.kelompok_kelas} sorot={sorot} memuat={memuat} kecil />
                      <span className="mt-1.5 block px-1 text-xs font-medium">{MODE_AWAM[m].judul}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <PhotoOverlay
                  gambar={gambar}
                  hasil={hasil?.hasil[mode]}
                  tampilan={tab}
                  kelompok={models.kelompok_kelas}
                  sorot={sorot}
                  sorotOrang={sorotOrang}
                  memuat={memuat}
                  className="mx-auto"
                  // Tinggi foto mengikuti sisa layar, supaya judul, tab, penggeser, dan foto muat dalam satu layar.
                  style={{ width: `min(100%, calc(max(240px, 100vh - 340px) * ${gambar.lebar / gambar.tinggi}))` }}
                />
              )}
            </div>

            {/* ganti foto */}
            <section aria-labelledby="judul-foto" className="order-3 min-w-0 lg:order-none lg:col-start-1 lg:row-start-2">
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                <h2 id="judul-foto" className="text-sm font-medium">
                  Ganti foto
                </h2>
                <p className="text-xs text-ink-3">Foto uji Construction-PPE, tidak pernah dipakai untuk melatih model</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button onClick={() => fileInput.current?.click()} size="sm" variant="outline" className="bg-white">
                  <ImageUp aria-hidden /> Unggah foto
                </Button>
                <input
                  ref={fileInput}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) pilihBlob(f, f.name)
                    e.target.value = ''
                  }}
                />
                {strip.map((n) => (
                  <button
                    key={n}
                    onClick={() => pilihContoh(n)}
                    className={cn('h-12 w-16 shrink-0 overflow-hidden rounded border-2 bg-plate', gambar?.nama === n ? 'border-ink' : 'border-transparent hover:border-ink-3')}
                    aria-label={`Pakai foto ${n}`}
                    aria-pressed={gambar?.nama === n}
                  >
                    <img src={api.sampleUrl(n)} alt="" loading="lazy" className="h-full w-full object-cover" />
                  </button>
                ))}
                {contoh.length > 9 && (
                  <Button variant="ghost" size="sm" onClick={() => setStrip(acak(contoh, 9))}>
                    Foto lain
                  </Button>
                )}
              </div>
              <details className="mt-3 text-sm">
                <summary className="cursor-pointer text-ink-2 select-none hover:text-ink">Pengaturan tampilan</summary>
                <div className="mt-3 flex max-w-md items-center gap-3">
                  <Label htmlFor="conf" className="shrink-0 text-sm font-normal">
                    Keyakinan minimal
                  </Label>
                  <Slider
                    id="conf"
                    min={0.05}
                    max={0.9}
                    step={0.05}
                    value={[confGeser]}
                    onValueChange={([v]) => setConfGeser(v)}
                    onValueCommit={([v]) => setConf(v)}
                    aria-label="Keyakinan minimal"
                  />
                  <span className="w-10 text-right text-sm font-semibold">{Math.round(confGeser * 100)}%</span>
                </div>
              </details>
            </section>

          {/* kanan: penjelasan bahasa awam */}
          <aside className="order-2 min-w-0 lg:sticky lg:top-6 lg:order-none lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-start" aria-live="polite">
            {hasil && models ? (
              tab === 'deteksi' ? (
                <PanelDeteksi mode={mode} hasil={hasil} kelompok={models.kelompok_kelas} sorot={sorot} onSorot={setSorot} onPilihMode={setMode} />
              ) : tab === 'kepatuhan' ? (
                <PanelKepatuhan mode={mode} hasil={hasil} sorotOrang={sorotOrang} onSorotOrang={setSorotOrang} onPilihMode={setMode} />
              ) : (
                <PanelBaru hasil={hasil} kelompok={models.kelompok_kelas} aktif={models.prompt_baru}>
                  <PromptEditor key={models.prompt_baru.join('|')} aktif={models.prompt_baru} maks={10} sibuk={promptSibuk} onTerapkan={terapkanPrompt} />
                </PanelBaru>
              )
            ) : (
              <p className="text-sm text-ink-3">Hasil akan muncul di sini setelah foto diperiksa.</p>
            )}
          </aside>
        </div>

        {/* penjelasan teknis, untuk yang ingin tahu kenapa */}
        <section className="mt-16 border-t border-rule pt-8" aria-labelledby="judul-kenapa">
          <h2 id="judul-kenapa" className="text-xl font-semibold">
            Kenapa jumlah foto berlabel penting
          </h2>
          <div className="mt-3 max-w-3xl space-y-2 text-[15px] leading-relaxed text-ink-2">
            <p>
              Melabeli foto, yaitu menggambar kotak di sekitar setiap helm, rompi, dan sarung tangan, memakan waktu lama.
              Penelitian ini mengukur berapa banyak label yang sebenarnya dibutuhkan.
            </p>
            <p>
              Tanpa satu pun foto berlabel, model sudah mencapai mAP50 {fmtID(38.4)}. Dengan sedikit foto berlabel,
              model yang sama lebih unggul daripada detektor biasa. Detektor biasa baru menyusul setelah diberi antara 109
              dan 338 foto berlabel, dan mencapai {fmtID(61.0)} dengan seluruh 4.986 foto.
            </p>
          </div>
          <div ref={kurvaRef} className="mt-6 max-w-4xl">
            <LabelRuler width={lebarKurva} columns={1} gap={0} aktif={mode} onHover={() => {}} />
            <p className="mt-2 text-xs text-ink-3">
              Akurasi = mAP50 pada data uji SH17 (1.620 foto), rata-rata 5 ulangan untuk model dengan sedikit label.
              Lingkaran besar adalah empat model yang bisa dicoba di atas.
            </p>
          </div>

          {hasil && models && (
            <details className="group mt-8">
              <summary className="flex cursor-pointer items-center gap-1.5 text-sm font-medium select-none">
                <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden />
                Rincian per jenis objek untuk keempat model pada foto ini
              </summary>
              <div className="mt-3">
                <ClassMatrix hasil={hasil} modes={models.modes} kelompok={models.kelompok_kelas} sorot={sorot} onSorot={setSorot} />
              </div>
            </details>
          )}
        </section>

        <footer className="mt-12 max-w-3xl space-y-1 text-xs text-ink-3">
          <p>Bobot yang dimuat adalah ulangan pertama (seed 0). Waktu per foto diukur langsung di laptop ini.</p>
          <p>Prototipe skripsi untuk keperluan akademik. Ultralytics berlisensi AGPL-3.0, dataset SH17 berlisensi CC BY-NC-SA 4.0.</p>
        </footer>
      </div>
    </div>
  )
}
