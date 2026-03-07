'use client'

import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { trackEvent } from '@/lib/analytics'

const TIER_NAMES: Record<string, string> = {
  free: '免費體驗',
  self_managed: '自主管理方案',
  coached: '教練指導方案',
}

export default function JoinSuccessPage() {
  return (
    <Suspense
      fallback={
        <section className="max-w-2xl mx-auto px-6 py-16 md:py-24 text-center">
          <div className="inline-block w-12 h-12 border-4 border-[#2563eb]/20 border-t-[#2563eb] rounded-full animate-spin mb-6" />
          <p className="text-gray-500">載入中...</p>
        </section>
      }
    >
      <JoinSuccessContent />
    </Suspense>
  )
}

function JoinSuccessContent() {
  const searchParams = useSearchParams()
  const orderId = searchParams.get('order_id')
  // 免費體驗：直接從 query params 取得
  const directCode = searchParams.get('code')
  const directName = searchParams.get('name')
  const directTier = searchParams.get('tier')

  const [status, setStatus] = useState<'loading' | 'success' | 'failed' | 'timeout'>('loading')
  const [uniqueCode, setUniqueCode] = useState<string | null>(directCode)
  const [tier, setTier] = useState<string | null>(directTier)
  const [name, setName] = useState<string | null>(directName)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    // 免費體驗：已有 code，直接顯示成功
    if (directCode) {
      setStatus('success')
      trackEvent('free_trial_success', { tier: 'free' })
      return
    }

    // 付費方案：polling 等待 webhook 處理
    if (!orderId) {
      setStatus('failed')
      return
    }

    let attempts = 0
    const maxAttempts = 15

    const poll = async () => {
      try {
        const res = await fetch(`/api/subscribe/verify?order_id=${orderId}`)
        const data = await res.json()

        if (data.completed && data.uniqueCode) {
          setUniqueCode(data.uniqueCode)
          setTier(data.tier)
          setName(data.name)
          setStatus('success')
          trackEvent('subscribe_success', { tier: data.tier, orderId })
          return
        }

        if (data.failed) {
          setStatus('failed')
          return
        }

        attempts++
        if (attempts >= maxAttempts) {
          setStatus('timeout')
          return
        }

        setTimeout(poll, 2000)
      } catch {
        attempts++
        if (attempts >= maxAttempts) {
          setStatus('timeout')
          return
        }
        setTimeout(poll, 3000)
      }
    }

    poll()
  }, [orderId, directCode])

  const handleCopy = () => {
    if (uniqueCode) {
      navigator.clipboard.writeText(uniqueCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const isFree = tier === 'free'

  return (
    <section className="max-w-2xl mx-auto px-6 py-16 md:py-24">
      {/* Loading */}
      {status === 'loading' && (
        <div className="text-center">
          <div className="inline-block w-12 h-12 border-4 border-[#2563eb]/20 border-t-[#2563eb] rounded-full animate-spin mb-6" />
          <h1 className="text-2xl font-bold mb-3" style={{ color: '#1e3a5f' }}>
            正在開通你的帳號...
          </h1>
          <p className="text-gray-500 text-sm">
            付款已確認，系統正在建立你的專屬儀表板，請稍候
          </p>
        </div>
      )}

      {/* Success */}
      {status === 'success' && uniqueCode && (
        <div className="text-center">
          <div className="inline-block bg-green-100 border border-green-300 rounded-full px-6 py-2 mb-6">
            <span className="text-green-700 font-bold text-sm">&#10003; 帳號開通成功</span>
          </div>

          <h1 className="text-3xl font-bold mb-2" style={{ color: '#1e3a5f' }}>
            歡迎，{name}！
          </h1>
          <p className="text-gray-500 text-sm mb-8">
            你的 {TIER_NAMES[tier || ''] || '方案'} 已啟用
            {isFree && '，可免費使用所有功能'}
          </p>

          {/* Unique Code Card */}
          <div className="bg-white border-2 border-[#2563eb] rounded-2xl p-8 mb-8 shadow-sm">
            <p className="text-sm text-gray-500 mb-3">你的專屬代碼</p>
            <div
              className="text-4xl md:text-5xl font-bold font-mono tracking-[4px] text-[#2563eb] mb-4 cursor-pointer hover:opacity-80 transition-opacity"
              onClick={handleCopy}
              title="點擊複製"
            >
              {uniqueCode}
            </div>
            <button
              onClick={handleCopy}
              className="text-sm text-gray-500 hover:text-[#2563eb] transition-colors"
            >
              {copied ? '已複製 ✓' : '點擊複製代碼'}
            </button>
            <p className="text-xs text-gray-400 mt-4">
              這是你登入儀表板的唯一憑證，請妥善保存。我們也已將此代碼寄到你的 Email。
            </p>
          </div>

          {/* LINE 綁定引導 */}
          <div className="bg-[#06C755]/10 border border-[#06C755]/30 rounded-2xl p-5 mb-8 text-left">
            <p className="text-sm font-semibold text-gray-800 mb-3">💬 綁定 LINE，用訊息就能記錄</p>
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-[#06C755]/20 flex items-center justify-center text-xs font-bold text-[#06C755] shrink-0">1</span>
                <p className="text-sm text-gray-600">
                  <a href="https://lin.ee/LP65rCc" target="_blank" rel="noopener noreferrer" className="text-[#06C755] font-semibold hover:underline">
                    點此加入 LINE 好友
                  </a>
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-[#06C755]/20 flex items-center justify-center text-xs font-bold text-[#06C755] shrink-0">2</span>
                <p className="text-sm text-gray-600">
                  傳送「<span className="font-mono bg-white px-1.5 py-0.5 rounded border text-gray-700">綁定 {uniqueCode}</span>」
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-[#06C755]/20 flex items-center justify-center text-xs font-bold text-[#06C755] shrink-0">3</span>
                <p className="text-sm text-gray-600">完成！之後傳訊息就能快速記錄，還會收到提醒</p>
              </div>
            </div>
          </div>

          {/* Quick Guide */}
          {isFree && (
            <div className="bg-gray-50 rounded-2xl p-5 mb-8 text-left">
              <p className="text-sm font-semibold text-gray-700 mb-3">進去之後可以做什麼？</p>
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-600 shrink-0">1</span>
                  <p className="text-sm text-gray-600">記錄你的<strong>體重 / 體態</strong>，追蹤變化趨勢</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center text-xs font-bold text-amber-600 shrink-0">2</span>
                  <p className="text-sm text-gray-600">記錄<strong>每日飲食</strong>，AI 自動計算營養素</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center text-xs font-bold text-green-600 shrink-0">3</span>
                  <p className="text-sm text-gray-600">持續記錄，系統會產生<strong>趨勢分析</strong></p>
                </div>
              </div>
            </div>
          )}

          {/* CTA */}
          <Link
            href={`/c/${uniqueCode}`}
            className="inline-block bg-[#2563eb] text-white px-10 py-4 rounded-xl font-bold text-lg hover:bg-[#1d4ed8] transition-colors shadow-lg mb-6"
          >
            進入我的儀表板 →
          </Link>

          <div className="space-y-2 mt-6">
            <p className="text-sm text-gray-500">
              下次登入只需訪問：
            </p>
            <code className="text-sm bg-gray-100 px-3 py-1.5 rounded-lg text-gray-600">
              howardprotocol.com/c/{uniqueCode}
            </code>
          </div>

          {/* 免費體驗升級提示 */}
          {isFree && (
            <div className="mt-8 bg-[#2563eb]/5 border border-[#2563eb]/20 rounded-xl p-4">
              <p className="text-sm text-[#2563eb] font-medium">
                想要訓練追蹤、感受紀錄等完整功能？隨時可升級
              </p>
              <Link
                href="/remote"
                className="text-xs text-[#2563eb] hover:underline mt-1 inline-block"
              >
                查看付費方案 →
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Failed */}
      {status === 'failed' && (
        <div className="text-center">
          <div className="inline-block bg-red-100 border border-red-300 rounded-full px-6 py-2 mb-6">
            <span className="text-red-700 font-bold text-sm">付款未完成</span>
          </div>
          <h1 className="text-2xl font-bold mb-3" style={{ color: '#1e3a5f' }}>
            付款未成功
          </h1>
          <p className="text-gray-500 text-sm mb-8">
            如果款項已扣除但看到此頁面，請聯繫我們處理。
          </p>
          <div className="flex gap-3 justify-center">
            <Link
              href="/join"
              className="bg-[#2563eb] text-white px-8 py-3 rounded-xl font-semibold hover:bg-[#1d4ed8] transition-colors"
            >
              重新選擇方案
            </Link>
            <a
              href="https://lin.ee/LP65rCc"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-[#06C755] text-white px-8 py-3 rounded-xl font-semibold hover:bg-[#05b34d] transition-colors"
            >
              聯繫客服
            </a>
          </div>
        </div>
      )}

      {/* Timeout */}
      {status === 'timeout' && (
        <div className="text-center">
          <div className="inline-block bg-amber-100 border border-amber-300 rounded-full px-6 py-2 mb-6">
            <span className="text-amber-700 font-bold text-sm">處理中</span>
          </div>
          <h1 className="text-2xl font-bold mb-3" style={{ color: '#1e3a5f' }}>
            帳號開通中，請稍後
          </h1>
          <p className="text-gray-500 text-sm mb-4">
            付款已收到，但帳號建立需要較長時間處理。
          </p>
          <p className="text-gray-500 text-sm mb-8">
            你的帳號資訊會在幾分鐘內寄到你的 Email，也可以加 LINE 聯繫我們。
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => window.location.reload()}
              className="bg-gray-100 text-gray-700 px-8 py-3 rounded-xl font-semibold hover:bg-gray-200 transition-colors"
            >
              重新整理
            </button>
            <a
              href="https://lin.ee/LP65rCc"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-[#06C755] text-white px-8 py-3 rounded-xl font-semibold hover:bg-[#05b34d] transition-colors"
            >
              加 LINE 聯繫
            </a>
          </div>
        </div>
      )}
    </section>
  )
}
