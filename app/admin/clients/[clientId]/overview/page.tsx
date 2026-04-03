'use client'

import { useState, useEffect, useMemo } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, BarChart, Bar, ReferenceLine, Cell
} from 'recharts'
import dynamic from 'next/dynamic'
import { FileText } from 'lucide-react'
import { daysUntilDateTW } from '@/lib/date-utils'
import { TRAINING_TYPES, isWeightTraining } from '@/components/client/types'
import { generateSupplementSuggestions } from '@/lib/supplement-engine'
import { isCompetitionMode, isHealthMode, PHASE_LABELS } from '@/lib/client-mode'

const LabNutritionAdviceCard = dynamic(() => import('@/components/client/LabNutritionAdviceCard'), { ssr: false })
const LabInsightsCard = dynamic(() => import('@/components/client/LabInsightsCard'), { ssr: false })

export default function ClientOverview() {
  const { clientId } = useParams()
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [dateRange, setDateRange] = useState<'7' | '14' | '30'>('14')
  const [suggestion, setSuggestion] = useState<any>(null)
  const [suggestionMeta, setSuggestionMeta] = useState<any>(null)
  const [applyingsuggestion, setApplyingsuggestion] = useState(false)
  const [suggestionApplied, setSuggestionApplied] = useState(false)
  const [client, setClient] = useState<any>(null)
  const [supplements, setSupplements] = useState<any[]>([])
  const [supplementLogs, setSupplementLogs] = useState<any[]>([])
  const [wellness, setWellness] = useState<any[]>([])
  const [trainingLogs, setTrainingLogs] = useState<any[]>([])
  const [bodyData, setBodyData] = useState<any[]>([])
  const [labResults, setLabResults] = useState<any[]>([])
  const [nutritionLogs, setNutritionLogs] = useState<any[]>([])
  const [trainingSets, setTrainingSets] = useState<any[]>([])
  const [coachSummary, setCoachSummary] = useState<string | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(false)

  useEffect(() => {
    fetchAllData()
  }, [clientId])

  const fetchAllData = async () => {
    try {
      const res = await fetch(`/api/client-overview?clientId=${clientId}`)
      if (!res.ok) throw new Error('Failed to fetch')
      const data = await res.json()

      setClient(data.client)
      setSupplements(data.supplements || [])
      setSupplementLogs(data.supplementLogs || [])
      setWellness(data.wellness || [])
      setTrainingLogs(data.trainingLogs || [])
      setBodyData(data.bodyData || [])
      setLabResults(data.labResults || [])
      setNutritionLogs(data.nutritionLogs || [])
      setTrainingSets(data.trainingSets || [])
      // 同時抓取營養分析
      if (data.client?.goal_type && data.client?.nutrition_enabled) {
        fetch(`/api/nutrition-suggestions?clientId=${data.client.id}`)
          .then(r => r.ok ? r.json() : null)
          .then(d => { if (d) { setSuggestion(d.suggestion); setSuggestionMeta(d.meta) } })
          .catch(() => {})
      }
    } catch (err) {
      console.error('載入資料錯誤:', err)
    } finally {
      setLoading(false)
    }
  }

  // 一鍵套用建議
  const applySuggestion = async () => {
    if (!suggestion || suggestion.status === 'insufficient_data' || suggestion.status === 'low_compliance') return
    // on_track 時只有安全修正才需要套用（autoApply = true 時表示有修正）
    if (suggestion.status === 'on_track' && !suggestion.autoApply) return
    setApplyingsuggestion(true)
    try {
      const updates: any = {}
      if (suggestion.suggestedCalories != null) updates.calories_target = suggestion.suggestedCalories
      if (suggestion.suggestedProtein != null) updates.protein_target = suggestion.suggestedProtein
      if (suggestion.suggestedCarbs != null) updates.carbs_target = suggestion.suggestedCarbs
      if (suggestion.suggestedFat != null) updates.fat_target = suggestion.suggestedFat
      if (suggestion.suggestedCarbsTrainingDay != null) updates.carbs_training_day = suggestion.suggestedCarbsTrainingDay
      if (suggestion.suggestedCarbsRestDay != null) updates.carbs_rest_day = suggestion.suggestedCarbsRestDay

      const res = await fetch('/api/admin/clients', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: client.id, clientData: updates }),
      })
      if (res.ok) {
        setSuggestionApplied(true)
        // 更新本地 client state
        setClient((prev: any) => ({ ...prev, ...updates }))
        setTimeout(() => setSuggestionApplied(false), 3000)
      }
    } catch (err) {
      console.error('套用建議失敗:', err)
    } finally {
      setApplyingsuggestion(false)
    }
  }

  const fetchCoachSummary = async () => {
    setSummaryLoading(true)
    setCoachSummary(null)
    try {
      const res = await fetch(`/api/admin/coach-summary?clientId=${clientId}`)
      if (!res.ok) throw new Error('Failed')
      const data = await res.json()
      setCoachSummary(data.summary)
    } catch (err) {
      console.error('生成教練建議失敗:', err)
      setCoachSummary('生成失敗，請稍後再試。')
    } finally {
      setSummaryLoading(false)
    }
  }

  // ===== 核心指標 =====
  const keyMetrics = useMemo(() => {
    const today = new Date()
    const todayStr = today.toISOString().split('T')[0]
    const rangeDays = parseInt(dateRange)
    const rangeStart = new Date(today); rangeStart.setDate(today.getDate() - (rangeDays - 1))
    const weekStart = rangeStart.toISOString().split('T')[0]
    const thirtyDaysAgo = new Date(today); thirtyDaysAgo.setDate(today.getDate() - 29)
    const monthStart = thirtyDaysAgo.toISOString().split('T')[0]

    // 補品服從率
    const totalSupps = supplements.length
    const weekLogs = supplementLogs.filter(l => l.date >= weekStart && l.date <= todayStr && l.completed)
    const monthLogs = supplementLogs.filter(l => l.date >= monthStart && l.date <= todayStr && l.completed)
    const weekCompliance = totalSupps > 0 ? Math.round((weekLogs.length / (rangeDays * totalSupps)) * 100) : 0
    const monthCompliance = totalSupps > 0 ? Math.round((monthLogs.length / (30 * totalSupps)) * 100) : 0

    // 本週訓練
    const weekTraining = trainingLogs.filter(l => l.date >= weekStart && l.date <= todayStr && l.training_type !== 'rest')
    const weekTrainingDays = weekTraining.length

    // 近 7 天平均感受
    const recentWellness = wellness.filter(w => w.date >= weekStart && w.date <= todayStr)
    const avgEnergy = recentWellness.length > 0
      ? (recentWellness.reduce((s, w) => s + (w.energy_level || 0), 0) / recentWellness.filter(w => w.energy_level).length).toFixed(1)
      : '--'

    // 體重變化
    const recentBody = bodyData.filter(b => b.weight != null)
    let weightChange = null as string | null
    if (recentBody.length >= 2) {
      const latest = recentBody[recentBody.length - 1].weight
      const prev = recentBody[recentBody.length - 2].weight
      weightChange = (latest - prev).toFixed(1)
    }

    // 飲食合規率
    const weekNutrition = nutritionLogs.filter(l => l.date >= weekStart && l.date <= todayStr)
    const weekNutritionCompliant = weekNutrition.filter(l => l.compliant).length
    const weekNutritionRate = weekNutrition.length > 0 ? Math.round((weekNutritionCompliant / weekNutrition.length) * 100) : null

    const monthNutrition = nutritionLogs.filter(l => l.date >= monthStart && l.date <= todayStr)
    const monthNutritionCompliant = monthNutrition.filter(l => l.compliant).length
    const monthNutritionRate = monthNutrition.length > 0 ? Math.round((monthNutritionCompliant / monthNutrition.length) * 100) : null

    // 蛋白質達標率 + 平均偏差
    const proteinTarget = client?.protein_target
    const weekNutritionWithProtein = weekNutrition.filter(l => l.protein_grams != null && proteinTarget)
    const proteinHitDays = weekNutritionWithProtein.filter(l => l.protein_grams >= proteinTarget * 0.9).length
    const proteinHitRate = weekNutritionWithProtein.length > 0 ? Math.round((proteinHitDays / weekNutritionWithProtein.length) * 100) : null
    const avgProtein = weekNutritionWithProtein.length > 0 ? Math.round(weekNutritionWithProtein.reduce((s, l) => s + l.protein_grams, 0) / weekNutritionWithProtein.length) : null
    const proteinDeltaPct = avgProtein && proteinTarget ? Math.round(((avgProtein - proteinTarget) / proteinTarget) * 100) : null

    // 體重變化 %BW
    const latestWeight = recentBody.length > 0 ? recentBody[recentBody.length - 1].weight : null
    const weightChangePct = latestWeight && weightChange ? ((Number(weightChange) / latestWeight) * 100).toFixed(1) : null

    return { weekCompliance, monthCompliance, weekTrainingDays, avgEnergy, weightChange, weightChangePct, latestWeight, weekNutritionRate, monthNutritionRate, proteinHitRate, avgProtein, proteinDeltaPct, proteinTarget }
  }, [supplements, supplementLogs, wellness, trainingLogs, bodyData, nutritionLogs, dateRange])

  // ===== 補品服從率趨勢（每日） =====
  const complianceTrend = useMemo(() => {
    if (!supplements.length || !supplementLogs.length) return []
    const total = supplements.length
    const rangeDays = parseInt(dateRange)
    const now = new Date()
    const rangeStart = new Date(now); rangeStart.setDate(now.getDate() - (rangeDays - 1))
    const startStr = rangeStart.toISOString().split('T')[0]
    const todayStr = now.toISOString().split('T')[0]
    const byDate: Record<string, number> = {}
    for (const log of supplementLogs) {
      if (log.completed && log.date >= startStr && log.date <= todayStr) {
        byDate[log.date] = (byDate[log.date] || 0) + 1
      }
    }
    return Object.entries(byDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({
        date: new Date(date).toLocaleDateString('zh-TW', { month: '2-digit', day: '2-digit' }),
        服從率: Math.round((count / total) * 100),
      }))
  }, [supplements, supplementLogs, dateRange])

  // ===== 感受趨勢 =====
  const wellnessTrend = useMemo(() => {
    if (!wellness.length) return []
    const rangeDays = parseInt(dateRange)
    const now = new Date()
    const rangeStart = new Date(now); rangeStart.setDate(now.getDate() - (rangeDays - 1))
    const startStr = rangeStart.toISOString().split('T')[0]
    const todayStr = now.toISOString().split('T')[0]
    return wellness
      .filter(w => w.date >= startStr && w.date <= todayStr && (w.sleep_quality != null || w.energy_level != null || w.mood != null))
      .map(w => ({
        date: new Date(w.date).toLocaleDateString('zh-TW', { month: '2-digit', day: '2-digit' }),
        睡眠: w.sleep_quality,
        精力: w.energy_level,
        心情: w.mood,
      }))
  }, [wellness, dateRange])

  // ===== 訓練日曆（6 週） =====
  const calendarWeeks = useMemo(() => {
    const now = new Date()
    const today = now.toISOString().split('T')[0]
    const dayOfWeek = now.getDay()
    const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1
    const thisMonday = new Date(now)
    thisMonday.setDate(now.getDate() - mondayOffset)

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

  // ===== 訓練類型分佈 =====
  const trainingDistribution = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const log of trainingLogs.filter(l => l.training_type !== 'rest')) {
      counts[log.training_type] = (counts[log.training_type] || 0) + 1
    }
    return Object.entries(counts)
      .map(([type, count]) => ({
        name: TRAINING_TYPES.find(t => t.value === type)?.label || type,
        次數: count,
      }))
      .sort((a, b) => b.次數 - a.次數)
  }, [trainingLogs])

  // ===== RPE 趨勢 =====
  const rpeTrend = useMemo(() => {
    return trainingLogs
      .filter(l => l.rpe != null && l.training_type !== 'rest')
      .map(l => ({
        date: new Date(l.date).toLocaleDateString('zh-TW', { month: '2-digit', day: '2-digit' }),
        RPE: l.rpe,
        type: TRAINING_TYPES.find(t => t.value === l.training_type)?.label || l.training_type,
      }))
  }, [trainingLogs])

  // ===== 體組成趨勢 =====
  const bodyTrend = useMemo(() => {
    if (!bodyData.length) return { weight: [], bodyFat: [] }
    const weight = bodyData.filter(b => b.weight != null).map(b => ({
      date: new Date(b.date).toLocaleDateString('zh-TW', { month: '2-digit', day: '2-digit' }),
      體重: b.weight,
    }))
    const bodyFat = bodyData.filter(b => b.body_fat != null).map(b => ({
      date: new Date(b.date).toLocaleDateString('zh-TW', { month: '2-digit', day: '2-digit' }),
      體脂: b.body_fat,
    }))
    return { weight, bodyFat }
  }, [bodyData])

  // ===== 血檢最新值 =====
  const latestLabs = useMemo(() => {
    const byName = new Map<string, any>()
    for (const r of labResults) {
      if (!byName.has(r.test_name)) byName.set(r.test_name, r)
    }
    return [...byName.values()]
  }, [labResults])

  // ===== 補品建議（依血檢數值）=====
  const supplementSuggestions = useMemo(() => {
    if (!latestLabs.length) return []
    const recentRPELogs = trainingLogs.filter(t => t.rpe != null).slice(-3)
    const hasHighRPE = recentRPELogs.length >= 3 && recentRPELogs.every((t: any) => t.rpe > 8.5)
    return generateSupplementSuggestions(latestLabs, {
      gender: client?.gender,
      isCompetitionPrep: isCompetitionMode(client?.client_mode),
      hasHighRPE,
      goalType: client?.goal_type || null,
      isHealthMode: isHealthMode(client?.client_mode),
      genetics: {
        mthfr: client?.gene_mthfr,
        apoe: client?.gene_apoe,
        depressionRisk: client?.gene_depression_risk,
      },
      prepPhase: client?.prep_phase || null,
    })
  }, [latestLabs, client, trainingLogs])

  // ===== 訓練×恢復交叉分析 =====
  const recoveryAnalysis = useMemo(() => {
    if (!trainingLogs.length || !wellness.length) return []
    const wellnessMap: Record<string, any> = {}
    for (const w of wellness) wellnessMap[w.date] = w

    const nextDay = (dateStr: string) => {
      const d = new Date(dateStr); d.setDate(d.getDate() + 1)
      return d.toISOString().split('T')[0]
    }

    const typeStats: Record<string, { count: number; energy: number[]; sleep: number[] }> = {}
    for (const log of trainingLogs.filter(l => l.training_type !== 'rest')) {
      const t = log.training_type
      if (!typeStats[t]) typeStats[t] = { count: 0, energy: [], sleep: [] }
      typeStats[t].count++
      const nextW = wellnessMap[nextDay(log.date)]
      if (nextW) {
        if (nextW.energy_level != null) typeStats[t].energy.push(nextW.energy_level)
        if (nextW.sleep_quality != null) typeStats[t].sleep.push(nextW.sleep_quality)
      }
    }

    return Object.entries(typeStats).map(([type, s]) => {
      const avg = (arr: number[]) => arr.length > 0 ? (arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1) : '--'
      return {
        type: TRAINING_TYPES.find(t => t.value === type)?.label || type,
        emoji: TRAINING_TYPES.find(t => t.value === type)?.emoji || '',
        count: s.count,
        avgEnergy: avg(s.energy),
        avgSleep: avg(s.sleep),
      }
    }).sort((a, b) => b.count - a.count)
  }, [trainingLogs, wellness])

  // ===== E1RM 趨勢（主項力量）=====
  const e1rmTrend = useMemo(() => {
    if (!trainingSets.length) return { exercises: [], chartData: [], changes: {} as Record<string, string> }
    const mainLiftNames = ['深蹲', '臥推', '硬舉', '肩推']
    const mainSets = trainingSets.filter(
      (s: any) => s.is_main_lift || mainLiftNames.some(n => s.exercise_name?.includes(n))
    )
    if (!mainSets.length) return { exercises: [], chartData: [], changes: {} as Record<string, string> }

    // Group by exercise and date, pick best E1RM per exercise per date
    const byExercise: Record<string, Record<string, number>> = {}
    for (const s of mainSets) {
      if (!s.weight || !s.reps || s.reps > 10 || s.reps < 1) continue
      const e1rm = s.weight * (36 / (37 - s.reps))
      const name = s.exercise_name
      if (!byExercise[name]) byExercise[name] = {}
      if (!byExercise[name][s.date] || e1rm > byExercise[name][s.date]) {
        byExercise[name][s.date] = Math.round(e1rm * 10) / 10
      }
    }

    const exercises = Object.keys(byExercise)
    if (!exercises.length) return { exercises: [], chartData: [], changes: {} as Record<string, string> }

    // Collect all dates
    const allDates = new Set<string>()
    for (const ex of exercises) {
      for (const d of Object.keys(byExercise[ex])) allDates.add(d)
    }
    const sortedDates = Array.from(allDates).sort()

    const chartData = sortedDates.map(date => {
      const point: any = { date: new Date(date).toLocaleDateString('zh-TW', { month: '2-digit', day: '2-digit' }) }
      for (const ex of exercises) {
        if (byExercise[ex][date]) point[ex] = byExercise[ex][date]
      }
      return point
    })

    // % change from first to last
    const changes: Record<string, string> = {}
    for (const ex of exercises) {
      const dates = Object.keys(byExercise[ex]).sort()
      if (dates.length >= 2) {
        const first = byExercise[ex][dates[0]]
        const last = byExercise[ex][dates[dates.length - 1]]
        const pct = ((last - first) / first) * 100
        changes[ex] = (pct >= 0 ? '+' : '') + pct.toFixed(1) + '%'
      }
    }

    return { exercises, chartData, changes }
  }, [trainingSets])

  // ===== 每週訓練量（Tonnage）趨勢 =====
  const weeklyTonnage = useMemo(() => {
    if (!trainingSets.length) return []
    // Group sets into ISO weeks (Mon-Sun)
    const weekMap: Record<string, number> = {}
    for (const s of trainingSets) {
      if (!s.weight || !s.reps) continue
      const d = new Date(s.date)
      const day = d.getDay()
      const diff = day === 0 ? 6 : day - 1
      const monday = new Date(d)
      monday.setDate(d.getDate() - diff)
      const key = monday.toISOString().split('T')[0]
      weekMap[key] = (weekMap[key] || 0) + (s.weight * s.reps)
    }
    const sorted = Object.entries(weekMap).sort(([a], [b]) => a.localeCompare(b))
    return sorted.map(([weekStart, tonnage], i) => {
      const prevTonnage = i > 0 ? sorted[i - 1][1] : tonnage
      return {
        week: new Date(weekStart).toLocaleDateString('zh-TW', { month: '2-digit', day: '2-digit' }),
        訓練量: Math.round(tonnage),
        increased: tonnage >= prevTonnage,
      }
    })
  }, [trainingSets])

  // ===== 每肌群週組數 =====
  const muscleGroupSets = useMemo(() => {
    if (!trainingSets.length) return []
    // Get current week (Mon-Sun)
    const now = new Date()
    const day = now.getDay()
    const diff = day === 0 ? 6 : day - 1
    const monday = new Date(now)
    monday.setDate(now.getDate() - diff)
    const mondayStr = monday.toISOString().split('T')[0]
    const todayStr = now.toISOString().split('T')[0]

    // Count distinct sets per muscle group this week
    const groupCounts: Record<string, number> = {}
    for (const s of trainingSets) {
      if (!s.muscle_group || s.date < mondayStr || s.date > todayStr) continue
      groupCounts[s.muscle_group] = (groupCounts[s.muscle_group] || 0) + 1
    }

    const labelMap: Record<string, string> = {
      chest: '胸', back: '背', shoulders: '肩', legs: '腿', arms: '手臂', core: '核心',
      glutes: '臀', hamstrings: '腿後', quads: '腿前', calves: '小腿',
    }

    return Object.entries(groupCounts)
      .map(([group, sets]) => ({
        muscle: labelMap[group] || group,
        組數: sets,
      }))
      .sort((a, b) => b.組數 - a.組數)
  }, [trainingSets])

  // ===== 飲食合規趨勢 =====
  const nutritionTrend = useMemo(() => {
    if (!nutritionLogs.length) return []
    const rangeDays = parseInt(dateRange)
    const now = new Date()
    const rangeStart = new Date(now); rangeStart.setDate(now.getDate() - (rangeDays - 1))
    const startStr = rangeStart.toISOString().split('T')[0]
    const todayStr = now.toISOString().split('T')[0]
    const byWeek: Record<string, { compliant: number; total: number }> = {}
    for (const log of nutritionLogs.filter((l: any) => l.date >= startStr && l.date <= todayStr)) {
      const d = new Date(log.date)
      const weekStart = new Date(d)
      const day = d.getDay()
      const diff = day === 0 ? 6 : day - 1
      weekStart.setDate(d.getDate() - diff)
      const key = weekStart.toISOString().split('T')[0]
      if (!byWeek[key]) byWeek[key] = { compliant: 0, total: 0 }
      byWeek[key].total++
      if (log.compliant) byWeek[key].compliant++
    }
    return Object.entries(byWeek)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, stats]) => ({
        date: new Date(date).toLocaleDateString('zh-TW', { month: '2-digit', day: '2-digit' }),
        飲食合規率: Math.round((stats.compliant / stats.total) * 100),
      }))
  }, [nutritionLogs, dateRange])

  // ===== 蛋白質/水量趨勢 =====
  const proteinWaterTrend = useMemo(() => {
    if (!nutritionLogs.length) return []
    const rangeDays = parseInt(dateRange)
    const now = new Date()
    const rangeStart = new Date(now); rangeStart.setDate(now.getDate() - (rangeDays - 1))
    const startStr = rangeStart.toISOString().split('T')[0]
    const todayStr = now.toISOString().split('T')[0]
    return nutritionLogs
      .filter((l: any) => l.date >= startStr && l.date <= todayStr && (l.protein_grams != null || l.water_ml != null))
      .sort((a: any, b: any) => a.date.localeCompare(b.date))
      .map((l: any) => ({
        date: new Date(l.date).toLocaleDateString('zh-TW', { month: '2-digit', day: '2-digit' }),
        蛋白質: l.protein_grams ?? null,
        飲水量: l.water_ml ? Math.round(l.water_ml / 100) * 100 : null,
      }))
  }, [nutritionLogs, dateRange])

  // ===== 備賽巨量營養素趨勢 =====
  const macroTrend = useMemo(() => {
    if (!isCompetitionMode(client?.client_mode) || !nutritionLogs.length) return { calories: [], carbs: [], fat: [] }
    const rangeDays = parseInt(dateRange)
    const now = new Date()
    const rangeStart = new Date(now); rangeStart.setDate(now.getDate() - (rangeDays - 1))
    const startStr = rangeStart.toISOString().split('T')[0]
    const todayStr = now.toISOString().split('T')[0]
    const filteredLogs = nutritionLogs.filter((l: any) => l.date >= startStr && l.date <= todayStr)
    const calories = filteredLogs
      .filter((l: any) => l.calories != null)
      .map((l: any) => ({
        date: new Date(l.date).toLocaleDateString('zh-TW', { month: '2-digit', day: '2-digit' }),
        熱量: l.calories,
      }))
    const carbs = filteredLogs
      .filter((l: any) => l.carbs_grams != null)
      .map((l: any) => ({
        date: new Date(l.date).toLocaleDateString('zh-TW', { month: '2-digit', day: '2-digit' }),
        碳水: l.carbs_grams,
      }))
    const fat = filteredLogs
      .filter((l: any) => l.fat_grams != null)
      .map((l: any) => ({
        date: new Date(l.date).toLocaleDateString('zh-TW', { month: '2-digit', day: '2-digit' }),
        脂肪: l.fat_grams,
      }))
    return { calories, carbs, fat }
  }, [nutritionLogs, client?.client_mode, dateRange])

  // ===== 巨量營養素偏差報告 =====
  const macroDeviation = useMemo(() => {
    if (!client || !nutritionLogs.length) return null
    const hasCarbCycling = client.carbs_training_day && client.carbs_rest_day
    const hasTargets = client.calories_target || client.protein_target || client.carbs_target || client.fat_target || hasCarbCycling

    if (!hasTargets) return null

    // 取近 N 天的資料
    const rangeDays = parseInt(dateRange)
    const today = new Date()
    const todayStr = today.toISOString().split('T')[0]
    const rangeStart = new Date(today); rangeStart.setDate(today.getDate() - (rangeDays - 1))
    const startStr = rangeStart.toISOString().split('T')[0]

    const recentLogs = nutritionLogs
      .filter((l: any) => l.date >= startStr && l.date <= todayStr)
      .sort((a: any, b: any) => a.date.localeCompare(b.date))

    if (recentLogs.length === 0) return null

    // 每日偏差（百分比）
    const dailyData = recentLogs.map((l: any) => {
      const day: any = {
        date: new Date(l.date).toLocaleDateString('zh-TW', { month: '2-digit', day: '2-digit' }),
        rawDate: l.date,
      }
      if (client.calories_target && l.calories != null) {
        day.calDev = Math.round(((l.calories - client.calories_target) / client.calories_target) * 100)
        day.calories = l.calories
      }
      if (client.protein_target && l.protein_grams != null) {
        day.proDev = Math.round(((l.protein_grams - client.protein_target) / client.protein_target) * 100)
        day.protein = l.protein_grams
      }
      // 碳水：碳循環模式下根據當天有無訓練動態選擇目標
      const dailyCarbTarget = hasCarbCycling
        ? (trainingLogs.some((t: any) => t.date === l.date && isWeightTraining(t.training_type)) ? client.carbs_training_day : client.carbs_rest_day)
        : client.carbs_target
      if (dailyCarbTarget && l.carbs_grams != null) {
        day.carbDev = Math.round(((l.carbs_grams - dailyCarbTarget) / dailyCarbTarget) * 100)
        day.carbs = l.carbs_grams
        day.carbTarget = dailyCarbTarget
        day.isTrainingDay = trainingLogs.some((t: any) => t.date === l.date && isWeightTraining(t.training_type))
      }
      if (client.fat_target && l.fat_grams != null) {
        day.fatDev = Math.round(((l.fat_grams - client.fat_target) / client.fat_target) * 100)
        day.fat = l.fat_grams
      }
      return day
    })

    // 計算平均偏差
    const avgDev = (key: string) => {
      const vals = dailyData.filter((d: any) => d[key] != null).map((d: any) => d[key])
      return vals.length > 0 ? Math.round(vals.reduce((a: number, b: number) => a + b, 0) / vals.length) : null
    }

    // 超標天數
    const overDays = (key: string, threshold: number) => {
      return dailyData.filter((d: any) => d[key] != null && Math.abs(d[key]) > threshold).length
    }

    return {
      dailyData,
      avgCalDev: avgDev('calDev'),
      avgProDev: avgDev('proDev'),
      avgCarbDev: avgDev('carbDev'),
      avgFatDev: avgDev('fatDev'),
      calOverDays: overDays('calDev', 10),
      proOverDays: overDays('proDev', 10),
      carbOverDays: overDays('carbDev', 10),
      fatOverDays: overDays('fatDev', 10),
      totalDays: dailyData.length,
    }
  }, [nutritionLogs, client, trainingLogs, dateRange])

  // ===== 週報自動產出 =====
  const weeklyReport = useMemo(() => {
    const rangeDays = parseInt(dateRange)
    const today = new Date()
    const todayStr = today.toISOString().split('T')[0]
    const periodStart = new Date(today); periodStart.setDate(today.getDate() - (rangeDays - 1))
    const weekStart = periodStart.toISOString().split('T')[0]
    const prevPeriodStart = new Date(today); prevPeriodStart.setDate(today.getDate() - (rangeDays * 2 - 1))
    const lastWeekStart = prevPeriodStart.toISOString().split('T')[0]
    const prevPeriodEnd = new Date(today); prevPeriodEnd.setDate(today.getDate() - rangeDays)
    const lastWeekEndStr = prevPeriodEnd.toISOString().split('T')[0]

    // 訓練摘要
    const weekTraining = trainingLogs.filter(l => l.date >= weekStart && l.date <= todayStr && l.training_type !== 'rest')
    const trainingDays = weekTraining.length
    const typeCounts: Record<string, number> = {}
    let totalRpe = 0, rpeCount = 0
    for (const l of weekTraining) {
      typeCounts[l.training_type] = (typeCounts[l.training_type] || 0) + 1
      if (l.rpe != null) { totalRpe += l.rpe; rpeCount++ }
    }
    const avgRpe = rpeCount > 0 ? (totalRpe / rpeCount).toFixed(1) : null
    const topTypes = Object.entries(typeCounts).sort((a, b) => b[1] - a[1]).slice(0, 3)
      .map(([type, count]) => `${TRAINING_TYPES.find(t => t.value === type)?.label || type}${count}次`)

    // 身心趨勢
    const weekWellness = wellness.filter(w => w.date >= weekStart && w.date <= todayStr)
    const lastWeekWellness = wellness.filter(w => w.date >= lastWeekStart && w.date <= lastWeekEndStr)
    const avg = (arr: any[], field: string) => {
      const vals = arr.filter(w => w[field] != null).map(w => w[field])
      return vals.length > 0 ? vals.reduce((a: number, b: number) => a + b, 0) / vals.length : null
    }
    const avgSleep = avg(weekWellness, 'sleep_quality')
    const avgEnergy = avg(weekWellness, 'energy_level')
    const avgMood = avg(weekWellness, 'mood')
    const lastAvgSleep = avg(lastWeekWellness, 'sleep_quality')
    const lastAvgEnergy = avg(lastWeekWellness, 'energy_level')
    const lastAvgMood = avg(lastWeekWellness, 'mood')
    const arrow = (curr: number | null, prev: number | null) => {
      if (curr == null || prev == null) return ''
      const diff = curr - prev
      if (Math.abs(diff) < 0.2) return ''
      return diff > 0 ? ' ↑' : ' ↓'
    }

    // 補品合規率
    const totalSupps = supplements.length
    const weekSuppLogs = supplementLogs.filter(l => l.date >= weekStart && l.date <= todayStr && l.completed)
    const lastWeekSuppLogs = supplementLogs.filter(l => l.date >= lastWeekStart && l.date <= lastWeekEndStr && l.completed)
    const weekSuppRate = totalSupps > 0 ? Math.round((weekSuppLogs.length / (rangeDays * totalSupps)) * 100) : null
    const lastWeekSuppRate = totalSupps > 0 ? Math.round((lastWeekSuppLogs.length / (rangeDays * totalSupps)) * 100) : null

    // 體重變化
    const recentBody = bodyData.filter(b => b.weight != null)
    const weekBody = recentBody.filter(b => b.date >= weekStart && b.date <= todayStr)
    const lastWeekBody = recentBody.filter(b => b.date >= lastWeekStart && b.date <= lastWeekEndStr)
    let weightDelta: string | null = null
    if (weekBody.length > 0 && lastWeekBody.length > 0) {
      const latestW = weekBody[weekBody.length - 1].weight
      const lastW = lastWeekBody[lastWeekBody.length - 1].weight
      weightDelta = (latestW - lastW).toFixed(1)
    }

    // 飲食合規
    const weekNutrition = nutritionLogs.filter(l => l.date >= weekStart && l.date <= todayStr)
    const lastWeekNutrition = nutritionLogs.filter(l => l.date >= lastWeekStart && l.date <= lastWeekEndStr)
    const weekNutRate = weekNutrition.length > 0 ? Math.round((weekNutrition.filter(l => l.compliant).length / weekNutrition.length) * 100) : null
    const lastWeekNutRate = lastWeekNutrition.length > 0 ? Math.round((lastWeekNutrition.filter(l => l.compliant).length / lastWeekNutrition.length) * 100) : null

    // 自動產出文字摘要
    const lines: string[] = []
    if (trainingDays > 0) {
      lines.push(`本週訓練 ${trainingDays} 天${topTypes.length > 0 ? `（${topTypes.join('、')}）` : ''}${avgRpe ? `，平均 RPE ${avgRpe}` : ''}。`)
    } else {
      lines.push('本週無訓練記錄。')
    }

    const wellnessParts: string[] = []
    if (avgSleep != null) wellnessParts.push(`睡眠 ${avgSleep.toFixed(1)}${arrow(avgSleep, lastAvgSleep)}`)
    if (avgEnergy != null) wellnessParts.push(`精力 ${avgEnergy.toFixed(1)}${arrow(avgEnergy, lastAvgEnergy)}`)
    if (avgMood != null) wellnessParts.push(`心情 ${avgMood.toFixed(1)}${arrow(avgMood, lastAvgMood)}`)
    if (wellnessParts.length > 0) {
      lines.push(`身心狀態：${wellnessParts.join('、')}。`)
    }

    const complianceParts: string[] = []
    if (weekSuppRate != null) {
      const suppDelta = lastWeekSuppRate != null ? weekSuppRate - lastWeekSuppRate : null
      complianceParts.push(`補品 ${weekSuppRate}%${suppDelta != null && Math.abs(suppDelta) >= 5 ? (suppDelta > 0 ? ' ↑' : ' ↓') : ''}`)
    }
    if (weekNutRate != null) {
      const nutDelta = lastWeekNutRate != null ? weekNutRate - lastWeekNutRate : null
      complianceParts.push(`飲食 ${weekNutRate}%${nutDelta != null && Math.abs(nutDelta) >= 5 ? (nutDelta > 0 ? ' ↑' : ' ↓') : ''}`)
    }
    if (complianceParts.length > 0) {
      lines.push(`合規率：${complianceParts.join('、')}。`)
    }

    if (weightDelta != null) {
      const w = Number(weightDelta)
      if (Math.abs(w) >= 0.1) {
        lines.push(`體重${w > 0 ? '增加' : '減少'} ${Math.abs(w)} kg。`)
      }
    }

    // 蛋白質/水量平均
    const weekNutritionWithProtein = weekNutrition.filter((l: any) => l.protein_grams != null)
    const avgProtein = weekNutritionWithProtein.length > 0
      ? Math.round(weekNutritionWithProtein.reduce((s: number, l: any) => s + l.protein_grams, 0) / weekNutritionWithProtein.length)
      : null
    const weekNutritionWithWater = weekNutrition.filter((l: any) => l.water_ml != null)
    const avgWater = weekNutritionWithWater.length > 0
      ? Math.round(weekNutritionWithWater.reduce((s: number, l: any) => s + l.water_ml, 0) / weekNutritionWithWater.length)
      : null

    // 備賽巨量營養素平均
    const weekNutritionWithCalories = weekNutrition.filter((l: any) => l.calories != null)
    const avgCalories = weekNutritionWithCalories.length > 0
      ? Math.round(weekNutritionWithCalories.reduce((s: number, l: any) => s + l.calories, 0) / weekNutritionWithCalories.length)
      : null
    const weekNutritionWithCarbs = weekNutrition.filter((l: any) => l.carbs_grams != null)
    const avgCarbs = weekNutritionWithCarbs.length > 0
      ? Math.round(weekNutritionWithCarbs.reduce((s: number, l: any) => s + l.carbs_grams, 0) / weekNutritionWithCarbs.length)
      : null
    const weekNutritionWithFat = weekNutrition.filter((l: any) => l.fat_grams != null)
    const avgFat = weekNutritionWithFat.length > 0
      ? Math.round(weekNutritionWithFat.reduce((s: number, l: any) => s + l.fat_grams, 0) / weekNutritionWithFat.length)
      : null

    const nutrientParts: string[] = []
    if (avgProtein != null) {
      nutrientParts.push(`蛋白質平均 ${avgProtein}g${client?.protein_target ? `（目標 ${client.protein_target}g）` : ''}`)
    }
    if (avgWater != null) {
      nutrientParts.push(`飲水平均 ${avgWater}ml${client?.water_target ? `（目標 ${client.water_target}ml）` : ''}`)
    }
    if (nutrientParts.length > 0) {
      lines.push(`營養攝取：${nutrientParts.join('、')}。`)
    }

    // 備賽巨量摘要
    if (isCompetitionMode(client?.client_mode)) {
      const macroParts: string[] = []
      if (avgCalories != null) macroParts.push(`熱量 ${avgCalories}kcal${client?.calories_target ? `/${client.calories_target}` : ''}`)
      if (avgCarbs != null) macroParts.push(`碳水 ${avgCarbs}g${client?.carbs_target ? `/${client.carbs_target}` : ''}`)
      if (avgFat != null) macroParts.push(`脂肪 ${avgFat}g${client?.fat_target ? `/${client.fat_target}` : ''}`)
      if (macroParts.length > 0) {
        lines.push(`備賽巨量：${macroParts.join('、')}。`)
      }
    }

    return {
      trainingDays, topTypes, avgRpe,
      avgSleep, avgEnergy, avgMood,
      sleepArrow: arrow(avgSleep, lastAvgSleep),
      energyArrow: arrow(avgEnergy, lastAvgEnergy),
      moodArrow: arrow(avgMood, lastAvgMood),
      weekSuppRate, lastWeekSuppRate,
      weekNutRate, lastWeekNutRate,
      weightDelta,
      avgProtein, avgWater,
      avgCalories, avgCarbs, avgFat,
      summary: lines.join('\n'),
      weekLabel: `${periodStart.toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' })} - ${today.toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' })}`,
    }
  }, [trainingLogs, wellness, supplements, supplementLogs, bodyData, nutritionLogs, dateRange])

  // ===== 需注意事項 =====
  const alerts = useMemo(() => {
    const items: string[] = []

    // 蛋白質嚴重不足（最高優先級）
    if (keyMetrics.proteinDeltaPct != null && keyMetrics.proteinDeltaPct <= -20) {
      items.push(`🥩 蛋白質嚴重不足（平均 ${keyMetrics.avgProtein}g / 目標 ${keyMetrics.proteinTarget}g，偏差 ${keyMetrics.proteinDeltaPct}%）`)
    } else if (keyMetrics.proteinDeltaPct != null && keyMetrics.proteinDeltaPct <= -10) {
      items.push(`🥩 蛋白質偏低（平均 ${keyMetrics.avgProtein}g / 目標 ${keyMetrics.proteinTarget}g，偏差 ${keyMetrics.proteinDeltaPct}%）`)
    }

    // 荷爾蒙變化追蹤（從血檢數據抓）
    const hormoneAlerts: string[] = []
    const recentLabs = labResults.filter(l => l.date)
    const labsByName = new Map<string, any[]>()
    for (const lab of recentLabs) {
      const name = lab.test_name.toLowerCase()
      if (!labsByName.has(name)) labsByName.set(name, [])
      labsByName.get(name)!.push(lab)
    }
    for (const [name, labs] of labsByName) {
      if (labs.length < 2) continue
      const sorted = [...labs].sort((a, b) => a.date.localeCompare(b.date))
      const oldest = sorted[0].value
      const latest = sorted[sorted.length - 1].value
      if (oldest <= 0) continue
      const changePct = Math.round(((latest - oldest) / oldest) * 100)
      if (/testosterone|睪固酮/.test(name) && changePct <= -20) {
        const label = name.includes('free') || name.includes('游離') ? '游離睪固酮' : name.includes('bioavail') ? 'Bioavailable T' : '睪固酮'
        hormoneAlerts.push(`${label} ${changePct}%`)
      }
    }
    if (hormoneAlerts.length > 0) {
      items.push(`🩸 荷爾蒙下滑：${hormoneAlerts.join('、')}`)
    }

    if (keyMetrics.weekCompliance < 50 && supplements.length > 0) items.push(`本週補品服從率僅 ${keyMetrics.weekCompliance}%`)
    const recentWellness = wellness.slice(-7)
    const lowEnergy = recentWellness.filter(w => w.energy_level != null && w.energy_level <= 2)
    if (lowEnergy.length >= 3) items.push(`近 7 天有 ${lowEnergy.length} 天精力偏低`)
    const highRpe = trainingLogs.filter(l => l.rpe >= 9).slice(-3)
    if (highRpe.length >= 2) items.push(`近期多次 RPE ≥ 9，注意過度訓練`)
    if (client?.next_checkup_date) {
      const diff = Math.floor((new Date(client.next_checkup_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      if (diff < 0) items.push(`回檢已逾期 ${Math.abs(diff)} 天`)
      else if (diff <= 7) items.push(`回檢日期在 ${diff} 天後`)
    }
    return items
  }, [keyMetrics, wellness, trainingLogs, supplements, client, labResults])

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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">載入學員資料...</p>
        </div>
      </div>
    )
  }

  if (!client) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-600">找不到學員資料</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link href="/admin" className="text-gray-600 hover:text-gray-900">← 返回</Link>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold text-gray-900">{client.name} — 學員總覽</h1>
                  {isCompetitionMode(client.client_mode) && client.competition_date && (() => {
                    const d = daysUntilDateTW(client.competition_date)
                    return d > 0 ? <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${d <= 14 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>🏆 {d}天</span> : null
                  })()}
                </div>
                <p className="text-xs text-gray-500">{client.age}歲 · {client.gender}{isCompetitionMode(client.client_mode) ? ` · ${PHASE_LABELS[client.prep_phase || ''] || ''}` : ''}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => window.open(`/admin/clients/${clientId}/report`, '_blank')}
                className="flex items-center gap-1.5 bg-gray-100 text-gray-700 px-3 py-2 rounded-lg text-sm hover:bg-gray-200 transition-colors"
                title="產生健康報告"
              >
                <FileText size={15} /> 健康報告
              </button>
              <Link
                href={`/admin/clients/${clientId}`}
                className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-200 transition-colors"
              >
                編輯資料
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">

        {/* 日期範圍篩選 */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">顯示範圍：</span>
          {(['7', '14', '30'] as const).map(d => (
            <button
              key={d}
              onClick={() => setDateRange(d)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${dateRange === d ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              {d} 天
            </button>
          ))}
        </div>

        {/* ===== 頂部快速摘要：紅綠燈 ===== */}
        <div className={`rounded-2xl p-5 border ${
          alerts.length >= 2 ? 'bg-red-50 border-red-200' : alerts.length === 1 ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'
        }`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <span className="text-3xl">{alerts.length >= 2 ? '🔴' : alerts.length === 1 ? '🟡' : '🟢'}</span>
              <div>
                <h2 className="text-base font-bold text-gray-900">{client.name} — 快速摘要</h2>
                <p className="text-xs text-gray-500">
                  {isCompetitionMode(client.client_mode) && client.competition_date && (() => {
                    const d = daysUntilDateTW(client.competition_date)
                    return d > 0 ? `🏆 距比賽 ${d} 天 · ${
                      (PHASE_LABELS[client.prep_phase || ''] || client.prep_phase || '')
                    }` : '比賽已結束'
                  })()}
                  {!isCompetitionMode(client.client_mode) && (client.health_goals || `${client.age}歲 · ${client.gender}`)}
                </p>
              </div>
            </div>
            <Link href={`/admin/clients/${clientId}`} className="px-3 py-1.5 bg-white text-gray-700 rounded-lg text-xs hover:bg-gray-100 transition-colors shadow-sm">
              編輯
            </Link>
          </div>

          {/* 關鍵指標一排 */}
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-7 gap-2 mb-3">
            {client.supplement_enabled && (
              <div className="bg-white/70 rounded-lg p-2 text-center">
                <p className="text-[10px] text-gray-500">補品</p>
                <p className={`text-lg font-bold ${keyMetrics.weekCompliance >= 80 ? 'text-green-600' : keyMetrics.weekCompliance >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>{keyMetrics.weekCompliance}%</p>
              </div>
            )}
            {client.nutrition_enabled && keyMetrics.weekNutritionRate != null && (
              <div className="bg-white/70 rounded-lg p-2 text-center">
                <p className="text-[10px] text-gray-500">飲食</p>
                <p className={`text-lg font-bold ${keyMetrics.weekNutritionRate >= 80 ? 'text-green-600' : keyMetrics.weekNutritionRate >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>{keyMetrics.weekNutritionRate}%</p>
              </div>
            )}
            {client.training_enabled && (
              <div className="bg-white/70 rounded-lg p-2 text-center">
                <p className="text-[10px] text-gray-500">訓練</p>
                <p className="text-lg font-bold text-blue-600">{keyMetrics.weekTrainingDays}天</p>
              </div>
            )}
            {client.wellness_enabled && (
              <div className="bg-white/70 rounded-lg p-2 text-center">
                <p className="text-[10px] text-gray-500">精力</p>
                <p className="text-lg font-bold text-purple-600">{keyMetrics.avgEnergy}</p>
              </div>
            )}
            {client.body_composition_enabled && keyMetrics.latestWeight && (
              <div className="bg-white/70 rounded-lg p-2 text-center">
                <p className="text-[10px] text-gray-500">體重</p>
                <p className="text-lg font-bold text-gray-900">{keyMetrics.latestWeight}<span className="text-xs font-normal">kg</span></p>
              </div>
            )}
            {client.body_composition_enabled && keyMetrics.weightChange && (
              <div className="bg-white/70 rounded-lg p-2 text-center">
                <p className="text-[10px] text-gray-500">週變化</p>
                <p className={`text-lg font-bold ${Number(keyMetrics.weightChange) > 0 ? (client.goal_type === 'bulk' ? 'text-green-500' : 'text-red-500') : Number(keyMetrics.weightChange) < 0 ? (client.goal_type === 'cut' ? 'text-green-500' : 'text-red-500') : 'text-gray-500'}`}>
                  {Number(keyMetrics.weightChange) > 0 ? '+' : ''}{keyMetrics.weightChange}
                  {keyMetrics.weightChangePct && <span className="text-[10px] font-normal text-gray-400 ml-0.5">({Number(keyMetrics.weightChangePct) > 0 ? '+' : ''}{keyMetrics.weightChangePct}%)</span>}
                </p>
              </div>
            )}
            {client.nutrition_enabled && keyMetrics.proteinHitRate != null && (
              <div className="bg-white/70 rounded-lg p-2 text-center">
                <p className="text-[10px] text-gray-500">蛋白質達標</p>
                <p className={`text-lg font-bold ${keyMetrics.proteinHitRate >= 80 ? 'text-green-600' : keyMetrics.proteinHitRate >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>{keyMetrics.proteinHitRate}%</p>
              </div>
            )}
          </div>

          {/* 警報文字 */}
          {alerts.length > 0 && (
            <div className="bg-white/50 rounded-lg px-3 py-2">
              {alerts.map((a, i) => (
                <p key={i} className="text-xs text-red-700">⚠️ {a}</p>
              ))}
            </div>
          )}
        </div>

        {/* 原有警示區塊已整合到頂部摘要 */}

        {/* ===== AI 教練建議 ===== */}
        <div className="bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-200 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-lg">🤖</span>
              <h3 className="text-sm font-semibold text-indigo-900">本週建議調整</h3>
            </div>
            <button
              onClick={fetchCoachSummary}
              disabled={summaryLoading}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                summaryLoading
                  ? 'bg-indigo-300 text-white cursor-not-allowed'
                  : 'bg-indigo-600 text-white hover:bg-indigo-700'
              }`}
            >
              {summaryLoading ? '生成中...' : coachSummary ? '重新生成' : '生成教練建議'}
            </button>
          </div>

          {summaryLoading && (
            <div className="flex items-center gap-3 py-4">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-600"></div>
              <p className="text-sm text-indigo-700">AI 正在分析學員數據...</p>
            </div>
          )}

          {!summaryLoading && coachSummary && (
            <div className="bg-white/70 rounded-xl p-4">
              <div className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{coachSummary}</div>
            </div>
          )}

          {!summaryLoading && !coachSummary && (
            <p className="text-xs text-indigo-600/70">點擊「生成教練建議」，AI 將根據近 14 天數據產出具體建議。</p>
          )}
        </div>

        {/* ===== 本週報告 ===== */}
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-blue-900">📋 {dateRange === '7' ? '本週' : `近 ${dateRange} 天`}報告</h3>
            <div className="flex items-center gap-2">
              <span className="text-xs text-blue-600 font-medium">{weeklyReport.weekLabel}</span>
              <button
                onClick={() => {
                  const text = `📋 ${client.name} 週報（${weeklyReport.weekLabel}）\n\n${weeklyReport.summary}`
                  navigator.clipboard.writeText(text).then(() => {
                    setCopied(true)
                    setTimeout(() => setCopied(false), 2000)
                  })
                }}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                  copied ? 'bg-green-500 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {copied ? '已複製 ✓' : '複製文字'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            {client.training_enabled && (
              <div className="bg-white/70 rounded-xl p-3 text-center">
                <p className="text-xs text-gray-500 mb-0.5">訓練天數</p>
                <p className="text-2xl font-bold text-blue-700">{weeklyReport.trainingDays}</p>
                {weeklyReport.avgRpe && <p className="text-xs text-gray-400">RPE {weeklyReport.avgRpe}</p>}
              </div>
            )}
            {client.wellness_enabled && (
              <div className="bg-white/70 rounded-xl p-3 text-center">
                <p className="text-xs text-gray-500 mb-0.5">精力</p>
                <p className="text-2xl font-bold text-purple-600">
                  {weeklyReport.avgEnergy != null ? weeklyReport.avgEnergy.toFixed(1) : '--'}
                </p>
                {weeklyReport.energyArrow && <p className="text-xs text-gray-400">vs 上週{weeklyReport.energyArrow}</p>}
              </div>
            )}
            {client.supplement_enabled && weeklyReport.weekSuppRate != null && (
              <div className="bg-white/70 rounded-xl p-3 text-center">
                <p className="text-xs text-gray-500 mb-0.5">補品服從</p>
                <p className={`text-2xl font-bold ${weeklyReport.weekSuppRate >= 80 ? 'text-green-600' : weeklyReport.weekSuppRate >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                  {weeklyReport.weekSuppRate}%
                </p>
                {weeklyReport.lastWeekSuppRate != null && (
                  <p className="text-xs text-gray-400">上週 {weeklyReport.lastWeekSuppRate}%</p>
                )}
              </div>
            )}
            {client.nutrition_enabled && weeklyReport.weekNutRate != null && (
              <div className="bg-white/70 rounded-xl p-3 text-center">
                <p className="text-xs text-gray-500 mb-0.5">飲食合規</p>
                <p className={`text-2xl font-bold ${weeklyReport.weekNutRate >= 80 ? 'text-green-600' : weeklyReport.weekNutRate >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                  {weeklyReport.weekNutRate}%
                </p>
                {weeklyReport.lastWeekNutRate != null && (
                  <p className="text-xs text-gray-400">上週 {weeklyReport.lastWeekNutRate}%</p>
                )}
              </div>
            )}
            {client.body_composition_enabled && weeklyReport.weightDelta != null && (
              <div className="bg-white/70 rounded-xl p-3 text-center">
                <p className="text-xs text-gray-500 mb-0.5">體重變化</p>
                <p className={`text-2xl font-bold ${Number(weeklyReport.weightDelta) > 0 ? 'text-red-600' : Number(weeklyReport.weightDelta) < 0 ? 'text-green-600' : 'text-gray-600'}`}>
                  {Number(weeklyReport.weightDelta) > 0 ? '+' : ''}{weeklyReport.weightDelta}
                </p>
                <p className="text-xs text-gray-400">kg</p>
              </div>
            )}
            {client.nutrition_enabled && weeklyReport.avgProtein != null && (
              <div className="bg-white/70 rounded-xl p-3 text-center">
                <p className="text-xs text-gray-500 mb-0.5">平均蛋白質</p>
                <p className={`text-2xl font-bold ${client.protein_target && weeklyReport.avgProtein >= client.protein_target ? 'text-green-600' : 'text-blue-600'}`}>
                  {weeklyReport.avgProtein}g
                </p>
                {client.protein_target && <p className="text-xs text-gray-400">目標 {client.protein_target}g</p>}
              </div>
            )}
            {client.nutrition_enabled && weeklyReport.avgWater != null && (
              <div className="bg-white/70 rounded-xl p-3 text-center">
                <p className="text-xs text-gray-500 mb-0.5">平均飲水</p>
                <p className={`text-2xl font-bold ${client.water_target && weeklyReport.avgWater >= client.water_target ? 'text-green-600' : 'text-cyan-600'}`}>
                  {weeklyReport.avgWater}ml
                </p>
                {client.water_target && <p className="text-xs text-gray-400">目標 {client.water_target}ml</p>}
              </div>
            )}
            {isCompetitionMode(client.client_mode) && weeklyReport.avgCalories != null && (
              <div className="bg-white/70 rounded-xl p-3 text-center">
                <p className="text-xs text-gray-500 mb-0.5">🔥 平均熱量</p>
                <p className={`text-2xl font-bold ${client.calories_target && weeklyReport.avgCalories >= client.calories_target * 0.9 && weeklyReport.avgCalories <= client.calories_target * 1.1 ? 'text-green-600' : 'text-orange-600'}`}>
                  {weeklyReport.avgCalories}
                </p>
                {client.calories_target && <p className="text-xs text-gray-400">目標 {client.calories_target}kcal</p>}
              </div>
            )}
            {isCompetitionMode(client.client_mode) && weeklyReport.avgCarbs != null && (
              <div className="bg-white/70 rounded-xl p-3 text-center">
                <p className="text-xs text-gray-500 mb-0.5">🍚 平均碳水</p>
                <p className={`text-2xl font-bold ${client.carbs_target && weeklyReport.avgCarbs >= client.carbs_target * 0.9 && weeklyReport.avgCarbs <= client.carbs_target * 1.1 ? 'text-green-600' : 'text-amber-600'}`}>
                  {weeklyReport.avgCarbs}g
                </p>
                {client.carbs_target && <p className="text-xs text-gray-400">目標 {client.carbs_target}g</p>}
              </div>
            )}
            {isCompetitionMode(client.client_mode) && weeklyReport.avgFat != null && (
              <div className="bg-white/70 rounded-xl p-3 text-center">
                <p className="text-xs text-gray-500 mb-0.5">🥑 平均脂肪</p>
                <p className={`text-2xl font-bold ${client.fat_target && weeklyReport.avgFat >= client.fat_target * 0.9 && weeklyReport.avgFat <= client.fat_target * 1.1 ? 'text-green-600' : 'text-yellow-600'}`}>
                  {weeklyReport.avgFat}g
                </p>
                {client.fat_target && <p className="text-xs text-gray-400">目標 {client.fat_target}g</p>}
              </div>
            )}
          </div>

          <div className="bg-white/60 rounded-xl p-3">
            <p className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">{weeklyReport.summary}</p>
          </div>
        </div>

        {/* ===== 營養分析引擎 ===== */}
        {suggestion && suggestion.status !== 'insufficient_data' && (
          <div className={`rounded-2xl p-5 border ${
            suggestion.status === 'on_track' ? 'bg-green-50 border-green-200' :
            suggestion.status === 'low_compliance' ? 'bg-gray-50 border-gray-200' :
            suggestion.status === 'too_fast' || suggestion.status === 'wrong_direction' ? 'bg-red-50 border-red-200' :
            'bg-amber-50 border-amber-200'
          }`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{suggestion.statusEmoji}</span>
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">🧮 營養分析引擎</h3>
                  <p className="text-xs text-gray-500">
                    {suggestionMeta?.goalType === 'cut' ? '🔻 減脂模式' : '🔺 增肌模式'}
                    {suggestion.weeklyWeightChangeRate != null && ` · 週變化 ${suggestion.weeklyWeightChangeRate > 0 ? '+' : ''}${suggestion.weeklyWeightChangeRate.toFixed(2)}%`}
                    {suggestion.estimatedTDEE && ` · 估算 TDEE ${suggestion.estimatedTDEE} kcal`}
                  </p>
                </div>
              </div>
              <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                suggestion.status === 'on_track' ? 'bg-green-100 text-green-700' :
                suggestion.status === 'low_compliance' ? 'bg-gray-100 text-gray-600' :
                suggestion.status === 'plateau' ? 'bg-amber-100 text-amber-700' :
                suggestion.status === 'peak_week' || suggestion.status === 'athletic_competition' ? 'bg-purple-100 text-purple-700' :
                suggestion.status === 'athletic_rebound' ? 'bg-indigo-100 text-indigo-700' :
                suggestion.status === 'athletic_weigh_in' ? 'bg-orange-100 text-orange-700' :
                'bg-red-100 text-red-700'
              }`}>{suggestion.statusLabel}</span>
            </div>

            <p className="text-sm text-gray-700 mb-4">{suggestion.message}</p>

            {/* 參考調整表 */}
            {suggestion.status !== 'low_compliance' && !(suggestion.status === 'on_track' && !suggestion.autoApply) && (
              <div className="bg-white/70 rounded-xl p-4 mb-3">
                <p className="text-xs font-semibold text-gray-600 mb-3">參考調整：</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {suggestion.suggestedCalories != null && (
                    <div className="text-center">
                      <p className="text-[10px] text-gray-500">🔥 熱量</p>
                      <p className="text-lg font-bold text-gray-900">{suggestion.suggestedCalories}</p>
                      <p className={`text-xs font-medium ${suggestion.caloriesDelta > 0 ? 'text-green-600' : suggestion.caloriesDelta < 0 ? 'text-red-600' : 'text-gray-400'}`}>
                        {suggestion.caloriesDelta > 0 ? '+' : ''}{suggestion.caloriesDelta} kcal
                      </p>
                    </div>
                  )}
                  {suggestion.suggestedProtein != null && (
                    <div className="text-center">
                      <p className="text-[10px] text-gray-500">🥩 蛋白質</p>
                      <p className="text-lg font-bold text-gray-900">{suggestion.suggestedProtein}g</p>
                      <p className={`text-xs font-medium ${suggestion.proteinDelta > 0 ? 'text-green-600' : suggestion.proteinDelta < 0 ? 'text-red-600' : 'text-gray-400'}`}>
                        {suggestion.proteinDelta === 0 ? '維持' : `${suggestion.proteinDelta > 0 ? '+' : ''}${suggestion.proteinDelta}g`}
                      </p>
                    </div>
                  )}
                  {suggestion.suggestedCarbs != null && (
                    <div className="text-center">
                      <p className="text-[10px] text-gray-500">🍚 碳水</p>
                      <p className="text-lg font-bold text-gray-900">{suggestion.suggestedCarbs}g</p>
                      <p className={`text-xs font-medium ${suggestion.carbsDelta > 0 ? 'text-green-600' : suggestion.carbsDelta < 0 ? 'text-red-600' : 'text-gray-400'}`}>
                        {suggestion.carbsDelta > 0 ? '+' : ''}{suggestion.carbsDelta}g
                      </p>
                    </div>
                  )}
                  {suggestion.suggestedFat != null && (
                    <div className="text-center">
                      <p className="text-[10px] text-gray-500">🥑 脂肪</p>
                      <p className="text-lg font-bold text-gray-900">{suggestion.suggestedFat}g</p>
                      <p className={`text-xs font-medium ${suggestion.fatDelta > 0 ? 'text-green-600' : suggestion.fatDelta < 0 ? 'text-red-600' : 'text-gray-400'}`}>
                        {suggestion.fatDelta === 0 ? '維持' : `${suggestion.fatDelta > 0 ? '+' : ''}${suggestion.fatDelta}g`}
                      </p>
                    </div>
                  )}
                </div>
                {/* 碳循環分配 */}
                {suggestion.suggestedCarbsTrainingDay != null && suggestion.suggestedCarbsRestDay != null && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <p className="text-[10px] text-gray-500 mb-1">🔄 碳循環分配</p>
                    <div className="flex gap-4 text-sm">
                      <span className="text-cyan-700">訓練日：{suggestion.suggestedCarbsTrainingDay}g</span>
                      <span className="text-gray-500">休息日：{suggestion.suggestedCarbsRestDay}g</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 警告 */}
            {suggestion.warnings?.length > 0 && (
              <div className="bg-white/50 rounded-lg px-3 py-2 mb-3">
                {suggestion.warnings.map((w: string, i: number) => (
                  <p key={i} className="text-xs text-amber-700">💡 {w}</p>
                ))}
              </div>
            )}

            {/* 操作按鈕 */}
            {suggestion.status !== 'low_compliance' && !(suggestion.status === 'on_track' && !suggestion.autoApply) && (
              <div className="flex gap-2">
                <button
                  onClick={applySuggestion}
                  disabled={applyingsuggestion || suggestionApplied}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                    suggestionApplied
                      ? 'bg-green-500 text-white'
                      : 'bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50'
                  }`}
                >
                  {suggestionApplied ? '✓ 已套用' : applyingsuggestion ? '套用中...' : '一鍵套用'}
                </button>
                <Link
                  href={`/admin/clients/${clientId}`}
                  className="flex-1 py-2.5 bg-white text-gray-700 rounded-xl text-sm font-medium text-center hover:bg-gray-50 transition-colors border border-gray-200"
                >
                  手動微調
                </Link>
              </div>
            )}

            {/* 資料來源 */}
            {suggestionMeta && (
              <div className="mt-3 pt-2 border-t border-gray-100 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-gray-400">
                <span>體重：{suggestionMeta.latestWeight}kg</span>
                <span>合規率：{suggestionMeta.nutritionCompliance}%</span>
                {suggestionMeta.avgDailyCalories && <span>均攝取：{suggestionMeta.avgDailyCalories}kcal</span>}
                <span>訓練：{suggestionMeta.trainingDaysPerWeek}天/週</span>
                {suggestion.dietDurationWeeks != null && <span>已執行：{suggestion.dietDurationWeeks}週</span>}
              </div>
            )}
            <p className="text-[10px] text-gray-400 mt-2">⚠️ 以上數據由系統根據體重趨勢自動運算，僅供教練參考，不構成營養指導。最終調整請依教練專業判斷。</p>
          </div>
        )}

        {/* ===== 核心指標卡片 ===== */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {client.supplement_enabled && (
            <div className="bg-white rounded-2xl shadow-sm p-5">
              <p className="text-xs text-gray-500 mb-1">{dateRange === '7' ? '週' : `${dateRange}天`}補品服從率</p>
              <p className={`text-3xl font-bold ${keyMetrics.weekCompliance >= 80 ? 'text-green-600' : keyMetrics.weekCompliance >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                {keyMetrics.weekCompliance}%
              </p>
              <p className="text-xs text-gray-400 mt-1">月 {keyMetrics.monthCompliance}%</p>
            </div>
          )}
          {client.training_enabled && (
            <div className="bg-white rounded-2xl shadow-sm p-5">
              <p className="text-xs text-gray-500 mb-1">{dateRange === '7' ? '本週' : `近${dateRange}天`}訓練</p>
              <p className="text-3xl font-bold text-blue-600">{keyMetrics.weekTrainingDays} 天</p>
            </div>
          )}
          {client.wellness_enabled && (
            <div className="bg-white rounded-2xl shadow-sm p-5">
              <p className="text-xs text-gray-500 mb-1">近 {dateRange} 天精力</p>
              <p className="text-3xl font-bold text-purple-600">{keyMetrics.avgEnergy}</p>
              <p className="text-xs text-gray-400 mt-1">滿分 5</p>
            </div>
          )}
          {client.body_composition_enabled && (
            <div className="bg-white rounded-2xl shadow-sm p-5">
              <p className="text-xs text-gray-500 mb-1">最新體重</p>
              <p className="text-3xl font-bold text-gray-900">{keyMetrics.latestWeight ?? '--'}</p>
              {keyMetrics.weightChange && (
                <p className={`text-xs mt-1 ${Number(keyMetrics.weightChange) > 0 ? 'text-red-500' : 'text-green-500'}`}>
                  {Number(keyMetrics.weightChange) > 0 ? '↑' : '↓'} {Math.abs(Number(keyMetrics.weightChange))} kg
                </p>
              )}
            </div>
          )}
          {client.lab_enabled && (
            <div className="bg-white rounded-2xl shadow-sm p-5">
              <p className="text-xs text-gray-500 mb-1">血檢指標</p>
              <p className="text-3xl font-bold text-gray-900">
                {latestLabs.filter(l => l.status === 'normal').length}/{latestLabs.length}
              </p>
              <p className="text-xs text-gray-400 mt-1">正常</p>
            </div>
          )}
          {client.nutrition_enabled && keyMetrics.weekNutritionRate != null && (
            <div className="bg-white rounded-2xl shadow-sm p-5">
              <p className="text-xs text-gray-500 mb-1">{dateRange === '7' ? '週' : `${dateRange}天`}飲食合規</p>
              <p className={`text-3xl font-bold ${keyMetrics.weekNutritionRate >= 80 ? 'text-green-600' : keyMetrics.weekNutritionRate >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                {keyMetrics.weekNutritionRate}%
              </p>
              {keyMetrics.monthNutritionRate != null && (
                <p className="text-xs text-gray-400 mt-1">月 {keyMetrics.monthNutritionRate}%</p>
              )}
            </div>
          )}
        </div>

        {/* ===== 第一排圖表：補品 + 感受 ===== */}
        {(client.supplement_enabled || client.wellness_enabled) && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 補品服從率趨勢 */}
            {client.supplement_enabled && (
              <div className="bg-white rounded-2xl shadow-sm p-5">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">💊 補品服從率趨勢</h3>
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
              </div>
            )}

            {/* 感受趨勢 */}
            {client.wellness_enabled && (
              <div className="bg-white rounded-2xl shadow-sm p-5">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">😊 感受趨勢</h3>
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
        )}

        {/* ===== 飲食合規趨勢 ===== */}
        {client.nutrition_enabled && nutritionTrend.length >= 2 && (
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">🍽️ 飲食合規趨勢（週）</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={nutritionTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" fontSize={11} />
                <YAxis domain={[0, 100]} fontSize={11} />
                <Tooltip formatter={(v: any) => [`${v}%`, '飲食合規率']} />
                <Bar dataKey="飲食合規率" fill="#22c55e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* ===== 蛋白質/水量趨勢 ===== */}
        {client.nutrition_enabled && proteinWaterTrend.length >= 2 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {proteinWaterTrend.some(d => d.蛋白質 != null) && (
              <div className="bg-white rounded-2xl shadow-sm p-5">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">🥩 蛋白質攝取趨勢</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={proteinWaterTrend.filter(d => d.蛋白質 != null)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" fontSize={11} />
                    <YAxis fontSize={11} />
                    <Tooltip formatter={(v: any) => [`${v}g`, '蛋白質']} />
                    {client.protein_target && (
                      <Line type="monotone" dataKey={() => client.protein_target} stroke="#ef4444" strokeDasharray="5 5" dot={false} name="目標" />
                    )}
                    <Bar dataKey="蛋白質" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                {client.protein_target && (
                  <p className="text-xs text-gray-400 mt-1 text-center">目標：{client.protein_target}g / 天</p>
                )}
              </div>
            )}
            {proteinWaterTrend.some(d => d.飲水量 != null) && (
              <div className="bg-white rounded-2xl shadow-sm p-5">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">💧 飲水量趨勢</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={proteinWaterTrend.filter(d => d.飲水量 != null)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" fontSize={11} />
                    <YAxis fontSize={11} />
                    <Tooltip formatter={(v: any) => [`${v}ml`, '飲水量']} />
                    <Bar dataKey="飲水量" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                {client.water_target && (
                  <p className="text-xs text-gray-400 mt-1 text-center">目標：{client.water_target}ml / 天</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* ===== 備賽巨量營養素趨勢 ===== */}
        {isCompetitionMode(client.client_mode) && (macroTrend.calories.length >= 2 || macroTrend.carbs.length >= 2 || macroTrend.fat.length >= 2) && (
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">🏆 備賽巨量營養素趨勢</h3>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {macroTrend.calories.length >= 2 && (
                <div>
                  <p className="text-xs text-gray-500 mb-2 font-medium">🔥 熱量 (kcal)</p>
                  <ResponsiveContainer width="100%" height={160}>
                    <LineChart data={macroTrend.calories}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" fontSize={10} />
                      <YAxis fontSize={10} />
                      <Tooltip formatter={(v: any) => [`${v} kcal`, '熱量']} />
                      <Line type="monotone" dataKey="熱量" stroke="#f97316" strokeWidth={2} dot={{ r: 2 }} />
                    </LineChart>
                  </ResponsiveContainer>
                  {client.calories_target && <p className="text-xs text-gray-400 text-center">目標：{client.calories_target} kcal</p>}
                </div>
              )}
              {macroTrend.carbs.length >= 2 && (
                <div>
                  <p className="text-xs text-gray-500 mb-2 font-medium">🍚 碳水 (g)</p>
                  <ResponsiveContainer width="100%" height={160}>
                    <LineChart data={macroTrend.carbs}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" fontSize={10} />
                      <YAxis fontSize={10} />
                      <Tooltip formatter={(v: any) => [`${v}g`, '碳水']} />
                      <Line type="monotone" dataKey="碳水" stroke="#f59e0b" strokeWidth={2} dot={{ r: 2 }} />
                    </LineChart>
                  </ResponsiveContainer>
                  {client.carbs_target && <p className="text-xs text-gray-400 text-center">目標：{client.carbs_target}g</p>}
                </div>
              )}
              {macroTrend.fat.length >= 2 && (
                <div>
                  <p className="text-xs text-gray-500 mb-2 font-medium">🥑 脂肪 (g)</p>
                  <ResponsiveContainer width="100%" height={160}>
                    <LineChart data={macroTrend.fat}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" fontSize={10} />
                      <YAxis fontSize={10} />
                      <Tooltip formatter={(v: any) => [`${v}g`, '脂肪']} />
                      <Line type="monotone" dataKey="脂肪" stroke="#eab308" strokeWidth={2} dot={{ r: 2 }} />
                    </LineChart>
                  </ResponsiveContainer>
                  {client.fat_target && <p className="text-xs text-gray-400 text-center">目標：{client.fat_target}g</p>}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===== 巨量營養素偏差報告 ===== */}
        {macroDeviation && macroDeviation.dailyData.length >= 3 && (
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-1">📊 巨量營養素偏差報告</h3>
            <p className="text-xs text-gray-400 mb-4">近 14 天每日攝取 vs 目標的偏差百分比，綠色 = ±10% 以內</p>

            {/* 偏差摘要卡片 */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
              {macroDeviation.avgCalDev != null && (
                <div className={`rounded-xl p-3 text-center ${Math.abs(macroDeviation.avgCalDev) <= 10 ? 'bg-green-50' : Math.abs(macroDeviation.avgCalDev) <= 20 ? 'bg-amber-50' : 'bg-red-50'}`}>
                  <p className="text-xs text-gray-500 mb-0.5">🔥 熱量偏差</p>
                  <p className={`text-xl font-bold ${Math.abs(macroDeviation.avgCalDev) <= 10 ? 'text-green-600' : Math.abs(macroDeviation.avgCalDev) <= 20 ? 'text-amber-600' : 'text-red-600'}`}>
                    {macroDeviation.avgCalDev > 0 ? '+' : ''}{macroDeviation.avgCalDev}%
                  </p>
                  <p className="text-[10px] text-gray-400">{macroDeviation.calOverDays}/{macroDeviation.totalDays} 天超標</p>
                </div>
              )}
              {macroDeviation.avgProDev != null && (
                <div className={`rounded-xl p-3 text-center ${Math.abs(macroDeviation.avgProDev) <= 10 ? 'bg-green-50' : Math.abs(macroDeviation.avgProDev) <= 20 ? 'bg-amber-50' : 'bg-red-50'}`}>
                  <p className="text-xs text-gray-500 mb-0.5">🥩 蛋白質偏差</p>
                  <p className={`text-xl font-bold ${Math.abs(macroDeviation.avgProDev) <= 10 ? 'text-green-600' : Math.abs(macroDeviation.avgProDev) <= 20 ? 'text-amber-600' : 'text-red-600'}`}>
                    {macroDeviation.avgProDev > 0 ? '+' : ''}{macroDeviation.avgProDev}%
                  </p>
                  <p className="text-[10px] text-gray-400">{macroDeviation.proOverDays}/{macroDeviation.totalDays} 天超標</p>
                </div>
              )}
              {macroDeviation.avgCarbDev != null && (
                <div className={`rounded-xl p-3 text-center ${Math.abs(macroDeviation.avgCarbDev) <= 10 ? 'bg-green-50' : Math.abs(macroDeviation.avgCarbDev) <= 20 ? 'bg-amber-50' : 'bg-red-50'}`}>
                  <p className="text-xs text-gray-500 mb-0.5">🍚 碳水偏差</p>
                  <p className={`text-xl font-bold ${Math.abs(macroDeviation.avgCarbDev) <= 10 ? 'text-green-600' : Math.abs(macroDeviation.avgCarbDev) <= 20 ? 'text-amber-600' : 'text-red-600'}`}>
                    {macroDeviation.avgCarbDev > 0 ? '+' : ''}{macroDeviation.avgCarbDev}%
                  </p>
                  <p className="text-[10px] text-gray-400">{macroDeviation.carbOverDays}/{macroDeviation.totalDays} 天超標</p>
                </div>
              )}
              {macroDeviation.avgFatDev != null && (
                <div className={`rounded-xl p-3 text-center ${Math.abs(macroDeviation.avgFatDev) <= 10 ? 'bg-green-50' : Math.abs(macroDeviation.avgFatDev) <= 20 ? 'bg-amber-50' : 'bg-red-50'}`}>
                  <p className="text-xs text-gray-500 mb-0.5">🥑 脂肪偏差</p>
                  <p className={`text-xl font-bold ${Math.abs(macroDeviation.avgFatDev) <= 10 ? 'text-green-600' : Math.abs(macroDeviation.avgFatDev) <= 20 ? 'text-amber-600' : 'text-red-600'}`}>
                    {macroDeviation.avgFatDev > 0 ? '+' : ''}{macroDeviation.avgFatDev}%
                  </p>
                  <p className="text-[10px] text-gray-400">{macroDeviation.fatOverDays}/{macroDeviation.totalDays} 天超標</p>
                </div>
              )}
            </div>

            {/* 偏差柱狀圖 — 熱量 */}
            {macroDeviation.dailyData.some((d: any) => d.calDev != null) && (
              <div className="mb-4">
                <p className="text-xs text-gray-500 mb-2 font-medium">🔥 每日熱量偏差 (%)（目標 {client.calories_target} kcal）</p>
                <ResponsiveContainer width="100%" height={140}>
                  <BarChart data={macroDeviation.dailyData.filter((d: any) => d.calDev != null)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" fontSize={10} />
                    <YAxis fontSize={10} tickFormatter={(v: number) => `${v}%`} />
                    <Tooltip formatter={(v: any, _: any, props: any) => [`${v}%（${props.payload.calories} kcal）`, '偏差']} />
                    <ReferenceLine y={0} stroke="#666" strokeWidth={1} />
                    <ReferenceLine y={10} stroke="#22c55e" strokeDasharray="3 3" strokeWidth={0.5} />
                    <ReferenceLine y={-10} stroke="#22c55e" strokeDasharray="3 3" strokeWidth={0.5} />
                    <Bar dataKey="calDev" radius={[2, 2, 0, 0]}>
                      {macroDeviation.dailyData.filter((d: any) => d.calDev != null).map((entry: any, index: number) => (
                        <Cell key={index} fill={Math.abs(entry.calDev) <= 10 ? '#22c55e' : Math.abs(entry.calDev) <= 20 ? '#f59e0b' : '#ef4444'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* 偏差柱狀圖 — 蛋白質 */}
            {macroDeviation.dailyData.some((d: any) => d.proDev != null) && (
              <div className="mb-4">
                <p className="text-xs text-gray-500 mb-2 font-medium">🥩 每日蛋白質偏差 (%)（目標 {client.protein_target}g）</p>
                <ResponsiveContainer width="100%" height={140}>
                  <BarChart data={macroDeviation.dailyData.filter((d: any) => d.proDev != null)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" fontSize={10} />
                    <YAxis fontSize={10} tickFormatter={(v: number) => `${v}%`} />
                    <Tooltip formatter={(v: any, _: any, props: any) => [`${v}%（${props.payload.protein}g）`, '偏差']} />
                    <ReferenceLine y={0} stroke="#666" strokeWidth={1} />
                    <ReferenceLine y={10} stroke="#22c55e" strokeDasharray="3 3" strokeWidth={0.5} />
                    <ReferenceLine y={-10} stroke="#22c55e" strokeDasharray="3 3" strokeWidth={0.5} />
                    <Bar dataKey="proDev" radius={[2, 2, 0, 0]}>
                      {macroDeviation.dailyData.filter((d: any) => d.proDev != null).map((entry: any, index: number) => (
                        <Cell key={index} fill={Math.abs(entry.proDev) <= 10 ? '#22c55e' : Math.abs(entry.proDev) <= 20 ? '#f59e0b' : '#ef4444'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* 偏差柱狀圖 — 碳水 */}
            {macroDeviation.dailyData.some((d: any) => d.carbDev != null) && (
              <div className="mb-4">
                <p className="text-xs text-gray-500 mb-2 font-medium">
                  🍚 每日碳水偏差 (%)
                  {client.carbs_training_day && client.carbs_rest_day
                    ? `（🔄 訓練日 ${client.carbs_training_day}g / 休息日 ${client.carbs_rest_day}g）`
                    : `（目標 ${client.carbs_target}g）`
                  }
                </p>
                <ResponsiveContainer width="100%" height={140}>
                  <BarChart data={macroDeviation.dailyData.filter((d: any) => d.carbDev != null)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" fontSize={10} />
                    <YAxis fontSize={10} tickFormatter={(v: number) => `${v}%`} />
                    <Tooltip formatter={(v: any, _: any, props: any) => [`${v}%（${props.payload.carbs}g${props.payload.carbTarget ? ` / 目標${props.payload.carbTarget}g` : ''}${props.payload.isTrainingDay != null ? (props.payload.isTrainingDay ? ' 訓練日' : ' 休息日') : ''}）`, '偏差']} />
                    <ReferenceLine y={0} stroke="#666" strokeWidth={1} />
                    <ReferenceLine y={10} stroke="#22c55e" strokeDasharray="3 3" strokeWidth={0.5} />
                    <ReferenceLine y={-10} stroke="#22c55e" strokeDasharray="3 3" strokeWidth={0.5} />
                    <Bar dataKey="carbDev" radius={[2, 2, 0, 0]}>
                      {macroDeviation.dailyData.filter((d: any) => d.carbDev != null).map((entry: any, index: number) => (
                        <Cell key={index} fill={Math.abs(entry.carbDev) <= 10 ? '#22c55e' : Math.abs(entry.carbDev) <= 20 ? '#f59e0b' : '#ef4444'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* 偏差柱狀圖 — 脂肪 */}
            {macroDeviation.dailyData.some((d: any) => d.fatDev != null) && (
              <div>
                <p className="text-xs text-gray-500 mb-2 font-medium">🥑 每日脂肪偏差 (%)（目標 {client.fat_target}g）</p>
                <ResponsiveContainer width="100%" height={140}>
                  <BarChart data={macroDeviation.dailyData.filter((d: any) => d.fatDev != null)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" fontSize={10} />
                    <YAxis fontSize={10} tickFormatter={(v: number) => `${v}%`} />
                    <Tooltip formatter={(v: any, _: any, props: any) => [`${v}%（${props.payload.fat}g）`, '偏差']} />
                    <ReferenceLine y={0} stroke="#666" strokeWidth={1} />
                    <ReferenceLine y={10} stroke="#22c55e" strokeDasharray="3 3" strokeWidth={0.5} />
                    <ReferenceLine y={-10} stroke="#22c55e" strokeDasharray="3 3" strokeWidth={0.5} />
                    <Bar dataKey="fatDev" radius={[2, 2, 0, 0]}>
                      {macroDeviation.dailyData.filter((d: any) => d.fatDev != null).map((entry: any, index: number) => (
                        <Cell key={index} fill={Math.abs(entry.fatDev) <= 10 ? '#22c55e' : Math.abs(entry.fatDev) <= 20 ? '#f59e0b' : '#ef4444'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}

        {/* ===== 第二排：訓練日曆 + RPE + 訓練分佈 ===== */}
        {client.training_enabled && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* 訓練日曆 */}
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
                        className={`aspect-square flex flex-col items-center justify-center rounded-lg text-xs ${
                          isToday ? 'ring-2 ring-blue-400' : ''
                        } ${
                          isFuture ? 'bg-gray-50 text-gray-300'
                            : log ? getTypeBgColor(log.training_type)
                            : 'bg-gray-50 text-gray-400'
                        }`}
                        title={log ? `${TRAINING_TYPES.find(t => t.value === log.training_type)?.label} ${log.duration ? log.duration + '分' : ''} ${log.rpe ? 'RPE' + log.rpe : ''}` : ''}
                      >
                        <span className="text-[10px] leading-none">{label}</span>
                        <span className="text-sm leading-none mt-0.5">{!isFuture && log ? getTypeEmoji(log.training_type) : ''}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>

            {/* 訓練類型分佈 */}
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

        {/* RPE 趨勢 */}
        {client.training_enabled && rpeTrend.length >= 2 && (
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">💥 RPE 趨勢</h3>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={rpeTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" fontSize={11} />
                <YAxis domain={[0, 10]} ticks={[2, 4, 6, 8, 10]} fontSize={11} />
                <Tooltip formatter={(v: any, _: any, props: any) => [`RPE ${v}（${props.payload.type}）`, '']} />
                <Line type="monotone" dataKey="RPE" stroke="#ef4444" strokeWidth={2} dot={{ r: 4, fill: '#ef4444', stroke: '#fff', strokeWidth: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* ===== 第三排：體組成趨勢 ===== */}
        {client.body_composition_enabled && <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {bodyTrend.weight.length >= 2 && (
            <div className="bg-white rounded-2xl shadow-sm p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">⚖️ 體重趨勢</h3>
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
        </div>}

        {/* ===== 訓練 × 恢復分析 ===== */}
        {client.training_enabled && client.wellness_enabled && recoveryAnalysis.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">🔍 訓練 × 恢復分析</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-2 px-3 text-xs text-gray-500">訓練類型</th>
                    <th className="text-center py-2 px-3 text-xs text-gray-500">次數</th>
                    <th className="text-center py-2 px-3 text-xs text-gray-500">隔天精力</th>
                    <th className="text-center py-2 px-3 text-xs text-gray-500">隔天睡眠</th>
                  </tr>
                </thead>
                <tbody>
                  {recoveryAnalysis.map((r, i) => (
                    <tr key={i} className="border-b border-gray-50">
                      <td className="py-2 px-3 font-medium">{r.emoji} {r.type}</td>
                      <td className="py-2 px-3 text-center text-gray-600">{r.count}</td>
                      <td className="py-2 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          r.avgEnergy !== '--' && Number(r.avgEnergy) >= 4 ? 'bg-green-100 text-green-700'
                            : r.avgEnergy !== '--' && Number(r.avgEnergy) >= 3 ? 'bg-yellow-100 text-yellow-700'
                            : r.avgEnergy !== '--' ? 'bg-red-100 text-red-700'
                            : 'bg-gray-100 text-gray-500'
                        }`}>{r.avgEnergy}</span>
                      </td>
                      <td className="py-2 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          r.avgSleep !== '--' && Number(r.avgSleep) >= 4 ? 'bg-green-100 text-green-700'
                            : r.avgSleep !== '--' && Number(r.avgSleep) >= 3 ? 'bg-yellow-100 text-yellow-700'
                            : r.avgSleep !== '--' ? 'bg-red-100 text-red-700'
                            : 'bg-gray-100 text-gray-500'
                        }`}>{r.avgSleep}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ===== E1RM 趨勢（主項力量）===== */}
        {client.training_enabled && e1rmTrend.exercises.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">💪 主項力量趨勢（E1RM）</h3>
            <div className="flex flex-wrap gap-3 mb-3">
              {e1rmTrend.exercises.map((ex: string) => {
                const change = e1rmTrend.changes[ex]
                return (
                  <span key={ex} className="text-xs text-gray-600">
                    {ex}
                    {change && (
                      <span className={`ml-1 font-semibold ${change.startsWith('+') ? 'text-green-600' : 'text-red-600'}`}>
                        {change}
                      </span>
                    )}
                  </span>
                )
              })}
            </div>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={e1rmTrend.chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" fontSize={11} />
                <YAxis fontSize={11} domain={['auto', 'auto']} unit="kg" />
                <Tooltip formatter={(v: any) => [`${v} kg`, '']} />
                <Legend />
                {e1rmTrend.exercises.map((ex: string, i: number) => {
                  const colors: Record<string, string> = { '深蹲': '#3b82f6', '臥推': '#ef4444', '硬舉': '#22c55e', '肩推': '#f59e0b' }
                  const fallbackColors = ['#6366f1', '#ec4899', '#14b8a6', '#f97316', '#8b5cf6']
                  const color = Object.entries(colors).find(([k]) => ex.includes(k))?.[1] || fallbackColors[i % fallbackColors.length]
                  return (
                    <Line
                      key={ex}
                      type="monotone"
                      dataKey={ex}
                      stroke={color}
                      strokeWidth={2}
                      dot={{ r: 3, fill: color }}
                      connectNulls
                    />
                  )
                })}
              </LineChart>
            </ResponsiveContainer>
            <p className="text-[10px] text-gray-400 mt-2">Brzycki E1RM = weight x 36/(37-reps)，僅取 reps &le; 10 的組數</p>
          </div>
        )}

        {/* ===== 每週訓練量趨勢 ===== */}
        {client.training_enabled && weeklyTonnage.length >= 2 && (
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">📈 每週訓練量趨勢</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={weeklyTonnage}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="week" fontSize={11} />
                <YAxis fontSize={11} tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
                <Tooltip formatter={(v: any) => [`${Number(v).toLocaleString()} kg`, '訓練量']} />
                <Bar dataKey="訓練量" radius={[4, 4, 0, 0]}>
                  {weeklyTonnage.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={entry.increased ? '#22c55e' : '#ef4444'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <p className="text-[10px] text-gray-400 mt-2">訓練量 = 所有組數的 weight x reps 加總（綠色 = 較上週增加，紅色 = 減少）</p>
          </div>
        )}

        {/* ===== 每肌群週組數 ===== */}
        {client.training_enabled && muscleGroupSets.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">🎯 每肌群週組數</h3>
            <ResponsiveContainer width="100%" height={Math.max(180, muscleGroupSets.length * 36)}>
              <BarChart data={muscleGroupSets} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" fontSize={11} domain={[0, 'auto']} />
                <YAxis type="category" dataKey="muscle" fontSize={12} width={45} />
                <Tooltip formatter={(v: any) => [`${v} 組`, '']} />
                <ReferenceLine x={10} stroke="#f59e0b" strokeDasharray="3 3" label={{ value: 'MEV', position: 'top', fontSize: 10, fill: '#f59e0b' }} />
                <ReferenceLine x={20} stroke="#ef4444" strokeDasharray="3 3" label={{ value: 'MRV', position: 'top', fontSize: 10, fill: '#ef4444' }} />
                <Bar dataKey="組數" fill="#6366f1" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <p className="text-[10px] text-gray-400 mt-2">本週（週一至今）各肌群組數，MEV=最小有效量（10組）、MRV=最大恢復量（20組）</p>
          </div>
        )}

        {/* ===== 血檢指標 ===== */}
        {client.lab_enabled && latestLabs.length > 0 && (
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

        {/* ===== 補品建議（依血檢）===== */}
        {supplementSuggestions.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-base">💊</span>
              <h3 className="text-sm font-semibold text-gray-900">補品建議</h3>
              <span className="text-xs text-gray-400 ml-auto">依血檢數值與訓練狀態自動分析</span>
            </div>
            <div className="space-y-4">
              {supplementSuggestions.map((s, i) => (
                <div key={i} className={`rounded-xl border overflow-hidden ${
                  s.priority === 'high' ? 'border-red-200' :
                  s.priority === 'medium' ? 'border-amber-200' :
                  'border-gray-200'
                }`}>
                  {/* 標題列 */}
                  <div className={`px-5 py-3 flex items-center gap-2 flex-wrap ${
                    s.priority === 'high' ? 'bg-red-50' :
                    s.priority === 'medium' ? 'bg-amber-50' :
                    'bg-gray-50'
                  }`}>
                    <span className="text-base font-bold text-gray-900">{s.name}</span>
                    <span className={`px-2.5 py-0.5 text-[11px] font-bold rounded-full ${
                      s.priority === 'high' ? 'bg-red-100 text-red-700' :
                      s.priority === 'medium' ? 'bg-amber-100 text-amber-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>{s.priority === 'high' ? '強烈建議' : s.priority === 'medium' ? '建議' : '可考慮'}</span>
                    <span className={`px-2.5 py-0.5 text-[11px] rounded-full ${
                      s.category === 'deficiency' ? 'bg-blue-100 text-blue-700' :
                      s.category === 'hormonal' ? 'bg-purple-100 text-purple-700' :
                      s.category === 'performance' ? 'bg-green-100 text-green-700' :
                      'bg-orange-100 text-orange-700'
                    }`}>{
                      s.category === 'deficiency' ? '補充缺乏' :
                      s.category === 'hormonal' ? '荷爾蒙' :
                      s.category === 'performance' ? '運動表現' : '恢復'
                    }</span>
                  </div>

                  {/* 內容區 */}
                  <div className="px-5 py-4 bg-white space-y-3">
                    <p className="text-sm text-gray-700 leading-relaxed">{s.reason}</p>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-gray-50 rounded-lg px-3 py-2.5">
                        <p className="text-[10px] font-medium text-gray-400 mb-1">劑量</p>
                        <p className="text-sm font-medium text-gray-800">{s.dosage}</p>
                      </div>
                      <div className="bg-gray-50 rounded-lg px-3 py-2.5">
                        <p className="text-[10px] font-medium text-gray-400 mb-1">服用時機</p>
                        <p className="text-sm font-medium text-gray-800">{s.timing}</p>
                      </div>
                    </div>

                    {s.triggerTests.length > 0 && (
                      <p className="text-xs text-gray-400">觸發指標：{s.triggerTests.join('、')}</p>
                    )}
                    <p className="text-xs text-gray-400 italic">文獻：{s.evidence}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ===== 血檢飲食建議 + 深度分析（與學員端同步）===== */}
        {client.lab_enabled && labResults.length > 0 && (
          <>
            <LabNutritionAdviceCard
              labResults={labResults}
              gender={(client.gender as '男性' | '女性') ?? undefined}
              goalType={client.goal_type as 'cut' | 'bulk' | null | undefined}
            />
            <LabInsightsCard
              labResults={labResults}
              gender={(client.gender as '男性' | '女性') ?? undefined}
              bodyFatPct={bodyData.length ? bodyData[bodyData.length - 1]?.body_fat ?? null : null}
            />
          </>
        )}

        {/* ===== 教練備註 ===== */}
        {client.coach_summary && (
          <div className="bg-blue-50 rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-blue-800 mb-2">📝 教練備註</h3>
            <p className="text-sm text-gray-700 whitespace-pre-line">{client.coach_summary}</p>
            {client.health_goals && (
              <p className="text-xs text-gray-600 mt-3 pt-3 border-t border-blue-100">🎯 目標：{client.health_goals}</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
