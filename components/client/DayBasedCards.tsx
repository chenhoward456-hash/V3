'use client'

import type { Client } from '@/hooks/useClientData'
import type { NutritionLog as NutritionLogType } from '@/components/client/types'
import { DAY_MS } from '@/lib/date-utils'
import { RetentionCard, TDEECalibrationCard } from '@/components/client/RetentionCards'

interface DayBasedCardsProps {
  client: Client
  isFree: boolean
  isSelfManaged: boolean
  nutritionLogs: NutritionLogType[]
  setShowAiChat: (show: boolean) => void
}

export default function DayBasedCards({
  client: c,
  isFree,
  isSelfManaged,
  nutritionLogs,
  setShowAiChat,
}: DayBasedCardsProps) {
  if (!(isFree || isSelfManaged) || !c.created_at) return null

  const daysSinceSignup = Math.floor((Date.now() - new Date(c.created_at).getTime()) / DAY_MS)

  // 計算蛋白質達標率和熱量合規天數（Day 3 卡片用）
  const recentNutritionLogs = (nutritionLogs || []) as Array<NutritionLogType & { protein_grams?: number; calories?: number }>
  const logsWithProtein = recentNutritionLogs.filter((n) => n.protein_grams != null)
  const pTarget = c.protein_target as number | null
  const proteinHitRate = logsWithProtein.length > 0 && pTarget
    ? Math.round((logsWithProtein.filter((n) => (n.protein_grams ?? 0) >= pTarget * 0.9).length / logsWithProtein.length) * 100)
    : null
  const logsWithCalories = recentNutritionLogs.filter((n) => n.calories != null)
  const calTarget = c.calories_target as number | null
  const caloriesCompliantDays = logsWithCalories.length > 0 && calTarget
    ? logsWithCalories.filter((n) => Math.abs((n.calories ?? 0) - calTarget) <= calTarget * 0.1).length
    : null

  // Day 1-2 — 系統正在學習
  if (daysSinceSignup < 3) {
    return (
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-4 mb-3">
        <div className="flex items-start gap-3">
          <span className="text-xl flex-shrink-0">🧠</span>
          <div>
            <p className="text-sm font-bold text-gray-900 mb-1">系統正在學習你的代謝特性</p>
            <p className="text-xs text-gray-600 leading-relaxed mb-2">
              你剛開始使用 Howard Protocol，系統需要約 14 天的數據才能精準計算你的實際 TDEE。
            </p>
            <div className="text-xs text-gray-500 leading-relaxed space-y-1">
              <p>現階段請：</p>
              <p>• 每天記錄體重（越準確越好）</p>
              <p>• 正常飲食，不用刻意改變</p>
            </div>
            <p className="text-[10px] text-blue-500 mt-2">系統會在背景持續分析你的數據趨勢</p>
          </div>
        </div>
      </div>
    )
  }

  // P0: Day 3 — 第3天留存觸發卡片
  if (daysSinceSignup >= 3 && daysSinceSignup <= 4) {
    const totalLogDays = recentNutritionLogs.length
    return (
      <RetentionCard onDismiss={() => {}} id="day3">
        <div className="flex items-start gap-3">
          <span className="text-xl flex-shrink-0">🎯</span>
          <div className="flex-1">
            <p className="text-sm font-bold text-gray-900 mb-2">你已連續記錄 {Math.min(totalLogDays, daysSinceSignup)} 天</p>
            <div className="space-y-1.5 mb-3">
              {proteinHitRate != null && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-600">蛋白質平均達標率</span>
                  <span className={`font-bold ${proteinHitRate >= 80 ? 'text-green-600' : 'text-amber-600'}`}>{proteinHitRate}%</span>
                </div>
              )}
              {caloriesCompliantDays != null && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-600">熱量合規天數</span>
                  <span className="font-bold text-gray-800">{caloriesCompliantDays}/{logsWithCalories.length} 天</span>
                </div>
              )}
            </div>
            <p className="text-xs text-gray-500 leading-relaxed">
              系統正在學習你的代謝特性，繼續記錄到第 14 天，TDEE 會根據你的真實數據自動校正。
            </p>
          </div>
        </div>
      </RetentionCard>
    )
  }

  // P1: Day 7 — AI 顧問預覽
  if (daysSinceSignup >= 7 && daysSinceSignup <= 10 && c.nutrition_enabled) {
    return (
      <div className="bg-gradient-to-br from-violet-50 to-blue-50 border border-violet-200 rounded-2xl p-4 mb-3">
        <div className="flex items-start gap-3">
          <span className="text-xl flex-shrink-0">🤖</span>
          <div className="flex-1">
            <p className="text-sm font-bold text-gray-900 mb-1">試試 AI 私人顧問</p>
            <p className="text-xs text-gray-600 leading-relaxed mb-3">
              系統已經收集了一週的數據。AI 顧問知道你的飲食、訓練、睡眠紀錄，可以回答「我的進度正常嗎」「今天剩下的量要怎麼吃」這類問題。
            </p>
            <button
              onClick={() => setShowAiChat(true)}
              className="inline-flex items-center gap-1.5 bg-[#2563eb] text-white text-xs font-semibold px-4 py-2 rounded-xl hover:bg-[#1d4ed8] transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              試試看
              {!c.ai_chat_enabled && <span className="text-[10px] opacity-80">（每月 3 次免費）</span>}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // P0: Day 14+ — TDEE 校正完成 WOW Moment
  if (daysSinceSignup >= 14 && daysSinceSignup <= 21) {
    return <TDEECalibrationCard client={c} />
  }

  return null
}
