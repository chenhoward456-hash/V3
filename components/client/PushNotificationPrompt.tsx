'use client'

import { useEffect, useState } from 'react'
import { usePushNotifications } from '@/hooks/usePushNotifications'

const DISMISS_KEY = 'push_prompt_dismissed'

/**
 * 開啟瀏覽器推播提醒的卡片。
 * 只在「瀏覽器支援 + 有 VAPID 公鑰 + 權限尚未決定 + 未訂閱 + 使用者沒關過」時顯示，
 * 不騷擾：權限為 denied、或使用者按過 ✕，就不再出現。
 */
export default function PushNotificationPrompt({ code, debug = false }: { code: string; debug?: boolean }) {
  const { supported, state, busy, subscribed, subscribe } = usePushNotifications(code)
  const [dismissed, setDismissed] = useState(true) // 預設不顯示，待 effect 判定
  const [justEnabled, setJustEnabled] = useState(false)

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(DISMISS_KEY) === '1')
    } catch {
      setDismissed(false)
    }
  }, [])

  // 測試模式：不管支援/權限/訂閱狀態，一律顯示並印出診斷，方便確認卡在哪一關
  if (debug) {
    return (
      <div className="bg-white border border-blue-200 rounded-2xl p-4 shadow-sm mb-3 text-sm">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-lg">🔔</span>
          <span className="font-semibold text-gray-900">推播提醒（測試模式）</span>
        </div>
        <ul className="text-xs text-gray-600 space-y-0.5 mb-3">
          <li>瀏覽器支援 + 有公鑰：<b className={supported ? 'text-emerald-600' : 'text-red-600'}>{supported ? '是' : '否（iPhone Safari 需先「加入主畫面」再從圖示開）'}</b></li>
          <li>通知權限狀態：<b>{state}</b>（default=未決定 / granted=已允許 / denied=已封鎖）</li>
          <li>已訂閱：<b>{subscribed ? '是' : '否'}</b></li>
        </ul>
        {justEnabled || subscribed ? (
          <div className="text-emerald-700 text-xs">✅ 已訂閱，可去 push_subscriptions 表確認</div>
        ) : (
          <button
            onClick={async () => { const ok = await subscribe(); if (ok) setJustEnabled(true) }}
            disabled={busy || !supported}
            className="bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {busy ? '開啟中…' : supported ? '開啟提醒（訂閱）' : '此裝置不支援'}
          </button>
        )}
      </div>
    )
  }

  if (!supported || subscribed || dismissed || state !== 'default') {
    if (justEnabled) {
      return (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-3 text-sm text-emerald-800">
          ✅ 提醒已開啟，打卡提醒和達標通知會直接推到這台裝置
        </div>
      )
    }
    return null
  }

  const close = () => {
    try { localStorage.setItem(DISMISS_KEY, '1') } catch {}
    setDismissed(true)
  }

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm flex items-start gap-3">
      <div className="text-2xl leading-none mt-0.5">🔔</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900">開啟提醒，別斷了你的進度</p>
        <p className="text-xs text-gray-500 mt-0.5">
          打卡提醒、達標恭喜、該回診血檢，直接推到手機。免費、隨時可關。
        </p>
        <button
          onClick={async () => {
            const ok = await subscribe()
            if (ok) setJustEnabled(true)
          }}
          disabled={busy}
          className="mt-3 inline-flex items-center gap-1.5 bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          {busy ? '開啟中…' : '開啟提醒'}
        </button>
      </div>
      <button
        onClick={close}
        aria-label="關閉"
        className="text-gray-400 hover:text-gray-600 text-sm shrink-0"
      >
        ✕
      </button>
    </div>
  )
}
