import { useRef } from 'react'
import { ImagePlus, Shuffle } from 'lucide-react'

import { api } from '@/lib/api'
import { namaFoto } from '@/lib/mode'
import { cn } from '@/lib/utils'

interface Props {
  daftar: string[]
  aktif: string | null
  onPilih: (nama: string) => void
  onUnggah: (f: File) => void
  onAcak?: () => void
}

// Deretan foto uji Construction-PPE (tidak pernah dipakai melatih model) plus tombol unggah.
export function Filmstrip({ daftar, aktif, onPilih, onUnggah, onAcak }: Props) {
  const input = useRef<HTMLInputElement>(null)
  return (
    <div className="flex items-center gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="Pilih foto">
      <button
        onClick={() => input.current?.click()}
        className="flex h-14 shrink-0 items-center gap-2 rounded-xl border border-dashed border-ink-3 bg-surface px-3 text-sm font-medium text-ink-2 hover:border-ink hover:text-ink"
      >
        <ImagePlus className="size-4" aria-hidden />
        Unggah foto
      </button>
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) onUnggah(f)
          e.target.value = ''
        }}
      />
      {daftar.map((n) => (
        <button
          key={n}
          onClick={() => onPilih(n)}
          title={namaFoto(n)}
          aria-label={`Pakai foto: ${namaFoto(n)}`}
          aria-pressed={aktif === n}
          className={cn(
            'relative h-14 w-20 shrink-0 overflow-hidden rounded-xl ring-offset-2 ring-offset-page transition-shadow',
            aktif === n ? 'ring-2 ring-ink' : 'opacity-80 hover:opacity-100 hover:ring-1 hover:ring-ink-3',
          )}
        >
          <img src={api.sampleUrl(n)} alt="" loading="lazy" className="h-full w-full object-cover" />
        </button>
      ))}
      {onAcak && (
        <button onClick={onAcak} className="flex h-14 shrink-0 items-center gap-1.5 rounded-xl px-3 text-sm text-ink-2 hover:bg-surface hover:text-ink" aria-label="Tampilkan foto lain">
          <Shuffle className="size-4" aria-hidden />
          Foto lain
        </button>
      )}
    </div>
  )
}
