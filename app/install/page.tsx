'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePushNotifications } from '@/hooks/usePushNotifications'

/**
 * /install?c={unique_code} — 一條固定連結，教學員把系統裝到手機桌面 + 開通知。
 * 帶 c 時存進 localStorage(hp_client_id) → 動態 manifest 讓桌面圖示直接開到他自己的主控台。
 * 自動偵測 iOS / Android / 桌機與目前狀態（已安裝 ✓ / 通知 ✓），只顯示還沒完成的步驟。
 */
export default function InstallPage() {
  const [mounted, setMounted] = useState(false)
  const [code, setCode] = useState('')
  const [platform, setPlatform] = useState<'ios' | 'android' | 'desktop'>('desktop')
  const [standalone, setStandalone] = useState(false)

  useEffect(() => {
    setMounted(true)
    const params = new URLSearchParams(window.location.search)
    const c = params.get('c') || ''
    if (/^[a-zA-Z0-9_-]{1,20}$/.test(c)) {
      setCode(c)
      try { localStorage.setItem('hp_client_id', c) } catch {}
    }
    const ua = navigator.userAgent
    const isIOS = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
    const isAndroid = /android/i.test(ua)
    setPlatform(isIOS ? 'ios' : isAndroid ? 'android' : 'desktop')
    setStandalone(
      window.matchMedia?.('(display-mode: standalone)').matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true
    )
  }, [])

  const { supported, state, busy, subscribed, subscribe } = usePushNotifications(code)
  const notifOn = state === 'granted' || subscribed
  const allDone = standalone && notifOn

  const Badge = ({ ok, label }: { ok: boolean; label: string }) => (
    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${ok ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
      <span>{ok ? '✅' : '⚪'}</span> {label}
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-50 px-5 py-8">
      <div className="max-w-md mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">把 Howard 裝到手機桌面</h1>
        <p className="text-sm text-gray-500 mb-5">裝好後桌面會有圖示、每天會提醒你記錄，不用再記網址。</p>

        {!mounted ? (
          <p className="text-sm text-gray-400 py-2">載入中…</p>
        ) : (
        <>
        {/* 目前狀態 */}
        <div className="flex gap-2 mb-5">
          <Badge ok={standalone} label="加入主畫面" />
          <Badge ok={notifOn} label="通知已開" />
        </div>

        {allDone ? (
          <div className="bg-white border border-emerald-200 rounded-2xl p-5 text-center">
            <div className="text-4xl mb-2">🎉</div>
            <p className="text-base font-bold text-gray-900 mb-1">全部設定好了！</p>
            <p className="text-sm text-gray-500 mb-4">每天早上會提醒你量體重，點一下就記好。</p>
            {code && (
              <Link href={`/c/${code}`} className="inline-block bg-primary-600 text-white text-sm font-bold px-5 py-3 rounded-xl hover:bg-primary-700 transition-colors">
                打開我的主控台 →
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {/* iOS：尚未加入主畫面 */}
            {platform === 'ios' && !standalone && (
              <div className="bg-white border border-slate-200 rounded-2xl p-5">
                <p className="text-sm font-bold text-gray-900 mb-3">📲 iPhone — 加入主畫面（請用 Safari）</p>
                <ol className="text-sm text-gray-700 space-y-2.5 list-decimal list-inside leading-relaxed">
                  <li>點最下面中間的「分享」鍵 <span className="font-mono">⬆️</span></li>
                  <li>往下滑，選「<b>加入主畫面</b>」→ 右上「加入」</li>
                  <li>回桌面點開新出現的「<b>Howard</b>」圖示</li>
                  <li className="text-primary-700 font-medium">⚠️ 一定要從那個圖示打開，這頁才會變成 App</li>
                </ol>
                <p className="text-xs text-gray-400 mt-3">從圖示打開後，回到這一頁就會跳出「開啟通知」。</p>
              </div>
            )}

            {/* iOS 已 standalone 但還沒開通知，或 Android/桌機支援 */}
            {supported && !notifOn && (
              <div className="bg-white border border-slate-200 rounded-2xl p-5">
                <p className="text-sm font-bold text-gray-900 mb-2">🔔 開啟每日提醒</p>
                <p className="text-xs text-gray-500 mb-3">允許後，每天早上會推播提醒你量體重、達標時恭喜你。免費、隨時可關。</p>
                <button
                  onClick={() => subscribe()}
                  disabled={busy}
                  className="w-full bg-primary-600 text-white text-sm font-bold py-3 rounded-xl hover:bg-primary-700 disabled:opacity-50 transition-colors"
                >
                  {busy ? '開啟中…' : '開啟通知'}
                </button>
                {state === 'denied' && (
                  <p className="text-xs text-red-500 mt-2">通知被封鎖了 — 到手機「設定 → 通知 → Howard」打開即可。</p>
                )}
              </div>
            )}

            {/* Android：用瀏覽器選單安裝 */}
            {platform === 'android' && !standalone && (
              <div className="bg-white border border-slate-200 rounded-2xl p-5">
                <p className="text-sm font-bold text-gray-900 mb-3">📲 Android — 安裝 App</p>
                <ol className="text-sm text-gray-700 space-y-2.5 list-decimal list-inside leading-relaxed">
                  <li>點右上角瀏覽器選單 <span className="font-mono">⋮</span></li>
                  <li>選「<b>安裝應用程式</b>」或「<b>加到主畫面</b>」</li>
                  <li>從桌面圖示打開，回到這頁開啟通知</li>
                </ol>
              </div>
            )}

            {/* 桌機 */}
            {platform === 'desktop' && (
              <div className="bg-white border border-slate-200 rounded-2xl p-4">
                <p className="text-sm text-gray-600">💻 這頁請用<b>手機</b>打開來安裝。桌機可直接用網址列右側的「安裝」圖示。</p>
              </div>
            )}

            {code && (
              <Link href={`/c/${code}`} className="block text-center text-sm text-primary-600 font-medium hover:underline">
                先打開我的主控台 →
              </Link>
            )}
          </div>
        )}
        </>
        )}
      </div>
    </div>
  )
}
