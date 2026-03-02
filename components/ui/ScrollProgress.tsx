'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

export default function ScrollProgress() {
  const [scrollProgress, setScrollProgress] = useState(0)
  const rafRef = useRef<number>(0)

  const handleScroll = useCallback(() => {
    if (rafRef.current) return
    rafRef.current = requestAnimationFrame(() => {
      const scrollTop = window.scrollY
      const docHeight = document.documentElement.scrollHeight - window.innerHeight
      if (docHeight > 0) {
        setScrollProgress((scrollTop / docHeight) * 100)
      }
      rafRef.current = 0
    })
  }, [])

  useEffect(() => {
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', handleScroll)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [handleScroll])

  return (
    <div className="fixed top-0 left-0 w-full h-0.5 bg-transparent z-[60]">
      <div
        className="h-full bg-primary"
        style={{ width: `${scrollProgress}%`, transition: 'none' }}
      />
    </div>
  )
}
