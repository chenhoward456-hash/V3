'use client'

import { memo, useEffect, useState } from 'react'
import Link from 'next/link'
import { X } from 'lucide-react'

// ⚠️ 原本是全站共用一把 `hp_welcome_completed` —— 教練在同一台裝置看過任何一個學員的頁面，
// 這張卡就對所有學員消失了。綁 clientId。
const storageKeyFor = (clientId: string) => `hp_welcome_completed_${clientId}`

interface Props {
  clientId: string
  /** 他還是新手嗎（見 lib/user-tenure.ts）。false 就整張不出現。 */
  isNew?: boolean
}

function WelcomeBannerInner({ clientId, isNew = true }: Props) {
  // 預設不顯示，hydration 後才檢查 localStorage（避免 SSR mismatch）
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // 資料先講話：記錄過東西的人不需要「第一次來？」（見 lib/user-tenure.ts）
    if (!isNew) return
    try {
      const completed = window.localStorage.getItem(storageKeyFor(clientId))
      if (!completed) setVisible(true)
    } catch {
      // localStorage 不可用 → 不顯示，避免 noisy
    }
  }, [clientId, isNew])

  function dismiss() {
    try {
      window.localStorage.setItem(storageKeyFor(clientId), new Date().toISOString())
    } catch {}
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-4 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-900 truncate">
            第一次來？看使用說明
          </div>
          <div className="text-xs text-slate-600 mt-0.5 truncate">
            5 分鐘讀完：每天怎麼用 / 數據怎麼看 / 方案差異 / FAQ
          </div>
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <Link
          href={`/c/${clientId}/help`}
          className="text-xs bg-primary-600 hover:bg-primary-700 text-white px-3 py-2 rounded-lg whitespace-nowrap"
        >
          打開 →
        </Link>
        <button
          onClick={dismiss}
          className="text-slate-400 hover:text-slate-600 p-1.5"
          aria-label="關閉"
          title="不再顯示"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

export default memo(WelcomeBannerInner)
