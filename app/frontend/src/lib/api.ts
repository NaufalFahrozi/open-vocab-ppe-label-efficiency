// Tipe dan pemanggil API backend (app/backend/main.py).

export type ModeId = 'zs' | 'lp10' | 'lp30' | 'full'
export const MODE_ORDER: ModeId[] = ['zs', 'lp10', 'lp30', 'full']

export interface ModeInfo {
  label: string
  keterangan: string
  label_per_kelas: number | null
  map50: number
  termuat: boolean
  error: string | null
  kelas: string[]
}

export interface ModelsResponse {
  modes: Record<ModeId, ModeInfo>
  kelompok_kelas: Record<string, string[]>
  conf_tampil: number
  prompt_baru: string[]
  ambang_pelanggaran: number
}

export interface Deteksi {
  kelas: string
  id: number
  skor: number
  box: [number, number, number, number]
}

export interface KepalaItem {
  box: number[]
  skor_kepala: number
  skor_helm: number
  skor_pelanggaran: number
  tanpa_helm: boolean
}

export interface TanganItem {
  box: number[]
  skor_tangan: number
  skor_sarung_tangan: number
  skor_pelanggaran: number
  tanpa_sarung_tangan: boolean
}

export type Status = 'patuh' | 'tidak patuh' | 'tidak diketahui'

export interface Orang {
  box: number[]
  skor: number
  status: Status
  helm: 'ya' | 'tidak' | 'tidak terlihat'
  sarung_tangan: 'ya' | 'tidak' | 'tidak terlihat'
  kepala: KepalaItem[]
  tangan: TanganItem[]
}

export interface Kepatuhan {
  orang: Orang[]
  lepas: { kepala: KepalaItem[]; tangan: TanganItem[] }
  ringkasan: Record<Status | 'kepala_tanpa_helm_lepas' | 'tangan_telanjang_lepas', number>
  ambang: { pelanggaran: number; kepala_orang: number; tangan_orang: number }
}

export interface HasilMode {
  deteksi: Deteksi[]
  ms_model: number
  ms_total: number
  kepatuhan?: Kepatuhan
}

export interface DetectResponse {
  lebar: number
  tinggi: number
  conf: number
  hasil: Partial<Record<ModeId, HasilMode>>
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let pesan = `${res.status} ${res.statusText}`
    try {
      const body = await res.json()
      if (body?.detail) pesan = typeof body.detail === 'string' ? body.detail : JSON.stringify(body.detail)
    } catch {
      /* respons bukan JSON */
    }
    throw new Error(pesan)
  }
  return res.json() as Promise<T>
}

export const api = {
  models: () => fetch('/api/models').then((r) => json<ModelsResponse>(r)),
  samples: () => fetch('/api/samples').then((r) => json<{ gambar: string[] }>(r)),
  sampleUrl: (nama: string) => `/api/samples/${encodeURIComponent(nama)}`,
  detect: (file: Blob, opts: { modes: ModeId[]; conf: number; kepatuhan: boolean; ambang: number }, signal?: AbortSignal) => {
    const fd = new FormData()
    fd.append('file', file, 'gambar')
    fd.append('modes', opts.modes.join(','))
    fd.append('conf', String(opts.conf))
    fd.append('kepatuhan', String(opts.kepatuhan))
    fd.append('ambang', String(opts.ambang))
    return fetch('/api/detect', { method: 'POST', body: fd, signal }).then((r) => json<DetectResponse>(r))
  },
  setPrompts: (kelas: string[]) =>
    fetch('/api/prompts', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kelas }),
    }).then((r) => json<{ prompt_baru: string[]; kelas_zs: string[]; ms_set_classes: number }>(r)),
}
