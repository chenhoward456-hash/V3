'use client'

import { useState, useMemo } from 'react'
import { getLocalDateStr, daysUntilDateTW } from '@/lib/date-utils'
import { useMeasuredContainer } from '@/hooks/useMeasuredContainer'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'

type MetricKey = 'calories' | 'protein' | 'carbs' | 'fat'

interface NutritionTrendProps {
  nutritionLogs: any[]
  caloriesTarget?: number | null
  proteinTarget?: number | null
  carbsTarget?: number | null
  fatTarget?: number | null
  simpleMode?: boolean
  competitionEnabled?: boolean
  competitionDate?: string | null
}

// 顏色沿用 NutrientSlider 慣例：蛋白/熱量=品牌藍、碳水=amber、脂肪=yellow
const METRICS: Record<MetricKey, { label: string; unit: string; color: string; field: string }> = {
  calories: { label: '熱量', unit: 'kcal', color: '#3D6E9E', field: 'calories' },
  protein: { label: '蛋白質', unit: 'g', color: '#3D6E9E', field: 'protein_grams' },
  carbs: { label: '碳水', unit: 'g', color: '#D97706', field: 'carbs_grams' },
  fat: { label: '脂肪', unit: 'g', color: '#CA8A04', field: 'fat_grams' },
}

const RANGE_OPTIONS = [
  { days: 14, label: '近 14 天' },
  { days: 30, label: '近 30 天' },
]

export default function NutritionTrend({
  nutritionLogs, caloriesTarget, proteinTarget, carbsTarget, fatTarget, simpleMode,
  competitionEnabled, competitionDate,
}: NutritionTrendProps) {
  const [rangeDays, setRangeDays] = useState(30)
  const [metric, setMetric] = useState<MetricKey>('calories')
  const { ref: chartRef, measured } = useMeasuredContainer()

  // Peak Week 期間每日目標逐日不同（碳水後載），固定目標線會把超補日誤畫成爆表 → 隱藏固定目標，引導看 Peak Week 計畫
  const isPeakWeek = !!(competitionEnabled && competitionDate && (() => {
    const d = daysUntilDateTW(competitionDate)
    return d >= 0 && d <= 7
  })())

  const targets: Record<MetricKey, number | null | undefined> = isPeakWeek
    ? { calories: null, protein: null, carbs: null, fat: null }
    : { calories: caloriesTarget, protein: proteinTarget, carbs: carbsTarget, fat: fatTarget }

  // 建立 date → log 對照，避免依賴 nutritionLogs 排序
  const byDate = useMemo(() => {
    const m = new Map<string, any>()
    for (const l of nutritionLogs || []) if (l?.date) m.set(l.date, l)
    return m
  }, [nutritionLogs])

  // 近 N 天每日序列（舊→新），未記錄的日子留 null 讓折線斷開
  const series = useMemo(() => {
    const out: { date: string; rawDate: string; calories: number | null; protein: number | null; carbs: number | null; fat: number | null }[] = []
    const now = new Date()
    for (let i = rangeDays - 1; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(now.getDate() - i)
      const ds = getLocalDateStr(d)
      const log = byDate.get(ds)
      out.push({
        date: d.toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' }),
        rawDate: ds,
        calories: log?.calories ?? null,
        protein: log?.protein_grams ?? null,
        carbs: log?.carbs_grams ?? null,
        fat: log?.fat_grams ?? null,
      })
    }
    return out
  }, [byDate, rangeDays])

  // 各指標日均（只算有記錄的日子）+ 記錄天數
  const averages = useMemo(() => {
    const result: Record<MetricKey, { avg: number | null; days: number }> = {
      calories: { avg: null, days: 0 }, protein: { avg: null, days: 0 },
      carbs: { avg: null, days: 0 }, fat: { avg: null, days: 0 },
    }
    ;(Object.keys(METRICS) as MetricKey[]).forEach((k) => {
      const vals = series.map((s) => s[k]).filter((v): v is number => v != null)
      result[k] = {
        avg: vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null,
        days: vals.length,
      }
    })
    return result
  }, [series])

  // 顯示哪些指標：簡單模式只看熱量；否則顯示有資料或有目標的指標
  const visibleMetrics = useMemo(() => {
    const all: MetricKey[] = simpleMode ? ['calories'] : ['calories', 'protein', 'carbs', 'fat']
    return all.filter((k) => averages[k].days > 0 || targets[k])
  }, [simpleMode, averages, targets])

  // 完全沒有任何巨量營養素資料 → 空狀態引導，不畫圖
  const hasAnyData = visibleMetrics.some((k) => averages[k].days > 0)

  // 選定指標若被隱藏，退回第一個可見指標
  const activeMetric = visibleMetrics.includes(metric) ? metric : (visibleMetrics[0] || 'calories')
  const activeCfg = METRICS[activeMetric]
  const activeTarget = targets[activeMetric]

  const chartData = series.map((s) => ({ date: s.date, value: s[activeMetric] }))
  const yValues = chartData.map((d) => d.value).filter((v): v is number => v != null)
  if (activeTarget) yValues.push(activeTarget)
  const minY = yValues.length ? Math.max(0, Math.floor(Math.min(...yValues) * 0.9)) : 0
  const maxY = yValues.length ? Math.ceil(Math.max(...yValues) * 1.1) : 100

  if (!hasAnyData) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-6">
        <h2 className="text-lg font-bold text-gray-900 mb-2">營養攝取趨勢</h2>
        <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
          <p className="text-sm text-slate-600">
            填入每天的營養素數據，這裡就會顯示你這個月的攝取曲線和日均攝取量。
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-gray-900">營養攝取趨勢</h2>
        <div className="flex gap-1">
          {RANGE_OPTIONS.map((r) => (
            <button
              key={r.days}
              onClick={() => setRangeDays(r.days)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                rangeDays === r.days ? 'bg-primary-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {isPeakWeek && (
        <div className="bg-primary-50 border border-primary-100 rounded-xl px-4 py-2.5 mb-4">
          <p className="text-xs text-primary-700 leading-relaxed">
            Peak Week 期間每日目標依碳水後載計畫逐日調整，這裡不套固定目標線；當日目標請看上方 Peak Week 計畫。
          </p>
        </div>
      )}

      {/* 日均攝取量（學員最想看的「這個月平均」） */}
      <div className={`grid ${visibleMetrics.length >= 3 ? 'grid-cols-2 sm:grid-cols-4' : `grid-cols-${visibleMetrics.length}`} gap-3 mb-5`}>
        {visibleMetrics.map((k) => {
          const cfg = METRICS[k]
          const { avg, days } = averages[k]
          const tgt = targets[k]
          return (
            <div key={k} className="bg-slate-50 rounded-xl p-3 text-center">
              <p className="text-[11px] text-gray-500 mb-0.5">日均{cfg.label}</p>
              <p className="text-lg font-bold text-gray-900 tabular-nums">
                {avg != null ? avg : '--'}<span className="text-xs font-normal text-gray-400"> {cfg.unit}</span>
              </p>
              {tgt ? (
                <p className="text-[11px] text-gray-400 tabular-nums">目標 {tgt}{cfg.unit === 'kcal' ? '' : cfg.unit}</p>
              ) : (
                <p className="text-[11px] text-gray-400 tabular-nums">{days} 天記錄</p>
              )}
            </div>
          )
        })}
      </div>

      {/* 指標切換 */}
      {visibleMetrics.length > 1 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {visibleMetrics.map((k) => (
            <button
              key={k}
              onClick={() => setMetric(k)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                activeMetric === k ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {METRICS[k].label}
            </button>
          ))}
        </div>
      )}

      {/* 目標線圖例（含數值，避免圖內 label 被右緣裁切） */}
      {activeTarget ? (
        <div className="flex justify-end mb-1">
          <span className="flex items-center gap-1.5 text-[11px] text-gray-400">
            <span className="w-4 inline-block" style={{ borderTop: '1.5px dashed #f87171' }} />
            目標 {activeTarget}{activeCfg.unit === 'kcal' ? ' kcal' : activeCfg.unit}
          </span>
        </div>
      ) : null}

      {/* 每日折線圖 */}
      <div className="h-56 w-full min-w-0" ref={chartRef}>
        {measured && (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" fontSize={10} tick={{ fill: '#9ca3af' }} interval="preserveStartEnd" minTickGap={20} />
              <YAxis domain={[minY, maxY]} fontSize={10} tick={{ fill: '#9ca3af' }} width={36} />
              <Tooltip
                contentStyle={{ backgroundColor: 'rgba(0,0,0,0.85)', borderRadius: 8, border: 'none', fontSize: 12 }}
                labelStyle={{ color: '#ccc' }}
                formatter={(value: any) => [`${value} ${activeCfg.unit}`, activeCfg.label]}
              />
              {activeTarget ? (
                <ReferenceLine
                  y={activeTarget}
                  stroke="#f87171"
                  strokeDasharray="6 3"
                  strokeWidth={1.5}
                />
              ) : null}
              <Line
                type="monotone"
                dataKey="value"
                stroke={activeCfg.color}
                strokeWidth={2}
                dot={{ r: 2, fill: activeCfg.color }}
                connectNulls={false}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
      <p className="text-[11px] text-gray-400 mt-2 text-center">
        灰色斷點＝當天沒記錄；日均只計算有記錄的日子
      </p>
    </div>
  )
}
