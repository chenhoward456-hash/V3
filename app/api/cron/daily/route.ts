/**
 * Daily Cron Job — 每日提醒推播
 *
 * 功能：
 * 1. 早上提醒量體重
 * 2. 晚上提醒填寫今日紀錄（僅推送還沒填的項目）
 *
 * 排程：Vercel Cron
 * - 早上提醒：每日 22:00 UTC (台灣 06:00) → type=morning
 * - 晚上提醒：每日 14:00 UTC (台灣 22:00) → type=evening
 *
 * 驗證：CRON_SECRET header 或 admin session
 */

import { NextRequest, NextResponse } from 'next/server'
import type { BodyComposition, NutritionLog, TrainingLog, DailyWellness } from '@/types'
import { createServiceSupabase } from '@/lib/supabase'
import { pushMessage, unlinkRichMenuFromUser } from '@/lib/line'
import { sendRoutineReminder } from '@/lib/notify'
import { sendPushNotification } from '@/lib/web-push'
import { buildPeakMorningReminder, buildPeakEveningReminder } from '@/lib/peak-week-reminders'
import { verifyAdminSession } from '@/lib/auth-middleware'
import { generateSmartAlerts, type InsightData, type ClientProfile } from '@/lib/ai-insights'
import { createLogger } from '@/lib/logger'
import { daysUntilDateTW, DAY_MS } from '@/lib/date-utils'
import {
  sendDay3Email,
  sendDay7Email,
  sendDay14Email,
  sendExpiryWarningEmail,
  sendWinBackEmail,
  sendLineBindReminderEmail,
} from '@/lib/email'
import { getDefaultFeatures } from '@/lib/tier-defaults'
import { generateBehaviorInsights, type InsightInput } from '@/lib/insight-engine'
import { startCronRun, completeCronRun, failCronRun } from '@/lib/cron-utils'
import { computeTrajectoryAdjustment, type MacroBounds } from '@/lib/trajectory-adjust'
import { calculateLabStatus } from '@/utils/labStatus'
import { generateNutritionSuggestion, type NutritionInput } from '@/lib/nutrition-engine'
import { isWeightTraining } from '@/components/client/types'

function parseSerotoninField(value: string | null): { serotonin?: 'LL' | 'SL' | 'SS'; depressionRisk?: 'low' | 'moderate' | 'high' } {
  if (!value) return {}
  if (value === 'LL' || value === 'SL' || value === 'SS') return { serotonin: value }
  if (value === 'low' || value === 'moderate' || value === 'high') return { depressionRisk: value }
  return {}
}

export const maxDuration = 300

const logger = createLogger('cron-daily')

function verifyCronAuth(request: NextRequest): boolean {
  const cronSecret = request.headers.get('authorization')
  if (cronSecret === `Bearer ${process.env.CRON_SECRET}`) return true

  const token = request.cookies.get('admin_session')?.value
  return !!token && verifyAdminSession(token)
}

/** 僅 Web Push，不 fallback LINE（用於低優先度日常提醒如量體重） */
async function sendWebPushOnly(
  clientId: string,
  message: { title: string; body: string; url?: string }
): Promise<boolean> {
  const supabase = createServiceSupabase()
  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('client_id', clientId)

  if (!subs || subs.length === 0) return false

  for (const sub of subs) {
    const ok = await sendPushNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      message
    )
    if (ok) return true
  }
  return false
}

function getTaiwanDate(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' })
}

function getTaiwanHour(): number {
  return parseInt(new Date().toLocaleString('en-US', { timeZone: 'Asia/Taipei', hour: 'numeric', hour12: false }))
}

/** 教練自訂 peak week 課表的一天（clients.coach_peak_week_plan.days[]） */
type PeakPlanDayRow = {
  date: string
  label?: string
  carbs?: number
  trainingNote?: string
  coachNote?: string
}

/** 兩個日期字串之間差幾天（用 UTC+8 錨定，避免主機時區把日期推移一天） */
function daysBetweenTW(fromDateStr: string, toDateStr: string): number {
  const from = new Date(`${fromDateStr}T00:00:00+08:00`).getTime()
  const to = new Date(`${toDateStr}T00:00:00+08:00`).getTime()
  if (Number.isNaN(from) || Number.isNaN(to)) return NaN
  return Math.round((to - from) / 86400000)
}

/** 與引擎的 phase 分段一致：7-4 低碳/IMT、3-2 充碳、1 taper、0 賽日 */
function inferPhaseFromDaysOut(daysOut: number): 'depletion' | 'fat_load' | 'carb_load' | 'taper' | 'show_day' {
  if (daysOut === 0) return 'show_day'
  if (daysOut === 1) return 'taper'
  if (daysOut <= 3) return 'carb_load'
  if (daysOut <= 5) return 'fat_load'
  return 'depletion'
}

export async function GET(request: NextRequest) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: '未授權' }, { status: 401 })
  }

  const supabase = createServiceSupabase()
  const hour = getTaiwanHour()
  const today = getTaiwanDate()
  const isMorningRun = hour >= 5 && hour < 12
  const cronJobType = isMorningRun ? 'daily_morning' as const : 'daily_evening' as const

  // Cron runs 冪等性檢查
  const { runId, alreadyRan } = await startCronRun(cronJobType, today)
  if (alreadyRan) {
    return NextResponse.json({ success: true, skipped: true, reason: '今日已執行過' })
  }

  // 由出生年重算年齡（有填 birth_year 者）→ age 隨年份自動更新，教練不必回後台改
  try {
    const nowYear = Number(today.slice(0, 4)) // 用台灣日期年份，避免 UTC 跨年邊界少算一歲
    const { data: birthClients } = await supabase
      .from('clients')
      .select('id, age, birth_year')
      .not('birth_year', 'is', null)
    for (const c of (birthClients ?? []) as Array<{ id: string; age: number | null; birth_year: number }>) {
      const computed = nowYear - c.birth_year
      if (computed >= 0 && computed <= 150 && computed !== c.age) {
        await supabase.from('clients').update({ age: computed }).eq('id', c.id)
      }
    }
  } catch (e) {
    console.warn('[cron/daily] 年齡重算失敗:', e)
  }

  // Clean up expired coach overrides
  try {
    const { data: overrideClients } = await supabase
      .from('clients')
      .select('id, name, coach_macro_override')
      .not('coach_macro_override', 'is', null)

    if (overrideClients?.length) {
      const now = new Date()
      for (const c of overrideClients) {
        const override = c.coach_macro_override as any
        if (override?.expires_at && new Date(override.expires_at) <= now) {
          await supabase.from('clients').update({ coach_macro_override: null }).eq('id', c.id)
          console.log(`[Cron] Coach override expired for ${c.name}, cleared.`)
        }
      }
    }
  } catch (e) {
    console.warn('[Cron] Coach override cleanup error:', e)
  }

  // ===== 軌跡式 macros 自動調整（每天執行，所有 tier） =====
  // 架構：軌跡數學算缺口 → nutrition-engine 安全層 gate → 通過才套用
  // 安全層包含：checkCuttingReadiness（賀爾蒙、TSH、cortisol、SHBG cross-pattern）、
  //           metabolicStress score、energyAvailability、tdeeAnomalyDetected
  let autoAdjustResults = {
    evaluated: 0, applied: 0, boundaryHit: 0,
    gatedByCuttingReadiness: 0, gatedByMetabolicStress: 0, gatedByTdeeAnomaly: 0, gatedByEngineAutoApply: 0,
    errors: [] as string[],
  }
  try {
    const { data: eligibleClients } = await supabase
      .from('clients')
      .select(`
        id, name, line_user_id, gender, subscription_tier, client_mode, prep_phase,
        goal_type, target_weight, target_date, competition_date, diet_start_date,
        calories_target, protein_target, carbs_target, fat_target,
        carbs_training_day, carbs_rest_day, activity_profile, weigh_in_gap_hours,
        gene_mthfr, gene_apoe, gene_depression_risk,
        macro_bounds, auto_adjust_enabled, last_auto_adjust_at,
        coach_macro_override, nutrition_enabled
      `)
      .eq('is_active', true)
      .eq('auto_adjust_enabled', true)
      .eq('nutrition_enabled', true)
      .not('goal_type', 'is', null)
      .not('target_weight', 'is', null)
      .not('target_date', 'is', null)
      .not('calories_target', 'is', null)

    const fourteenDaysAgo = new Date(); fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14)
    const fourteenStr = fourteenDaysAgo.toISOString().split('T')[0]
    const sevenDaysAgo = new Date(); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const sevenDaysStr = sevenDaysAgo.toISOString().split('T')[0]

    for (const c of (eligibleClients ?? [])) {
      autoAdjustResults.evaluated++
      try {
        // 教練手動鎖定的完全不動
        if (c.coach_macro_override) continue

        // 一次抓齊安全層需要的所有資料
        const [bodyRes, wellnessRes, trainingRes, nutritionRes, labRes] = await Promise.all([
          supabase.from('body_composition').select('date, weight, height, body_fat').eq('client_id', c.id).order('date', { ascending: true }).limit(180),
          supabase.from('daily_wellness').select('date, energy_level, training_drive, device_recovery_score, resting_hr, hrv, wearable_sleep_score, respiratory_rate').eq('client_id', c.id).gte('date', fourteenStr),
          supabase.from('training_logs').select('date, training_type, rpe').eq('client_id', c.id).gte('date', fourteenStr),
          supabase.from('nutrition_logs').select('date, calories, carbs_grams, compliant').eq('client_id', c.id).gte('date', fourteenStr),
          supabase.from('lab_results').select('test_name, value, unit, date').eq('client_id', c.id).order('date', { ascending: false }).limit(50),
        ])

        const bodyData = bodyRes.data ?? []
        if (bodyData.length === 0) continue

        const latestBf = [...(bodyData as any[])].reverse().find(b => b.body_fat != null)?.body_fat ?? null

        // 1. 軌跡數學
        const trajResult = computeTrajectoryAdjustment({
          bodyDataEntries: bodyData.map((b: any) => ({ date: b.date, weight: b.weight })),
          goalType: c.goal_type as 'cut' | 'bulk' | 'recomp',
          targetWeight: c.target_weight ? Number(c.target_weight) : null,
          targetDate: c.competition_date || c.target_date,
          currentCalories: c.calories_target ? Number(c.calories_target) : null,
          currentProtein: c.protein_target ? Number(c.protein_target) : null,
          currentFat: c.fat_target ? Number(c.fat_target) : null,
          currentCarbs: c.carbs_target ? Number(c.carbs_target) : null,
          currentCarbsTrainingDay: c.carbs_training_day ? Number(c.carbs_training_day) : null,
          currentCarbsRestDay: c.carbs_rest_day ? Number(c.carbs_rest_day) : null,
          gender: c.gender,
          bounds: (c.macro_bounds as MacroBounds | null) ?? null,
          lastAdjustAt: c.last_auto_adjust_at,
          bodyFatPct: latestBf != null ? Number(latestBf) : null,
          geneticProfile: (c.gene_mthfr || c.gene_apoe || c.gene_depression_risk) ? {
            mthfr: c.gene_mthfr || undefined,
            apoe: c.gene_apoe || undefined,
            ...parseSerotoninField(c.gene_depression_risk),
          } : undefined,
        })

        if (!trajResult.shouldAdjust) continue

        // 2. 跑 nutrition-engine 拿安全層判定
        const latestWeight = (bodyData as any[]).filter(b => b.weight != null).slice(-1)[0]?.weight ?? null
        if (!latestWeight) continue
        const latestHeight = [...(bodyData as any[])].reverse().find(b => b.height != null)?.height ?? null

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
          // #3: 算真實 status（原本硬寫 normal → lab→macro 安全修正全失效）。性別取中文。
          labResults: labs.map((l: any) => {
            const v = l.value != null ? Number(l.value) : null
            const g = c.gender === '女性' ? '女性' : c.gender === '男性' ? '男性' : undefined
            const status = (v != null && Number.isFinite(v)) ? calculateLabStatus(String(l.test_name), v, g) : 'normal'
            return { test_name: String(l.test_name), value: v, unit: String(l.unit ?? ''), status, date: l.date }
          }),
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

        // 3. 安全層 gate — 任何一層 block 都不套用
        const cuttingBlocked = engineResult.cuttingReadinessGate?.blocked === true
        const metabolicHighStress = (engineResult.metabolicStress?.score ?? 0) >= 60
        const tdeeAnomaly = engineResult.tdeeAnomalyDetected === true
        const engineNoAutoApply = engineResult.autoApply === false
        // Peak/比賽/秤重/反彈期：體重劇烈波動（肝醣/水分），軌跡數學會算出離譜建議並破壞超補/秤重協議 → 一律不自動調整
        const phaseLocked = ['peak_week', 'competition', 'weigh_in', 'rebound'].includes(c.prep_phase || '')
        // #8: 恢復狀態 critical 或過度訓練高風險時，不自動加深赤字（與 recovery 引擎「該休息+refeed」相反指令會打架）
        const recoveryCritical = engineResult.recoveryAssessment?.state === 'critical'
          || engineResult.recoveryAssessment?.overtrainingRisk?.riskLevel === 'high'
          || engineResult.recoveryAssessment?.overtrainingRisk?.riskLevel === 'very_high'

        const gates = {
          cuttingBlocked, metabolicHighStress, tdeeAnomaly, engineNoAutoApply, phaseLocked, recoveryCritical,
        }

        if (cuttingBlocked || metabolicHighStress || tdeeAnomaly || engineNoAutoApply || phaseLocked || recoveryCritical) {
          if (cuttingBlocked) autoAdjustResults.gatedByCuttingReadiness++
          if (metabolicHighStress) autoAdjustResults.gatedByMetabolicStress++
          if (tdeeAnomaly) autoAdjustResults.gatedByTdeeAnomaly++
          if (engineNoAutoApply) autoAdjustResults.gatedByEngineAutoApply++

          // 寫 audit log（安全層擋住的決策也要留紀錄）
          const blockReasons: string[] = []
          if (cuttingBlocked) blockReasons.push(`Cutting gate blocked (score ${engineResult.cuttingReadinessGate?.readinessScore}): ${engineResult.cuttingReadinessGate?.reasons.join('；')}`)
          if (metabolicHighStress) blockReasons.push(`Metabolic stress score ${engineResult.metabolicStress?.score} ≥ 60 — 建議 refeed/diet break`)
          if (tdeeAnomaly) blockReasons.push('TDEE 校正異常，引擎已暫停自動套用')
          if (engineNoAutoApply) blockReasons.push('Engine autoApply=false')
          if (phaseLocked) blockReasons.push(`${c.prep_phase} 期 — 不自動調整（保護超補/秤重協議）`)
          if (recoveryCritical) blockReasons.push('恢復 critical / 過度訓練高風險 — 不自動加深赤字（建議休息+refeed）')

          await supabase.from('macro_adjustment_log').insert({
            client_id: c.id,
            applied_by: 'system',
            trigger_source: 'trajectory',
            old_macros: {
              calories_target: c.calories_target ? Number(c.calories_target) : null,
              carbs_target: c.carbs_target ? Number(c.carbs_target) : null,
              carbs_training_day: c.carbs_training_day ? Number(c.carbs_training_day) : null,
              carbs_rest_day: c.carbs_rest_day ? Number(c.carbs_rest_day) : null,
            },
            new_macros: { _blocked: true, would_have_been: trajResult.newMacros },
            reason: `軌跡建議調整但被安全層 gate：${blockReasons.join('｜')}`,
            trajectory_data: { ...trajResult.trajectoryData, gates },
            hit_boundary: false,
            boundary_detail: null,
          })

          // 教練 LINE alert（注意：學員不收 push，避免恐慌；只有教練收）
          // 教練 line_user_id 從 ADMIN_LINE_USER_ID 環境變數抓
          const coachLineId = process.env.ADMIN_LINE_USER_ID
          if (coachLineId) {
            const labFlags = engineResult.cuttingReadinessGate?.labFlags?.join('、') || ''
            // 主訊息：人話為主，技術細節摺到下方
            const kcalAbs = Math.abs(trajResult.kcalAdjustment || 0)
            const headline = `🔴 ${c.name} 卡住了`
            const lay = `軌跡需要砍 ${kcalAbs} kcal，但已撞安全層 → 引擎自動停手`
            const detail = blockReasons.map(r => `· ${r}`).join('\n')
            const alertMsg = `${headline}\n\n${lay}\n\n${labFlags ? `⚠️ 異常項目：${labFlags}\n\n` : ''}細節：\n${detail}\n\n👇 一鍵處理`

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

          continue
        }

        // 4. 所有 gate 都通過 → 套用軌跡建議
        const oldMacros = {
          calories_target: c.calories_target ? Number(c.calories_target) : null,
          protein_target: c.protein_target ? Number(c.protein_target) : null,
          carbs_target: c.carbs_target ? Number(c.carbs_target) : null,
          fat_target: c.fat_target ? Number(c.fat_target) : null,
          carbs_training_day: c.carbs_training_day ? Number(c.carbs_training_day) : null,
          carbs_rest_day: c.carbs_rest_day ? Number(c.carbs_rest_day) : null,
        }

        const now = new Date().toISOString()
        const tier = c.subscription_tier

        // 全自動白名單：AUTO_APPLY_CLIENT_IDS 內的帳號（教練自己的驗證帳號）即使是 coached 也直接套用，
        // 用來端到端驗證自動化；其他付費學員維持「提案 → 教練核准」保護。
        const autoApplyIds = (process.env.AUTO_APPLY_CLIENT_IDS || '').split(',').map(s => s.trim()).filter(Boolean)
        const forceAutoApply = autoApplyIds.includes(c.id)

        // Tier 分流：coached/protocol 走 propose 流程、self_managed（與白名單）走 auto-apply
        if ((tier === 'coached' || tier === 'protocol') && !forceAutoApply) {
          // 寫 pending_proposals 等教練審核
          // 先檢查 24h 內是否有未審 proposal，避免重複
          const { data: existing } = await supabase
            .from('pending_proposals')
            .select('id')
            .eq('client_id', c.id)
            .eq('status', 'pending')
            .gte('proposed_at', new Date(Date.now() - 24 * 3600 * 1000).toISOString())
            .limit(1)
            .maybeSingle()
          if (existing) continue

          const { data: proposal } = await supabase
            .from('pending_proposals')
            .insert({
              client_id: c.id,
              proposed_by: 'system_trajectory',
              proposal_type: 'macro_adjustment',
              current_state: oldMacros,
              proposed_changes: trajResult.newMacros,
              reasoning: `[Cron 自動偵測]\n${trajResult.reason}\n\n${trajResult.boundaryDetail ?? ''}`,
              trajectory_data: { ...trajResult.trajectoryData, gatesChecked: true, engineReadinessScore: engineResult.cuttingReadinessGate?.readinessScore ?? null, metabolicStressScore: engineResult.metabolicStress?.score ?? null, tier },
              safety_check_result: { passed: true, violations: [], warnings: [] },
            })
            .select()
            .single()

          autoAdjustResults.applied++ // 統計記成 proposed
          if (trajResult.hitBoundary) autoAdjustResults.boundaryHit++

          // LINE push 教練（不是學員）
          const coachLineId = process.env.ADMIN_LINE_USER_ID
          if (coachLineId && proposal) {
            const carbLine = trajResult.newMacros?.carbs_training_day != null
              ? `訓練日碳水 ${oldMacros.carbs_training_day} → ${trajResult.newMacros.carbs_training_day}g\n非訓練日 ${oldMacros.carbs_rest_day} → ${trajResult.newMacros.carbs_rest_day}g`
              : trajResult.newMacros?.carbs_target != null
                ? `碳水 ${oldMacros.carbs_target} → ${trajResult.newMacros.carbs_target}g`
                : ''
            const msg = `📋 [系統提案] ${c.name}\n\n熱量 ${oldMacros.calories_target} → ${trajResult.newMacros?.calories_target} kcal\n${carbLine}\n\n${trajResult.reason}${trajResult.hitBoundary ? `\n\n⚠️ ${trajResult.boundaryDetail}` : ''}\n\nID: ${proposal.id.slice(0, 8)}`

            // 3 顆審核鍵 (一律)；hitBoundary=true 再加 3 顆「解根因」鍵
            const items: any[] = [
              { type: 'action', action: { type: 'postback', label: '✓ 核准套用', data: `agent_proposal:approve:${proposal.id}`, displayText: `核准 ${proposal.id.slice(0, 8)}` } },
              { type: 'action', action: { type: 'postback', label: '✗ 拒絕', data: `agent_proposal:reject:${proposal.id}`, displayText: `拒絕 ${proposal.id.slice(0, 8)}` } },
              { type: 'action', action: { type: 'postback', label: '💬 再聊', data: `agent_proposal:discuss:${proposal.id}`, displayText: `再聊 ${proposal.id.slice(0, 8)}` } },
            ]
            if (trajResult.hitBoundary) {
              items.push(
                { type: 'action', action: { type: 'postback', label: '📅 延 14 天', data: `coach_action:extend_target:${c.id}`, displayText: `${c.name} 改延 14 天` } },
                { type: 'action', action: { type: 'postback', label: '🎯 放鬆 1kg', data: `coach_action:ease_target:${c.id}`, displayText: `${c.name} 放鬆 target ±1 kg` } },
                { type: 'action', action: { type: 'postback', label: '🏃 +30min 有氧', data: `coach_action:add_cardio:${c.id}`, displayText: `${c.name} cardio +30 min` } },
              )
            }
            await pushMessage(coachLineId, [{
              type: 'text', text: msg,
              quickReply: { items },
            } as any]).catch(() => {})
          }
          continue // 不執行下方的 auto-apply
        }

        // self_managed：原本邏輯，直接套用
        const { error: updErr } = await supabase
          .from('clients')
          .update({ ...trajResult.newMacros, last_auto_adjust_at: now })
          .eq('id', c.id)
        if (updErr) throw updErr

        await supabase.from('macro_adjustment_log').insert({
          client_id: c.id,
          applied_by: 'system',
          trigger_source: 'trajectory',
          old_macros: oldMacros,
          new_macros: trajResult.newMacros,
          reason: trajResult.reason,
          trajectory_data: { ...trajResult.trajectoryData, gatesChecked: true, engineReadinessScore: engineResult.cuttingReadinessGate?.readinessScore ?? null, metabolicStressScore: engineResult.metabolicStress?.score ?? null },
          hit_boundary: trajResult.hitBoundary,
          boundary_detail: trajResult.boundaryDetail,
        })

        autoAdjustResults.applied++
        if (trajResult.hitBoundary) autoAdjustResults.boundaryHit++

        if (c.line_user_id) {
          const carbLine = trajResult.newMacros?.carbs_training_day != null
            ? `訓練日碳水 ${oldMacros.carbs_training_day} → ${trajResult.newMacros.carbs_training_day}g\n非訓練日 ${oldMacros.carbs_rest_day} → ${trajResult.newMacros.carbs_rest_day}g`
            : trajResult.newMacros?.carbs_target != null
              ? `碳水 ${oldMacros.carbs_target} → ${trajResult.newMacros.carbs_target}g`
              : ''
          const msg = trajResult.hitBoundary
            ? `⚠️ 系統依進度自動調整 macros\n\n熱量 ${oldMacros.calories_target} → ${trajResult.newMacros?.calories_target} kcal\n${carbLine}\n\n${trajResult.reason}\n\n${trajResult.boundaryDetail}\n\n→ LINE 諮詢教練決定下一步`
            : `🤖 系統依進度調整今日 macros\n\n熱量 ${oldMacros.calories_target} → ${trajResult.newMacros?.calories_target} kcal\n${carbLine}\n\n${trajResult.reason}`
          await pushMessage(c.line_user_id, [{ type: 'text', text: msg }]).catch(() => {})
        }
      } catch (e) {
        autoAdjustResults.errors.push(`${c.name}: ${(e as Error).message}`)
      }
    }
    logger.info(`Auto-adjust: ${autoAdjustResults.applied}/${autoAdjustResults.evaluated} applied, ${autoAdjustResults.boundaryHit} boundary, gated by [cutting:${autoAdjustResults.gatedByCuttingReadiness} stress:${autoAdjustResults.gatedByMetabolicStress} tdee:${autoAdjustResults.gatedByTdeeAnomaly} engine:${autoAdjustResults.gatedByEngineAutoApply}]`)
  } catch (e) {
    console.warn('[Cron] Auto-adjust block error:', e)
  }

  // ===== Wellness 漂移 → 觸發 retest 提醒（每週日早上跑一次） =====
  // 不按時間表強制驗血（學員花費考量），而是當 wellness 訊號惡化 4 週時提醒
  // 條件：近 2 週平均 vs 前 2 週平均，至少 2 個指標下降 >25%
  //       AND 距上次荷爾蒙血檢 ≥ 12 週
  // 24 小時 dedupe：同一學員 7 天內只 push 一次
  let retestReminderCount = 0
  const dayOfWeek = new Date().getDay() // 0 = Sunday
  if (isMorningRun && dayOfWeek === 0) {
    try {
      const { data: wellnessClients } = await supabase
        .from('clients')
        .select('id, name, line_user_id, gender')
        .eq('is_active', true)
        .eq('wellness_enabled', true)
        .not('line_user_id', 'is', null)

      const twentyEightDaysAgo = new Date(); twentyEightDaysAgo.setDate(twentyEightDaysAgo.getDate() - 28)
      const twentyEightStr = twentyEightDaysAgo.toISOString().split('T')[0]
      const fourteenDaysAgo2 = new Date(); fourteenDaysAgo2.setDate(fourteenDaysAgo2.getDate() - 14)
      const fourteenStr2 = fourteenDaysAgo2.toISOString().split('T')[0]
      const twelveWeeksAgo = new Date(); twelveWeeksAgo.setDate(twelveWeeksAgo.getDate() - 12 * 7)
      const twelveWeeksStr = twelveWeeksAgo.toISOString().split('T')[0]

      for (const c of (wellnessClients ?? [])) {
        try {
          // 抓近 28 天 wellness
          const { data: wellnessData } = await supabase
            .from('daily_wellness')
            .select('date, energy_level, training_drive, sleep_quality, mood')
            .eq('client_id', c.id)
            .gte('date', twentyEightStr)
            .order('date', { ascending: true })

          const all = wellnessData ?? []
          const recent = all.filter((w: any) => w.date >= fourteenStr2)
          const previous = all.filter((w: any) => w.date < fourteenStr2)
          if (recent.length < 7 || previous.length < 7) continue

          const avg = (arr: any[], field: string) => {
            const vals = arr.map(x => x[field]).filter((v: any) => v != null) as number[]
            return vals.length > 0 ? vals.reduce((s, v) => s + v, 0) / vals.length : null
          }

          type Drop = { metric: string; prev: number; recent: number; dropPct: number }
          const drops: Drop[] = []
          for (const metric of ['energy_level', 'training_drive', 'sleep_quality', 'mood']) {
            const prev = avg(previous, metric)
            const cur = avg(recent, metric)
            if (prev == null || cur == null || prev < 2) continue
            const dropPct = (prev - cur) / prev
            if (dropPct > 0.25) drops.push({ metric, prev, recent: cur, dropPct })
          }
          if (drops.length < 2) continue

          // 檢查上次荷爾蒙血檢
          const { data: lastHormoneLab } = await supabase
            .from('lab_results')
            .select('test_name, date')
            .eq('client_id', c.id)
            .or('test_name.ilike.%testosterone%,test_name.ilike.%睪固酮%,test_name.ilike.%cortisol%,test_name.ilike.%皮質%,test_name.ilike.%TSH%,test_name.ilike.%甲狀腺%,test_name.ilike.%SHBG%,test_name.ilike.%estradiol%,test_name.ilike.%雌二醇%')
            .order('date', { ascending: false })
            .limit(1)

          const latestLabDate = lastHormoneLab?.[0]?.date
          if (latestLabDate && latestLabDate >= twelveWeeksStr) continue // 還在 12 週內

          // 24h dedupe：用 macro_adjustment_log 簡易檢查（避免新表）
          const { data: recentRetest } = await supabase
            .from('macro_adjustment_log')
            .select('id, applied_at')
            .eq('client_id', c.id)
            .eq('trigger_source', 'tdee_weekly')
            .gte('applied_at', new Date(Date.now() - 7 * 86_400_000).toISOString())
            .limit(1)
          if (recentRetest && recentRetest.length > 0) continue

          // 推 LINE
          const labelMap: Record<string, string> = { energy_level: '精力', training_drive: '訓練動力', sleep_quality: '睡眠品質', mood: '心情' }
          const dropLines = drops.map(d => `・${labelMap[d.metric] || d.metric}：${d.prev.toFixed(1)} → ${d.recent.toFixed(1)} (-${Math.round(d.dropPct * 100)}%)`).join('\n')
          const labContext = latestLabDate
            ? `上次荷爾蒙驗血 ${Math.floor((Date.now() - new Date(latestLabDate).getTime()) / (7 * 86_400_000))} 週前`
            : '尚無荷爾蒙血檢紀錄'

          const msg = `🩸 建議安排一次血檢\n\n你近 4 週身體訊號明顯下滑：\n${dropLines}\n\n${labContext}。可能原因：\n・荷爾蒙（睪固酮、甲狀腺）\n・恢復不足（皮質醇、發炎）\n・營養缺乏（鐵、維他命 D、B 群）\n\n驗一次荷爾蒙 + 代謝面板就能定位。`

          // Web Push 優先（省 LINE 額度），無訂閱才 fallback LINE
          await sendRoutineReminder(c.id, c.line_user_id, {
            title: '🩸 建議安排一次血檢',
            body: '近 4 週身體訊號明顯下滑，驗一次荷爾蒙＋代謝面板就能定位',
            lineText: msg,
            url: '/dashboard',
          }).catch(() => {})

          // 寫 log 做 dedupe 標記（用既有表，trigger_source 'tdee_weekly' 暫借）
          await supabase.from('macro_adjustment_log').insert({
            client_id: c.id,
            applied_by: 'system',
            trigger_source: 'tdee_weekly',
            old_macros: {},
            new_macros: { _retest_reminder: true },
            reason: `Wellness 漂移觸發 retest 提醒：${drops.map(d => `${labelMap[d.metric]} -${Math.round(d.dropPct * 100)}%`).join('、')}`,
          })

          retestReminderCount++
        } catch (e) {
          console.warn(`[Cron] Wellness retest check failed for ${c.name}:`, e)
        }
      }
      logger.info(`Retest reminders pushed: ${retestReminderCount}`)
    } catch (e) {
      console.warn('[Cron] Wellness retest block error:', e)
    }
  }

  // 取得所有已綁定 LINE 的活躍學員
  const { data: clients, error } = await supabase
    .from('clients')
    .select('id, name, unique_code, line_user_id, subscription_tier, body_composition_enabled, nutrition_enabled, training_enabled, wellness_enabled, client_mode, competition_date, coach_peak_week_plan')
    .eq('is_active', true)
    .not('line_user_id', 'is', null)

  if (error || !clients) {
    return NextResponse.json({ error: '無法取得學員', detail: error?.message }, { status: 500 })
  }

  let sent = 0
  let webPushUsed = 0
  let linePushUsed = 0
  const errors: string[] = []

  // 判斷早上或晚上
  const isMorning = isMorningRun
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://howard456.vercel.app'

  // ── Peak Week 每日提醒（備賽最後 7 天，含比賽當天）──
  // Helms Ch.7：「你在賽前一晚看起來如何，決定了 80% 的碳水判斷。」
  // 而視覺評估有紀律要求（固定燈光/時間/餐數、跟基準照並排比）——沒人提醒就會忘，
  // 忘了，peak week 最重要的那個決策就只能用猜的。
  try {
    const peakTargets = (clients as Array<{
      id: string; name: string; unique_code?: string; client_mode?: string | null
      competition_date?: string | null
      coach_peak_week_plan?: { days?: PeakPlanDayRow[] } | null
    }>).filter(c => {
      if (!c.competition_date || c.client_mode === 'athletic') return false
      const dl = daysBetweenTW(today, c.competition_date)
      return dl >= 0 && dl <= 7
    })

    for (const client of peakTargets) {
      const daysOut = daysBetweenTW(today, client.competition_date!)
      const coachDay = (client.coach_peak_week_plan?.days ?? []).find(d => d.date === today)
      const day = {
        daysOut,
        label: coachDay?.label,
        phase: inferPhaseFromDaysOut(daysOut),
        carbs: coachDay?.carbs,
        trainingNote: coachDay?.trainingNote,
        coachNote: coachDay?.coachNote,
      }

      const reminder = isMorning ? buildPeakMorningReminder(day) : buildPeakEveningReminder(day)
      if (!reminder) continue

      const ok = await sendWebPushOnly(client.id, {
        ...reminder,
        url: client.unique_code ? `${siteUrl}/c/${client.unique_code}` : `${siteUrl}/dashboard`,
      })
      if (ok) { sent++; webPushUsed++ }
    }
  } catch (e) {
    errors.push(`peak_week_reminder: ${(e as Error)?.message ?? 'unknown'}`)
  }

  if (isMorning) {
    // ── 早上提醒：量體重（僅 Web Push，不消耗 LINE 額度）──
    const { data: todayWeights } = await supabase
      .from('body_composition')
      .select('client_id')
      .eq('date', today)

    const hasWeight = new Set((todayWeights || []).map((w: { client_id: string }) => w.client_id))
    const morningTargets = clients.filter(c => c.body_composition_enabled && !hasWeight.has(c.id))

    // 批次發送（每批 5 個，僅 Web Push）
    for (let i = 0; i < morningTargets.length; i += 5) {
      const batch = morningTargets.slice(i, i + 5)
      const results = await Promise.allSettled(
        batch.map(client =>
          sendWebPushOnly(client.id, {
            title: `☀️ 早安 ${client.name}！`,
            body: '別忘了量體重喔',
            url: `${siteUrl}/dashboard`,
          })
        )
      )
      results.forEach((result, idx) => {
        if (result.status === 'fulfilled' && result.value) {
          sent++
          webPushUsed++
        } else if (result.status === 'rejected') {
          errors.push(`${batch[idx].name}: ${result.reason?.message || 'unknown'}`)
        }
      })
    }

    // ── 學員端二次追加提醒（第一次晚上提醒後仍沒填 → 隔天早上補推一次）──
    //    只針對 coached/protocol tier（教練實際在盯的學員，如 Eddie/William/陳胤豪），不吵自助/免費用戶。
    //    體重不列入：昨天的空腹體重無法補量，已由上面的「量體重」晨間提醒涵蓋；這裡只追可補填的 飲食/訓練/感受。
    try {
      const fuYday = new Date(); fuYday.setDate(fuYday.getDate() - 1)
      const fuYdayStr = fuYday.toISOString().split('T')[0]
      const [fuNutRes, fuTrainRes, fuWellRes] = await Promise.all([
        supabase.from('nutrition_logs').select('client_id').eq('date', fuYdayStr),
        supabase.from('training_logs').select('client_id').eq('date', fuYdayStr),
        supabase.from('daily_wellness').select('client_id').eq('date', fuYdayStr),
      ])
      const fuHadNut = new Set((fuNutRes.data || []).map((r: { client_id: string }) => r.client_id))
      const fuHadTrain = new Set((fuTrainRes.data || []).map((r: { client_id: string }) => r.client_id))
      const fuHadWell = new Set((fuWellRes.data || []).map((r: { client_id: string }) => r.client_id))
      const followups: { client: typeof clients[0]; missed: string[] }[] = []
      for (const c of clients) {
        if (c.subscription_tier !== 'coached' && c.subscription_tier !== 'protocol') continue
        const missed: string[] = []
        if (c.nutrition_enabled && !fuHadNut.has(c.id)) missed.push('飲食')
        if (c.training_enabled && !fuHadTrain.has(c.id)) missed.push('訓練')
        if (c.wellness_enabled && !fuHadWell.has(c.id)) missed.push('感受')
        if (missed.length > 0) followups.push({ client: c, missed })
      }
      for (let i = 0; i < followups.length; i += 5) {
        const batch = followups.slice(i, i + 5)
        const results = await Promise.allSettled(batch.map(({ client, missed }) =>
          sendWebPushOnly(client.id, {
            title: `📋 ${client.name}，昨天的紀錄還沒補`,
            body: `昨天的${missed.join('、')}還沒填，順手補一下、進度才追得準 💪`,
            url: `${siteUrl}/dashboard`,
          })
        ))
        results.forEach((r, idx) => {
          if (r.status === 'fulfilled' && r.value) { sent++; webPushUsed++ }
          else if (r.status === 'rejected') errors.push(`followup ${batch[idx].client.name}: ${(r.reason as { message?: string })?.message || 'unknown'}`)
        })
      }
    } catch (e) {
      errors.push(`followup: ${e instanceof Error ? e.message : String(e)}`)
    }

    // ── 教練晨間摘要：推送昨日學員狀態到教練 LINE ──
    const coachLineId = process.env.COACH_LINE_USER_ID
    if (coachLineId) {
      try {
        const yesterday = new Date()
        yesterday.setDate(yesterday.getDate() - 1)
        const yesterdayStr = yesterday.toISOString().split('T')[0]

        // Query yesterday's data
        const [yWeightRes, yNutritionRes, yTrainingRes, yWellnessRes] = await Promise.all([
          supabase.from('body_composition').select('client_id, weight').eq('date', yesterdayStr),
          supabase.from('nutrition_logs').select('client_id').eq('date', yesterdayStr),
          supabase.from('training_logs').select('client_id, rpe').eq('date', yesterdayStr),
          supabase.from('daily_wellness').select('client_id, energy_level').eq('date', yesterdayStr),
        ])

        const hadWeight = new Set((yWeightRes.data || []).map((w: { client_id: string }) => w.client_id))
        const hadNutrition = new Set((yNutritionRes.data || []).map((n: { client_id: string }) => n.client_id))
        const hadTraining = new Set((yTrainingRes.data || []).map((t: { client_id: string }) => t.client_id))
        const hadWellness = new Set((yWellnessRes.data || []).map((w: { client_id: string }) => w.client_id))

        // 教練晨報看的是「所有活躍學員」，不是上面那份「有綁 LINE 才收得到提醒」的名單——
        // 否則沒綁 LINE 的學員（例：Eddie）等於從教練視野裡整個消失。
        const { data: digestClients } = await supabase
          .from('clients')
          .select('id, name, body_composition_enabled, nutrition_enabled, training_enabled, wellness_enabled')
          .eq('is_active', true)
        const coachViewClients = digestClients ?? clients

        const digestLines: string[] = []

        // 1. Clients who missed records yesterday
        const missedClients = coachViewClients.filter(c => {
          const missed: string[] = []
          if (c.body_composition_enabled && !hadWeight.has(c.id)) missed.push('體重')
          if (c.nutrition_enabled && !hadNutrition.has(c.id)) missed.push('飲食')
          if (c.training_enabled && !hadTraining.has(c.id)) missed.push('訓練')
          if (c.wellness_enabled && !hadWellness.has(c.id)) missed.push('感受')
          return missed.length > 0
        })
        if (missedClients.length > 0) {
          digestLines.push('📋 昨日未記錄：')
          for (const mc of missedClients.slice(0, 10)) {
            const missed: string[] = []
            if (mc.body_composition_enabled && !hadWeight.has(mc.id)) missed.push('體重')
            if (mc.nutrition_enabled && !hadNutrition.has(mc.id)) missed.push('飲食')
            if (mc.training_enabled && !hadTraining.has(mc.id)) missed.push('訓練')
            if (mc.wellness_enabled && !hadWellness.has(mc.id)) missed.push('感受')
            digestLines.push(`  • ${mc.name}：${missed.join('、')}`)
          }
        }

        // 2. Low energy or high RPE
        const lowEnergy = (yWellnessRes.data || []).filter((w: { client_id: string; energy_level: number | null }) => w.energy_level != null && w.energy_level <= 2)
        const highRPE = (yTrainingRes.data || []).filter((t: { client_id: string; rpe: number | null }) => t.rpe != null && t.rpe >= 9)
        if (lowEnergy.length > 0 || highRPE.length > 0) {
          digestLines.push('')
          digestLines.push('⚠️ 需關注：')
          for (const w of lowEnergy) {
            const name = coachViewClients.find(c => c.id === w.client_id)?.name || '未知'
            digestLines.push(`  • ${name}：精力 ${w.energy_level}/5`)
          }
          for (const t of highRPE) {
            const name = coachViewClients.find(c => c.id === t.client_id)?.name || '未知'
            digestLines.push(`  • ${name}：RPE ${t.rpe}`)
          }
        }

        // 3. Weight plateau alerts (>7 days no change ±0.2kg)
        const recentWeightsRes = await supabase
          .from('body_composition')
          .select('client_id, weight, date')
          .gte('date', new Date(Date.now() - 10 * DAY_MS).toISOString().split('T')[0])
          .order('date', { ascending: false })
        const weightsByClient: Record<string, number[]> = {}
        for (const w of (recentWeightsRes.data || [])) {
          if (w.weight == null) continue
          if (!weightsByClient[w.client_id]) weightsByClient[w.client_id] = []
          weightsByClient[w.client_id].push(w.weight)
        }
        const plateauClients: string[] = []
        for (const [cid, weights] of Object.entries(weightsByClient)) {
          if (weights.length >= 7) {
            const range = Math.max(...weights) - Math.min(...weights)
            if (range <= 0.2) {
              const name = coachViewClients.find(c => c.id === cid)?.name || '未知'
              plateauClients.push(name)
            }
          }
        }
        if (plateauClients.length > 0) {
          digestLines.push('')
          digestLines.push('📊 體重停滯（>7天 ±0.2kg）：')
          plateauClients.forEach(name => digestLines.push(`  • ${name}`))
        }

        // 4. Competition countdowns (<30 days)
        const { data: compClients } = await supabase
          .from('clients')
          .select('name, competition_date')
          .eq('is_active', true)
          .in('client_mode', ['bodybuilding', 'athletic'])
          .not('competition_date', 'is', null)
        const urgentComp = (compClients || []).filter((c: { name: string; competition_date: string }) => {
          const days = daysUntilDateTW(c.competition_date)
          return days > 0 && days <= 30
        })
        if (urgentComp.length > 0) {
          digestLines.push('')
          digestLines.push('🏆 備賽倒數：')
          for (const cc of urgentComp) {
            const days = daysUntilDateTW(cc.competition_date)
            digestLines.push(`  • ${cc.name}：${days} 天`)
          }
        }

        // 方案到期倒數 — 原本到期提醒只推給學員（而且只推有綁 LINE 的），教練端完全沒有視野：
        // 2026-08-11 靠人工查 DB 才發現震宣 7 天後就到期。續約是教練的決定，他得先看得到。
        const { data: expiringClients } = await supabase
          .from('clients')
          .select('name, expires_at, subscription_tier')
          .eq('is_active', true)
          .neq('subscription_tier', 'free')
          .not('expires_at', 'is', null)
        const expiringSoon = (expiringClients || [])
          .map((c: { name: string; expires_at: string; subscription_tier: string }) => ({
            ...c, days: daysUntilDateTW(c.expires_at),
          }))
          .filter(c => c.days <= 14)
          .sort((a, b) => a.days - b.days)
        if (expiringSoon.length > 0) {
          digestLines.push('')
          digestLines.push('📅 方案到期：')
          for (const ec of expiringSoon) {
            digestLines.push(
              ec.days < 0 ? `  • ${ec.name}：已過期 ${Math.abs(ec.days)} 天`
              : ec.days === 0 ? `  • ${ec.name}：今天到期`
              : `  • ${ec.name}：${ec.days} 天後到期`
            )
          }
        }

        // Only send if there are actionable items
        if (digestLines.length > 0) {
          const header = `☀️ 教練晨報 ${today}\n\n`
          const digestText = header + digestLines.join('\n')
          await pushMessage(coachLineId, [{ type: 'text', text: digestText }])
          logger.info(`Coach digest sent: ${digestLines.length} lines`)
        }
      } catch (err) {
        logger.error('Coach digest error:', err)
        errors.push(`Coach digest: ${(err as Error).message || 'unknown'}`)
      }
    }
  } else {
    // ── 晚上提醒：聰明推播（只推活躍用戶，節省 LINE 額度）──

    // 1. 查今天已記錄的數據
    const [todayWeightRes, wellnessRes, nutritionRes, trainingRes] = await Promise.all([
      supabase.from('body_composition').select('client_id, weight').eq('date', today),
      supabase.from('daily_wellness').select('client_id').eq('date', today),
      supabase.from('nutrition_logs').select('client_id').eq('date', today),
      supabase.from('training_logs').select('client_id').eq('date', today),
    ])

    const hasWeight = new Set((todayWeightRes.data || []).map((w: { client_id: string }) => w.client_id))
    const hasWellness = new Set((wellnessRes.data || []).map((w: { client_id: string }) => w.client_id))
    const hasNutrition = new Set((nutritionRes.data || []).map((n: { client_id: string }) => n.client_id))
    const hasTraining = new Set((trainingRes.data || []).map((t: { client_id: string }) => t.client_id))

    // 2. 查過去 7 天有記錄過的人（活躍用戶）
    const sevenDaysAgo = new Date(Date.now() - 7 * DAY_MS).toISOString().split('T')[0]
    const { data: recentRecords } = await supabase
      .from('body_composition')
      .select('client_id')
      .gte('date', sevenDaysAgo)
    const activeClientIds = new Set((recentRecords || []).map((r: { client_id: string }) => r.client_id))

    // 3. 查每位活躍用戶的最近兩筆體重（用於 Quick Reply + delta 比較）
    const { data: latestWeights } = await supabase
      .from('body_composition')
      .select('client_id, weight, date')
      .not('weight', 'is', null)
      .order('date', { ascending: false })
    const lastWeightByClient: Record<string, number> = {}
    const prevWeightByClient: Record<string, number> = {}
    for (const w of (latestWeights || []) as { client_id: string; weight: number; date: string }[]) {
      if (!lastWeightByClient[w.client_id]) {
        lastWeightByClient[w.client_id] = w.weight
      } else if (!prevWeightByClient[w.client_id]) {
        prevWeightByClient[w.client_id] = w.weight
      }
    }

    // 4. 分兩組：Web Push 組（所有缺記錄的人）+ LINE Push 組（活躍但今天沒記體重）
    const eveningTargets: { client: typeof clients[0]; missing: string[]; missingShort: string[] }[] = []
    const lineWeightTargets: { client: typeof clients[0]; lastWeight: number }[] = []

    for (const client of clients) {
      // Web Push 提醒（所有缺記錄的人，免費無限）
      const missing: string[] = []
      const missingShort: string[] = []
      if (client.body_composition_enabled && !hasWeight.has(client.id)) {
        missing.push('• 體重 → 輸入「體重 72.5」')
        missingShort.push('體重')
      }
      if (client.wellness_enabled && !hasWellness.has(client.id)) {
        missing.push('• 身心狀態 → 輸入「身心 4 3 4」')
        missingShort.push('身心狀態')
      }
      if (client.nutrition_enabled && !hasNutrition.has(client.id)) {
        missing.push('• 飲食紀錄 → 輸入「達標」或「未達標」')
        missingShort.push('飲食紀錄')
      }
      if (client.training_enabled && !hasTraining.has(client.id)) {
        missing.push('• 訓練紀錄 → 輸入「訓練 推 60分鐘」')
        missingShort.push('訓練紀錄')
      }
      if (missing.length > 0) eveningTargets.push({ client, missing, missingShort })

      // LINE Push 提醒：付費用戶 + 今天完全沒記錄 → 推一則（省 LINE 額度）
      // 免費版 LINE 每月 200 則，6 個付費 × 30 天 = 最多 180 則
      const isPaid = client.subscription_tier === 'coached' || client.subscription_tier === 'self_managed'
      const hasAnyRecord = hasWeight.has(client.id) || hasWellness.has(client.id) || hasNutrition.has(client.id) || hasTraining.has(client.id)
      if (
        isPaid &&
        client.line_user_id &&
        !hasAnyRecord &&
        lastWeightByClient[client.id]
      ) {
        lineWeightTargets.push({ client, lastWeight: lastWeightByClient[client.id] })
      }
    }

    // 5a. Web Push 提醒（免費，照常送）
    for (let i = 0; i < eveningTargets.length; i += 5) {
      const batch = eveningTargets.slice(i, i + 5)
      const results = await Promise.allSettled(
        batch.map(({ client, missing, missingShort }) =>
          sendWebPushOnly(client.id, {
            title: `🌙 還有 ${missing.length} 項沒記錄`,
            body: `缺少：${missingShort.join('、')}`,
            url: `${siteUrl}/dashboard`,
          })
        )
      )
      results.forEach((result) => {
        if (result.status === 'fulfilled' && result.value) {
          sent++
          webPushUsed++
        }
      })
    }

    // 5b. LINE Push 體重提醒（只給活躍用戶，帶 Quick Reply 一鍵記錄）
    for (let i = 0; i < lineWeightTargets.length; i += 5) {
      const batch = lineWeightTargets.slice(i, i + 5)
      const results = await Promise.allSettled(
        batch.map(({ client, lastWeight }) => {
          const w = lastWeight
          const quickReplyItems = [
            { type: 'action' as const, action: { type: 'message' as const, label: `${(w - 0.5).toFixed(1)}`, text: `體重 ${(w - 0.5).toFixed(1)}` } },
            { type: 'action' as const, action: { type: 'message' as const, label: `${w.toFixed(1)}（不變）`, text: `體重 ${w.toFixed(1)}` } },
            { type: 'action' as const, action: { type: 'message' as const, label: `${(w + 0.5).toFixed(1)}`, text: `體重 ${(w + 0.5).toFixed(1)}` } },
            { type: 'action' as const, action: { type: 'message' as const, label: '自己輸入', text: '記體重' } },
          ]
          const prev = prevWeightByClient[client.id]
          const deltaText = prev != null
            ? (() => { const d = w - prev; return d === 0 ? '持平' : `${d > 0 ? '+' : ''}${d.toFixed(1)}` })()
            : null
          const msgText = deltaText
            ? `🌙 ${client.name}，上次 ${w.toFixed(1)}kg（${deltaText}），今天呢？\n回覆數字即可記錄 👇`
            : `🌙 ${client.name}，上次 ${w.toFixed(1)}kg，今天呢？\n回覆數字即可記錄 👇`
          return pushMessage(client.line_user_id, [{
            type: 'text',
            text: msgText,
            quickReply: { items: quickReplyItems },
          }])
        })
      )
      results.forEach((result, idx) => {
        if (result.status === 'fulfilled') {
          sent++
          linePushUsed++
        } else {
          errors.push(`LINE weight push ${batch[idx].client.name}: ${(result.reason as Error)?.message || 'unknown'}`)
        }
      })
    }
    logger.info(`Evening push: ${webPushUsed} web, ${linePushUsed} LINE (${lineWeightTargets.length} weight targets)`)
  }

  // ===== 到期提醒（每日檢查，早上執行一次就好）=====
  // 到期前 7/3/1 天 + 到期當天 → LINE 通知自動扣款時間
  let expiryReminders = 0
  if (isMorning) {
    const { data: allClients } = await supabase
      .from('clients')
      .select('id, name, line_user_id, unique_code, expires_at, subscription_tier')
      .eq('is_active', true)
      .not('line_user_id', 'is', null)
      .not('expires_at', 'is', null)

    if (allClients) {
      const now = new Date()

      for (const c of allClients) {
        if (!c.expires_at || c.subscription_tier === 'free') continue
        const expiresAt = new Date(c.expires_at)
        const daysLeft = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

        if (daysLeft === 7 || daysLeft === 3 || daysLeft === 1 || daysLeft === 0) {
          try {
            const expiryMsg = daysLeft === 0
              ? `${c.name}，你的方案今天自動續訂扣款。\n\n扣款成功後會自動延長一個月，無需手動操作。\n\n如需取消，請至儀表板設定頁面操作。`
              : `${c.name}，你的方案將在 ${daysLeft} 天後自動續訂。\n\n系統會自動從信用卡扣款，不需手動操作。\n如需取消自動扣款，請至儀表板右上角設定。`
            await sendRoutineReminder(c.id, c.line_user_id, {
              title: daysLeft === 0 ? '💳 今日自動續訂' : `💳 ${daysLeft} 天後自動續訂`,
              body: daysLeft === 0 ? '方案今天自動扣款，成功後自動延長一個月' : '系統將自動扣款，如需取消請至設定',
              lineText: expiryMsg,
              url: '/dashboard',
            })
            expiryReminders++
          } catch (err: unknown) {
            errors.push(`expiry_${c.name}: ${err instanceof Error ? err.message : String(err)}`)
          }
        }
      }
    }
  }

  // ===== 新加入學員旅程（啟動序列 + 里程碑）=====
  // 啟動序列：加入後第 1/2/3 天「從未記過任何一筆」→ 升級式催第一筆（接住啟動失敗，如 Eddie/世傳）。
  // 里程碑：第 3/7/14 天「真的有記錄」的免費用戶 → 鼓勵/升級。
  // 修正舊 bug：里程碑「你已經記錄 3 天了」原本不檢查有沒有記錄，會恭喜從沒打卡的人。
  let milestonesSent = 0
  let activationNudges = 0
  if (isMorning) {
    const fifteenDaysAgoStr = new Date(Date.now() - 15 * 86_400_000).toISOString().slice(0, 10)
    const { data: newClients } = await supabase
      .from('clients')
      .select('id, name, line_user_id, created_at, subscription_tier, body_composition_enabled, nutrition_enabled, wellness_enabled, training_enabled')
      .eq('is_active', true)
      .not('line_user_id', 'is', null)
      .gte('created_at', fifteenDaysAgoStr + 'T00:00:00Z')

    if (newClients && newClients.length > 0) {
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://howard456.vercel.app'
      const now = new Date()
      const ids = newClients.map(c => c.id)

      // 批次判斷「這些新學員誰曾經記過任何一筆」（跨 5 張打卡表，只查候選 id）
      const everLogged = new Set<string>()
      for (const table of ['body_composition', 'nutrition_logs', 'training_logs', 'daily_wellness', 'supplement_logs'] as const) {
        const { data } = await supabase.from(table).select('client_id').in('client_id', ids)
        for (const r of (data ?? []) as Array<{ client_id: string }>) everLogged.add(r.client_id)
      }

      for (const c of newClients) {
        const daysSinceJoin = Math.floor((now.getTime() - new Date(c.created_at).getTime()) / (1000 * 60 * 60 * 24))
        const hasLogged = everLogged.has(c.id)
        const tracks = c.body_composition_enabled || c.nutrition_enabled || c.wellness_enabled || c.training_enabled

        // ── 啟動序列：從未記過 + 有開通追蹤 + 第 1/2/3 天 ──
        if (!hasLogged && tracks && (daysSinceJoin === 1 || daysSinceJoin === 2 || daysSinceJoin === 3)) {
          let title = '', body = '', lineText = ''
          if (daysSinceJoin === 1) {
            title = '👋 Howard：記下你的第一筆'
            body = '30 秒記體重，系統馬上算出你的每日目標'
            lineText = `${c.name}，我是 Howard 👋\n\n看到你加入了，但還沒記第一筆數據。花 30 秒記今天體重，系統馬上幫你算出 TDEE 和每日目標——這是一切的起點。\n\n直接回覆「體重 XX」，或點開記錄。`
          } else if (daysSinceJoin === 2) {
            title = '第一筆最難，之後都很快'
            body = '今天量完體重直接記，10 秒搞定'
            lineText = `${c.name}，第一筆最難、之後都很快 🙂\n\n今天量完體重直接記一下（10 秒），系統就能開始幫你追蹤。卡在哪也可以直接問我。`
          } else {
            title = 'Howard：需要我幫你設定嗎？'
            body = '卡住的話直接回我這則訊息'
            lineText = `${c.name}，最後提醒一次——沒有你的數據，系統幫不了你。\n\n如果卡在哪裡，直接回我這則訊息，我幫你弄。`
          }
          try {
            await sendRoutineReminder(c.id, c.line_user_id, { title, body, lineText, url: '/dashboard' })
            activationNudges++
          } catch (err: unknown) {
            errors.push(`activation_${c.name}: ${err instanceof Error ? err.message : String(err)}`)
          }
          continue // 啟動中就不發里程碑
        }

        // ── 里程碑：真的有記錄的免費用戶，第 3/7/14 天 ──
        if (!hasLogged || c.subscription_tier !== 'free') continue
        let milestoneMsg: string | null = null
        if (daysSinceJoin === 3) {
          milestoneMsg = `${c.name}，你已經記錄 3 天了 👍\n\n持續記錄的人，減脂成功率是沒記錄的 2 倍——你已經在對的路上了。\n\n💡 每天量完體重直接輸入「體重 XX」就好，10 秒搞定。`
        } else if (daysSinceJoin === 7) {
          milestoneMsg = `${c.name}，一週了！你的數據已經開始有趨勢了 📈\n\n你目前用的是免費版，已經可以追蹤體重和飲食。\n\n不過如果你想知道「我的進度到底正不正常」「該不該調整」，升級後 AI 會根據你這一週的真實數據幫你判斷，不是給你網路上的通用建議。\n\n👉 看看差在哪：${siteUrl}/upgrade?from=free`
        } else if (daysSinceJoin === 14) {
          milestoneMsg = `${c.name}，兩週了，你的數據量已經蠻有參考價值了 📊\n\n如果你有時候會不確定自己的方向對不對——升級後可以直接問 AI，它看得到你所有的紀錄，會根據趨勢給你具體建議。\n\n👉 ${siteUrl}/upgrade?from=free\n\n有問題也可以直接問我！`
        }

        if (milestoneMsg) {
          try {
            const milestoneTitle = daysSinceJoin === 3 ? '👍 連續記錄 3 天' : daysSinceJoin === 7 ? '📈 一週了，數據開始有趨勢' : '📊 兩週了，數據有參考價值'
            const milestoneBody = daysSinceJoin === 3 ? '持續記錄的人減脂成功率是 2 倍，你在對的路上' : '想知道進度正不正常？看看升級差在哪'
            await sendRoutineReminder(c.id, c.line_user_id, {
              title: milestoneTitle,
              body: milestoneBody,
              lineText: milestoneMsg,
              url: daysSinceJoin === 3 ? '/dashboard' : '/upgrade?from=free',
            })
            milestonesSent++
          } catch (err: unknown) {
            errors.push(`milestone_${c.name}: ${err instanceof Error ? err.message : String(err)}`)
          }
        }
      }
    }
  }

  // ===== Email Drip Sequence（早上執行）=====
  // Day 3 / Day 7 / Day 14（免費用戶）/ Win-back / Expiry warning emails
  let emailDripSent = 0
  let emailDripFailed = 0
  if (isMorning) {
    const now = new Date()

    // Helper: get email for a client from subscription_purchases (most recent completed)
    const getClientEmail = async (clientId: string): Promise<string | null> => {
      const { data } = await supabase
        .from('subscription_purchases')
        .select('email')
        .eq('client_id', clientId)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      return data?.email || null
    }

    // Helper: compute days since a date (integer, floor)
    const daysSince = (dateStr: string): number => {
      return Math.floor((now.getTime() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24))
    }

    // Helper: compute days until a date (integer, ceil)
    const daysUntil = (dateStr: string): number => {
      return Math.ceil((new Date(dateStr).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    }

    // ── a0) Day 1 LINE 綁定提醒：註冊滿 1 天但 line_user_id 仍為空 ──
    {
      const { data: unboundClients } = await supabase
        .from('clients')
        .select('id, name, unique_code, created_at, line_user_id')
        .eq('is_active', true)
        .is('line_user_id', null)

      if (unboundClients) {
        for (const c of unboundClients) {
          if (daysSince(c.created_at) !== 1) continue
          try {
            const email = await getClientEmail(c.id)
            if (!email) continue
            const result = await sendLineBindReminderEmail({
              to: email,
              name: c.name,
              uniqueCode: c.unique_code,
            })
            if (result.success) emailDripSent++
            else emailDripFailed++
          } catch (err: unknown) {
            emailDripFailed++
            errors.push(`email_linebind_${c.name}: ${err instanceof Error ? err.message : String(err)}`)
          }
        }
      }
    }

    // ── a) Day 3 email: active clients created exactly 3 days ago ──
    {
      const { data: day3Clients } = await supabase
        .from('clients')
        .select('id, name, unique_code, created_at')
        .eq('is_active', true)

      if (day3Clients) {
        for (const c of day3Clients) {
          if (daysSince(c.created_at) !== 3) continue
          try {
            const email = await getClientEmail(c.id)
            if (!email) continue
            const result = await sendDay3Email({ to: email, name: c.name, uniqueCode: c.unique_code })
            if (result.success) emailDripSent++
            else emailDripFailed++
          } catch (err: unknown) {
            emailDripFailed++
            errors.push(`email_day3_${c.name}: ${err instanceof Error ? err.message : String(err)}`)
          }
        }
      }
    }

    // ── b) Day 7 email: active clients created exactly 7 days ago ──
    {
      const { data: day7Clients } = await supabase
        .from('clients')
        .select('id, name, unique_code, created_at')
        .eq('is_active', true)

      if (day7Clients) {
        for (const c of day7Clients) {
          if (daysSince(c.created_at) !== 7) continue
          try {
            const email = await getClientEmail(c.id)
            if (!email) continue
            const result = await sendDay7Email({ to: email, name: c.name, uniqueCode: c.unique_code })
            if (result.success) emailDripSent++
            else emailDripFailed++
          } catch (err: unknown) {
            emailDripFailed++
            errors.push(`email_day7_${c.name}: ${err instanceof Error ? err.message : String(err)}`)
          }
        }
      }
    }

    // ── c) Day 14 email: free users at day 14 who haven't upgraded ──
    {
      const { data: day14Clients } = await supabase
        .from('clients')
        .select('id, name, unique_code, created_at, subscription_tier')
        .eq('is_active', true)
        .eq('subscription_tier', 'free')

      if (day14Clients) {
        for (const c of day14Clients) {
          if (daysSince(c.created_at) !== 14) continue
          try {
            const email = await getClientEmail(c.id)
            if (!email) continue
            const result = await sendDay14Email({ to: email, name: c.name, uniqueCode: c.unique_code })
            if (result.success) emailDripSent++
            else emailDripFailed++
          } catch (err: unknown) {
            emailDripFailed++
            errors.push(`email_day14_${c.name}: ${err instanceof Error ? err.message : String(err)}`)
          }
        }
      }
    }

    // ── d) Win-back email: inactive clients whose expires_at was exactly 7 days ago ──
    {
      const { data: churnedClients } = await supabase
        .from('clients')
        .select('id, name, expires_at')
        .eq('is_active', false)
        .not('expires_at', 'is', null)

      if (churnedClients) {
        for (const c of churnedClients) {
          if (!c.expires_at || daysSince(c.expires_at) !== 7) continue
          try {
            const email = await getClientEmail(c.id)
            if (!email) continue
            const result = await sendWinBackEmail({ to: email, name: c.name })
            if (result.success) emailDripSent++
            else emailDripFailed++
          } catch (err: unknown) {
            emailDripFailed++
            errors.push(`email_winback_${c.name}: ${err instanceof Error ? err.message : String(err)}`)
          }
        }
      }
    }

    // ── e) Expiry warning email: paid clients expiring in 7/3/1 days ──
    {
      const { data: paidClients } = await supabase
        .from('clients')
        .select('id, name, subscription_tier, expires_at')
        .eq('is_active', true)
        .not('subscription_tier', 'eq', 'free')
        .not('expires_at', 'is', null)

      if (paidClients) {
        for (const c of paidClients) {
          if (!c.expires_at) continue
          const dl = daysUntil(c.expires_at)
          if (dl !== 7 && dl !== 3 && dl !== 1) continue
          try {
            const email = await getClientEmail(c.id)
            if (!email) continue
            const result = await sendExpiryWarningEmail({
              to: email,
              name: c.name,
              daysLeft: dl,
              tier: c.subscription_tier,
            })
            if (result.success) emailDripSent++
            else emailDripFailed++
          } catch (err: unknown) {
            emailDripFailed++
            errors.push(`email_expiry_${c.name}: ${err instanceof Error ? err.message : String(err)}`)
          }
        }
      }
    }

    logger.info('Email drip sequence completed', { sent: emailDripSent, failed: emailDripFailed })
  }

  // ===== Referral Reward Automation（早上執行）=====
  let referralsCompleted = 0
  let referralsExpired = 0
  if (isMorning) {
    const now = new Date()
    const sevenDaysAgoDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const thirtyDaysAgoDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    // Find all pending referrals created 7+ days ago
    const { data: pendingReferrals } = await supabase
      .from('referrals')
      .select('id, referrer_id, referee_id, created_at')
      .eq('status', 'pending')
      .lte('created_at', sevenDaysAgoDate.toISOString())

    if (pendingReferrals) {
      const sevenDaysAgoStr = sevenDaysAgoDate.toISOString().split('T')[0]

      for (const ref of pendingReferrals) {
        try {
          // Check if referee has been active: at least 3 records in body_data OR nutrition_logs in past 7 days
          const [bodyRes, nutritionRes] = await Promise.all([
            supabase
              .from('body_composition')
              .select('id', { count: 'exact', head: true })
              .eq('client_id', ref.referee_id)
              .gte('date', sevenDaysAgoStr),
            supabase
              .from('nutrition_logs')
              .select('id', { count: 'exact', head: true })
              .eq('client_id', ref.referee_id)
              .gte('date', sevenDaysAgoStr),
          ])

          const totalActivity = (bodyRes.count || 0) + (nutritionRes.count || 0)

          if (totalActivity >= 3) {
            // Referee is active — complete the referral and reward the referrer
            const { error: updateErr } = await supabase
              .from('referrals')
              .update({
                status: 'completed',
                completed_at: now.toISOString(),
                reward_applied: true,
              })
              .eq('id', ref.id)

            if (!updateErr) {
              // Extend referrer's expires_at by 7 days
              const { data: referrer } = await supabase
                .from('clients')
                .select('expires_at')
                .eq('id', ref.referrer_id)
                .single()

              let newExpiry: Date
              if (referrer?.expires_at && new Date(referrer.expires_at) > now) {
                // Extend from current expiry
                newExpiry = new Date(new Date(referrer.expires_at).getTime() + 7 * 24 * 60 * 60 * 1000)
              } else {
                // Set to now + 7 days if null or already past
                newExpiry = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
              }

              await supabase
                .from('clients')
                .update({ expires_at: newExpiry.toISOString() })
                .eq('id', ref.referrer_id)

              referralsCompleted++
              logger.info('Referral completed, reward applied', {
                referralId: ref.id,
                referrerId: ref.referrer_id,
                newExpiry: newExpiry.toISOString(),
              })
            }
          } else {
            // Check if 30+ days have passed since referral creation — expire it
            const referralCreatedAt = new Date(ref.created_at)
            if (referralCreatedAt <= thirtyDaysAgoDate) {
              await supabase
                .from('referrals')
                .update({ status: 'expired' })
                .eq('id', ref.id)

              referralsExpired++
              logger.info('Referral expired (inactive referee)', {
                referralId: ref.id,
                refereeId: ref.referee_id,
              })
            }
          }
        } catch (err: unknown) {
          errors.push(`referral_${ref.id}: ${err instanceof Error ? err.message : String(err)}`)
        }
      }
    }

    logger.info('Referral automation completed', { completed: referralsCompleted, expired: referralsExpired })
  }

  // ===== 智能警示推播（晚上執行）=====
  let smartAlertsSent = 0
  if (!isMorning) {
    // 取得過去 7 天數據做智能分析
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const sevenDaysStr = sevenDaysAgo.toISOString().split('T')[0]

    const [nutRes, wellRes, trainRes, bodyRes] = await Promise.all([
      supabase.from('nutrition_logs').select('client_id, date, calories, protein_grams, carbs_grams, fat_grams, compliant')
        .gte('date', sevenDaysStr).order('date'),
      supabase.from('daily_wellness').select('client_id, date, mood, energy_level, sleep_quality, hunger, stress_level')
        .gte('date', sevenDaysStr).order('date'),
      supabase.from('training_logs').select('client_id, date, training_type, duration, rpe')
        .gte('date', sevenDaysStr).order('date'),
      supabase.from('body_composition').select('client_id, date, weight, body_fat')
        .gte('date', sevenDaysStr).not('weight', 'is', null).order('date'),
    ])

    const allNut = nutRes.data || []
    const allWell = wellRes.data || []
    const allTrain = trainRes.data || []
    const allBody = bodyRes.data || []

    // 取得學員的目標設定
    const { data: allClientsFull } = await supabase
      .from('clients')
      .select('id, name, line_user_id, calories_target, protein_target, carbs_target, fat_target, goal_type, target_weight, gender')
      .eq('is_active', true)
      .not('line_user_id', 'is', null)

    if (allClientsFull) {
      for (const c of allClientsFull) {
        const clientProfile: ClientProfile = {
          name: c.name,
          gender: c.gender,
          goalType: c.goal_type,
          currentWeight: null,
          currentBodyFat: null,
          targetWeight: c.target_weight,
          caloriesTarget: c.calories_target,
          proteinTarget: c.protein_target,
          carbsTarget: c.carbs_target,
          fatTarget: c.fat_target,
        }

        const insightData: InsightData = {
          client: clientProfile,
          nutritionLogs: allNut.filter((n: { client_id: string }) => n.client_id === c.id),
          wellnessLogs: allWell.filter((w: { client_id: string }) => w.client_id === c.id),
          trainingLogs: allTrain.filter((t: { client_id: string }) => t.client_id === c.id),
          bodyLogs: allBody.filter((b: { client_id: string }) => b.client_id === c.id),
        }

        const alerts = generateSmartAlerts(insightData)
        // 只推送 warning 級別的警示，避免打擾
        const warnings = alerts.filter(a => a.severity === 'warning')

        if (warnings.length > 0) {
          const alertMsg = [
            `${c.name}，系統偵測到以下需注意事項：\n`,
            ...warnings.map(a => `${a.icon} ${a.title}\n${a.message}`),
          ].join('\n\n')

          try {
            await pushMessage(c.line_user_id, [{ type: 'text', text: alertMsg }])
            smartAlertsSent++
          } catch (err: unknown) {
            errors.push(`alert_${c.name}: ${err instanceof Error ? err.message : String(err)}`)
          }
        }
      }
    }
  }

  // ===== 付費帳號到期自動降級（早上執行）=====
  let downgradedCount = 0
  if (isMorning) {
    const { data: expiredClients } = await supabase
      .from('clients')
      .select('id, name, line_user_id, subscription_tier, expires_at')
      .eq('is_active', true)
      .not('subscription_tier', 'eq', 'free')
      .not('expires_at', 'is', null)

    if (expiredClients) {
      const now = new Date()
      for (const c of expiredClients) {
        if (!c.expires_at) continue
        const expiresAt = new Date(c.expires_at)
        if (expiresAt < now) {
          // 降級為免費方案
          const freeFeatures = getDefaultFeatures('free')
          const { error: downgradeErr } = await supabase
            .from('clients')
            .update({
              subscription_tier: 'free',
              ...freeFeatures,
            })
            .eq('id', c.id)

          if (downgradeErr) {
            errors.push(`降級失敗 [${c.name}]: ${downgradeErr.message}`)
          } else {
            downgradedCount++
            logger.info('帳號已降級為免費', { clientName: c.name, previousTier: c.subscription_tier })

            // 通知用戶 + 切回行銷版 Rich Menu
            if (c.line_user_id) {
              const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://howard456.vercel.app'
              try {
                await unlinkRichMenuFromUser(c.line_user_id)
                await pushMessage(c.line_user_id, [{
                  type: 'text',
                  text: `${c.name}，你的方案已到期，帳號已切換為免費版。\n\n免費版仍可使用體重追蹤和飲食達標紀錄。\n\n想繼續使用完整功能？\n👉 ${siteUrl}/remote\n\n你之前的數據都完整保留，重新訂閱後立即恢復。`,
                }])
              } catch (err: unknown) {
                errors.push(`降級通知失敗 [${c.name}]: ${err instanceof Error ? err.message : String(err)}`)
              }
            }
          }
        }
      }
    }
  }

  // ===== Insight 驅動推播（晚上，每週一次）=====
  // 週日晚上推一條最重要的 insight，讓用戶知道「系統有在幫你看數據」
  let insightPushSent = 0
  if (!isMorning && new Date().getDay() === 0) { // 週日
    const { data: insightClients } = await supabase
      .from('clients')
      .select('id, unique_code, name, line_user_id, gender, goal_type, subscription_tier')
      .eq('is_active', true)
      .not('line_user_id', 'is', null)
      .not('subscription_tier', 'eq', 'free') // 只推給付費用戶

    if (insightClients) {
      const fourteenDaysAgo = new Date()
      fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14)
      const sinceStr = fourteenDaysAgo.toISOString().split('T')[0]

      for (const c of insightClients) {
        try {
          const [wellRes, nutRes, trainRes, bodyRes] = await Promise.all([
            supabase.from('daily_wellness').select('date, sleep_quality, energy_level, mood, stress_level, cognitive_clarity, training_drive, device_recovery_score, resting_hr, hrv, wearable_sleep_score').eq('client_id', c.id).gte('date', sinceStr).order('date', { ascending: false }),
            supabase.from('nutrition_logs').select('date, calories, carbs_grams, protein_grams, compliant').eq('client_id', c.id).gte('date', sinceStr).order('date', { ascending: false }),
            supabase.from('training_logs').select('date, training_type, rpe, duration').eq('client_id', c.id).gte('date', sinceStr).order('date', { ascending: false }),
            supabase.from('body_composition').select('date, weight').eq('client_id', c.id).gte('date', sinceStr).not('weight', 'is', null).order('date', { ascending: false }).limit(14),
          ])

          if ((wellRes.data?.length ?? 0) < 5 && (nutRes.data?.length ?? 0) < 5) continue // 數據不夠

          const input: InsightInput = {
            gender: c.gender || '男性',
            bodyWeight: bodyRes.data?.[0]?.weight ?? 70,
            goalType: (c.goal_type as 'cut' | 'bulk' | 'recomp') || 'cut',
            wellness: (wellRes.data || []).map((w: any) => ({ ...w })),
            nutrition: (nutRes.data || []).map((n: any) => ({ ...n })),
            training: (trainRes.data || []).map((t: any) => ({ ...t })),
            supplementLogs: [],
            supplementCount: 0,
            weightHistory: (bodyRes.data || []).map((b: any) => ({ date: b.date, weight: b.weight })),
          }

          const insights = generateBehaviorInsights(input)
          // 只推第一條（最重要的），且不推 early rules 和 low confidence
          const topInsight = insights.find(i => !i.id.startsWith('early-') && i.confidence !== 'low')
          if (!topInsight) continue

          const msg = `${topInsight.emoji} ${c.name}，本週分析：\n\n${topInsight.title}\n${topInsight.description}\n\n💡 ${topInsight.suggestion}`

          await pushMessage(c.line_user_id, [{ type: 'text', text: msg }])
          insightPushSent++
        } catch (err: unknown) {
          errors.push(`insight_push_${c.name}: ${err instanceof Error ? err.message : String(err)}`)
        }
      }
    }
  }

  // ===== 沉默用戶喚回（晚上執行）=====
  // 只在「停打卡剛好第 3 天 / 第 7 天」各喚回一次（loss aversion：別讓進度斷掉）。
  // 不每晚轟炸、不打擾早已死掉的帳號（gap>7 不發）；曾有記錄者才喚（從未記過走啟動序列）。
  // Web Push 優先、無訂閱才 fallback LINE，省爆掉的 LINE 額度。
  let reengagementSent = 0
  if (!isMorning) {
    const since31 = new Date(Date.now() - 31 * 86_400_000).toISOString().slice(0, 10)
    // 可通知 = 有綁 LINE **或** 有 Web Push 訂閱。
    // （原本只收 line_user_id not null → 沒綁 LINE 但開了推播的學員（例：Eddie）
    //   一則喚回都收不到，跟 sendRoutineReminder「Web Push 優先」的設計自相矛盾。）
    const [{ data: allActiveClients }, { data: pushSubRows }] = await Promise.all([
      supabase.from('clients').select('id, name, line_user_id').eq('is_active', true),
      supabase.from('push_subscriptions').select('client_id'),
    ])
    const pushableIds = new Set((pushSubRows ?? []).map((r: { client_id: string }) => r.client_id))
    const activeClients = (allActiveClients ?? []).filter(c => c.line_user_id || pushableIds.has(c.id))

    if (activeClients && activeClients.length > 0) {
      // 近 31 天各表最後活動日 → 每位學員的最後打卡日
      const lastAct: Record<string, string> = {}
      for (const table of ['body_composition', 'nutrition_logs', 'training_logs', 'daily_wellness', 'supplement_logs'] as const) {
        const { data } = await supabase.from(table).select('client_id, date').gte('date', since31)
        for (const r of (data ?? []) as Array<{ client_id: string; date: string }>) {
          if (!lastAct[r.client_id] || r.date > lastAct[r.client_id]) lastAct[r.client_id] = r.date
        }
      }

      const todayMs = Date.parse(today)
      for (const c of activeClients) {
        const la = lastAct[c.id]
        if (!la) continue // 近 31 天從未記錄 → 啟動序列或早已流失，不在此喚
        const gap = Math.floor((todayMs - Date.parse(la)) / 86_400_000)
        if (gap !== 3 && gap !== 7) continue // 只在第 3 / 7 天各喚一次

        const msg = gap === 3
          ? {
              title: '👋 三天沒看到你了',
              body: '別讓進度斷在這，10 秒記一筆就好',
              lineText: `${c.name}，三天沒看到你了 👋\n\n你之前累積的記錄正在等下一筆——別讓趨勢斷掉。\n今天花 10 秒記個體重就好：輸入「體重 XX.X」。`,
            }
          : {
              title: '一週沒記錄了，回來看看？',
              body: '你的數據都還在，接著記就有趨勢',
              lineText: `${c.name}，一週沒記錄了。\n\n你之前的數據都還在，接著記就能看出這週的變化。卡住的話直接回我，我幫你。`,
            }
        try {
          await sendRoutineReminder(c.id, c.line_user_id ?? '', { ...msg, url: '/dashboard' })
          reengagementSent++
        } catch (err: unknown) {
          errors.push(`再喚醒失敗 [${c.name}]: ${err instanceof Error ? err.message : String(err)}`)
        }
      }
    }
  }

  // ===== Garmin OAuth 狀態清理（早上執行）=====
  let garminStatesCleared = 0
  if (isMorning) {
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
      const { error: cleanupErr } = await supabase
        .from('garmin_oauth_states')
        .delete()
        .lt('created_at', oneHourAgo)
      if (!cleanupErr) {
        logger.info('Cleaned up expired Garmin OAuth states')
      }
    } catch (err) {
      errors.push(`garmin_cleanup: ${(err as Error).message || 'unknown'}`)
    }
  }

  // ── 折疊排程：Vercel 方案只跑前 2 個 cron(daily 早/晚)，vercel.json 其餘 6 支從未被觸發。
  // 折進每日 morning run：依「台灣日期」判斷今天該跑哪幾支，用 CRON_SECRET 自呼叫(verifyCronAuth 認得)。
  const foldedCrons: Record<string, string> = {}
  if (isMorningRun) {
    const twDow = new Date(today + 'T12:00:00Z').getUTCDay() // 台灣日期的星期(0=日)
    const twDom = Number(today.slice(8, 10))
    const due = ['invariants', 'nurture-sequence']  // 每天
    if (twDow === 0) due.push('weekly')             // 週日：學員週報
    if (twDow === 1) due.push('skip-review')        // 週一
    if (twDom === 1) due.push('monthly')            // 每月 1 號
    const base = process.env.NEXT_PUBLIC_SITE_URL || 'https://howard456.vercel.app'
    for (const job of due) {
      try {
        const r = await fetch(`${base}/api/cron/${job}`, {
          headers: { Authorization: `Bearer ${process.env.CRON_SECRET || ''}` },
        })
        foldedCrons[job] = String(r.status)
        if (!r.ok) errors.push(`折疊排程 ${job} 回 ${r.status}`)
      } catch (e) {
        foldedCrons[job] = 'error'
        errors.push(`折疊排程 ${job} 失敗: ${e instanceof Error ? e.message : String(e)}`)
      }
    }
  }

  const responseData = {
    success: errors.length === 0,
    type: isMorning ? 'morning' : 'evening',
    foldedCrons,
    sent,
    webPushUsed,
    linePushUsed,
    expiryReminders,
    milestonesSent,
    activationNudges,
    emailDripSent,
    emailDripFailed,
    referralsCompleted,
    referralsExpired,
    smartAlertsSent,
    downgradedCount,
    reengagementSent,
    insightPushSent,
    garminStatesCleared,
    errors,
  }

  // 通知教練 cron 錯誤
  if (errors.length > 0) {
    // Sentry：把整批 cron 錯誤丟到 Sentry（不依賴 LINE push，雙保險）
    try {
      const Sentry = await import('@sentry/nextjs')
      Sentry.captureMessage(`Daily cron errors (${errors.length})`, {
        level: 'error',
        extra: { type: isMorning ? 'morning' : 'evening', errors, date: today },
      })
    } catch { /* Sentry 不存在不該擋 cron */ }

    const coachLineId = process.env.COACH_LINE_USER_ID
    if (coachLineId) {
      const errorSummary = [
        `⚠️ 排程執行有 ${errors.length} 個錯誤：`,
        '',
        ...errors.slice(0, 5).map(e => `• ${e}`),
        ...(errors.length > 5 ? [`...還有 ${errors.length - 5} 個錯誤`] : []),
      ].join('\n')
      pushMessage(coachLineId, [{ type: 'text', text: errorSummary }]).catch(err => {
        logger.error('Failed to notify coach about cron errors', err)
      })
    }
  }

  // 寫入 cron_runs
  if (errors.length === 0) {
    await completeCronRun(runId, responseData)
  } else {
    await failCronRun(runId, errors.join('; '), responseData)
  }

  return NextResponse.json(responseData)
}
