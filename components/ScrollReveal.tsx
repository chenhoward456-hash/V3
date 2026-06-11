'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(mq.matches)
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])
  return reduced
}

export default function ScrollReveal({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  const reducedMotion = usePrefersReducedMotion()

  useEffect(() => {
    if (reducedMotion) { setVisible(true); return }
    const el = ref.current
    if (!el) return
    // 已在（或接近）視窗內的區塊立刻顯示，避免首屏/慢速 JS 看到空白
    if (el.getBoundingClientRect().top < window.innerHeight) { setVisible(true); return }
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.unobserve(el) } },
      { threshold: 0.15 }
    )
    observer.observe(el)
    // 保險：observer 萬一沒觸發也不會永遠停在隱藏
    const fallback = setTimeout(() => setVisible(true), 1500)
    return () => { observer.disconnect(); clearTimeout(fallback) }
  }, [reducedMotion])

  return (
    <div
      ref={ref}
      style={reducedMotion ? undefined : {
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(24px)',
        transition: 'opacity 0.6s ease-out, transform 0.6s ease-out',
      }}
    >
      {children}
    </div>
  )
}
