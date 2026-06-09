/**
 * Single-client trajectory diagnosis — dry run the cron logic for one client
 * and push the resulting LINE alert to the admin. NO DB writes (except audit-log
 * insert is skipped). Use this to test what the system "currently thinks" of a
 * client without waiting for the daily cron tick.
 *
 * Auth: CRON_SECRET header OR admin session
 * Usage: GET /api/admin/trajectory-check?clientId=<uuid>
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase'
import { pushMessage } from '@/lib/line'
import { verifyAdminSession } from '@/lib/auth-middleware'
import { computeTrajectoryAdjustment, type MacroBounds } from '@/lib/trajectory-adjust'
import { generateNutritionSuggestion, type NutritionInput } from '@/lib/nutrition-engine'
import { isWeightTraining } from '@/components/client/types'

function parseSerotoninField(value: string | null): { serotonin?: 'LL' | 'SL' | 'SS'; depressionRisk?: 'low' | 'moderate' | 'high' } {
  if (!value) return {}
  if (value === 'LL' || value === 'SL' || value === 'SS') return { serotonin: value }
  if (value === 'low' || value === 'moderate' || value === 'high') return { depressionRisk: value }
  return {}
}

function verifyAuth(request: NextRequest): boolean {
  const cronSecret = request.headers.get('authorization')
  if (cronSecret === `Bearer ${process.env.CRON_SECRET}`) return true
  const token = request.cookies.get('admin_session')?.value
  return !!token && verifyAdminSession(token)
}

export async function GET(request: NextRequest) {
  if (!verifyAuth(request)) {
    return NextResponse.json({ error: '未授權' }, { status: 401 })
  }

  const clientId = request.nextUrl.searchParams.get('clientId')
  if (!clientId) return NextResponse.json({ error: '缺少 clientId' }, { status: 400 })

  const supabase = createServiceSupabase()

  const { data: c, error: cErr } = await supabase
    .from('clients')
    .select('id, name, gender, goal_type, target_weight, target_date, competition_date, calories_target, protein_target, carbs_target, fat_target, carbs_training_day, carbs_rest_day, last_auto_adjust_at, macro_bounds, coach_macro_override, diet_start_date, prep_phase, client_mode, weigh_in_gap_hours, activity_profile, gene_mthfr, gene_apoe, gene_depression_risk')
    .eq('id', clientId)
    .maybeSingle()
  if (cErr || !c) return NextResponse.json({ error: '找不到學員' }, { status: 404 })

  if (c.coach_macro_override) {
    return NextResponse.json({ ok: true, decision: 'override_locked', message: '教練手動鎖定，引擎不動' })
  }

  const fourteenDaysAgo = new Date(); fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14)
  const fourteenStr = fourteenDaysAgo.toISOString().split('T')[0]
  const sevenDaysAgo = new Date(); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  const sevenDaysStr = sevenDaysAgo.toISOString().split('T')[0]

  const [bodyRes, wellnessRes, trainingRes, nutritionRes, labRes] = await Promise.all([
    supabase.from('body_composition').select('date, weight, height, body_fat').eq('client_id', c.id).order('date', { ascending: true }).limit(180),
    supabase.from('daily_wellness').select('date, energy_level, training_drive, device_recovery_score, resting_hr, hrv, wearable_sleep_score, respiratory_rate').eq('client_id', c.id).gte('date', fourteenStr),
    supabase.from('training_logs').select('date, training_type, rpe').eq('client_id', c.id).gte('date', fourteenStr),
    supabase.from('nutrition_logs').select('date, calories, carbs_grams, compliant').eq('client_id', c.id).gte('date', fourteenStr),
    supabase.from('lab_results').select('test_name, value, unit, date').eq('client_id', c.id).order('date', { ascending: false }).limit(50),
  ])

  const bodyData = bodyRes.data ?? []
  if (bodyData.length === 0) {
    return NextResponse.json({ ok: true, decision: 'no_body_data', message: '沒有體重紀錄，無法判斷' })
  }

  const trajResult = computeTrajectoryAdjustment({
    bodyDataEntries: bodyData.map((b: any) => ({ date: b.date, weight: b.weight })),
    goalType: c.goal_type as 'cut' | 'bulk' | 'recomp',
    targetWeight: c.target_weight ? Number(c.target_weight) : null,
    targetDate: c.target_date,
    currentCalories: c.calories_target ? Number(c.calories_target) : null,
    currentProtein: c.protein_target ? Number(c.protein_target) : null,
    currentFat: c.fat_target ? Number(c.fat_target) : null,
    currentCarbs: c.carbs_target ? Number(c.carbs_target) : null,
    currentCarbsTrainingDay: c.carbs_training_day ? Number(c.carbs_training_day) : null,
    currentCarbsRestDay: c.carbs_rest_day ? Number(c.carbs_rest_day) : null,
    gender: c.gender,
    bounds: (c.macro_bounds as MacroBounds | null) ?? null,
    lastAdjustAt: c.last_auto_adjust_at,
  })

  if (!trajResult.shouldAdjust) {
    return NextResponse.json({ ok: true, decision: 'no_adjust', reason: trajResult.reason, trajResult })
  }

  const latestWeight = (bodyData as any[]).filter(b => b.weight != null).slice(-1)[0]?.weight ?? null
  if (!latestWeight) return NextResponse.json({ ok: true, decision: 'no_weight', message: '抓不到最新體重' })
  const latestHeight = [...(bodyData as any[])].reverse().find(b => b.height != null)?.height ?? null
  const latestBf = [...(bodyData as any[])].reverse().find(b => b.body_fat != null)?.body_fat ?? null

  const wellness = wellnessRes.data ?? []
  const trainingLogs = trainingRes.data ?? []
  const nutrition = nutritionRes.data ?? []
  const labs = labRes.data ?? []

  const weeklyWeights: { week: number; avgWeight: number }[] = []
  for (let w = 0; w < 4; w++) {
    const we = new Date(); we.setDate(we.getDate() - w * 7)
    const ws = new Date(we); ws.setDate(we.getDate() - 6)
    const wsStr = ws.toISOString().split('T')[0]
    const weStr = we.toISOString().split('T')[0]
    const ww = (bodyData as any[]).filter(b => b.date >= wsStr && b.date <= weStr && b.weight != null).map(b => Number(b.weight))
    if (ww.length > 0) weeklyWeights.push({ week: w, avgWeight: Math.round((ww.reduce((s, x) => s + x, 0) / ww.length) * 100) / 100 })
  }

  const compliantCount = nutrition.filter((n: any) => n.compliant).length
  const nutritionCompliance = Math.round((compliantCount / 14) * 100)
  const withCal = nutrition.filter((n: any) => n.calories != null)
  const avgDailyCalories = withCal.length >= 7 ? Math.round(withCal.reduce((s: number, n: any) => s + Number(n.calories), 0) / withCal.length) : null
  const recentTraining = trainingLogs.filter((t: any) => isWeightTraining(t.training_type))
  const trainingDaysPerWeek = Math.round(recentTraining.length / 2)

  const engineInput: NutritionInput = {
    gender: c.gender || '男性',
    bodyWeight: Number(latestWeight),
    goalType: (c.goal_type || 'cut') as 'cut' | 'bulk' | 'recomp',
    dietStartDate: c.diet_start_date || null,
    height: latestHeight ? Number(latestHeight) : null,
    bodyFatPct: latestBf ? Number(latestBf) : null,
    targetWeight: c.target_weight ? Number(c.target_weight) : null,
    targetDate: c.competition_date || c.target_date || null,
    currentCalories: c.calories_target ? Number(c.calories_target) : null,
    currentProtein: c.protein_target ? Number(c.protein_target) : null,
    currentCarbs: c.carbs_target ? Number(c.carbs_target) : null,
    currentFat: c.fat_target ? Number(c.fat_target) : null,
    currentCarbsTrainingDay: c.carbs_training_day ? Number(c.carbs_training_day) : null,
    currentCarbsRestDay: c.carbs_rest_day ? Number(c.carbs_rest_day) : null,
    carbsCyclingEnabled: !!(c.carbs_training_day && c.carbs_rest_day),
    weeklyWeights,
    nutritionCompliance,
    avgDailyCalories,
    trainingDaysPerWeek,
    prepPhase: c.prep_phase || undefined,
    clientMode: (c.client_mode as any) || undefined,
    weighInGapHours: c.weigh_in_gap_hours ?? undefined,
    activityProfile: c.activity_profile || undefined,
    labResults: labs.map((l: any) => ({ test_name: String(l.test_name), value: l.value != null ? Number(l.value) : null, unit: String(l.unit ?? ''), status: 'normal' as const, date: l.date })),
    recentWellness: wellness.map((w: any) => ({
      date: w.date,
      energy_level: w.energy_level ?? null,
      training_drive: w.training_drive ?? null,
      device_recovery_score: w.device_recovery_score ?? null,
      resting_hr: w.resting_hr ?? null,
      hrv: w.hrv ?? null,
      wearable_sleep_score: w.wearable_sleep_score ?? null,
      respiratory_rate: w.respiratory_rate ?? null,
    })),
    recentTrainingLogs: trainingLogs.filter((t: any) => t.date >= sevenDaysStr).map((t: any) => ({ date: t.date, rpe: t.rpe ?? null })),
    recentCarbsPerDay: nutrition.filter((n: any) => n.date >= sevenDaysStr).map((n: any) => ({ date: n.date, carbs: n.carbs_grams ?? null })),
    geneticProfile: (c.gene_mthfr || c.gene_apoe || c.gene_depression_risk) ? {
      mthfr: c.gene_mthfr || undefined,
      apoe: c.gene_apoe || undefined,
      ...parseSerotoninField(c.gene_depression_risk),
    } : undefined,
  }

  const engineResult = generateNutritionSuggestion(engineInput)

  const cuttingBlocked = engineResult.cuttingReadinessGate?.blocked === true
  const metabolicHighStress = (engineResult.metabolicStress?.score ?? 0) >= 60
  const tdeeAnomaly = engineResult.tdeeAnomalyDetected === true
  const engineNoAutoApply = engineResult.autoApply === false
  const gated = cuttingBlocked || metabolicHighStress || tdeeAnomaly || engineNoAutoApply

  const coachLineId = process.env.ADMIN_LINE_USER_ID

  if (gated) {
    const blockReasons: string[] = []
    if (cuttingBlocked) blockReasons.push(`Cutting gate blocked (score ${engineResult.cuttingReadinessGate?.readinessScore}): ${engineResult.cuttingReadinessGate?.reasons.join('；')}`)
    if (metabolicHighStress) blockReasons.push(`Metabolic stress score ${engineResult.metabolicStress?.score} ≥ 60 — 建議 refeed/diet break`)
    if (tdeeAnomaly) blockReasons.push('TDEE 校正異常，引擎已暫停自動套用')
    if (engineNoAutoApply) blockReasons.push('Engine autoApply=false')

    const labFlags = engineResult.cuttingReadinessGate?.labFlags?.join('、') || ''
    const kcalAbs = Math.abs(trajResult.kcalAdjustment || 0)
    const headline = `🔴 ${c.name} 卡住了 (測試)`
    const lay = `軌跡需要砍 ${kcalAbs} kcal，但已撞安全層 → 引擎自動停手`
    const detail = blockReasons.map(r => `· ${r}`).join('\n')
    const alertMsg = `${headline}\n\n${lay}\n\n${labFlags ? `⚠️ 異常項目：${labFlags}\n\n` : ''}細節：\n${detail}\n\n👇 一鍵處理（按下去會真的改 DB）`

    if (coachLineId) {
      await pushMessage(coachLineId, [{
        type: 'text',
        text: alertMsg,
        quickReply: {
          items: [
            { type: 'action', action: { type: 'postback', label: '📅 延 14 天', data: `coach_action:extend_target:${c.id}`, displayText: `延 ${c.name} 目標日 +14 天` } },
            { type: 'action', action: { type: 'postback', label: '🎯 放鬆目標 1kg', data: `coach_action:ease_target:${c.id}`, displayText: `${c.name} target_weight ±1 kg` } },
            { type: 'action', action: { type: 'postback', label: '🏃 +30min cardio', data: `coach_action:add_cardio:${c.id}`, displayText: `${c.name} cardio +30 min/天` } },
            { type: 'action', action: { type: 'postback', label: '🛠 進後台處理', data: `coach_action:cancel:${c.id}`, displayText: `${c.name} 進後台手動處理` } },
          ],
        },
      } as any]).catch(() => {})
    }

    return NextResponse.json({
      ok: true, decision: 'blocked_alert_pushed',
      kcalAdjustmentNeeded: kcalAbs,
      blockReasons,
      gates: { cuttingBlocked, metabolicHighStress, tdeeAnomaly, engineNoAutoApply },
      trajResult,
    })
  }

  // safety pass → 會建 proposal（這裡不真的建，只 preview）
  const carbLine = trajResult.newMacros?.carbs_training_day != null
    ? `訓練日碳水 ${c.carbs_training_day} → ${trajResult.newMacros.carbs_training_day}g\n非訓練日 ${c.carbs_rest_day} → ${trajResult.newMacros.carbs_rest_day}g`
    : trajResult.newMacros?.carbs_target != null
      ? `碳水 ${c.carbs_target} → ${trajResult.newMacros.carbs_target}g`
      : ''
  const previewMsg = `📋 [系統會建提案] ${c.name} (測試 — 不真的建)\n\n熱量 ${c.calories_target} → ${trajResult.newMacros?.calories_target} kcal\n${carbLine}\n\n${trajResult.reason}${trajResult.hitBoundary ? `\n\n⚠️ ${trajResult.boundaryDetail}` : ''}\n\n→ 隔天 cron 才會真的建 proposal\n\n👇 hitBoundary 的「解根因」按鈕（會真的改 DB）`

  if (coachLineId) {
    // hitBoundary 才掛根因鍵；正常 proposal 走隔天 cron，這裡是 preview 不真的建，所以沒核准鍵
    const items: any[] = trajResult.hitBoundary ? [
      { type: 'action', action: { type: 'postback', label: '📅 延 14 天', data: `coach_action:extend_target:${c.id}`, displayText: `${c.name} 改延 14 天` } },
      { type: 'action', action: { type: 'postback', label: '🎯 放鬆 1kg', data: `coach_action:ease_target:${c.id}`, displayText: `${c.name} 放鬆 target ±1 kg` } },
      { type: 'action', action: { type: 'postback', label: '🏃 +30min 有氧', data: `coach_action:add_cardio:${c.id}`, displayText: `${c.name} cardio +30 min` } },
    ] : []
    await pushMessage(coachLineId, [{
      type: 'text', text: previewMsg,
      ...(items.length > 0 ? { quickReply: { items } } : {}),
    } as any]).catch(() => {})
  }

  return NextResponse.json({
    ok: true, decision: 'would_propose',
    newMacros: trajResult.newMacros,
    reason: trajResult.reason,
    hitBoundary: trajResult.hitBoundary,
    trajResult,
  })
}
