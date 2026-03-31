'use client'

import { useMemo } from 'react'

interface ProgressJourneyProps {
  bodyData: Array<{ date: string; weight: number | null; body_fat: number | null }>
  wellness: Array<{ date: string; sleep_quality: number | null; energy_level: number | null; mood: number | null }>
  nutritionLogs: Array<{ date: string; compliant: boolean | null; protein_grams: number | null }>
  trainingLogs: Array<{ date: string; training_type: string }>
  bodyWeight: number
  goalType: string | null
}

interface ProgressMetric {
  label: string
  emoji: string
  current: string
  previous: string
  change: string
  trend: 'up' | 'down' | 'flat'
  isGood: boolean
}

function avg(nums: number[]): number {
  if (nums.length === 0) return 0
  return nums.reduce((a, b) => a + b, 0) / nums.length
}

export default function ProgressJourney({
  bodyData,
  wellness,
  nutritionLogs,
  trainingLogs,
  bodyWeight,
  goalType,
}: ProgressJourneyProps) {
  // DEBUG: 強制渲染測試 — 確認 component 有被 mount
  console.log('[ProgressJourney] mounted', { bodyData: bodyData.length, wellness: wellness.length, nutritionLogs: nutritionLogs.length, trainingLogs: trainingLogs.length })

  const progress = useMemo(() => {
    // 計算連續記錄天數（streak）
    const allDates = new Set([
      ...bodyData.map(b => b.date),
      ...wellness.map(w => w.date),
      ...nutritionLogs.map(n => n.date),
    ])
    const sortedDates = [...allDates].sort((a, b) => b.localeCompare(a)) // newest first
    let streak = 0
    const today = new Date()
    for (let i = 0; i < 60; i++) {
      const d = new Date(today)
      d.setDate(today.getDate() - i)
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      if (allDates.has(dateStr)) {
        streak++
      } else {
        if (i === 0) continue // 今天還沒填不算斷
        break
      }
    }

    // 拆分：最近 7 個日曆天 vs 前 7 個日曆天（用日期判斷，不是 index）
    const splitByWeek = <T extends { date: string }>(arr: T[]) => {
      const now = new Date()
      const thisWeekStart = new Date(now)
      thisWeekStart.setDate(now.getDate() - 6) // 今天往前 6 天 = 本週 7 天
      const lastWeekStart = new Date(now)
      lastWeekStart.setDate(now.getDate() - 13) // 再往前 7 天 = 上週 7 天

      const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      const thisWeekStr = fmt(thisWeekStart)
      const lastWeekStr = fmt(lastWeekStart)
      const todayStr = fmt(now)

      return {
        thisWeek: arr.filter(item => item.date >= thisWeekStr && item.date <= todayStr),
        lastWeek: arr.filter(item => item.date >= lastWeekStr && item.date < thisWeekStr),
      }
    }

    const metrics: ProgressMetric[] = []

    // 1. 體重趨勢
    const bodyWeek = splitByWeek(bodyData.filter(b => b.weight != null))
    if (bodyWeek.thisWeek.length >= 1 && bodyWeek.lastWeek.length >= 1) {
      const thisAvg = avg(bodyWeek.thisWeek.map(b => b.weight!))
      const lastAvg = avg(bodyWeek.lastWeek.map(b => b.weight!))
      const change = thisAvg - lastAvg
      const isCut = goalType === 'cut'
      metrics.push({
        label: '體重',
        emoji: '⚖️',
        current: `${thisAvg.toFixed(1)}kg`,
        previous: `${lastAvg.toFixed(1)}kg`,
        change: `${change > 0 ? '+' : ''}${change.toFixed(1)}kg`,
        trend: Math.abs(change) < 0.2 ? 'flat' : change > 0 ? 'up' : 'down',
        isGood: isCut ? change < -0.1 : change > 0.1,
      })
    }

    // 2. 飲食合規率
    const nutWeek = splitByWeek(nutritionLogs.filter(n => n.compliant != null))
    if (nutWeek.thisWeek.length >= 2 && nutWeek.lastWeek.length >= 2) {
      const thisRate = Math.round(nutWeek.thisWeek.filter(n => n.compliant).length / nutWeek.thisWeek.length * 100)
      const lastRate = Math.round(nutWeek.lastWeek.filter(n => n.compliant).length / nutWeek.lastWeek.length * 100)
      const change = thisRate - lastRate
      metrics.push({
        label: '飲食合規',
        emoji: '🥗',
        current: `${thisRate}%`,
        previous: `${lastRate}%`,
        change: `${change > 0 ? '+' : ''}${change}%`,
        trend: Math.abs(change) < 5 ? 'flat' : change > 0 ? 'up' : 'down',
        isGood: change >= 0,
      })
    }

    // 3. 蛋白質達標
    const proteinLogs = nutritionLogs.filter(n => n.protein_grams != null)
    const proWeek = splitByWeek(proteinLogs)
    if (proWeek.thisWeek.length >= 2 && proWeek.lastWeek.length >= 2) {
      const thisAvg = Math.round(avg(proWeek.thisWeek.map(n => n.protein_grams!)))
      const lastAvg = Math.round(avg(proWeek.lastWeek.map(n => n.protein_grams!)))
      const change = thisAvg - lastAvg
      metrics.push({
        label: '蛋白質',
        emoji: '🥩',
        current: `${thisAvg}g`,
        previous: `${lastAvg}g`,
        change: `${change > 0 ? '+' : ''}${change}g`,
        trend: Math.abs(change) < 5 ? 'flat' : change > 0 ? 'up' : 'down',
        isGood: change >= 0,
      })
    }

    // 4. 睡眠品質
    const sleepLogs = wellness.filter(w => w.sleep_quality != null)
    const sleepWeek = splitByWeek(sleepLogs)
    if (sleepWeek.thisWeek.length >= 2 && sleepWeek.lastWeek.length >= 2) {
      const thisAvg = avg(sleepWeek.thisWeek.map(w => w.sleep_quality!))
      const lastAvg = avg(sleepWeek.lastWeek.map(w => w.sleep_quality!))
      const change = thisAvg - lastAvg
      metrics.push({
        label: '睡眠',
        emoji: '😴',
        current: `${thisAvg.toFixed(1)}/5`,
        previous: `${lastAvg.toFixed(1)}/5`,
        change: `${change > 0 ? '+' : ''}${change.toFixed(1)}`,
        trend: Math.abs(change) < 0.3 ? 'flat' : change > 0 ? 'up' : 'down',
        isGood: change >= 0,
      })
    }

    // 5. 精力
    const energyLogs = wellness.filter(w => w.energy_level != null)
    const energyWeek = splitByWeek(energyLogs)
    if (energyWeek.thisWeek.length >= 2 && energyWeek.lastWeek.length >= 2) {
      const thisAvg = avg(energyWeek.thisWeek.map(w => w.energy_level!))
      const lastAvg = avg(energyWeek.lastWeek.map(w => w.energy_level!))
      const change = thisAvg - lastAvg
      metrics.push({
        label: '精力',
        emoji: '⚡',
        current: `${thisAvg.toFixed(1)}/5`,
        previous: `${lastAvg.toFixed(1)}/5`,
        change: `${change > 0 ? '+' : ''}${change.toFixed(1)}`,
        trend: Math.abs(change) < 0.3 ? 'flat' : change > 0 ? 'up' : 'down',
        isGood: change >= 0,
      })
    }

    // 6. 訓練頻率
    const trainWeek = splitByWeek(trainingLogs.filter(t => t.training_type && t.training_type !== 'rest'))
    if (trainWeek.lastWeek.length >= 1) {
      const thisDays = new Set(trainWeek.thisWeek.map(t => t.date)).size
      const lastDays = new Set(trainWeek.lastWeek.map(t => t.date)).size
      const change = thisDays - lastDays
      metrics.push({
        label: '訓練',
        emoji: '🏋️',
        current: `${thisDays}天`,
        previous: `${lastDays}天`,
        change: `${change > 0 ? '+' : ''}${change}天`,
        trend: change === 0 ? 'flat' : change > 0 ? 'up' : 'down',
        isGood: change >= 0,
      })
    }

    // 計算「進步中」的指標數量
    const improvingCount = metrics.filter(m => m.isGood && m.trend !== 'flat').length
    const totalWithTrend = metrics.filter(m => m.trend !== 'flat').length

    return { metrics, streak, improvingCount, totalWithTrend }
  }, [bodyData, wellness, nutritionLogs, trainingLogs, bodyWeight, goalType])

  // DEBUG: 暫時顯示數據狀態，確認 component 有被渲染
  if (progress.metrics.length < 1) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-3xl p-4 mb-4 text-xs text-yellow-800">
        <p className="font-bold mb-1">📈 進度（Debug）</p>
        <p>bodyData: {bodyData.length} 筆 | wellness: {wellness.length} 筆 | nutrition: {nutritionLogs.length} 筆 | training: {trainingLogs.length} 筆</p>
        <p>bodyWeight: {bodyWeight} | goalType: {goalType}</p>
        <p>metrics 產出: {progress.metrics.length} 個 | streak: {progress.streak}</p>
        {bodyData.length > 0 && <p>最新體重日期: {bodyData[0]?.date} | 最舊: {bodyData[bodyData.length-1]?.date}</p>}
        {wellness.length > 0 && <p>最新感受日期: {wellness[0]?.date} | 最舊: {wellness[wellness.length-1]?.date}</p>}
      </div>
    )
  }

  const { metrics, streak, improvingCount, totalWithTrend } = progress

  // 整體趨勢語句
  const summaryText = totalWithTrend === 0
    ? '持續記錄，下週就能看到趨勢'
    : improvingCount >= totalWithTrend * 0.7
    ? '多項指標都在進步，繼續保持！'
    : improvingCount >= totalWithTrend * 0.4
    ? '穩步前進中，部分指標還有提升空間'
    : '本週比較辛苦，先確保睡眠和飲食基本到位'

  return (
    <div className="bg-white rounded-3xl shadow-sm p-5 mb-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">📈</span>
          <h2 className="text-base font-bold text-gray-900">你的進度</h2>
        </div>
        {streak >= 3 && (
          <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full">
            🔥 連續 {streak} 天
          </span>
        )}
      </div>

      {/* Summary */}
      <p className="text-xs text-gray-500 mb-3">{summaryText}</p>

      {/* Metrics grid */}
      <div className="grid grid-cols-2 gap-2">
        {metrics.map((m) => {
          const trendIcon = m.trend === 'up' ? '↑' : m.trend === 'down' ? '↓' : '→'
          const trendColor = m.trend === 'flat'
            ? 'text-gray-400'
            : m.isGood
            ? 'text-green-600'
            : 'text-red-500'
          const bgColor = m.trend === 'flat'
            ? 'bg-gray-50'
            : m.isGood
            ? 'bg-green-50'
            : 'bg-red-50'

          return (
            <div key={m.label} className={`${bgColor} rounded-2xl p-3`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-500">{m.emoji} {m.label}</span>
                <span className={`text-[10px] font-bold ${trendColor}`}>
                  {trendIcon} {m.change}
                </span>
              </div>
              <p className="text-lg font-bold text-gray-900">{m.current}</p>
              <p className="text-[10px] text-gray-400">上週 {m.previous}</p>
            </div>
          )
        })}
      </div>

      {/* Week comparison label */}
      <p className="text-[9px] text-gray-400 mt-2 text-center">
        本週 vs 上週比較
      </p>
    </div>
  )
}
