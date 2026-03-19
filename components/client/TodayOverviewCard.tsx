'use client'

import { daysUntilDateTW } from '@/lib/date-utils'
import { calcRecommendedStageWeight } from '@/lib/stage-weight'

interface CompletedItem {
  icon: string
  label: string
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
}: TodayOverviewCardProps) {
  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-2xl p-4 mb-3">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">📋</span>
          <span className="text-sm font-semibold text-gray-700">今日概覽</span>
        </div>
        {overallStreak > 0 && (
          <div className="flex items-center gap-1.5 bg-white rounded-full px-3 py-1 shadow-sm">
            <span className="text-sm">🔥</span>
            <span className="text-sm font-bold text-orange-600">{overallStreak}</span>
            <span className="text-[10px] text-gray-500">天連續</span>
          </div>
        )}
      </div>

      {/* 今日完成項目 */}
      <div className="flex flex-wrap gap-2 mb-2">
        {todayCompletedItems.length > 0 ? (
          todayCompletedItems.map(item => (
            <span key={item.label} className="inline-flex items-center gap-1 bg-green-100 text-green-700 rounded-full px-2.5 py-1 text-xs font-medium">
              <span>{item.icon}</span> {item.label} ✓
            </span>
          ))
        ) : (
          <p className="text-xs text-gray-500">👋 今天還沒有紀錄，往下滑開始吧</p>
        )}
      </div>

      {/* 備賽模式：今日體重 vs 目標 */}
      {isCompetition && targetWeight && latestBodyData?.weight && (
        <div className="mt-2 pt-2 border-t border-blue-100 space-y-1">
          {/* Peak Week 體重拆分 */}
          {(() => {
            const totalGap = Math.abs(latestBodyData.weight! - targetWeight)
            const waterCutPct = 0.02  // 2% BW
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
          {/* 體態推算參考範圍（需要體脂率才顯示） */}
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
