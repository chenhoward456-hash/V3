'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { analyzeDietaryPatterns } from '@/lib/ai-insights'
import { trackEvent } from '@/lib/analytics'

interface FreeInsightTeaserProps {
  nutritionLogs: Array<{
    date: string
    calories?: number | null
    protein_grams?: number | null
    carbs_grams?: number | null
    fat_grams?: number | null
    water_ml?: number | null
  }>
  bodyData: Array<{ date: string; weight?: number | null }>
  targets: {
    calories?: number | null
    protein?: number | null
    carbs?: number | null
    fat?: number | null
    water?: number | null
  }
}

export default function FreeInsightTeaser({
  nutritionLogs,
  bodyData,
  targets,
}: FreeInsightTeaserProps) {
  const analysis = useMemo(() => {
    // 至少 7 天數據才顯示
    if (nutritionLogs.length < 7) return null

    const patterns = analyzeDietaryPatterns(nutritionLogs, targets)

    // 計算簡單統計
    const last7 = nutritionLogs.slice(-7)
    const daysAnalyzed = last7.length

    // 蛋白質平均 vs 目標
    const proteinValues = last7
      .map((n) => n.protein_grams)
      .filter((v): v is number => v != null)
    const avgProtein =
      proteinValues.length > 0
        ? proteinValues.reduce((a, b) => a + b, 0) / proteinValues.length
        : null
    const proteinPct =
      avgProtein != null && targets.protein
        ? Math.round((avgProtein / targets.protein) * 100)
        : null

    // 週末 vs 平日熱量差
    const weekdayLogs = last7.filter((n) => {
      const day = new Date(n.date + 'T12:00:00').getDay()
      return day >= 1 && day <= 5
    })
    const weekendLogs = last7.filter((n) => {
      const day = new Date(n.date + 'T12:00:00').getDay()
      return day === 0 || day === 6
    })
    const avgWeekdayCal = calcAvg(weekdayLogs.map((n) => n.calories))
    const avgWeekendCal = calcAvg(weekendLogs.map((n) => n.calories))
    const calDiff =
      avgWeekdayCal != null && avgWeekendCal != null
        ? Math.round(avgWeekendCal - avgWeekdayCal)
        : null

    // 收集可見洞察（最多 2 條）
    const visibleInsights: string[] = []

    if (patterns.proteinDeficiency.detected && proteinPct != null) {
      visibleInsights.push(
        `蛋白質平均只達目標的 ${proteinPct}%，${patterns.proteinDeficiency.deficientDays}/${patterns.proteinDeficiency.totalDays} 天不足`
      )
    } else if (proteinPct != null && proteinPct < 90) {
      visibleInsights.push(`蛋白質平均達目標的 ${proteinPct}%`)
    }

    if (patterns.weekendOvereat.detected && calDiff != null) {
      visibleInsights.push(
        `週末平均多攝取 ${calDiff} kcal（平日 ${patterns.weekendOvereat.avgWeekdayCal} → 週末 ${patterns.weekendOvereat.avgWeekendCal}）`
      )
    }

    if (
      visibleInsights.length < 2 &&
      patterns.waterDeficiency.detected &&
      patterns.waterDeficiency.avgWater != null
    ) {
      visibleInsights.push(
        `平均水分攝取 ${patterns.waterDeficiency.avgWater}ml，低於目標的 70%`
      )
    }

    if (visibleInsights.length < 2 && patterns.carbsImbalance.detected) {
      visibleInsights.push(patterns.carbsImbalance.detail)
    }

    // 如果沒有偵測到任何模式，提供基礎統計
    if (visibleInsights.length === 0 && avgProtein != null && targets.protein) {
      visibleInsights.push(
        `蛋白質平均 ${Math.round(avgProtein)}g / 目標 ${targets.protein}g`
      )
    }

    return {
      daysAnalyzed,
      visibleInsights,
      hasPatterns:
        patterns.weekendOvereat.detected ||
        patterns.proteinDeficiency.detected ||
        patterns.carbsImbalance.detected ||
        patterns.waterDeficiency.detected,
    }
  }, [nutritionLogs, bodyData, targets])

  if (!analysis || analysis.visibleInsights.length === 0) return null

  // 鎖定的假洞察行
  const lockedLines = [
    '個人化碳水循環建議與每日目標調整',
    '體重停滯風險預警與突破策略',
    '根據你的數據生成的完整週報分析',
  ]

  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-4">
      {/* 標題 */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">📊</span>
        <div>
          <p className="text-sm font-semibold text-gray-800">
            本週 AI 分析完成
          </p>
          <p className="text-[11px] text-gray-500">
            已分析 {analysis.daysAnalyzed} 天的飲食數據
          </p>
        </div>
      </div>

      {/* 可見洞察 */}
      <div className="space-y-2 mb-3">
        {analysis.visibleInsights.map((insight, i) => (
          <div
            key={i}
            className="flex items-start gap-2 bg-white/70 rounded-xl px-3 py-2"
          >
            <span className="text-xs mt-0.5">
              {i === 0 ? '⚠️' : '📉'}
            </span>
            <p className="text-xs text-gray-700 leading-relaxed">{insight}</p>
          </div>
        ))}
      </div>

      {/* 鎖定的洞察 */}
      <div className="space-y-2 mb-4">
        {lockedLines.map((line, i) => (
          <div
            key={i}
            className="flex items-center gap-2 rounded-xl px-3 py-2 bg-white/40"
          >
            <svg
              className="w-3.5 h-3.5 text-gray-400 shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
              />
            </svg>
            <p className="text-xs text-gray-400 blur-[2px] select-none">
              {line}
            </p>
          </div>
        ))}
      </div>

      {/* 升級 CTA */}
      <Link
        href="/upgrade?from=free&feature=ai-weekly-insight"
        onClick={() =>
          trackEvent('upgrade_cta_clicked', {
            feature: 'free_insight_teaser',
            tier: 'self_managed',
          })
        }
        className="block w-full text-center bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs font-semibold px-5 py-2.5 rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-sm"
      >
        升級自主管理方案，解鎖完整 AI 分析 — NT$499/月
      </Link>
    </div>
  )
}

function calcAvg(values: (number | null | undefined)[]): number | null {
  const valid = values.filter((v): v is number => v != null)
  if (valid.length === 0) return null
  return valid.reduce((a, b) => a + b, 0) / valid.length
}
