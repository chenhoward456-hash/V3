'use client'

import { useState, useEffect } from 'react'
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

export default function BehaviorInsights({ clientId, code, isFree }: BehaviorInsightsProps) {
  const [insights, setInsights] = useState<BehaviorInsight[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchInsights = async () => {
      try {
        const res = await fetch(`/api/insights?clientId=${clientId}&code=${code}`)
        if (!res.ok) return
        const data = await res.json()
        setInsights(data.insights || [])
        setHasMore(data.hasMore || false)
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

  return (
    <div className="bg-white rounded-3xl shadow-sm p-5 mb-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">💡</span>
        <h2 className="text-base font-bold text-gray-900">你的數據告訴你</h2>
        <span className="text-[10px] text-gray-400 ml-auto">根據近 14 天行為數據</span>
      </div>

      <div className="space-y-2.5">
        {insights.map((insight) => {
          const colors = categoryColors[insight.category] || categoryColors.trend
          const conf = confidenceLabels[insight.confidence] || confidenceLabels.medium

          return (
            <div
              key={insight.id}
              className={`${colors.bg} ${colors.border} border rounded-2xl px-4 py-3`}
            >
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
          )
        })}
      </div>

      {hasMore && (
        <div className="mt-3 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl px-4 py-3 text-center">
          <p className="text-xs text-blue-700 font-medium">
            還有更多洞察等你解鎖 — 升級後查看完整分析
          </p>
        </div>
      )}

      <p className="text-[9px] text-gray-400 mt-2 text-center">
        以上為教練級行為分析，非醫療建議
      </p>
    </div>
  )
}
