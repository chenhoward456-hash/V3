'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, BarChart, Bar, ReferenceLine, Cell
} from 'recharts'
import { ChevronLeft } from 'lucide-react'
import { useClientData } from '@/hooks/useClientData'
import { TRAINING_TYPES } from '@/components/client/types'

const getTypeBgColor = (type: string) => {
  const colors: Record<string, string> = {
    push: 'bg-red-100', pull: 'bg-blue-100', legs: 'bg-green-100',
    full_body: 'bg-purple-100', cardio: 'bg-orange-100', chest: 'bg-pink-100',
    shoulder: 'bg-indigo-100', arms: 'bg-yellow-100', rest: 'bg-gray-100',
  }
  return colors[type] || 'bg-gray-100'
}
const getTypeEmoji = (type: string) => TRAINING_TYPES.find(t => t.value === type)?.emoji || ''
const getStatusColor = (status: string) => {
  if (status === 'normal') return 'bg-green-100 text-green-700'
  if (status === 'attention') return 'bg-yellow-100 text-yellow-700'
  return 'bg-red-100 text-red-700'
}

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('zh-TW', { month: '2-digit', day: '2-digit' })

interface TrainingSet {
  id: string
  date: string
  exercise_name: string
  muscle_group: string | null
  set_number: number
  weight: number | null
  reps: number | null
  rpe: number | null
  is_main_lift: boolean
}

export default function ClientOverviewPage() {
  const { clientId } = useParams()
  const { data: clientData, isLoading, error } = useClientData(clientId as string)
  const [trainingSets, setTrainingSets] = useState<TrainingSet[]>([])

  const c = clientData?.client

  // 全部 sort ASC（API 回傳 DESC）
  const bodyData = useMemo(
    () => (clientData?.bodyData || []).slice().sort((a, b) => a.date.localeCompare(b.date)),
    [clientData?.bodyData]
  )
  const wellness = useMemo(
    () => (clientData?.wellness || []).slice().sort((a, b) => a.date.localeCompare(b.date)),
    [clientData?.wellness]
  )
  const trainingLogs = useMemo(
    () => (clientData?.trainingLogs || []).slice().sort((a, b) => a.date.localeCompare(b.date)),
    [clientData?.trainingLogs]
  )
  const nutritionLogs = useMemo(
    () => (clientData?.nutritionLogs || []).slice().sort((a, b) => a.date.localeCompare(b.date)),
    [clientData?.nutritionLogs]
  )
  const supplementLogs = clientData?.recentLogs || []
  const supplements = (c?.supplements || []) as any[]
  const labResults = (c?.lab_results || []) as any[]

  const isCoachGuided = c
    ? (c.subscription_tier !== 'free' && c.subscription_tier !== 'self_managed')
    : false

  // Coach tier: fetch training_sets for E1RM / volume / muscle group
  useEffect(() => {
    if (!isCoachGuided || !c?.unique_code) return
    fetch(`/api/training-sets-range?clientId=${c.unique_code}&days=90`)
      .then(r => r.ok ? r.json() : null)
      .then(j => { if (j?.data) setTrainingSets(j.data) })
      .catch(() => {})
  }, [isCoachGuided, c?.unique_code])

  // ===== 連續打卡 streak =====
  const streak = useMemo(() => {
    const activityDates = new Set<string>()
    bodyData.forEach(b => activityDates.add(b.date))
    trainingLogs.forEach(t => activityDates.add(t.date))
    nutritionLogs.forEach((n: any) => activityDates.add(n.date))
    wellness.forEach(w => activityDates.add(w.date))
    ;(supplementLogs as any[]).forEach(l => { if (l.completed || l.taken) activityDates.add(l.date) })

    const today = new Date(); today.setHours(0, 0, 0, 0)
    const todayStr = today.toISOString().split('T')[0]
    const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1)
    const yesterdayStr = yesterday.toISOString().split('T')[0]

    let cursor: Date
    if (activityDates.has(todayStr)) cursor = today
    else if (activityDates.has(yesterdayStr)) cursor = yesterday
    else return 0

    let count = 0
    while (true) {
      const cs = cursor.toISOString().split('T')[0]
      if (!activityDates.has(cs)) break
      count++
      cursor.setDate(cursor.getDate() - 1)
    }
    return count
  }, [bodyData, trainingLogs, nutritionLogs, wellness, supplementLogs])

  // ===== 本週摘要（rolling 7 天）=====
  const weekSummary = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const weekAgo = new Date(today); weekAgo.setDate(today.getDate() - 6)
    const startStr = weekAgo.toISOString().split('T')[0]
    const todayStr = today.toISOString().split('T')[0]

    const trainDays = trainingLogs.filter(l =>
      l.date >= startStr && l.date <= todayStr && l.training_type !== 'rest'
    ).length

    const wkBody = bodyData.filter(b => b.date >= startStr && b.date <= todayStr && b.weight != null)
    const earliest7d = bodyData.filter(b => b.weight != null).slice(0, Math.max(1, Math.floor(wkBody.length / 2)))
    const recentAvg = wkBody.length
      ? wkBody.slice(-3).reduce((s, b) => s + Number(b.weight), 0) / Math.min(3, wkBody.length)
      : null
    const earlyAvg = wkBody.length >= 2
      ? wkBody.slice(0, Math.min(3, wkBody.length)).reduce((s, b) => s + Number(b.weight), 0) / Math.min(3, wkBody.length)
      : null
    const weightDelta = recentAvg != null && earlyAvg != null ? recentAvg - earlyAvg : null

    const wkNutri = nutritionLogs.filter((n: any) => n.date >= startStr && n.date <= todayStr)
    const proteinTarget = c?.protein_target ? Number(c.protein_target) : null
    const proteinHits = proteinTarget
      ? wkNutri.filter((n: any) => n.protein_grams != null && Number(n.protein_grams) >= proteinTarget * 0.9).length
      : null
    const proteinTotalLogs = wkNutri.filter((n: any) => n.protein_grams != null).length

    return { trainDays, weightDelta, proteinHits, proteinTotalLogs, hasProteinTarget: !!proteinTarget }
  }, [trainingLogs, bodyData, nutritionLogs, c?.protein_target])

  // ===== 體重 / 體脂 趨勢 =====
  const bodyTrend = useMemo(() => {
    const weight = bodyData.filter(b => b.weight != null).map(b => ({
      date: fmtDate(b.date), 體重: Number(b.weight),
    }))
    const bodyFat = bodyData.filter(b => b.body_fat != null).map(b => ({
      date: fmtDate(b.date), 體脂: Number(b.body_fat),
    }))
    return { weight, bodyFat }
  }, [bodyData])

  // ===== 週平均體重（滾動 7 天 × 8 週 + 趨勢）=====
  const weeklyWeight = useMemo(() => {
    const withWeight = bodyData
      .filter(b => b.weight != null && !Number.isNaN(Number(b.weight)))
      .map(b => ({ date: b.date as string, weight: Number(b.weight) }))

    if (withWeight.length === 0) return null

    const today = new Date(); today.setHours(0, 0, 0, 0)
    const weeks: Array<{ label: string; avg: number | null; count: number }> = []
    for (let i = 7; i >= 0; i--) {
      const end = new Date(today); end.setDate(today.getDate() - i * 7)
      const start = new Date(end); start.setDate(end.getDate() - 6)
      const startStr = start.toISOString().split('T')[0]
      const endStr = end.toISOString().split('T')[0]
      const inWeek = withWeight.filter(e => e.date >= startStr && e.date <= endStr)
      const avg = inWeek.length > 0 ? inWeek.reduce((s, e) => s + e.weight, 0) / inWeek.length : null
      weeks.push({ label: i === 0 ? '本週' : `${i}週前`, avg, count: inWeek.length })
    }
    const filled = weeks.filter(w => w.avg != null)
    if (filled.length < 2) return null
    const current = filled[filled.length - 1]!
    const previous = filled[filled.length - 2]!
    const fourWeeksAgo = filled.length >= 5 ? filled[filled.length - 5] : null
    const delta1w = current.avg! - previous.avg!
    const delta4w = fourWeeksAgo ? current.avg! - fourWeeksAgo.avg! : null

    let slope: number | null = null
    const points = weeks.map((w, idx) => ({ x: idx, y: w.avg })).filter(p => p.y != null) as Array<{ x: number; y: number }>
    if (points.length >= 3) {
      const n = points.length
      const mx = points.reduce((s, p) => s + p.x, 0) / n
      const my = points.reduce((s, p) => s + p.y, 0) / n
      let num = 0, den = 0
      for (const p of points) { num += (p.x - mx) * (p.y - my); den += (p.x - mx) ** 2 }
      if (den > 0) slope = num / den
    }

    const chartData = weeks.map(w => ({ label: w.label, 體重: w.avg }))
    return { chartData, current: current.avg!, delta1w, delta4w, slope }
  }, [bodyData])

  // ===== 目標進度 =====
  const goalProgress = useMemo(() => {
    if (!c?.target_weight || !weeklyWeight) return null
    const target = Number(c.target_weight)
    const cur = weeklyWeight.current
    const diff = cur - target
    return {
      target,
      current: cur,
      diff,
      direction: c.goal_type === 'cut' ? 'down' : c.goal_type === 'bulk' ? 'up' : 'maintain',
    }
  }, [c?.target_weight, c?.goal_type, weeklyWeight])

  // ===== 訓練日曆（6 週） =====
  const calendarWeeks = useMemo(() => {
    const now = new Date()
    const today = now.toISOString().split('T')[0]
    const dayOfWeek = now.getDay()
    const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1
    const thisMonday = new Date(now); thisMonday.setDate(now.getDate() - mondayOffset)

    const weeks: { date: string; label: string; log: any; isToday: boolean; isFuture: boolean }[][] = []
    for (let w = 5; w >= 0; w--) {
      const week: typeof weeks[0] = []
      for (let d = 0; d < 7; d++) {
        const date = new Date(thisMonday)
        date.setDate(thisMonday.getDate() - w * 7 + d)
        const dateStr = date.toISOString().split('T')[0]
        week.push({
          date: dateStr,
          label: date.getDate().toString(),
          log: trainingLogs.find(l => l.date === dateStr) || null,
          isToday: dateStr === today,
          isFuture: dateStr > today,
        })
      }
      weeks.push(week)
    }
    return weeks
  }, [trainingLogs])

  const trainingDistribution = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const log of trainingLogs.filter(l => l.training_type !== 'rest')) {
      counts[log.training_type] = (counts[log.training_type] || 0) + 1
    }
    return Object.entries(counts)
      .map(([type, count]) => ({ name: TRAINING_TYPES.find(t => t.value === type)?.label || type, 次數: count }))
      .sort((a, b) => b.次數 - a.次數)
  }, [trainingLogs])

  const rpeTrend = useMemo(() => {
    return trainingLogs
      .filter(l => l.rpe != null && l.training_type !== 'rest')
      .map(l => ({
        date: fmtDate(l.date),
        RPE: l.rpe,
        type: TRAINING_TYPES.find(t => t.value === l.training_type)?.label || l.training_type,
      }))
  }, [trainingLogs])

  // ===== 蛋白質 / 飲水 趨勢 =====
  const proteinTrend = useMemo(() => {
    return nutritionLogs
      .filter((l: any) => l.protein_grams != null)
      .map((l: any) => ({ date: fmtDate(l.date), 蛋白質: Number(l.protein_grams) }))
  }, [nutritionLogs])
  const waterTrend = useMemo(() => {
    return nutritionLogs
      .filter((l: any) => l.water_ml != null)
      .map((l: any) => ({ date: fmtDate(l.date), 飲水ml: Number(l.water_ml) }))
  }, [nutritionLogs])
  const caloriesTrend = useMemo(() => {
    return nutritionLogs
      .filter((l: any) => l.calories != null)
      .map((l: any) => ({ date: fmtDate(l.date), 卡路里: Number(l.calories) }))
  }, [nutritionLogs])

  // ===== 補品服從率（14 天） =====
  const complianceTrend = useMemo(() => {
    if (!supplements.length || !supplementLogs.length) return []
    const total = supplements.length
    const now = new Date()
    const rangeStart = new Date(now); rangeStart.setDate(now.getDate() - 13)
    const startStr = rangeStart.toISOString().split('T')[0]
    const todayStr = now.toISOString().split('T')[0]
    const byDate: Record<string, number> = {}
    for (const log of supplementLogs as any[]) {
      const taken = (log.completed ?? log.taken) === true
      if (taken && log.date >= startStr && log.date <= todayStr) {
        byDate[log.date] = (byDate[log.date] || 0) + 1
      }
    }
    return Object.entries(byDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date: fmtDate(date), 服從率: Math.round((count / total) * 100) }))
  }, [supplements, supplementLogs])

  // ===== 感受趨勢 =====
  const wellnessTrend = useMemo(() => {
    if (!wellness.length) return []
    return wellness
      .filter(w => w.sleep_quality != null || w.energy_level != null || w.mood != null)
      .map(w => ({
        date: fmtDate(w.date),
        睡眠: w.sleep_quality,
        精力: w.energy_level,
        心情: w.mood,
      }))
  }, [wellness])

  // ===== 血檢最新 =====
  const latestLabs = useMemo(() => {
    const sorted = [...labResults].sort((a, b) => (b.date || '').localeCompare(a.date || ''))
    const byName = new Map<string, any>()
    for (const r of sorted) {
      if (!byName.has(r.test_name)) byName.set(r.test_name, r)
    }
    return [...byName.values()]
  }, [labResults])

  // ===== E1RM 趨勢（主項力量，按 exercise 分組）=====
  const e1rmTrend = useMemo(() => {
    if (trainingSets.length === 0) return [] as any[]
    const byExDate: Record<string, Record<string, number>> = {}
    for (const s of trainingSets) {
      if (!s.is_main_lift) continue
      if (s.weight == null || s.reps == null || s.reps <= 0 || s.reps > 10) continue
      const e1rm = Number(s.weight) * 36 / (37 - Number(s.reps))
      const key = s.exercise_name
      if (!byExDate[key]) byExDate[key] = {}
      byExDate[key][s.date] = Math.max(byExDate[key][s.date] || 0, e1rm)
    }
    // Pick top 3 exercises by count of dates
    const topExs = Object.entries(byExDate)
      .map(([k, v]) => ({ exercise: k, dates: Object.keys(v).length }))
      .sort((a, b) => b.dates - a.dates)
      .slice(0, 3)
      .map(e => e.exercise)
    if (topExs.length === 0) return []
    // Merge into one chart data
    const allDates = new Set<string>()
    for (const ex of topExs) Object.keys(byExDate[ex]).forEach(d => allDates.add(d))
    const sortedDates = [...allDates].sort()
    return sortedDates.map(d => {
      const row: any = { date: fmtDate(d) }
      for (const ex of topExs) {
        if (byExDate[ex][d]) row[ex] = Math.round(byExDate[ex][d])
      }
      return row
    })
  }, [trainingSets])

  // ===== 每週訓練量（總 tonnage）=====
  const weeklyTonnage = useMemo(() => {
    if (trainingSets.length === 0) return []
    const byWeek: Record<string, number> = {}
    for (const s of trainingSets) {
      if (s.weight == null || s.reps == null) continue
      const d = new Date(s.date)
      const dow = d.getDay()
      const mondayOff = dow === 0 ? 6 : dow - 1
      const monday = new Date(d); monday.setDate(d.getDate() - mondayOff)
      const wk = monday.toISOString().split('T')[0]
      byWeek[wk] = (byWeek[wk] || 0) + Number(s.weight) * Number(s.reps)
    }
    return Object.entries(byWeek)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([wk, ton]) => ({ week: fmtDate(wk), 訓練量: Math.round(ton) }))
  }, [trainingSets])

  // ===== 每肌群週組數（最近一週）=====
  const muscleVolume = useMemo(() => {
    if (trainingSets.length === 0) return []
    const today = new Date()
    const start = new Date(today); start.setDate(today.getDate() - 6)
    const startStr = start.toISOString().split('T')[0]
    const counts: Record<string, number> = {}
    for (const s of trainingSets) {
      if (s.date < startStr) continue
      const mg = s.muscle_group || '其他'
      counts[mg] = (counts[mg] || 0) + 1
    }
    return Object.entries(counts)
      .map(([肌群, 組數]) => ({ 肌群, 組數 }))
      .sort((a, b) => b.組數 - a.組數)
  }, [trainingSets])

  // ===== 「Howard 解讀」一句話（規則 driven）=====
  const goalInsight = useMemo(() => {
    if (!goalProgress || !weeklyWeight?.slope) return null
    const slope = weeklyWeight.slope
    const dir = goalProgress.direction
    if (dir === 'down') {
      if (slope < -0.1) return `速率 ${slope.toFixed(2)} kg/週，符合健康減脂節奏 ✅`
      if (slope > 0.1) return `近 8 週略有上升（${slope.toFixed(2)} kg/週），檢視熱量缺口或睡眠`
      return '體重持平，可能要再加大熱量缺口或檢視水分波動'
    }
    if (dir === 'up') {
      if (slope > 0.1) return `速率 ${slope.toFixed(2)} kg/週，增重節奏穩定 ✅`
      if (slope < -0.1) return `體重下滑中（${slope.toFixed(2)} kg/週），熱量需要再加`
      return '體重持平，需要再增加熱量或加強訓練'
    }
    return '維持階段，體重在合理範圍內波動就好'
  }, [goalProgress, weeklyWeight])

  const weeklyWeightInsight = useMemo(() => {
    if (!weeklyWeight) return null
    if (weeklyWeight.delta4w == null) return '資料還在累積，4 週後解讀會更穩定'
    const abs = Math.abs(weeklyWeight.delta4w)
    if (abs < 0.5) return '4 週變化 < 0.5 kg，處於穩定期'
    const dir = weeklyWeight.delta4w > 0 ? '上升' : '下降'
    return `近 4 週${dir} ${abs.toFixed(1)} kg，週平均比每日量測更能反映真實趨勢`
  }, [weeklyWeight])

  const rpeInsight = useMemo(() => {
    const recent = rpeTrend.slice(-7).map(r => Number(r.RPE)).filter(v => !Number.isNaN(v))
    if (recent.length < 3) return null
    const avg = recent.reduce((s, v) => s + v, 0) / recent.length
    if (avg > 8.5) return `近 7 次平均 RPE ${avg.toFixed(1)}，強度偏高，注意恢復與睡眠`
    if (avg < 6) return `近 7 次平均 RPE ${avg.toFixed(1)}，強度偏低，可考慮加重或增組`
    return `近 7 次平均 RPE ${avg.toFixed(1)}，落在進步區間 ✅`
  }, [rpeTrend])

  const e1rmInsight = useMemo(() => {
    if (e1rmTrend.length < 2) return null
    const first = e1rmTrend[0]
    const last = e1rmTrend[e1rmTrend.length - 1]
    const exs = Object.keys(first).filter(k => k !== 'date')
    const lines: string[] = []
    for (const ex of exs) {
      if (first[ex] != null && last[ex] != null) {
        const diff = (last[ex] as number) - (first[ex] as number)
        const sign = diff > 0 ? '+' : ''
        lines.push(`${ex} ${sign}${diff.toFixed(0)} kg`)
      }
    }
    return lines.length ? `90 天變化：${lines.join('　·　')}` : null
  }, [e1rmTrend])

  const tonnageInsight = useMemo(() => {
    if (weeklyTonnage.length < 2) return null
    const last = weeklyTonnage[weeklyTonnage.length - 1].訓練量
    const prev = weeklyTonnage[weeklyTonnage.length - 2].訓練量
    if (prev === 0) return null
    const pct = ((last - prev) / prev) * 100
    if (Math.abs(pct) < 5) return '本週訓練量與上週相當，維持穩定 ✅'
    if (pct > 0) return `本週訓練量比上週 +${pct.toFixed(0)}%，進步槓桿在累積`
    return `本週訓練量比上週 ${pct.toFixed(0)}%，看是 deload 還是強度下滑`
  }, [weeklyTonnage])

  const muscleInsight = useMemo(() => {
    if (muscleVolume.length === 0) return null
    const low = muscleVolume.filter(m => m.組數 < 6).map(m => m.肌群)
    const high = muscleVolume.filter(m => m.組數 >= 10).map(m => m.肌群)
    if (low.length === 0 && high.length > 0) return `${high.join('、')} 已達 10+ 組，本週分配充足 ✅`
    if (low.length > 0) return `${low.join('、')} 本週 < 6 組，建議補強`
    return '本週各肌群分配均衡'
  }, [muscleVolume])

  const complianceInsight = useMemo(() => {
    if (complianceTrend.length < 3) return null
    const avg = complianceTrend.reduce((s, c) => s + c.服從率, 0) / complianceTrend.length
    if (avg >= 80) return `平均 ${avg.toFixed(0)}%，補品服從率很高 ✅`
    if (avg >= 50) return `平均 ${avg.toFixed(0)}%，有進步空間`
    return `平均 ${avg.toFixed(0)}%，記得每天吃完補品才有效果`
  }, [complianceTrend])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">載入你的數據...</p>
        </div>
      </div>
    )
  }

  if (error || !c) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">載入失敗</h1>
          <p className="text-gray-600 mb-4">找不到你的資料，請回首頁重試。</p>
          <Link href={`/c/${clientId}`} className="text-blue-600 underline">回首頁</Link>
        </div>
      </div>
    )
  }

  const totalTrainingDays = trainingLogs.filter(l => l.training_type !== 'rest').length
  const totalWeighIns = bodyData.filter(b => b.weight != null).length
  const slopeText = weeklyWeight?.slope != null
    ? `${weeklyWeight.slope > 0 ? '+' : ''}${weeklyWeight.slope.toFixed(2)} kg/週`
    : '—'

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href={`/c/${clientId}`} className="flex items-center gap-1 text-gray-600 hover:text-gray-900">
            <ChevronLeft size={20} />
            <span className="text-sm">返回</span>
          </Link>
          <h1 className="text-base font-bold text-gray-900">📊 我的完整數據</h1>
          <div className="w-12" />
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-5 space-y-4">
        {/* 摘要 + Streak + 本週一句話 */}
        <div className="bg-zinc-900 rounded-2xl p-5 text-white">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-emerald-400 font-semibold">{c.name}</p>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-5xl font-black tracking-tight tabular-nums">{streak}</span>
                <span className="text-xs text-zinc-400">天連續打卡</span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-wider text-zinc-500">累積</p>
              <p className="text-3xl font-black tabular-nums">{Math.max(totalTrainingDays, totalWeighIns, wellness.length)}</p>
              <p className="text-[10px] text-zinc-500">天</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 mt-5 pt-4 border-t border-white/10">
            <div>
              <p className="text-xl font-bold tabular-nums">{totalTrainingDays}</p>
              <p className="text-[10px] uppercase tracking-wider text-zinc-500 mt-0.5">訓練</p>
            </div>
            <div>
              <p className="text-xl font-bold tabular-nums">{totalWeighIns}</p>
              <p className="text-[10px] uppercase tracking-wider text-zinc-500 mt-0.5">量測</p>
            </div>
            <div>
              <p className="text-xl font-bold tabular-nums">{wellness.length}</p>
              <p className="text-[10px] uppercase tracking-wider text-zinc-500 mt-0.5">感受</p>
            </div>
          </div>

          {/* 本週一句話摘要 */}
          <div className="mt-4 pt-3 border-t border-white/10">
            <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1.5">本週（近 7 天）</p>
            <p className="text-sm leading-relaxed text-zinc-200">
              訓練 <b>{weekSummary.trainDays}</b> 天
              {weekSummary.weightDelta != null && (
                <>
                  {' · '}體重{' '}
                  <b>{weekSummary.weightDelta > 0 ? '+' : ''}{weekSummary.weightDelta.toFixed(1)}</b> kg
                </>
              )}
              {weekSummary.hasProteinTarget && weekSummary.proteinTotalLogs > 0 && (
                <>
                  {' · '}蛋白質達標 <b>{weekSummary.proteinHits}/{weekSummary.proteinTotalLogs}</b> 天
                </>
              )}
            </p>
          </div>
        </div>

        {/* 目標進度 + 週平均體重 — 並排 */}
        {(goalProgress || weeklyWeight) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {goalProgress && (
              <div className="bg-white rounded-2xl shadow-sm p-5">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">🎯 目標進度</h3>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-gray-900">{goalProgress.current.toFixed(1)}</span>
                  <span className="text-sm text-gray-500">kg → {goalProgress.target.toFixed(1)} kg</span>
                </div>
                <p className={`text-sm mt-2 ${
                  goalProgress.direction === 'down'
                    ? goalProgress.diff > 0 ? 'text-amber-600' : 'text-green-600'
                    : goalProgress.direction === 'up'
                      ? goalProgress.diff < 0 ? 'text-amber-600' : 'text-green-600'
                      : 'text-gray-600'
                }`}>
                  {goalProgress.diff > 0 ? `還差 ${goalProgress.diff.toFixed(1)} kg` : goalProgress.diff < 0 ? `已超過 ${Math.abs(goalProgress.diff).toFixed(1)} kg` : '達成目標'}
                </p>
                <p className="text-xs text-gray-500 mt-2">
                  目標方向：{goalProgress.direction === 'down' ? '減脂' : goalProgress.direction === 'up' ? '增肌' : '維持'}
                  　·　當前趨勢：{slopeText}
                </p>
                {goalInsight && (
                  <div className="mt-3 pt-2 border-t border-gray-100 flex items-start gap-1.5">
                    <span className="text-[9px] uppercase tracking-wider font-semibold text-emerald-600">解讀</span>
                    <p className="text-[11px] text-gray-600 leading-relaxed">{goalInsight}</p>
                  </div>
                )}
              </div>
            )}
            {weeklyWeight && (
              <div className="bg-white rounded-2xl shadow-sm p-5">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">📈 週平均體重（8 週）</h3>
                <ResponsiveContainer width="100%" height={140}>
                  <LineChart data={weeklyWeight.chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" fontSize={10} />
                    <YAxis fontSize={10} domain={['auto', 'auto']} />
                    <Tooltip />
                    <Line type="monotone" dataKey="體重" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
                <div className="flex gap-4 mt-2 text-xs">
                  <span className="text-gray-600">本週：<b>{weeklyWeight.current.toFixed(1)} kg</b></span>
                  <span className={weeklyWeight.delta1w! > 0 ? 'text-orange-600' : 'text-blue-600'}>
                    1週 {weeklyWeight.delta1w! > 0 ? '+' : ''}{weeklyWeight.delta1w!.toFixed(2)}
                  </span>
                  {weeklyWeight.delta4w != null && (
                    <span className={weeklyWeight.delta4w > 0 ? 'text-orange-600' : 'text-blue-600'}>
                      4週 {weeklyWeight.delta4w > 0 ? '+' : ''}{weeklyWeight.delta4w.toFixed(2)}
                    </span>
                  )}
                </div>
                {weeklyWeightInsight && (
                  <div className="mt-3 pt-2 border-t border-gray-100 flex items-start gap-1.5">
                    <span className="text-[9px] uppercase tracking-wider font-semibold text-emerald-600">解讀</span>
                    <p className="text-[11px] text-gray-600 leading-relaxed">{weeklyWeightInsight}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* 體重 / 體脂 */}
        {c.body_composition_enabled && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {bodyTrend.weight.length >= 2 ? (
              <div className="bg-white rounded-2xl shadow-sm p-5">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">⚖️ 體重趨勢（每日）</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={bodyTrend.weight}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" fontSize={11} />
                    <YAxis fontSize={11} domain={['auto', 'auto']} />
                    <Tooltip />
                    <Line type="monotone" dataKey="體重" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="bg-white rounded-2xl shadow-sm p-5">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">⚖️ 體重趨勢</h3>
                <div className="h-[200px] flex items-center justify-center text-gray-400 text-sm">資料不足（至少 2 筆）</div>
              </div>
            )}
            {bodyTrend.bodyFat.length >= 2 && (
              <div className="bg-white rounded-2xl shadow-sm p-5">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">📉 體脂趨勢</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={bodyTrend.bodyFat}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" fontSize={11} />
                    <YAxis fontSize={11} domain={['auto', 'auto']} />
                    <Tooltip />
                    <Line type="monotone" dataKey="體脂" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}

        {/* 訓練日曆 + 分佈 */}
        {c.training_enabled && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl shadow-sm p-5 lg:col-span-2">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">🗓️ 訓練日曆（6 週）</h3>
              <div className="space-y-1">
                <div className="grid grid-cols-7 gap-1 mb-1">
                  {['一', '二', '三', '四', '五', '六', '日'].map(d => (
                    <div key={d} className="text-center text-xs text-gray-400 font-medium">{d}</div>
                  ))}
                </div>
                {calendarWeeks.map((week, wi) => (
                  <div key={wi} className="grid grid-cols-7 gap-1">
                    {week.map(({ date, label, log, isToday, isFuture }) => (
                      <div
                        key={date}
                        className={`aspect-square flex flex-col items-center justify-center rounded-lg text-xs ${isToday ? 'ring-2 ring-blue-400' : ''} ${
                          isFuture ? 'bg-gray-50 text-gray-300'
                            : log ? getTypeBgColor(log.training_type)
                            : 'bg-gray-50 text-gray-400'
                        }`}
                        title={log ? `${TRAINING_TYPES.find(t => t.value === log.training_type)?.label}${log.rpe ? ' · RPE' + log.rpe : ''}` : ''}
                      >
                        <span className="text-[10px] leading-none">{label}</span>
                        <span className="text-sm leading-none mt-0.5">{!isFuture && log ? getTypeEmoji(log.training_type) : ''}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">📊 訓練分佈</h3>
              {trainingDistribution.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={trainingDistribution} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" fontSize={11} />
                    <YAxis type="category" dataKey="name" fontSize={11} width={40} />
                    <Tooltip />
                    <Bar dataKey="次數" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[200px] flex items-center justify-center text-gray-400 text-sm">無訓練資料</div>
              )}
            </div>
          </div>
        )}

        {/* RPE */}
        {c.training_enabled && rpeTrend.length >= 2 && (
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">💥 RPE 趨勢（訓練強度感受）</h3>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={rpeTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" fontSize={11} />
                <YAxis domain={[0, 10]} ticks={[2, 4, 6, 8, 10]} fontSize={11} />
                <Tooltip formatter={(v: any, _: any, props: any) => [`RPE ${v}（${props.payload.type}）`, '']} />
                <Line type="monotone" dataKey="RPE" stroke="#ef4444" strokeWidth={2} dot={{ r: 4, fill: '#ef4444', stroke: '#fff', strokeWidth: 2 }} />
              </LineChart>
            </ResponsiveContainer>
            {rpeInsight && (
              <div className="mt-3 pt-2 border-t border-gray-100 flex items-start gap-1.5">
                <span className="text-xs">💡</span>
                <p className="text-[11px] text-gray-600 leading-relaxed">{rpeInsight}</p>
              </div>
            )}
          </div>
        )}

        {/* 營養趨勢 */}
        {c.nutrition_enabled && (proteinTrend.length >= 2 || waterTrend.length >= 2 || caloriesTrend.length >= 2) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {caloriesTrend.length >= 2 && (
              <div className="bg-white rounded-2xl shadow-sm p-5">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">🔥 卡路里攝取（30 天）</h3>
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={caloriesTrend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" fontSize={10} />
                    <YAxis fontSize={10} />
                    <Tooltip />
                    {c.calories_target && <ReferenceLine y={Number(c.calories_target)} stroke="#10b981" strokeDasharray="3 3" label={{ value: `目標 ${c.calories_target}`, fontSize: 10, fill: '#10b981' }} />}
                    <Line type="monotone" dataKey="卡路里" stroke="#f97316" strokeWidth={2} dot={{ r: 2 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
            {proteinTrend.length >= 2 && (
              <div className="bg-white rounded-2xl shadow-sm p-5">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">🥩 蛋白質攝取（30 天）</h3>
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={proteinTrend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" fontSize={10} />
                    <YAxis fontSize={10} />
                    <Tooltip />
                    {c.protein_target && <ReferenceLine y={Number(c.protein_target)} stroke="#10b981" strokeDasharray="3 3" label={{ value: `目標 ${c.protein_target}g`, fontSize: 10, fill: '#10b981' }} />}
                    <Line type="monotone" dataKey="蛋白質" stroke="#dc2626" strokeWidth={2} dot={{ r: 2 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
            {waterTrend.length >= 2 && (
              <div className="bg-white rounded-2xl shadow-sm p-5">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">💧 飲水量（30 天）</h3>
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={waterTrend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" fontSize={10} />
                    <YAxis fontSize={10} />
                    <Tooltip />
                    {c.water_target && <ReferenceLine y={Number(c.water_target)} stroke="#10b981" strokeDasharray="3 3" label={{ value: `目標 ${c.water_target}ml`, fontSize: 10, fill: '#10b981' }} />}
                    <Line type="monotone" dataKey="飲水ml" stroke="#0ea5e9" strokeWidth={2} dot={{ r: 2 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}

        {/* ===== 教練指導用戶的進階區塊 ===== */}
        {isCoachGuided && (
          <>
            <div className="pt-3 pb-1">
              <div className="flex items-center gap-2">
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-indigo-300 to-transparent" />
                <span className="text-xs font-semibold text-indigo-600 px-2">👨‍🏫 教練指導 · 進階分析</span>
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-indigo-300 to-transparent" />
              </div>
            </div>

            {/* E1RM */}
            {e1rmTrend.length >= 2 && (
              <div className="bg-white rounded-2xl shadow-sm p-5">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">💪 主項力量 E1RM（前 3 大動作）</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={e1rmTrend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" fontSize={11} />
                    <YAxis fontSize={11} domain={['auto', 'auto']} />
                    <Tooltip />
                    <Legend />
                    {Object.keys(e1rmTrend[0] || {}).filter(k => k !== 'date').map((k, i) => {
                      const colors = ['#6366f1', '#ef4444', '#10b981']
                      return <Line key={k} type="monotone" dataKey={k} stroke={colors[i % 3]} strokeWidth={2} dot={{ r: 3 }} connectNulls />
                    })}
                  </LineChart>
                </ResponsiveContainer>
                <p className="text-[10px] text-gray-400 mt-2">Brzycki 公式估算最大肌力（kg）</p>
                {e1rmInsight && (
                  <div className="mt-3 pt-2 border-t border-gray-100 flex items-start gap-1.5">
                    <span className="text-[9px] uppercase tracking-wider font-semibold text-emerald-600">解讀</span>
                    <p className="text-[11px] text-gray-600 leading-relaxed">{e1rmInsight}</p>
                  </div>
                )}
              </div>
            )}

            {/* 每週訓練量 + 肌群分佈 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {weeklyTonnage.length >= 2 && (
                <div className="bg-white rounded-2xl shadow-sm p-5">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">📈 每週訓練量</h3>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={weeklyTonnage}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="week" fontSize={10} />
                      <YAxis fontSize={10} />
                      <Tooltip formatter={(v: any) => [`${v.toLocaleString()} kg`, '訓練量']} />
                      <Bar dataKey="訓練量" fill="#6366f1" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                  <p className="text-[10px] text-gray-400 mt-2">總訓練量 = Σ (重量 × 次數)</p>
                  {tonnageInsight && (
                    <div className="mt-3 pt-2 border-t border-gray-100 flex items-start gap-1.5">
                      <span className="text-[9px] uppercase tracking-wider font-semibold text-emerald-600">解讀</span>
                      <p className="text-[11px] text-gray-600 leading-relaxed">{tonnageInsight}</p>
                    </div>
                  )}
                </div>
              )}
              {muscleVolume.length > 0 && (
                <div className="bg-white rounded-2xl shadow-sm p-5">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">🎯 本週肌群組數</h3>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={muscleVolume} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" fontSize={11} />
                      <YAxis type="category" dataKey="肌群" fontSize={11} width={60} />
                      <Tooltip />
                      <Bar dataKey="組數" fill="#10b981" radius={[0, 4, 4, 0]}>
                        {muscleVolume.map((entry, i) => (
                          <Cell key={i} fill={entry.組數 >= 10 ? '#10b981' : entry.組數 >= 6 ? '#f59e0b' : '#9ca3af'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  <p className="text-[10px] text-gray-400 mt-2">綠色：≥10 組 · 黃色：6-9 組 · 灰：&lt;6 組</p>
                  {muscleInsight && (
                    <div className="mt-3 pt-2 border-t border-gray-100 flex items-start gap-1.5">
                      <span className="text-[9px] uppercase tracking-wider font-semibold text-emerald-600">解讀</span>
                      <p className="text-[11px] text-gray-600 leading-relaxed">{muscleInsight}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 血檢 */}
            {c.lab_enabled && latestLabs.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm p-5">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">🩸 血檢指標（最新）</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {latestLabs.map((lab) => (
                    <div key={lab.id} className="border border-gray-100 rounded-xl p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-gray-900">{lab.test_name}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(lab.status)}`}>
                          {lab.status === 'normal' ? '正常' : lab.status === 'attention' ? '注意' : '警示'}
                        </span>
                      </div>
                      <p className="text-2xl font-bold text-gray-900">{lab.value} <span className="text-sm font-normal text-gray-500">{lab.unit}</span></p>
                      <p className="text-xs text-gray-400 mt-1">參考：{lab.reference_range} · {new Date(lab.date).toLocaleDateString('zh-TW')}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {c.supplement_enabled && (
                <div className="bg-white rounded-2xl shadow-sm p-5">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">💊 補品服從率（14 天）</h3>
                  {complianceTrend.length >= 2 ? (
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={complianceTrend}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" fontSize={11} />
                        <YAxis domain={[0, 100]} fontSize={11} />
                        <Tooltip formatter={(v: any) => [`${v}%`, '服從率']} />
                        <Line type="monotone" dataKey="服從率" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[200px] flex items-center justify-center text-gray-400 text-sm">資料不足</div>
                  )}
                  {complianceInsight && (
                    <div className="mt-3 pt-2 border-t border-gray-100 flex items-start gap-1.5">
                      <span className="text-[9px] uppercase tracking-wider font-semibold text-emerald-600">解讀</span>
                      <p className="text-[11px] text-gray-600 leading-relaxed">{complianceInsight}</p>
                    </div>
                  )}
                </div>
              )}
              {c.wellness_enabled && (
                <div className="bg-white rounded-2xl shadow-sm p-5">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">😊 感受趨勢（30 天）</h3>
                  {wellnessTrend.length >= 2 ? (
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={wellnessTrend}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" fontSize={11} />
                        <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} fontSize={11} />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="睡眠" stroke="#3b82f6" strokeWidth={2} dot={{ r: 2 }} />
                        <Line type="monotone" dataKey="精力" stroke="#f59e0b" strokeWidth={2} dot={{ r: 2 }} />
                        <Line type="monotone" dataKey="心情" stroke="#22c55e" strokeWidth={2} dot={{ r: 2 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[200px] flex items-center justify-center text-gray-400 text-sm">資料不足</div>
                  )}
                </div>
              )}
            </div>
          </>
        )}

        {/* 📚 延伸閱讀 — 對應 dashboard 各指標 */}
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">📚 想深入學原理？</h3>
          <p className="text-xs text-gray-500 mb-4">數字背後的科學，看完你會更知道在追什麼。</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {(() => {
              const articles: Array<{ slug: string; title: string; metric: string }> = []
              if (c.body_composition_enabled) {
                articles.push({ slug: 'fat-loss-plateau-guide', title: '減脂停滯期完全攻略：5 個科學方法突破卡關', metric: '體重 / 目標' })
                articles.push({ slug: 'three-layers-fat-loss-strategy', title: '肚子三層脂肪，用錯順序永遠瘦不下來', metric: '體脂' })
              }
              if (c.training_enabled) {
                articles.push({ slug: 'muscle-building-science-2025', title: '2025 增肌真相：三個科學新發現打臉常識', metric: '訓練量 / E1RM' })
                articles.push({ slug: 'zone-2-vo2max-aerobic-base', title: '有氧要喘才有效？這觀念讓你的心肺做白工', metric: 'RPE / 訓練分佈' })
              }
              if (c.nutrition_enabled) {
                articles.push({ slug: 'what-is-tdee', title: 'TDEE 是什麼？為什麼公式算出來的都不準', metric: '卡路里' })
                articles.push({ slug: 'protein-intake-guide', title: '蛋白質攝取完整指南：一天吃多少？怎麼吃？', metric: '蛋白質' })
                articles.push({ slug: 'morning-electrolyte-water', title: '早上別只喝白開水：一杯不到 1 塊的電解質配方', metric: '飲水' })
              }
              if (c.wellness_enabled) {
                articles.push({ slug: 'sleep-quality-hrv-optimization', title: '為什麼你睡 8 小時還是累？HRV 告訴你真相', metric: '感受趨勢' })
                articles.push({ slug: 'sleep-efficiency-protocol', title: '睡眠效能協議：睡眠不能補考，但可以預先儲值', metric: '睡眠' })
              }
              if (isCoachGuided && c.lab_enabled) {
                articles.push({ slug: '5-blood-tests-beyond-nhi', title: '健保不看的 5 個血檢數字（ApoB / Hcy / D / hs-CRP / HOMA-IR）', metric: '血檢' })
                articles.push({ slug: 'testosterone-shbg-crash-low-carb', title: '睪固酮跌 36%：被忽略的 SHBG 才是真兇', metric: '荷爾蒙' })
              }
              return articles.map(a => (
                <Link
                  key={a.slug}
                  href={`/blog/${a.slug}`}
                  target="_blank"
                  className="group flex items-start gap-2 p-3 rounded-xl border border-gray-100 hover:border-indigo-200 hover:bg-indigo-50/30 transition-colors"
                >
                  <span className="text-base flex-shrink-0">📖</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-indigo-500 font-medium mb-0.5">{a.metric}</p>
                    <p className="text-xs text-gray-800 leading-snug group-hover:text-indigo-700">{a.title}</p>
                  </div>
                  <span className="text-gray-300 group-hover:text-indigo-500 flex-shrink-0">→</span>
                </Link>
              ))
            })()}
          </div>
          <Link href="/blog" target="_blank" className="block mt-4 text-center text-xs text-indigo-600 hover:underline">
            看完整文章列表 →
          </Link>
        </div>

        {/* 499/自主管理 提示 */}
        {!isCoachGuided && (
          <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4">
            <p className="text-sm font-semibold text-indigo-900 mb-1">想看更深入的分析？</p>
            <p className="text-xs text-indigo-700 leading-relaxed">
              升級教練指導方案可解鎖主項力量 E1RM、每週訓練量、肌群分佈、血檢追蹤、補品服從率、感受趨勢分析，
              並有 Howard 親自為你解讀數據、調整方向。
            </p>
          </div>
        )}

        <div className="text-center text-xs text-gray-400 py-4">
          數據每 30 秒自動刷新
        </div>
      </main>
    </div>
  )
}
