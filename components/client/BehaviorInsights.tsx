'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import type { BehaviorInsight } from '@/lib/insight-engine'

interface BehaviorInsightsProps {
  clientId: string
  code: string
  isFree?: boolean
}

const categoryColors: Record<string, { bg: string; border: string; text: string }> = {
  sleep_training: { bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-700' },
  nutrition_mood: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700' },
  training_recovery: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700' },
  supplement_effect: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700' },
  trend: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700' },
}

const categoryLabels: Record<string, string> = {
  sleep_training: '睡眠 x 訓練',
  nutrition_mood: '飲食 x 情緒',
  training_recovery: '訓練 x 恢復',
  supplement_effect: '補品 x 感受',
  trend: '綜合趨勢',
}

const confidenceLabels: Record<string, { label: string; color: string }> = {
  high: { label: '資料充足', color: 'text-green-600' },
  medium: { label: '資料尚可', color: 'text-amber-600' },
  low: { label: '資料偏少', color: 'text-gray-400' },
}

// 模糊化的假 insight（免費用戶看到被鎖住的預覽）
const BLURRED_PREVIEWS = [
  { emoji: '💓', title: '高強度訓練後 HRV 下降', category: 'training_recovery' },
  { emoji: '🌙', title: '補品與睡眠品質連動', category: 'supplement_effect' },
  { emoji: '🧠', title: '整體狀態趨勢分析', category: 'trend' },
]

export default function BehaviorInsights({ clientId, code, isFree }: BehaviorInsightsProps) {
  const [insights, setInsights] = useState<BehaviorInsight[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchInsights = async () => {
      try {
        const res = await fetch(`/api/insights?clientId=${clientId}&code=${code}`)
        if (!res.ok) return
        const data = await res.json()
        setInsights(data.insights || [])
        setHasMore(data.hasMore || false)
        setTotalCount(data.totalCount || 0)
      } catch { /* ignore */ }
      finally { setLoading(false) }
    }
    fetchInsights()
  }, [clientId, code])

  if (loading) {
    return (
      <div className="bg-white rounded-3xl shadow-sm p-5 mb-4 animate-pulse">
        <div className="h-5 w-32 bg-gray-200 rounded mb-3" />
        <div className="space-y-3">
          <div className="h-16 bg-gray-100 rounded-xl" />
          <div className="h-16 bg-gray-100 rounded-xl" />
        </div>
      </div>
    )
  }

  if (insights.length === 0) return null

  // 判斷是否有「有意義的」insight（非 early/low-confidence）
  const hasMeaningfulInsight = insights.some(i => i.confidence !== 'low' && !i.id.startsWith('early-'))

  return (
    <div className="bg-white rounded-3xl shadow-sm p-5 mb-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">💡</span>
        <h2 className="text-base font-bold text-gray-900">你的數據告訴你</h2>
        <span className="text-[10px] text-gray-400 ml-auto">根據近 14 天行為數據</span>
      </div>

      <div className="space-y-2.5">
        {insights.map((insight, idx) => {
          const colors = categoryColors[insight.category] || categoryColors.trend
          const conf = confidenceLabels[insight.confidence] || confidenceLabels.medium

          return (
            <div key={insight.id}>
              <div className={`${colors.bg} ${colors.border} border rounded-2xl px-4 py-3`}>
                <div className="flex items-start gap-2.5">
                  <span className="text-xl shrink-0 mt-0.5">{insight.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className={`text-sm font-bold ${colors.text}`}>{insight.title}</p>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full bg-white/60 ${conf.color}`}>
                        {conf.label}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 leading-relaxed mb-1.5">
                      {insight.description}
                    </p>
                    <p className="text-xs font-medium text-gray-800">
                      {insight.suggestion}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-end mt-1.5">
                  <span className={`text-[9px] ${colors.text} opacity-60`}>
                    {categoryLabels[insight.category] || ''}
                  </span>
                </div>
              </div>

              {/* 上下文 CTA：在第一個有意義的 insight 後面推升級（僅免費用戶） */}
              {isFree && hasMeaningfulInsight && idx === 0 && insights.length >= 2 && (
                <div className="mt-2 mb-1 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl px-4 py-3 text-center">
                  <p className="text-xs text-white font-bold mb-1">
                    系統發現了 {totalCount} 個與你有關的行為模式
                  </p>
                  <p className="text-[10px] text-blue-100 mb-2">
                    升級後解鎖完整分析 — 包含跨維度交叉比對、趨勢預測、個人化建議
                  </p>
                  <Link
                    href="/upgrade"
                    className="inline-block bg-white text-blue-700 text-xs font-bold px-5 py-2 rounded-lg hover:bg-blue-50 transition-colors"
                  >
                    查看完整分析
                  </Link>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* 免費用戶：模糊化的鎖定預覽 */}
      {hasMore && (
        <div className="mt-3 space-y-2">
          {BLURRED_PREVIEWS.slice(0, Math.min(totalCount - insights.length, 3)).map((preview, i) => {
            const colors = categoryColors[preview.category] || categoryColors.trend
            return (
              <div
                key={i}
                className={`${colors.bg} ${colors.border} border rounded-2xl px-4 py-3 relative overflow-hidden`}
              >
                <div className="flex items-center gap-2.5 blur-[6px] select-none pointer-events-none">
                  <span className="text-xl">{preview.emoji}</span>
                  <div>
                    <p className={`text-sm font-bold ${colors.text}`}>{preview.title}</p>
                    <p className="text-xs text-gray-500">根據你的數據分析，這個模式值得關注...</p>
                  </div>
                </div>
                <div className="absolute inset-0 flex items-center justify-center bg-white/30">
                  <span className="text-xs font-bold text-gray-500 bg-white/80 px-3 py-1.5 rounded-full shadow-sm">
                    🔒 升級解鎖
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <p className="text-[9px] text-gray-400 mt-2 text-center">
        以上為教練級行為分析，非醫療建議
      </p>
    </div>
  )
}
