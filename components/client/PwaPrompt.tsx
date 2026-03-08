'use client'

import { useState, useEffect } from 'react'
import { X, Share, MoreVertical, PlusSquare } from 'lucide-react'

export default function PwaPrompt() {
  const [show, setShow] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [platform, setPlatform] = useState<'ios' | 'android' | 'other'>('other')

  useEffect(() => {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
      || (navigator as any).standalone === true

    if (isStandalone) return

    // 已經關閉過就不再顯示（7 天後再提醒）
    const dismissed = localStorage.getItem('pwa_prompt_dismissed')
    if (dismissed) {
      const dismissedAt = parseInt(dismissed, 10)
      if (Date.now() - dismissedAt < 7 * 24 * 60 * 60 * 1000) return
    }

    const ua = navigator.userAgent
    if (/iPhone|iPad|iPod/i.test(ua)) {
      setPlatform('ios')
      setShow(true)
    } else if (/Android/i.test(ua)) {
      setPlatform('android')
      setShow(true)
    }
  }, [])

  const dismiss = () => {
    setShow(false)
    localStorage.setItem('pwa_prompt_dismissed', Date.now().toString())
  }

  if (!show) return null

  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-4 mb-3 relative">
      <button
        onClick={dismiss}
        className="absolute top-3 right-3 text-gray-400 hover:text-gray-600"
        aria-label="關閉"
      >
        <X size={16} />
      </button>

      <div className="flex items-start gap-3">
        <div className="text-2xl flex-shrink-0">📱</div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-800 mb-1">
            加到主畫面，一鍵開啟
          </p>
          <p className="text-xs text-gray-500 mb-2">
            像 App 一樣使用，不用每次開瀏覽器找
          </p>

          {!expanded ? (
            <button
              onClick={() => setExpanded(true)}
              className="text-xs font-medium text-blue-600 hover:text-blue-700"
            >
              看教學 →
            </button>
          ) : (
            <div className="mt-2 space-y-2">
              {platform === 'ios' ? (
                <>
                  <Step number={1} icon={<Share size={14} />}>
                    點底部的<span className="font-semibold">分享按鈕</span>
                  </Step>
                  <Step number={2} icon={<PlusSquare size={14} />}>
                    往下滑，選<span className="font-semibold">「加入主畫面」</span>
                  </Step>
                  <Step number={3}>
                    點右上角<span className="font-semibold">「新增」</span>即可
                  </Step>
                </>
              ) : (
                <>
                  <Step number={1} icon={<MoreVertical size={14} />}>
                    點右上角的<span className="font-semibold">選單（⋮）</span>
                  </Step>
                  <Step number={2}>
                    選<span className="font-semibold">「加到主畫面」</span>或<span className="font-semibold">「安裝應用程式」</span>
                  </Step>
                  <Step number={3}>
                    確認<span className="font-semibold">「安裝」</span>即可
                  </Step>
                </>
              )}
              <button
                onClick={dismiss}
                className="text-xs text-gray-400 hover:text-gray-600 mt-1"
              >
                我知道了
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Step({ number, icon, children }: { number: number; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-xs text-gray-700">
      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-100 text-blue-600 font-bold flex items-center justify-center text-[10px]">
        {number}
      </span>
      {icon && <span className="text-gray-400 flex-shrink-0">{icon}</span>}
      <span>{children}</span>
    </div>
  )
}
