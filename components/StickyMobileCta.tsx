'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

export default function StickyMobileCta() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      // Show after scrolling past ~600px (roughly past the hero section)
      setVisible(window.scrollY > 600)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 z-50 md:hidden transition-all duration-300 ${
        visible
          ? 'translate-y-0 opacity-100'
          : 'translate-y-full opacity-0'
      }`}
    >
      <div className="bg-white/90 backdrop-blur-xl border-t border-gray-200 px-4 py-3 shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
        <div className="flex gap-3 max-w-lg mx-auto">
          <Link
            href="/join"
            className="flex-1 bg-primary text-white text-center py-3 rounded-xl font-semibold text-sm hover:bg-primary-dark transition-colors min-h-[44px] flex items-center justify-center"
          >
            免費開始
          </Link>
          <Link
            href="/join"
            className="flex-1 bg-navy text-white text-center py-3 rounded-xl font-semibold text-sm hover:bg-navy/90 transition-colors min-h-[44px] flex items-center justify-center"
          >
            NT$499/月 升級
          </Link>
        </div>
      </div>
    </div>
  )
}
