'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

export default function CookieConsent() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    const consent = localStorage.getItem('cookie_consent')
    if (!consent) {
      const timer = setTimeout(() => setShow(true), 1500)
      return () => clearTimeout(timer)
    }
  }, [])

  const accept = () => {
    localStorage.setItem('cookie_consent', 'accepted')
    setShow(false)
    // Reload to trigger GA loading
    window.location.reload()
  }

  const decline = () => {
    localStorage.setItem('cookie_consent', 'declined')
    setShow(false)
  }

  if (!show) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 animate-slide-up">
      <div className="max-w-4xl mx-auto bg-gray-900 text-gray-200 rounded-2xl p-5 shadow-2xl flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <p className="text-sm leading-relaxed flex-1">
          我們使用 Cookie 和 Google Analytics 來改善您的瀏覽體驗並分析網站流量。
          <Link href="/privacy" className="text-blue-400 hover:text-blue-300 ml-1 underline">
            隱私政策
          </Link>
        </p>
        <div className="flex gap-3 shrink-0">
          <button
            onClick={decline}
            className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors rounded-lg"
          >
            拒絕
          </button>
          <button
            onClick={accept}
            className="px-5 py-2 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors"
          >
            接受
          </button>
        </div>
      </div>
    </div>
  )
}
