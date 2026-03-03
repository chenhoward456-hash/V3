/**
 * Weekly Report API
 * 教練週報 API — 為所有活躍學員生成智慧週報
 *
 * GET /api/admin/weekly-report
 *   - 需要 admin session
 *   - 回傳每位學員的週報 + 教練全局摘要
 *
 * GET /api/admin/weekly-report?clientId=xxx
 *   - 回傳單一學員的詳細週報
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase'
import { verifyAdminSession } from '@/lib/auth-middleware'
import {
  generateClientReport,
  generateCoachDigest,
  type ClientReportInput,
} from '@/lib/weekly-report-engine'

const supabase = createServiceSupabase()

function getAdminSession(request: NextRequest): boolean {
  const token = request.cookies.get('admin_session')?.value
  return !!token && verifyAdminSession(token)
}

export async function GET(request: NextRequest) {
  if (!getAdminSession(request)) {
    return NextResponse.json({ error: '未授權' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const clientId = searchParams.get('clientId')

  try {
    const today = new Date()
    const todayStr = today.toISOString().split('T')[0]

    const thirtyDaysAgo = new Date(today)
    thirtyDaysAgo.setDate(today.getDate() - 30)
    const sinceDate = thirtyDaysAgo.toISOString().split('T')[0]

    const fourteenDaysAgo = new Date(today)
    fourteenDaysAgo.setDate(today.getDate() - 14)
    const fourteenStr = fourteenDaysAgo.toISOString().split('T')[0]

    const sevenDaysAgo = new Date(today)
    sevenDaysAgo.setDate(today.getDate() - 7)
    const sevenStr = sevenDaysAgo.toISOString().split('T')[0]

    // 1. 取得學員
    let clientsQuery = supabase.from('clients').select('*').eq('is_active', true)
    if (clientId) clientsQuery = clientsQuery.eq('id', clientId)
    const { data: clients, error: clientErr } = await clientsQuery

    if (clientErr || !clients || clients.length === 0) {
      return NextResponse.json({ error: clientId ? '找不到學員' : '無活躍學員' }, { status: 404 })
    }

    const clientIds = clients.map((c: any) => c.id)

    // 2. 批量查詢近 30 天數據
    const [bodyRes, nutritionRes, trainingRes, wellnessRes, suppRes, suppLogRes, labRes] = await Promise.all([
      supabase.from('body_composition').select('client_id, date, weight, height, body_fat')
        .in('client_id', clientIds).gte('date', sinceDate).not('weight', 'is', null)
        .order('date', { ascending: true }),
      supabase.from('nutrition_logs').select('client_id, date, compliant, calories, protein_grams, carbs_grams, fat_grams')
        .in('client_id', clientIds).gte('date', sinceDate).order('date', { ascending: true }),
      supabase.from('training_logs').select('client_id, date, training_type, rpe')
        .in('client_id', clientIds).gte('date', sinceDate).order('date', { ascending: true }),
      supabase.from('daily_wellness').select('client_id, date, sleep_quality, energy_level, mood, stress_level, training_drive, cognitive_clarity, resting_hr, hrv, wearable_sleep_score, respiratory_rate')
        .in('client_id', clientIds).gte('date', sinceDate).order('date', { ascending: true }),
      supabase.from('supplements').select('id, client_id').in('client_id', clientIds),
      supabase.from('supplement_logs').select('client_id, supplement_id, date, completed')
        .in('client_id', clientIds).gte('date', sevenStr),
      supabase.from('lab_results').select('client_id, test_name, value, unit, status, date')
        .in('client_id', clientIds).order('date', { ascending: false }),
    ])

    const allBody = bodyRes.data || []
    const allNutrition = nutritionRes.data || []
    const allTraining = trainingRes.data || []
    const allWellness = wellnessRes.data || []
    const allSupplements = suppRes.data || []
    const allSuppLogs = suppLogRes.data || []
    const allLabs = labRes.data || []

    // 3. 為每位學員組裝輸入並生成週報
    const reports = []

    for (const client of clients) {
      const cBody = allBody.filter((b: any) => b.client_id === client.id)
      const cNutrition = allNutrition.filter((n: any) => n.client_id === client.id)
      const cTraining = allTraining.filter((t: any) => t.client_id === client.id)
      const cWellness = allWellness.filter((w: any) => w.client_id === client.id)
      const cSupps = allSupplements.filter((s: any) => s.client_id === client.id)
      const cSuppLogs = allSuppLogs.filter((l: any) => l.client_id === client.id)

      // 最近血檢（每個 test_name 只取最新一筆）
      const cLabs = allLabs.filter((l: any) => l.client_id === client.id)
      const latestLabsMap = new Map<string, any>()
      for (const lab of cLabs) {
        if (!latestLabsMap.has(lab.test_name)) latestLabsMap.set(lab.test_name, lab)
      }
      const latestLabs = Array.from(latestLabsMap.values())

      // 近 14 天 wellness
      const wellness14 = cWellness.filter((w: any) => w.date >= fourteenStr)

      // 近 14 天 nutrition
      const nutrition14 = cNutrition.filter((n: any) => n.date >= fourteenStr)

      // 近 14 天 training
      const training14 = cTraining.filter((t: any) => t.date >= fourteenStr)

      // 近 14 天 body
      const body14 = cBody.filter((b: any) => b.date >= fourteenStr)

      // 週均體重
      const weeklyWeights: { week: number; avgWeight: number }[] = []
      for (let w = 0; w < 4; w++) {
        const weekEnd = new Date(today)
        weekEnd.setDate(today.getDate() - w * 7)
        const weekStart = new Date(weekEnd)
        weekStart.setDate(weekEnd.getDate() - 6)
        const startStr = weekStart.toISOString().split('T')[0]
        const endStr = weekEnd.toISOString().split('T')[0]
        const wWeights = cBody
          .filter((b: any) => b.date >= startStr && b.date <= endStr)
          .map((b: any) => b.weight)
        if (wWeights.length > 0) {
          const avg = wWeights.reduce((a: number, b: number) => a + b, 0) / wWeights.length
          weeklyWeights.push({ week: w, avgWeight: Math.round(avg * 100) / 100 })
        }
      }

      // 飲食合規率
      const compliantCount = nutrition14.filter((n: any) => n.compliant).length
      const nutritionCompliance = nutrition14.length > 0
        ? Math.round((compliantCount / nutrition14.length) * 100) : 0

      // 補品合規率
      const suppCount = cSupps.length
      const suppLogsCompleted = cSuppLogs.filter((l: any) => l.completed).length
      const supplementComplianceRate = suppCount > 0
        ? Math.min(1, suppLogsCompleted / (suppCount * 7)) : 0

      // 體重停滯
      const weightStagnant = body14.length >= 4 &&
        Math.max(...body14.map((b: any) => b.weight)) - Math.min(...body14.map((b: any) => b.weight)) < 0.5

      // 每日活動（近 30 天）
      const dailyActivity: ClientReportInput['dailyActivity'] = []
      for (let d = 0; d < 30; d++) {
        const date = new Date(today)
        date.setDate(today.getDate() - (29 - d))
        const dateStr = date.toISOString().split('T')[0]
        dailyActivity.push({
          date: dateStr,
          hasWellness: cWellness.some((w: any) => w.date === dateStr),
          hasNutrition: cNutrition.some((n: any) => n.date === dateStr),
          hasTraining: cTraining.some((t: any) => t.date === dateStr),
          hasSupplement: cSuppLogs.some((l: any) => l.date === dateStr && l.completed),
          hasBodyComp: cBody.some((b: any) => b.date === dateStr),
        })
      }

      // 恢復基線（用第 8-30 天的平均）
      const baselineWellness = cWellness.filter((w: any) => w.date < fourteenStr)
      const baselineHRVs = baselineWellness.map((w: any) => w.hrv).filter((v: any) => v != null) as number[]
      const baselineRHRs = baselineWellness.map((w: any) => w.resting_hr).filter((v: any) => v != null) as number[]

      const reportInput: ClientReportInput = {
        clientId: client.id,
        clientName: client.name,
        gender: client.gender || '男性',
        goalType: client.goal_type || 'cut',
        isActive: client.is_active,
        subscriptionTier: client.subscription_tier || 'free',
        prepPhase: client.prep_phase || null,
        competitionEnabled: client.competition_enabled || false,
        competitionDate: client.competition_date || null,
        dietStartDate: client.diet_start_date || null,
        targetWeight: client.target_weight || null,
        targetBodyFatPct: client.body_fat_target || null,
        targetDate: client.competition_date || client.target_date || null,
        caloriesTarget: client.calories_target || null,
        proteinTarget: client.protein_target || null,
        estimatedTDEE: null, // Will be calculated by prediction engine
        dailyActivity,
        wellness: wellness14.map((w: any) => ({
          date: w.date,
          sleep_quality: w.sleep_quality ?? null,
          energy_level: w.energy_level ?? null,
          mood: w.mood ?? null,
          stress_level: w.stress_level ?? null,
          training_drive: w.training_drive ?? null,
          cognitive_clarity: w.cognitive_clarity ?? null,
          resting_hr: w.resting_hr ?? null,
          hrv: w.hrv ?? null,
        })),
        training: training14.map((t: any) => ({
          date: t.date,
          training_type: t.training_type,
          rpe: t.rpe ?? null,
        })),
        nutrition: nutrition14.map((n: any) => ({
          date: n.date,
          compliant: n.compliant ?? null,
          calories: n.calories ?? null,
          protein_grams: n.protein_grams ?? null,
        })),
        bodyComposition: body14.map((b: any) => ({
          date: b.date,
          weight: b.weight,
          body_fat: b.body_fat ?? null,
        })),
        weeklyWeights,
        labResults: latestLabs.map((l: any) => ({
          test_name: l.test_name,
          value: l.value,
          status: l.status || 'normal',
          date: l.date,
        })),
        supplementComplianceRate,
        nutritionCompliance,
        weightStagnant,
        weeksSinceLastBreak: null,
        refeedSuggested: false,
        lastRefeedDate: null,
        baselineHRV: baselineHRVs.length > 0 ? baselineHRVs.reduce((a, b) => a + b, 0) / baselineHRVs.length : null,
        baselineRHR: baselineRHRs.length > 0 ? baselineRHRs.reduce((a, b) => a + b, 0) / baselineRHRs.length : null,
      }

      const report = generateClientReport(reportInput)
      reports.push(report)
    }

    // 4. 生成教練全局摘要
    const digest = generateCoachDigest(reports)

    // 5. 回傳
    if (clientId) {
      return NextResponse.json({ report: reports[0] })
    }

    return NextResponse.json({
      digest,
      reports,
    })
  } catch (err: any) {
    console.error('[weekly-report] Error:', err)
    return NextResponse.json({ error: '生成週報失敗', detail: err.message }, { status: 500 })
  }
}
