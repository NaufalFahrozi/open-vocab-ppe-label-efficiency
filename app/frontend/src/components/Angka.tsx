import { useEffect, useRef } from 'react'
import { animate, useReducedMotion } from 'motion/react'

// Angka yang bergerak ke nilai baru, supaya perubahan antarmodel terasa, bukan sekadar berganti.
export function Angka({ nilai, className }: { nilai: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const lama = useRef(nilai)
  const diam = useReducedMotion()
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (diam) {
      el.textContent = String(nilai)
      lama.current = nilai
      return
    }
    const c = animate(lama.current, nilai, {
      duration: 0.5,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => (el.textContent = String(Math.round(v))),
    })
    lama.current = nilai
    return () => c.stop()
  }, [nilai, diam])
  return (
    <span ref={ref} className={className}>
      {nilai}
    </span>
  )
}
