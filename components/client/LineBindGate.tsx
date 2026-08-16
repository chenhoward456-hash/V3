'use client'

import { useEffect, useState } from 'react'
import { LINE_ADD_FRIEND_URL, lineBindDeeplink } from '@/lib/line-links'

/**
 * 新學員的第一道關：先把通知管道接起來，再談記錄。
 *
 * ⚠️ 為什麼要擋（2026-08-16 Howard：「光系統沒有強制讓他們綁定就錯了啊」）：
 * 他說得對。原本新學員首屏的 LINE 區塊是一段**不能點的文字**
 * （「LINE 還沒綁？綁了就能用 LINE 快速回報體重」），連按鈕都沒有；
 * 首頁那張 banner 又可以直接滑過去。結果：林宥任天天在用系統，
 * 但既沒綁 LINE 也沒開推播 —— 我們發的每日提醒、教練訊息、週報他一個字都收不到。
 *
 * 順序必須是「先建管道，再要求行為」。沒有管道，之後每一則提醒都是白工。
 *
 * 但不做死擋 —— 他可能在電腦上開、或手邊沒有 LINE。給「先跳過」，
 * 但要明確按下去，而且只跳過這一次（沒綁成功的話下次進來還是先問）。
 */

const SKIP_KEY = 'line_bind_gate_skipped_at'
/** 跳過後多久再問一次。一天 —— 綁定是留存的前提，不該像推播提示那樣等三天 */
const SKIP_TTL = 24 * 60 * 60 * 1000

export function shouldShowLineGate(hasLineBinding: boolean): boolean {
  if (hasLineBinding) return false
  try {
    const raw = localStorage.getItem(SKIP_KEY)
    const ts = raw ? Number(raw) : 0
    if (Number.isFinite(ts) && ts > 0 && Date.now() - ts < SKIP_TTL) return false
  } catch { /* 無痕模式等 */ }
  return true
}

export default function LineBindGate({
  clientName,
  uniqueCode,
  onSkip,
}: {
  clientName: string
  uniqueCode: string
  onSkip: () => void
}) {
  const [tapped, setTapped] = useState(false)

  // 從 LINE 切回來時重抓一次，綁好了就不用再看到這頁
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible' && tapped) window.location.reload() }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [tapped])

  const skip = () => {
    try { localStorage.setItem(SKIP_KEY, String(Date.now())) } catch {}
    onSkip()
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-5 py-10">
      <div className="w-full max-w-md">
        <div className="bg-white border border-slate-200 rounded-2xl p-6">
          <p className="text-xs text-slate-400 mb-1">第 1 步，只做一次</p>
          <h1 className="text-xl font-bold text-gray-900 mb-3">{clientName}，先把提醒打開</h1>

          <p className="text-sm text-gray-600 leading-relaxed mb-1">
            不綁的話，你在這裡看到的東西<span className="font-semibold text-gray-900">不會有人提醒你回來看</span> ——
            每天的提醒、我調整的內容、每週進度，全部送不到。
          </p>
          <p className="text-sm text-gray-600 leading-relaxed mb-5">
            綁好之後也可以直接在 LINE 傳訊息記體重，不用開網頁。
          </p>

          <div className="space-y-2.5">
            <a
              href={LINE_ADD_FRIEND_URL}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setTapped(true)}
              className="flex items-center justify-center w-full bg-[#06C755] text-white text-sm font-bold py-3.5 rounded-xl hover:bg-[#05a548] transition-colors"
            >
              ① 加好友
            </a>
            <a
              href={lineBindDeeplink(uniqueCode)}
              onClick={() => setTapped(true)}
              className="flex items-center justify-center w-full bg-white text-[#06C755] text-sm font-bold py-3.5 rounded-xl border-2 border-[#06C755] hover:bg-[#06C755]/5 transition-colors"
            >
              ② 送出綁定
            </a>
          </div>

          <p className="text-[11px] text-slate-400 mt-3 leading-relaxed">
            ②會自動打開 LINE 並填好「綁定 {uniqueCode}」，你只要按送出。
            <br />
            如果沒有自動填，手動貼這行也可以：<span className="font-mono text-slate-500">綁定 {uniqueCode}</span>
          </p>

          <button
            type="button"
            onClick={skip}
            className="w-full mt-5 text-xs text-slate-400 hover:text-slate-600 transition-colors py-2"
          >
            先跳過，我等一下再綁
          </button>
        </div>
      </div>
    </div>
  )
}
