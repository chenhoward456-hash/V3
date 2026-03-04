/**
 * 健康模式季度報告 API
 * GET /api/health-report?clientId={uuid}
 *
 * 產出本季 vs 上季的完整對比：
 *   - 健康分數趨勢
 *   - 各支柱進步幅度
 *   - 血檢數值前後對比
 *   - 體組成變化
 *   - 血檢 → 飲食建議
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase'
import { calculateHealthScore, type HealthScoreInput } from '@/lib/health-score-engine'
import { generateLabNutritionAdvice, type LabNutritionAdvice } from '@/lib/lab-nutrition-advisor'

export const dynamic = 'force-dynamic'

interface QuarterData {
  healthScore: ReturnType<typeof calculateHealthScore> | null
  avgWeight: number | null
  avgBodyFat: number | null
  labResults: Array<{ test_name: string; value: number; unit: string; status: string; date: string }>
  supplementCompliance: number
  trainingDaysPerWeek: number
  avgSleepQuality: number | null
  avgEnergyLevel: number | null
  avgStressLevel: number | null
  startDate: string
  endDate: string
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const clientId = searchParams.get('clientId')

  if (!clientId) {
    return NextResponse.json({ error: '缺少 clientId' }, { status: 400 })
  }

  const supabase = createServiceSupabase()

  try {
    // 1. 取得客戶資料
    const { data: client, error: clientErr } = await supabase
      .from('clients')
      .select('id, gender, health_mode_enabled, quarterly_cycle_start')
      .eq('id', clientId)
      .single()

    if (clientErr || !client) {
      return NextResponse.json({ error: '找不到學員' }, { status: 404 })
    }

    if (!client.health_mode_enabled) {
      return NextResponse.json({ error: '非健康模式學員' }, { status: 403 })
    }

    // 2. 計算本季和上季的日期範圍
    const cycleStart = client.quarterly_cycle_start
      ? new Date(client.quarterly_cycle_start)
      : new Date()

    const currentQuarter = {
      start: cycleStart.toISOString().split('T')[0],
      end: new Date(cycleStart.getTime() + 90 * 86400000).toISOString().split('T')[0],
    }

    const prevQuarterEnd = new Date(cycleStart.getTime() - 86400000)
    const prevQuarterStart = new Date(prevQuarterEnd.getTime() - 89 * 86400000)
    const previousQuarter = {
      start: prevQuarterStart.toISOString().split('T')[0],
      end: prevQuarterEnd.toISOString().split('T')[0],
    }

    // 3. 取得兩季的數據
    const [currentData, previousData] = await Promise.all([
      fetchQuarterData(supabase, client.id, currentQuarter.start, currentQuarter.end, client.gender),
      fetchQuarterData(supabase, client.id, previousQuarter.start, previousQuarter.end, client.gender),
    ])

    // 4. 血檢飲食建議（用最新血檢）
    const latestLabs = currentData.labResults.length > 0
      ? currentData.labResults
      : previousData.labResults
    const labNutritionAdvice = generateLabNutritionAdvice(
      latestLabs.map(l => ({
        test_name: l.test_name,
        value: l.value,
        unit: l.unit,
        status: l.status as 'normal' | 'attention' | 'alert',
      })),
      { gender: client.gender, goalType: null }
    )

    // 5. 組裝對比報告
    const report = buildComparisonReport(currentData, previousData, currentQuarter, previousQuarter)

    return NextResponse.json({
      report,
      labNutritionAdvice,
      currentQuarter,
      previousQuarter,
    })
  } catch (err) {
    return NextResponse.json({ error: '報告產生失敗' }, { status: 500 })
  }
}

async function fetchQuarterData(
  supabase: ReturnType<typeof createServiceSupabase>,
  clientId: string,
  startDate: string,
  endDate: string,
  gender: string
): Promise<QuarterData> {
  const today = new Date().toISOString().split('T')[0]
  const effectiveEnd = endDate > today ? today : endDate

  const [bodyRes, wellnessRes, nutritionRes, trainingRes, labRes, suppRes] = await Promise.all([
    supabase.from('body_composition').select('weight, body_fat, date')
      .eq('client_id', clientId).gte('date', startDate).lte('date', effectiveEnd).order('date'),
    supabase.from('daily_wellness').select('sleep_quality, energy_level, mood, cognitive_clarity, stress_level, date')
      .eq('client_id', clientId).gte('date', startDate).lte('date', effectiveEnd).order('date'),
    supabase.from('nutrition_logs').select('compliant, date')
      .eq('client_id', clientId).gte('date', startDate).lte('date', effectiveEnd),
    supabase.from('training_logs').select('training_type, date')
      .eq('client_id', clientId).gte('date', startDate).lte('date', effectiveEnd),
    supabase.from('lab_results').select('test_name, value, unit, status, date')
      .eq('client_id', clientId).gte('date', startDate).lte('date', effectiveEnd).order('date'),
    supabase.from('supplement_logs').select('completed, date')
      .eq('client_id', clientId).gte('date', startDate).lte('date', effectiveEnd),
  ])

  const bodyData = bodyRes.data || []
  const wellnessData = wellnessRes.data || []
  const nutritionData = nutritionRes.data || []
  const trainingData = trainingRes.data || []
  const labData = labRes.data || []
  const suppData = suppRes.data || []

  // 計算健康分數（用最近 7 天數據）
  const last7Wellness = wellnessData.slice(-7)
  const last7Nutrition = nutritionData.slice(-7)
  const last7Training = trainingData.slice(-7)
  const suppCompliance = suppData.length > 0
    ? suppData.filter((s: any) => s.completed).length / suppData.length
    : 0

  const healthScoreInput: HealthScoreInput = {
    wellnessLast7: last7Wellness.map((w: any) => ({
      sleep_quality: w.sleep_quality,
      energy_level: w.energy_level,
      mood: w.mood,
      cognitive_clarity: w.cognitive_clarity,
      stress_level: w.stress_level,
    })),
    nutritionLast7: last7Nutrition.map((n: any) => ({ compliant: n.compliant })),
    trainingLast7: last7Training.map((t: any) => ({ training_type: t.training_type })),
    supplementComplianceRate: suppCompliance,
    labResults: labData.map((l: any) => ({ status: l.status })),
    quarterlyStart: startDate,
  }

  const healthScore = wellnessData.length > 0 ? calculateHealthScore(healthScoreInput) : null

  // 平均值計算
  const weights = bodyData.filter((b: any) => b.weight).map((b: any) => b.weight)
  const bodyFats = bodyData.filter((b: any) => b.body_fat).map((b: any) => b.body_fat)
  const sleepScores = wellnessData.filter((w: any) => w.sleep_quality).map((w: any) => w.sleep_quality)
  const energyScores = wellnessData.filter((w: any) => w.energy_level).map((w: any) => w.energy_level)
  const stressScores = wellnessData.filter((w: any) => w.stress_level).map((w: any) => w.stress_level)

  const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : null

  // 每週訓練天數
  const weeks = Math.max(1, Math.ceil(trainingData.length / 7))
  const trainingDays = trainingData.filter((t: any) => t.training_type !== 'rest').length

  return {
    healthScore,
    avgWeight: avg(weights),
    avgBodyFat: avg(bodyFats),
    labResults: labData as any,
    supplementCompliance: suppCompliance,
    trainingDaysPerWeek: Math.round(trainingDays / weeks * 10) / 10,
    avgSleepQuality: avg(sleepScores),
    avgEnergyLevel: avg(energyScores),
    avgStressLevel: avg(stressScores),
    startDate,
    endDate,
  }
}

interface ComparisonItem {
  label: string
  icon: string
  current: number | string | null
  previous: number | string | null
  unit: string
  improved: boolean | null  // null = 無法比較
}

function buildComparisonReport(
  current: QuarterData,
  previous: QuarterData,
  currentQ: { start: string; end: string },
  previousQ: { start: string; end: string },
) {
  const comparisons: ComparisonItem[] = []

  // 健康分數
  comparisons.push({
    label: '健康分數',
    icon: '🌿',
    current: current.healthScore?.total ?? null,
    previous: previous.healthScore?.total ?? null,
    unit: '分',
    improved: current.healthScore && previous.healthScore
      ? current.healthScore.total > previous.healthScore.total
      : null,
  })

  // 各支柱
  if (current.healthScore && previous.healthScore) {
    for (let i = 0; i < current.healthScore.pillars.length; i++) {
      const cp = current.healthScore.pillars[i]
      const pp = previous.healthScore.pillars[i]
      if (cp && pp) {
        comparisons.push({
          label: cp.label,
          icon: cp.emoji,
          current: cp.score,
          previous: pp.score,
          unit: '分',
          improved: cp.score > pp.score,
        })
      }
    }
  }

  // 體組成
  comparisons.push({
    label: '平均體重',
    icon: '⚖️',
    current: current.avgWeight ? Math.round(current.avgWeight * 10) / 10 : null,
    previous: previous.avgWeight ? Math.round(previous.avgWeight * 10) / 10 : null,
    unit: 'kg',
    improved: current.avgWeight != null && previous.avgWeight != null
      ? current.avgWeight < previous.avgWeight  // 假設減比較好（可再依 goalType 調整）
      : null,
  })

  comparisons.push({
    label: '平均體脂',
    icon: '📏',
    current: current.avgBodyFat ? Math.round(current.avgBodyFat * 10) / 10 : null,
    previous: previous.avgBodyFat ? Math.round(previous.avgBodyFat * 10) / 10 : null,
    unit: '%',
    improved: current.avgBodyFat != null && previous.avgBodyFat != null
      ? current.avgBodyFat < previous.avgBodyFat
      : null,
  })

  // 生活指標
  comparisons.push({
    label: '睡眠品質',
    icon: '😴',
    current: current.avgSleepQuality ? Math.round(current.avgSleepQuality * 10) / 10 : null,
    previous: previous.avgSleepQuality ? Math.round(previous.avgSleepQuality * 10) / 10 : null,
    unit: '/5',
    improved: current.avgSleepQuality != null && previous.avgSleepQuality != null
      ? current.avgSleepQuality > previous.avgSleepQuality
      : null,
  })

  comparisons.push({
    label: '壓力指數',
    icon: '😰',
    current: current.avgStressLevel ? Math.round(current.avgStressLevel * 10) / 10 : null,
    previous: previous.avgStressLevel ? Math.round(previous.avgStressLevel * 10) / 10 : null,
    unit: '/5',
    improved: current.avgStressLevel != null && previous.avgStressLevel != null
      ? current.avgStressLevel < previous.avgStressLevel  // 壓力越低越好
      : null,
  })

  // 血檢比較（找同名指標的前後值）
  const labComparisons: Array<{
    testName: string
    current: { value: number; status: string; date: string } | null
    previous: { value: number; status: string; date: string } | null
    improved: boolean | null
    unit: string
  }> = []

  // 用 Map 取每個指標的最新值
  const currentLabMap = new Map<string, typeof current.labResults[0]>()
  for (const l of current.labResults) {
    currentLabMap.set(l.test_name, l)
  }

  const previousLabMap = new Map<string, typeof previous.labResults[0]>()
  for (const l of previous.labResults) {
    previousLabMap.set(l.test_name, l)
  }

  const allTestNames = new Set([...currentLabMap.keys(), ...previousLabMap.keys()])
  for (const name of allTestNames) {
    const curr = currentLabMap.get(name)
    const prev = previousLabMap.get(name)

    // 判斷進步：normal > attention > alert
    const statusRank = { normal: 2, attention: 1, alert: 0 }
    const improved = curr && prev
      ? (statusRank[curr.status as keyof typeof statusRank] ?? 0) > (statusRank[prev.status as keyof typeof statusRank] ?? 0)
      : null

    labComparisons.push({
      testName: name,
      current: curr ? { value: curr.value, status: curr.status, date: curr.date } : null,
      previous: prev ? { value: prev.value, status: prev.status, date: prev.date } : null,
      improved,
      unit: curr?.unit || prev?.unit || '',
    })
  }

  return {
    comparisons,
    labComparisons,
    currentGrade: current.healthScore?.grade ?? null,
    previousGrade: previous.healthScore?.grade ?? null,
    daysInCycle: current.healthScore?.daysInCycle ?? null,
  }
}
