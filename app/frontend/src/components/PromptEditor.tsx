import { useState } from 'react'
import { X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface Props {
  aktif: string[] // prompt baru yang sedang dipakai backend
  maks: number
  sibuk: boolean
  onTerapkan: (kelas: string[]) => void
}

const SARAN = ['ladder', 'traffic cone', 'safety harness', 'excavator', 'fire extinguisher']

export function PromptEditor({ aktif, maks, sibuk, onTerapkan }: Props) {
  const [draf, setDraf] = useState<string[]>(aktif)
  const [teks, setTeks] = useState('')
  const berubah = draf.join('|') !== aktif.join('|')

  const tambah = (t: string) => {
    const bersih = t.trim().toLowerCase().replace(/\s+/g, ' ')
    if (bersih && !draf.includes(bersih) && draf.length < maks) setDraf([...draf, bersih])
    setTeks('')
  }

  return (
    <div className="space-y-3">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          tambah(teks)
        }}
      >
        <label htmlFor="prompt-baru" className="sr-only">
          Nama kelas baru
        </label>
        <Input id="prompt-baru" value={teks} onChange={(e) => setTeks(e.target.value)} placeholder="misalnya safety harness" maxLength={40} className="bg-white" />
        <Button type="submit" variant="outline" disabled={!teks.trim() || draf.length >= maks}>
          Tambah
        </Button>
      </form>

      {draf.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5" aria-label="Kelas baru">
          {draf.map((k) => (
            <li key={k} className="flex items-center gap-1 rounded-md border border-dashed border-[var(--grp-baru)] bg-white py-0.5 pr-1 pl-2 text-sm">
              {k}
              <button type="button" onClick={() => setDraf(draf.filter((x) => x !== k))} className="rounded p-0.5 text-ink-3 hover:bg-muted hover:text-ink" aria-label={`Hapus ${k}`}>
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="flex flex-wrap items-center gap-1.5 text-xs text-ink-3">
          Contoh:
          {SARAN.map((s) => (
            <button key={s} type="button" onClick={() => tambah(s)} className="rounded border border-rule bg-white px-1.5 py-0.5 text-ink-2 hover:border-ink-3 hover:text-ink">
              {s}
            </button>
          ))}
        </p>
      )}

      <div className="flex items-center gap-3">
        <Button onClick={() => onTerapkan(draf)} disabled={!berubah || sibuk} size="sm">
          {sibuk ? 'Mencari…' : 'Cari di foto'}
        </Button>
        {berubah && <span className="text-xs text-ink-3">Belum diterapkan</span>}
      </div>
    </div>
  )
}
