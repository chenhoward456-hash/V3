'use client'

import { useMemo } from 'react'
import { daysUntilDateTW } from '@/lib/date-utils'
import { calcRecommendedStageWeight } from '@/lib/stage-weight'

interface CompletedItem {
  icon: string
  label: string
}

interface TrainingLog {
  date: string
  training_type: string
  duration?: number | null
  sets?: number | null
  rpe?: number | null
  compound_weight?: number | null
  compound_reps?: number | null
}

interface WellnessLog {
  date: string
  energy_level?: number | null
  sleep_quality?: number | null
  training_drive?: number | null
}

interface BodyDataPoint {
  date: string
  weight?: number | null
  body_fat?: number | null
}

interface TodayOverviewCardProps {
  overallStreak: number
  todayCompletedItems: CompletedItem[]
  isCompetition: boolean
  targetWeight: number | null
  competitionDate: string | null
  prepPhase: string | null
  gender: string | null
  latestBodyData: {
    weight?: number | null
    body_fat?: number | null
    height?: number | null
  } | null
  // New: data for daily insight
  trainingLogs?: TrainingLog[]
  wellness?: WellnessLog[]
  bodyData?: BodyDataPoint[]
}

interface DailyInsight {
  emoji: string
  message: string
  type: 'progress' | 'warning' | 'milestone' | 'trend' | 'gap' | 'neutral'
}

const MILESTONE_DAYS = [7, 14, 21, 30, 60, 90, 180, 365]

const TYPE_LABELS: Record<string, string> = {
  push: '推', pull: '拉', legs: '腿', full_body: '全身', upper_body: '上肢',
  cardio: '有氧', chest: '胸', shoulder: '肩', arms: '手臂',
}

function generateInsight(
  trainingLogs: TrainingLog[],
  wellness: WellnessLog[],
  bodyData: BodyDataPoint[],
  overallStreak: number,
): DailyInsight | null {
  const sorted = [...trainingLogs].sort((a, b) => b.date.localeCompare(a.date))
  const activeLogs = sorted.filter(l => l.training_type !== 'rest')

  // ── Priority 1: Training progress (compound lift trending up) ──
  const typesWithCompound = activeLogs.filter(l => l.compound_weight != null && l.compound_weight > 0)
  if (typesWithCompound.length >= 3) {
    // Group by training_type, check last 3 of same type
    const typeGroups: Record<string, TrainingLog[]> = {}
    for (const l of typesWithCompound) {
      if (!typeGroups[l.training_type]) typeGroups[l.training_type] = []
      typeGroups[l.training_type].push(l)
    }
    for (const [type, logs] of Object.entries(typeGroups)) {
      if (logs.length < 3) continue
      const last3 = logs.slice(0, 3) // already sorted desc
      const w = last3.map(l => l.compound_weight!)
      // Check if strictly increasing (oldest to newest)
      if (w[2] < w[1] && w[1] < w[0]) {
        const label = TYPE_LABELS[type] || type
        const gain = w[0] - w[2]
        return {
          emoji: '📈',
          message: `${label}主項連漲 3 次（+${gain}kg），保持這個節奏`,
          type: 'progress',
        }
      }
    }
  }

  // ── Priority 2: Recovery warning (yesterday high RPE + poor sleep/energy) ──
  if (activeLogs.length > 0 && wellness.length > 0) {
    const yesterday = activeLogs[0]
    if (yesterday.rpe != null && yesterday.rpe >= 9) {
      const sortedWellness = [...wellness].sort((a, b) => b.date.localeCompare(a.date))
      const recentW = sortedWellness[0]
      if (recentW) {
        const poorSleep = recentW.sleep_quality != null && recentW.sleep_quality <= 2
        const poorEnergy = recentW.energy_level != null && recentW.energy_level <= 2
        if (poorSleep || poorEnergy) {
          return {
            emoji: '⚠️',
            message: `上次訓練 RPE ${yesterday.rpe}${poorSleep ? '，睡眠品質偏低' : ''}${poorEnergy ? '，精力不足' : ''}。今天考慮降量`,
            type: 'warning',
          }
        }
      }
    }
  }

  // ── Priority 3: Streak milestone ──
  if (overallStreak > 0 && MILESTONE_DAYS.includes(overallStreak)) {
    const msgs: Record<number, string> = {
      7: '一週不中斷，習慣正在成形',
      14: '兩週了，身體開始適應你的節奏',
      21: '三週連續，你已經超過大部分人了',
      30: '整整一個月！這不是三分鐘熱度',
      60: '60 天連續記錄，自律已經內化了',
      90: '一整季不間斷，這就是長期主義',
      180: '半年了。你已經不是同一個人',
      365: '365 天。一整年。致敬。',
    }
    return {
      emoji: '🏆',
      message: `連續 ${overallStreak} 天——${msgs[overallStreak]}`,
      type: 'milestone',
    }
  }

  // ── Priority 4: Body composition trend (3+ weeks direction) ──
  if (bodyData.length >= 3) {
    const sortedBody = [...bodyData]
      .filter(b => b.body_fat != null)
      .sort((a, b) => a.date.localeCompare(b.date))
    if (sortedBody.length >= 3) {
      const last3 = sortedBody.slice(-3)
      const bfValues = last3.map(b => b.body_fat!)
      // Consistently decreasing
      if (bfValues[0] > bfValues[1] && bfValues[1] > bfValues[2]) {
        const drop = (bfValues[0] - bfValues[2]).toFixed(1)
        return {
          emoji: '🔥',
          message: `體脂連續下降中（-${drop}%），飲食和訓練正在起作用`,
          type: 'trend',
        }
      }
      // Consistently increasing (might be bad or good depending on goal)
      if (bfValues[0] < bfValues[1] && bfValues[1] < bfValues[2]) {
        const rise = (bfValues[2] - bfValues[0]).toFixed(1)
        return {
          emoji: '📊',
          message: `體脂連續 3 次上升（+${rise}%），留意飲食或考慮調整`,
          type: 'trend',
        }
      }
    }

    // Weight trend
    const sortedWeight = [...bodyData]
      .filter(b => b.weight != null)
      .sort((a, b) => a.date.localeCompare(b.date))
    if (sortedWeight.length >= 4) {
      const last4 = sortedWeight.slice(-4)
      const weights = last4.map(b => b.weight!)
      const allDown = weights.every((w, i) => i === 0 || w <= weights[i - 1])
      const allUp = weights.every((w, i) => i === 0 || w >= weights[i - 1])
      if (allDown && weights[0] - weights[3] >= 0.5) {
        return {
          emoji: '📉',
          message: `體重穩定下降中（${weights[3]}→${weights[0]}kg），趨勢正確`,
          type: 'trend',
        }
      }
      if (allUp && weights[3] - weights[0] >= 0.5) {
        return {
          emoji: '📈',
          message: `體重連續上升（${weights[0]}→${weights[3]}kg），確認是否符合目標`,
          type: 'trend',
        }
      }
    }
  }

  // ── Priority 5: Training gap (>5 days since a muscle group) ──
  const weightTypes = ['push', 'pull', 'legs', 'chest', 'shoulder', 'arms', 'full_body', 'upper_body']
  const trainedTypes = new Set(activeLogs.slice(0, 14).map(l => l.training_type).filter(t => weightTypes.includes(t)))
  if (trainedTypes.size > 0 && activeLogs.length >= 5) {
    for (const type of trainedTypes) {
      const lastOfType = activeLogs.find(l => l.training_type === type)
      if (lastOfType) {
        const daysAgo = Math.floor(
          (Date.now() - new Date(lastOfType.date + 'T12:00:00').getTime()) / (1000 * 60 * 60 * 24)
        )
        if (daysAgo >= 6) {
          const label = TYPE_LABELS[type] || type
          return {
            emoji: '💡',
            message: `${label}已經 ${daysAgo} 天沒練了，考慮排進這週`,
            type: 'gap',
          }
        }
      }
    }
  }

  // ── Fallback: streak info ──
  if (overallStreak >= 3) {
    return {
      emoji: '🔥',
      message: `連續第 ${overallStreak} 天記錄，繼續保持`,
      type: 'neutral',
    }
  }

  return null
}

const INSIGHT_STYLES: Record<DailyInsight['type'], { bg: string; border: string; text: string }> = {
  progress: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700' },
  warning: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700' },
  milestone: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700' },
  trend: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700' },
  gap: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700' },
  neutral: { bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-600' },
}

export default function TodayOverviewCard({
  overallStreak,
  todayCompletedItems,
  isCompetition,
  targetWeight,
  competitionDate,
  prepPhase,
  gender,
  latestBodyData,
  trainingLogs = [],
  wellness = [],
  bodyData = [],
}: TodayOverviewCardProps) {
  const insight = useMemo(
    () => generateInsight(trainingLogs, wellness, bodyData, overallStreak),
    [trainingLogs, wellness, bodyData, overallStreak]
  )

  const insightStyle = insight ? INSIGHT_STYLES[insight.type] : null

  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-2xl p-4 mb-3">
      {/* Daily Insight — the aha moment */}
      {insight && insightStyle && (
        <div className={`${insightStyle.bg} ${insightStyle.border} border rounded-xl px-3.5 py-2.5 mb-3`}>
          <p className={`text-sm font-medium ${insightStyle.text}`}>
            {insight.emoji} {insight.message}
          </p>
        </div>
      )}

      <div className="flex items-center justify-between mb-2">
        <div className="flex flex-wrap gap-1.5 flex-1">
          {todayCompletedItems.length > 0 ? (
            todayCompletedItems.map(item => (
              <span key={item.label} className="inline-flex items-center gap-0.5 bg-green-100 text-green-700 rounded-full px-2 py-0.5 text-[11px] font-medium">
                {item.icon} {item.label} ✓
              </span>
            ))
          ) : (
            <p className="text-xs text-gray-500">👋 今天還沒有紀錄</p>
          )}
        </div>
        {overallStreak > 0 && (
          <div className="flex items-center gap-1 bg-white rounded-full px-2.5 py-0.5 shadow-sm ml-2 shrink-0">
            <span className="text-xs">🔥</span>
            <span className="text-xs font-bold text-orange-600">{overallStreak}</span>
            <span className="text-[9px] text-gray-400">天</span>
          </div>
        )}
      </div>

      {/* 備賽模式：今日體重 vs 目標 */}
      {isCompetition && targetWeight && latestBodyData?.weight && (
        <div className="mt-2 pt-2 border-t border-blue-100 space-y-1">
          {(() => {
            const totalGap = Math.abs(latestBodyData.weight! - targetWeight)
            const waterCutPct = 0.02
            const peakWeekLoss = Math.round(latestBodyData.weight! * waterCutPct * 10) / 10
            const prePeakTarget = Math.round((targetWeight + peakWeekLoss) * 10) / 10
            const dietGap = Math.max(0, Math.round((latestBodyData.weight! - prePeakTarget) * 10) / 10)
            const daysLeft = competitionDate ? daysUntilDateTW(competitionDate) : null
            const showSplit = daysLeft != null && daysLeft > 7 && prepPhase !== 'peak_week'

            return (
              <>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-500">⚖️ 最新</span>
                  <span className="text-sm font-bold text-gray-800">{latestBodyData.weight} kg</span>
                  <span className="text-xs text-gray-400">→</span>
                  <span className="text-xs text-gray-500">🎯 上台</span>
                  <span className="text-sm font-bold text-red-500">{targetWeight} kg</span>
                  <span className={`text-xs font-medium ml-auto ${totalGap <= 1 ? 'text-green-600' : 'text-amber-600'}`}>
                    差 {totalGap.toFixed(1)} kg
                  </span>
                </div>
                {showSplit && totalGap > peakWeekLoss && (
                  <div className="flex items-center gap-2 text-[10px] text-indigo-500 bg-indigo-50 rounded-lg px-2 py-1">
                    <span>💧 飲食目標 {dietGap} kg</span>
                    <span className="text-gray-300">+</span>
                    <span>Peak Week 約 {peakWeekLoss} kg</span>
                  </div>
                )}
              </>
            )
          })()}
          {latestBodyData.body_fat && (() => {
            const rec = calcRecommendedStageWeight(
              latestBodyData.weight!,
              latestBodyData.body_fat!,
              gender ?? '男性',
              latestBodyData.height
            )
            return (
              <div className="text-xs text-gray-500 flex items-center gap-1 flex-wrap">
                <span>🔬 FFM {rec.ffm} kg</span>
                <span className="text-gray-300">｜</span>
                <span>參考上台範圍</span>
                <span className="font-semibold text-blue-600">{rec.recommendedLow}–{rec.recommendedHigh} kg</span>
                <span className="text-gray-400">（體脂 {rec.targetBFLow}–{rec.targetBFHigh}%）</span>
              </div>
            )
          })()}
        </div>
      )}
    </div>
  )
}
