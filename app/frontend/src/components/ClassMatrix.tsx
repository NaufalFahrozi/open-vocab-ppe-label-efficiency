import { MODE_ORDER, type DetectResponse, type ModeId, type ModelsResponse } from '@/lib/api'
import { kelompokDari, namaTampil, WARNA_KELOMPOK, type Kelompok } from '@/lib/kelas'
import { cn } from '@/lib/utils'

// Matriks kelas x mode: berapa objek tiap kelas yang dilihat tiap mode pada foto ini.
// Menyorot satu baris menyalakan kotak kelas itu di keempat panel.

interface Props {
  hasil: DetectResponse
  modes: ModelsResponse['modes']
  kelompok: Record<string, string[]>
  sorot: string | null
  onSorot: (k: string | null) => void
}

const URUT: Kelompok[] = ['APD', 'Bagian tubuh', 'Lainnya', 'Kelas baru']

export function ClassMatrix({ hasil, modes, kelompok, sorot, onSorot }: Props) {
  const semua = new Set<string>()
  for (const m of MODE_ORDER) modes[m]?.kelas.forEach((k) => semua.add(k))

  const baris = URUT.map((g) => ({
    g,
    kelas: [...semua].filter((k) => kelompokDari(k, kelompok) === g),
  })).filter((b) => b.kelas.length)

  const sel = (m: ModeId, k: string) => {
    const d = hasil.hasil[m]?.deteksi.filter((x) => x.kelas === k) ?? []
    return { n: d.length, maks: d.length ? Math.max(...d.map((x) => x.skor)) : 0, dikenal: modes[m]?.kelas.includes(k) }
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-rule bg-sheet">
      <table className="w-full min-w-[560px] border-collapse text-sm" onMouseLeave={() => onSorot(null)}>
        <caption className="px-3 pt-3 pb-2 text-left text-xs text-ink-2">
          Jumlah objek per kelas yang terdeteksi pada foto ini, dengan skor tertinggi di sebelahnya. Arahkan kursor ke satu
          baris untuk menyorot kelas itu di semua panel.
        </caption>
        <thead>
          <tr className="border-y border-rule text-left text-xs text-ink-2">
            <th scope="col" className="px-3 py-2 font-medium">
              Kelas
            </th>
            {MODE_ORDER.map((m) => (
              <th key={m} scope="col" className="px-3 py-2 text-right font-medium">
                {modes[m]?.label}
              </th>
            ))}
          </tr>
        </thead>
        {baris.map(({ g, kelas }) => (
          <tbody key={g}>
            <tr>
              <th colSpan={5} scope="rowgroup" className="px-3 pt-3 pb-1 text-left text-xs font-semibold">
                <span className="mr-2 inline-block size-2.5 rounded-sm align-middle" style={{ background: WARNA_KELOMPOK[g] }} aria-hidden />
                {g}
              </th>
            </tr>
            {kelas.map((k) => (
              <tr
                key={k}
                onMouseEnter={() => onSorot(k)}
                onFocus={() => onSorot(k)}
                tabIndex={0}
                className={cn('border-t border-rule/60 outline-none', sorot === k ? 'bg-row' : 'hover:bg-row/60')}
              >
                <th scope="row" className="px-3 py-1.5 text-left font-normal">
                  {namaTampil(k)}
                  {namaTampil(k) !== k && <span className="ml-1.5 text-xs text-ink-3">{k}</span>}
                </th>
                {MODE_ORDER.map((m) => {
                  const { n, maks, dikenal } = sel(m, k)
                  return (
                    <td key={m} className="px-3 py-1.5 text-right">
                      {!dikenal ? (
                        <span className="text-xs text-ink-3" title="Model ini tidak mengenal kelas tersebut">
                          tidak dikenal
                        </span>
                      ) : n ? (
                        <>
                          <b className="font-semibold">{n}</b>
                          <span className="ml-1.5 text-xs text-ink-3">{Math.round(maks * 100)}</span>
                        </>
                      ) : (
                        <span className="text-ink-3">0</span>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        ))}
      </table>
    </div>
  )
}
