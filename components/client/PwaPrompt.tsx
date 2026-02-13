'use client'

import { useState, useEffect } from 'react'

export default function PwaPrompt() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    // 只在手機瀏覽器且非 standalone 模式下顯示
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
      || (navigator as any).standalone === true
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)

    if (isMobile && !isStandalone) {
      setShow(true)
    }
  }, [])

  if (!show) return null

  return (
    <div className="bg-blue-50 rounded-2xl p-4 mb-20 text-center">
      <p className="text-sm text-blue-700">
        📱 將此頁加入主畫面，隨時追蹤健康狀態
      </p>
      <button
        onClick={() => setShow(false)}
        className="text-xs text-blue-400 mt-1 hover:text-blue-600"
      >
        知道了
      </button>
    </div>
  )
}
