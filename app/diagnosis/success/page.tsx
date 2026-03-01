'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useLocalStorage } from '@/hooks/useLocalStorage'
import { generateDemoAnalysis, type DemoAnalysisInput, type DemoAnalysisResult } from '@/lib/nutrition-engine'
import LineButton from '@/components/LineButton'
import { trackEvent } from '@/lib/analytics'

export default function SuccessPage() {
  const searchParams = useSearchParams()
  const sessionId = searchParams.get('session_id')

  const [status, setStatus] = useState<'loading' | 'success' | 'pending' | 'error'>('loading')
  const [downloadToken, setDownloadToken] = useLocalStorage<string>('ebook_download_token', '')
  const [purchaseEmail, setPurchaseEmail] = useState('')
  const [retryCount, setRetryCount] = useState(0)

  // 讀取 quiz data from localStorage 重新計算結果
  const [gender] = useLocalStorage<string>('demo_gender', '')
  const [bodyWeight] = useLocalStorage<string>('demo_weight', '')
  const [height] = useLocalStorage<string>('demo_height', '')
  const [bodyFatPct] = useLocalStorage<string>('demo_bodyfat', '')
  const [goalType] = useLocalStorage<string>('demo_goal', '')
  const [targetWeight] = useLocalStorage<string>('demo_target_weight', '')
  const [trainingDays] = useLocalStorage<number>('demo_training_days', 4)

  const [result, setResult] = useState<DemoAnalysisResult | null>(null)

  // 計算分析結果
  useEffect(() => {
    if (gender && bodyWeight && goalType && !result) {
      const input: DemoAnalysisInput = {
        gender: gender as '男性' | '女性',
        bodyWeight: parseFloat(bodyWeight),
        height: height ? parseFloat(height) : null,
        bodyFatPct: bodyFatPct ? parseFloat(bodyFatPct) : null,
        goalType: goalType as 'cut' | 'bulk',
        targetWeight: targetWeight ? parseFloat(targetWeight) : null,
        trainingDaysPerWeek: trainingDays,
      }
      setResult(generateDemoAnalysis(input))
    }
  }, [gender, bodyWeight, goalType, height, bodyFatPct, targetWeight, trainingDays, result])

  const verifyPurchase = useCallback(async () => {
    if (!sessionId) {
      setStatus('error')
      return
    }

    try {
      const res = await fetch(`/api/ebook/verify-purchase?session_id=${sessionId}`)
      const data = await res.json()

      if (data.purchased && data.downloadToken) {
        setDownloadToken(data.downloadToken)
        setPurchaseEmail(data.email || '')
        setStatus('success')
        trackEvent('ebook_purchase_completed', { source: 'success_page' })
      } else if (retryCount < 10) {
        setStatus('pending')
        // 3 秒後重試
        setTimeout(() => setRetryCount(c => c + 1), 3000)
      } else {
        setStatus('error')
      }
    } catch {
      if (retryCount < 10) {
        setStatus('pending')
        setTimeout(() => setRetryCount(c => c + 1), 3000)
      } else {
        setStatus('error')
      }
    }
  }, [sessionId, retryCount, setDownloadToken])

  useEffect(() => {
    verifyPurchase()
  }, [verifyPurchase])

  // Loading / Pending
  if (status === 'loading' || status === 'pending') {
    return (
      <section className="max-w-2xl mx-auto px-6 py-20 text-center">
        <div className="bg-white border border-gray-200 rounded-2xl p-10 shadow-sm">
          <div className="animate-spin w-12 h-12 border-4 border-[#2563eb] border-t-transparent rounded-full mx-auto mb-6" />
          <h1 className="text-xl font-bold mb-2" style={{ color: '#1e3a5f' }}>
            正在確認付款...
          </h1>
          <p className="text-gray-500 text-sm">
            通常只需幾秒鐘。請勿關閉此頁面。
          </p>
          {retryCount > 3 && (
            <p className="text-gray-400 text-xs mt-4">
              付款處理中，請稍候...（{retryCount}/10）
            </p>
          )}
        </div>
      </section>
    )
  }

  // Error
  if (status === 'error') {
    return (
      <section className="max-w-2xl mx-auto px-6 py-20 text-center">
        <div className="bg-white border border-gray-200 rounded-2xl p-10 shadow-sm">
          <p className="text-4xl mb-4">😕</p>
          <h1 className="text-xl font-bold mb-2" style={{ color: '#1e3a5f' }}>
            付款確認失敗
          </h1>
          <p className="text-gray-500 text-sm mb-6">
            如果你已完成付款，請稍等幾分鐘後重新整理此頁面。<br />
            若持續無法取得，請透過 LINE 聯繫我們。
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => { setRetryCount(0); setStatus('loading') }}
              className="bg-[#2563eb] text-white px-6 py-3 rounded-xl font-semibold hover:bg-[#1d4ed8] transition-colors"
            >
              重新確認
            </button>
            <LineButton
              source="success_error"
              intent="payment_support"
              className="bg-gray-100 text-gray-700 px-6 py-3 rounded-xl font-semibold hover:bg-gray-200 transition-colors"
            >
              聯繫客服
            </LineButton>
          </div>
        </div>
      </section>
    )
  }

  // Success!
  return (
    <section className="max-w-2xl mx-auto px-6 py-16 md:py-20">
      <div className="bg-white border border-gray-200 rounded-2xl p-8 md:p-10 shadow-sm">
        {/* 成功標誌 */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-4xl">✅</span>
          </div>
          <h1 className="text-2xl font-bold mb-2" style={{ color: '#1e3a5f' }}>
            購買成功！
          </h1>
          {purchaseEmail && (
            <p className="text-gray-500 text-sm">收據已發送至 {purchaseEmail}</p>
          )}
        </div>

        {/* 下載電子書 */}
        <div className="bg-gradient-to-br from-[#1e3a5f] to-[#2563eb] rounded-2xl p-6 text-center mb-8">
          <p className="text-white/80 text-sm mb-3">你的電子書已準備好</p>
          <a
            href={`/api/ebook/download?token=${downloadToken}`}
            onClick={() => trackEvent('ebook_downloaded', { source: 'success_page' })}
            className="inline-block bg-white text-[#1e3a5f] px-10 py-4 rounded-xl font-bold text-lg hover:bg-gray-50 transition-colors shadow-lg"
          >
            📥 下載 System Reboot 電子書
          </a>
          <p className="text-white/50 text-xs mt-3">
            PDF · 11 頁 · 睡眠與神經系統優化實戰手冊
          </p>
        </div>

        {/* 完整分析結果 */}
        {result && (
          <div className="space-y-4 mb-8">
            <h2 className="text-lg font-bold text-center" style={{ color: '#1e3a5f' }}>
              你的完整分析報告
            </h2>

            {/* 核心指標 */}
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-gray-50 rounded-xl p-3 text-center">
                <p className="text-[10px] text-gray-400 mb-1">估算 TDEE</p>
                <p className="text-xl font-bold text-gray-900">{result.estimatedTDEE.toLocaleString()}</p>
                <p className="text-[10px] text-gray-400">kcal/天</p>
              </div>
              <div className="bg-[#2563eb]/5 rounded-xl p-3 text-center border border-[#2563eb]/20">
                <p className="text-[10px] text-[#2563eb] mb-1">目標熱量</p>
                <p className="text-xl font-bold text-[#2563eb]">{result.suggestedCalories.toLocaleString()}</p>
                <p className="text-[10px] text-[#2563eb]">kcal/天</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3 text-center">
                <p className="text-[10px] text-gray-400 mb-1">每日{goalType === 'cut' ? '赤字' : '盈餘'}</p>
                <p className={`text-xl font-bold ${goalType === 'cut' ? 'text-green-600' : 'text-blue-600'}`}>
                  {Math.abs(result.dailyDeficit)}
                </p>
                <p className="text-[10px] text-gray-400">kcal</p>
              </div>
            </div>

            {/* 巨量營養素 */}
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-red-50 rounded-xl p-3 text-center border border-red-100">
                <p className="text-[10px] text-red-400 mb-1">🥩 蛋白質</p>
                <p className="text-lg font-bold text-red-700">{result.suggestedProtein}g</p>
                <p className="text-[10px] text-red-400">{(result.suggestedProtein * 4)} kcal</p>
              </div>
              <div className="bg-amber-50 rounded-xl p-3 text-center border border-amber-100">
                <p className="text-[10px] text-amber-500 mb-1">🍚 碳水</p>
                <p className="text-lg font-bold text-amber-700">{result.suggestedCarbs}g</p>
                <p className="text-[10px] text-amber-500">{(result.suggestedCarbs * 4)} kcal</p>
              </div>
              <div className="bg-yellow-50 rounded-xl p-3 text-center border border-yellow-200">
                <p className="text-[10px] text-yellow-600 mb-1">🥑 脂肪</p>
                <p className="text-lg font-bold text-yellow-700">{result.suggestedFat}g</p>
                <p className="text-[10px] text-yellow-600">{(result.suggestedFat * 9)} kcal</p>
              </div>
            </div>

            {/* 預估時程 */}
            {result.projectedWeeks != null && (
              <div className="bg-[#1e3a5f]/5 rounded-xl p-4 text-center">
                <p className="text-sm font-semibold" style={{ color: '#1e3a5f' }}>
                  🕐 預估 {result.projectedWeeks} 週達標
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  每週 {goalType === 'cut' ? '-' : '+'}{Math.abs(result.weeklyChangeKg).toFixed(2)} kg（{Math.abs(result.weeklyChangeRate).toFixed(1)}% BW/週）
                </p>
              </div>
            )}

            {/* 安全提醒 */}
            {result.safetyNotes.length > 0 && (
              <div className="space-y-2">
                {result.safetyNotes.map((note, i) => (
                  <div key={i} className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    <p className="text-xs text-amber-700">⚠️ {note}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* LINE 教練 upsell */}
        <div className="bg-gray-50 rounded-2xl p-6 text-center">
          <p className="text-sm text-gray-700 mb-1 leading-relaxed">
            想讓這些數據<span className="font-bold text-[#1e3a5f]">每週自動校正</span>？
          </p>
          <p className="text-sm text-gray-500 mb-4 leading-relaxed">
            訂閱後系統根據你的真實體重數據自動調整，搭配 CSCS 教練每週監督。
          </p>
          <LineButton
            source="diagnosis_purchased"
            intent="coaching_upsell"
            className="inline-block bg-[#06C755] text-white px-6 py-3 rounded-xl font-semibold hover:bg-[#05b34d] transition-colors shadow-sm"
          >
            加 LINE 了解訂閱方案 💬
          </LineButton>
        </div>
      </div>

      {/* 底部免責 */}
      <p className="text-center text-xs text-gray-400 mt-6 leading-relaxed">
        此為系統根據公開研究文獻與公式自動估算之參考數據，不構成個人化營養指導或醫療建議。
        <br />實際數值會因個人代謝、活動量、飲食記錄完整度而有差異。如有健康疑慮，請諮詢合格醫師或營養師。
      </p>
    </section>
  )
}
