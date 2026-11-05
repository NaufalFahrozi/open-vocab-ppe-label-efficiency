import { useState } from 'react'
import { Plus, Search, X } from 'lucide-react'

import { NAMA_ID } from '@/lib/kelas'

interface Props {
  aktif: string[] // kelas baru yang sedang dipakai backend
  maks: number
  sibuk: boolean
  onTerapkan: (kelas: string[]) => void
  kelasBawaan: string[] // 17 kelas SH17 yang sudah dikenal detektor
  bawaan: string[] // kelas bawaan yang sedang dicari pengguna
  onBawaan: (kelas: string[]) => void
}

// "gloves" atau "helm" sudah termasuk 17 kelas bawaan. Dulu nama seperti ini dibuang diam-diam oleh backend
// (supaya kelas tidak dobel), sehingga terlihat seperti tidak berfungsi. Sekarang dikenali di sini dan
// hasilnya diambil dari kelas bawaannya.
const norm = (s: string) => s.trim().toLowerCase().replace(/[-_\s]+/g, ' ')
function cocokBawaan(t: string, kelas: string[]) {
  const n = norm(t)
  return kelas.find((k) => norm(k) === n || norm(NAMA_ID[k] ?? '') === n || (k === 'ear-mufs' && n === 'earmuffs'))
}

// Contoh yang terbukti ditemukan di foto uji: tangga (image58), kerucut lalu lintas (image1145), botol dan
// gelas (image1306), kursi (image1231). safety harness sengaja ada untuk memperlihatkan salah deteksi (image169).
const SARAN = ['ladder', 'traffic cone', 'bottle', 'chair', 'safety harness']

export function PromptEditor({ aktif, maks, sibuk, onTerapkan, kelasBawaan, bawaan, onBawaan }: Props) {
  const [daftar, setDaftar] = useState<string[]>(aktif)
  const [teks, setTeks] = useState('')
  const berubah = daftar.join('|') !== aktif.join('|')

  const tambah = (t: string) => {
    const bersih = t.trim().toLowerCase().replace(/\s+/g, ' ')
    const k = cocokBawaan(bersih, kelasBawaan)
    if (k) {
      if (!bawaan.includes(k)) onBawaan([...bawaan, k])
    } else if (bersih && !daftar.includes(bersih) && daftar.length < maks) {
      const baru = [...daftar, bersih]
      setDaftar(baru)
      onTerapkan(baru) // langsung dicari, tanpa langkah "terapkan" yang membingungkan
    }
    setTeks('')
  }
  const hapus = (k: string) => {
    const baru = daftar.filter((x) => x !== k)
    setDaftar(baru)
    onTerapkan(baru)
  }

  return (
    <div className="space-y-3">
      <form
        className="flex items-center gap-2 rounded-xl border border-line bg-surface p-1.5 pl-3 focus-within:border-ink"
        onSubmit={(e) => {
          e.preventDefault()
          tambah(teks)
        }}
      >
        <Search className="size-4 shrink-0 text-ink-3" aria-hidden />
        <label htmlFor="prompt-baru" className="sr-only">
          Nama benda dalam bahasa Inggris
        </label>
        <input
          id="prompt-baru"
          value={teks}
          onChange={(e) => setTeks(e.target.value)}
          placeholder="misalnya ladder"
          maxLength={40}
          className="min-w-0 flex-1 bg-transparent py-1.5 text-[15px] outline-none placeholder:text-ink-3"
        />
        <button type="submit" disabled={!teks.trim() || daftar.length >= maks || sibuk} className="rounded-lg bg-ink px-3.5 py-2 text-sm font-semibold text-white disabled:opacity-40">
          {sibuk ? 'Mencari…' : 'Cari'}
        </button>
      </form>

      {daftar.length + bawaan.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label="Benda yang dicari">
          {bawaan.map((k) => (
            <li key={k} className="flex items-center gap-1 rounded-full border border-apd bg-surface py-1 pr-1 pl-3 text-sm" title="Sudah termasuk 17 jenis benda bawaan">
              {k}
              <button type="button" onClick={() => onBawaan(bawaan.filter((x) => x !== k))} className="rounded-full p-0.5 text-ink-3 hover:bg-row hover:text-ink" aria-label={`Hapus ${k}`}>
                <X className="size-3.5" />
              </button>
            </li>
          ))}
          {daftar.map((k) => (
            <li key={k} className="flex items-center gap-1 rounded-full border border-dashed border-baru bg-surface py-1 pr-1 pl-3 text-sm">
              {k}
              <button type="button" onClick={() => hapus(k)} className="rounded-full p-0.5 text-ink-3 hover:bg-row hover:text-ink" aria-label={`Hapus ${k}`}>
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-ink-3">Coba:</span>
        {SARAN.filter((s) => !daftar.includes(s)).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => tambah(s)}
            disabled={sibuk}
            className="inline-flex items-center gap-1 rounded-full border border-line bg-surface px-2.5 py-1 text-xs text-ink-2 hover:border-ink-3 hover:text-ink"
          >
            <Plus className="size-3" aria-hidden />
            {s}
          </button>
        ))}
      </div>
      {berubah && sibuk && <p className="text-xs text-ink-3">Menyiapkan model…</p>}
    </div>
  )
}
