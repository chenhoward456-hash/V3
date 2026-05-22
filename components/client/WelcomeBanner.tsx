'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { X } from 'lucide-react'

const STORAGE_KEY = 'hp_welcome_completed'

interface Props {
  clientId: string
}

export default function WelcomeBanner({ clientId }: Props) {
  // 預設不顯示，hydration 後才檢查 localStorage（避免 SSR mismatch）
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    try {
      const completed = window.localStorage.getItem(STORAGE_KEY)
      if (!completed) setVisible(true)
    } catch {
      // localStorage 不可用 → 不顯示，避免 noisy
    }
  }, [])

  function dismiss() {
    try {
      window.localStorage.setItem(STORAGE_KEY, new Date().toISOString())
    } catch {}
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="bg-gradient-to-r from-emerald-50 via-blue-50 to-emerald-50 border border-emerald-200 rounded-2xl p-4 mb-4 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <span className="text-3xl shrink-0">🎯</span>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-emerald-900 truncate">
            第一次來？看 2 分鐘導覽
          </div>
          <div className="text-xs text-emerald-700 mt-0.5 truncate">
            介紹 5 個核心功能：上傳血檢 / 趨勢儀表板 / 教練筆記 / 補品 protocol / FAQ
          </div>
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <Link
          href={`/c/${clientId}/welcome`}
          className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded-lg whitespace-nowrap"
        >
          開始 →
        </Link>
        <button
          onClick={dismiss}
          className="text-emerald-700 hover:text-emerald-900 p-1.5"
          aria-label="關閉"
          title="不再顯示"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
