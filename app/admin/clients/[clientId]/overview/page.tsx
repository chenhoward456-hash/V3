'use client'

import { useState, useEffect, useMemo } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, BarChart, Bar
} from 'recharts'
import { TRAINING_TYPES } from '@/components/client/types'

export default function ClientOverview() {
  const { clientId } = useParams()
  const [loading, setLoading] = useState(true)
  const [client, setClient] = useState<any>(null)
  const [supplements, setSupplements] = useState<any[]>([])
  const [supplementLogs, setSupplementLogs] = useState<any[]>([])
  const [wellness, setWellness] = useState<any[]>([])
  const [trainingLogs, setTrainingLogs] = useState<any[]>([])
  const [bodyData, setBodyData] = useState<any[]>([])
  const [labResults, setLabResults] = useState<any[]>([])
  const [nutritionLogs, setNutritionLogs] = useState<any[]>([])

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
    } catch (err) {
      console.error('載入資料錯誤:', err)
    } finally {
      setLoading(false)
    }
  }

  // ===== 核心指標 =====
  const keyMetrics = useMemo(() => {
    const today = new Date()
    const todayStr = today.toISOString().split('T')[0]
    const sevenDaysAgo = new Date(today); sevenDaysAgo.setDate(today.getDate() - 6)
    const weekStart = sevenDaysAgo.toISOString().split('T')[0]
    const thirtyDaysAgo = new Date(today); thirtyDaysAgo.setDate(today.getDate() - 29)
    const monthStart = thirtyDaysAgo.toISOString().split('T')[0]

    // 補品服從率
    const totalSupps = supplements.length
    const weekLogs = supplementLogs.filter(l => l.date >= weekStart && l.date <= todayStr && l.completed)
    const monthLogs = supplementLogs.filter(l => l.date >= monthStart && l.date <= todayStr && l.completed)
    const weekCompliance = totalSupps > 0 ? Math.round((weekLogs.length / (7 * totalSupps)) * 100) : 0
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

    return { weekCompliance, monthCompliance, weekTrainingDays, avgEnergy, weightChange, latestWeight: recentBody.length > 0 ? recentBody[recentBody.length - 1].weight : null, weekNutritionRate, monthNutritionRate }
  }, [supplements, supplementLogs, wellness, trainingLogs, bodyData, nutritionLogs])

  // ===== 補品服從率趨勢（每日） =====
  const complianceTrend = useMemo(() => {
    if (!supplements.length || !supplementLogs.length) return []
    const total = supplements.length
    const byDate: Record<string, number> = {}
    for (const log of supplementLogs) {
      if (log.completed) {
        byDate[log.date] = (byDate[log.date] || 0) + 1
      }
    }
    return Object.entries(byDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({
        date: new Date(date).toLocaleDateString('zh-TW', { month: '2-digit', day: '2-digit' }),
        服從率: Math.round((count / total) * 100),
      }))
  }, [supplements, supplementLogs])

  // ===== 感受趨勢 =====
  const wellnessTrend = useMemo(() => {
    if (!wellness.length) return []
    return wellness
      .filter(w => w.sleep_quality != null || w.energy_level != null || w.mood != null)
      .map(w => ({
        date: new Date(w.date).toLocaleDateString('zh-TW', { month: '2-digit', day: '2-digit' }),
        睡眠: w.sleep_quality,
        精力: w.energy_level,
        心情: w.mood,
      }))
  }, [wellness])

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

  // ===== 飲食合規趨勢 =====
  const nutritionTrend = useMemo(() => {
    if (!nutritionLogs.length) return []
    const byWeek: Record<string, { compliant: number; total: number }> = {}
    for (const log of nutritionLogs) {
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
  }, [nutritionLogs])

  // ===== 週報自動產出 =====
  const weeklyReport = useMemo(() => {
    const today = new Date()
    const todayStr = today.toISOString().split('T')[0]
    const sevenDaysAgo = new Date(today); sevenDaysAgo.setDate(today.getDate() - 6)
    const weekStart = sevenDaysAgo.toISOString().split('T')[0]
    const fourteenDaysAgo = new Date(today); fourteenDaysAgo.setDate(today.getDate() - 13)
    const lastWeekStart = fourteenDaysAgo.toISOString().split('T')[0]
    const lastWeekEnd = new Date(today); lastWeekEnd.setDate(today.getDate() - 7)
    const lastWeekEndStr = lastWeekEnd.toISOString().split('T')[0]

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
    const weekSuppRate = totalSupps > 0 ? Math.round((weekSuppLogs.length / (7 * totalSupps)) * 100) : null
    const lastWeekSuppRate = totalSupps > 0 ? Math.round((lastWeekSuppLogs.length / (7 * totalSupps)) * 100) : null

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

    return {
      trainingDays, topTypes, avgRpe,
      avgSleep, avgEnergy, avgMood,
      sleepArrow: arrow(avgSleep, lastAvgSleep),
      energyArrow: arrow(avgEnergy, lastAvgEnergy),
      moodArrow: arrow(avgMood, lastAvgMood),
      weekSuppRate, lastWeekSuppRate,
      weekNutRate, lastWeekNutRate,
      weightDelta,
      summary: lines.join('\n'),
      weekLabel: `${sevenDaysAgo.toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' })} - ${today.toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' })}`,
    }
  }, [trainingLogs, wellness, supplements, supplementLogs, bodyData, nutritionLogs])

  // ===== 需注意事項 =====
  const alerts = useMemo(() => {
    const items: string[] = []
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
  }, [keyMetrics, wellness, trainingLogs, supplements, client])

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
                <h1 className="text-xl font-bold text-gray-900">{client.name} — 學員總覽</h1>
                <p className="text-xs text-gray-500">{client.age}歲 · {client.gender}</p>
              </div>
            </div>
            <Link
              href={`/admin/clients/${clientId}`}
              className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-200 transition-colors"
            >
              編輯資料
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">

        {/* ===== 警示 ===== */}
        {alerts.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
            <p className="text-sm font-medium text-red-800 mb-2">⚠️ 需要注意</p>
            <div className="space-y-1">
              {alerts.map((a, i) => (
                <p key={i} className="text-sm text-red-700">• {a}</p>
              ))}
            </div>
          </div>
        )}

        {/* ===== 本週報告 ===== */}
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-blue-900">📋 本週報告</h3>
            <span className="text-xs text-blue-600 font-medium">{weeklyReport.weekLabel}</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            {client.training_enabled && (
              <div className="bg-white/70 rounded-xl p-3 text-center">
                <p className="text-xs text-gray-500 mb-0.5">訓練天數</p>
                <p className="text-2xl font-bold text-blue-700">{weeklyReport.trainingDays}</p>
                {weeklyReport.avgRpe && <p className="text-xs text-gray-400">RPE {weeklyReport.avgRpe}</p>}
              </div>
            )}
            <div className="bg-white/70 rounded-xl p-3 text-center">
              <p className="text-xs text-gray-500 mb-0.5">精力</p>
              <p className="text-2xl font-bold text-purple-600">
                {weeklyReport.avgEnergy != null ? weeklyReport.avgEnergy.toFixed(1) : '--'}
              </p>
              {weeklyReport.energyArrow && <p className="text-xs text-gray-400">vs 上週{weeklyReport.energyArrow}</p>}
            </div>
            {weeklyReport.weekSuppRate != null && (
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
            {weeklyReport.weightDelta != null && (
              <div className="bg-white/70 rounded-xl p-3 text-center">
                <p className="text-xs text-gray-500 mb-0.5">體重變化</p>
                <p className={`text-2xl font-bold ${Number(weeklyReport.weightDelta) > 0 ? 'text-red-600' : Number(weeklyReport.weightDelta) < 0 ? 'text-green-600' : 'text-gray-600'}`}>
                  {Number(weeklyReport.weightDelta) > 0 ? '+' : ''}{weeklyReport.weightDelta}
                </p>
                <p className="text-xs text-gray-400">kg</p>
              </div>
            )}
          </div>

          <div className="bg-white/60 rounded-xl p-3">
            <p className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">{weeklyReport.summary}</p>
          </div>
        </div>

        {/* ===== 核心指標卡片 ===== */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <p className="text-xs text-gray-500 mb-1">週補品服從率</p>
            <p className={`text-3xl font-bold ${keyMetrics.weekCompliance >= 80 ? 'text-green-600' : keyMetrics.weekCompliance >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
              {keyMetrics.weekCompliance}%
            </p>
            <p className="text-xs text-gray-400 mt-1">月 {keyMetrics.monthCompliance}%</p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <p className="text-xs text-gray-500 mb-1">本週訓練</p>
            <p className="text-3xl font-bold text-blue-600">{keyMetrics.weekTrainingDays} 天</p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <p className="text-xs text-gray-500 mb-1">近 7 天精力</p>
            <p className="text-3xl font-bold text-purple-600">{keyMetrics.avgEnergy}</p>
            <p className="text-xs text-gray-400 mt-1">滿分 5</p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <p className="text-xs text-gray-500 mb-1">最新體重</p>
            <p className="text-3xl font-bold text-gray-900">{keyMetrics.latestWeight ?? '--'}</p>
            {keyMetrics.weightChange && (
              <p className={`text-xs mt-1 ${Number(keyMetrics.weightChange) > 0 ? 'text-red-500' : 'text-green-500'}`}>
                {Number(keyMetrics.weightChange) > 0 ? '↑' : '↓'} {Math.abs(Number(keyMetrics.weightChange))} kg
              </p>
            )}
          </div>
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <p className="text-xs text-gray-500 mb-1">血檢指標</p>
            <p className="text-3xl font-bold text-gray-900">
              {latestLabs.filter(l => l.status === 'normal').length}/{latestLabs.length}
            </p>
            <p className="text-xs text-gray-400 mt-1">正常</p>
          </div>
          {client.nutrition_enabled && keyMetrics.weekNutritionRate != null && (
            <div className="bg-white rounded-2xl shadow-sm p-5">
              <p className="text-xs text-gray-500 mb-1">週飲食合規</p>
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 補品服從率趨勢 */}
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

          {/* 感受趨勢 */}
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
        </div>

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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
        </div>

        {/* ===== 訓練 × 恢復分析 ===== */}
        {recoveryAnalysis.length > 0 && (
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

        {/* ===== 血檢指標 ===== */}
        {latestLabs.length > 0 && (
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
