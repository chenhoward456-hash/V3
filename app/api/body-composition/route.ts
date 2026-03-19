import { NextRequest, NextResponse } from 'next/server'
import { validateBodyComposition, validateDate } from '@/utils/validation'
import { verifyAuth, isCoach, createErrorResponse, createSuccessResponse, rateLimit, getClientIP } from '@/lib/auth-middleware'
import { generateNutritionSuggestion, NutritionInput } from '@/lib/nutrition-engine'
import { createServiceSupabase } from '@/lib/supabase'
import { isWeightTraining } from '@/components/client/types'
import { isCompetitionMode } from '@/lib/client-mode'
import { DAY_MS } from '@/lib/date-utils'

const supabase = createServiceSupabase()

function parseSerotoninField(value: string | null): { serotonin?: 'LL' | 'SL' | 'SS'; depressionRisk?: 'low' | 'moderate' | 'high' } {
  if (!value) return {}
  if (value === 'LL' || value === 'SL' || value === 'SS') return { serotonin: value }
  if (value === 'low' || value === 'moderate' || value === 'high') return { depressionRisk: value }
  return {}
}

// 自動調整營養素目標（與 nutrition-suggestions API 保持一致的完整輸入）
async function autoAdjustNutrition(clientId: string): Promise<{ adjusted: boolean; message?: string; calories?: number; protein?: number; carbs?: number; fat?: number; debug?: string }> {
  // 1. 取得學員資料
  const { data: client } = await supabase
    .from('clients')
    .select('*')
    .eq('id', clientId)
    .single()

  if (!client?.goal_type || !client?.nutrition_enabled) {
    return { adjusted: false, debug: `skip: goal_type=${client?.goal_type}, nutrition_enabled=${client?.nutrition_enabled}` }
  }

  // 教練覆寫鎖定已移除 — 自動調整引擎是核心功能，不應被 coach lock 阻擋
  // coach_macro_override 僅供前端顯示提示，不阻止引擎更新

  // 2. 取得近 30 天所有相關數據（平行查詢）
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const sinceDate = thirtyDaysAgo.toISOString().split('T')[0]
  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]
  const sevenDaysAgo = new Date(today)
  sevenDaysAgo.setDate(today.getDate() - 6)
  const sevenDaysStr = sevenDaysAgo.toISOString().split('T')[0]
  const sixtyDaysAgo = new Date(today)
  sixtyDaysAgo.setDate(today.getDate() - 60)
  const sixtyDaysStr = sixtyDaysAgo.toISOString().split('T')[0]
  const eightWeeksAgo = new Date(today)
  eightWeeksAgo.setDate(today.getDate() - 56)
  const eightWeeksStr = eightWeeksAgo.toISOString().split('T')[0]

  const [bodyRes, nutritionRes, trainingRes, wellnessRes, labRes, periodRes, suppLogsRes, suppListRes] = await Promise.all([
    supabase.from('body_composition').select('date, weight, body_fat, height').eq('client_id', clientId)
      .gte('date', sinceDate).not('weight', 'is', null).order('date', { ascending: true }),
    supabase.from('nutrition_logs').select('date, compliant, calories, carbs_grams').eq('client_id', clientId)
      .gte('date', sinceDate).order('date', { ascending: true }),
    supabase.from('training_logs').select('date, training_type, rpe, duration').eq('client_id', clientId)
      .gte('date', sinceDate).order('date', { ascending: true }),
    supabase.from('daily_wellness').select('date, energy_level, training_drive, device_recovery_score, resting_hr, hrv, wearable_sleep_score, respiratory_rate').eq('client_id', clientId)
      .gte('date', sinceDate).order('date', { ascending: true }),
    supabase.from('lab_results').select('test_name, value, unit, status').eq('client_id', clientId)
      .order('date', { ascending: false }).limit(30),
    // 月經週期：最近 60 天內最後一次經期標記
    client.gender === '女性'
      ? supabase.from('daily_wellness').select('date').eq('client_id', clientId)
          .eq('period_start', true).gte('date', sixtyDaysStr).order('date', { ascending: false }).limit(1)
      : Promise.resolve({ data: null, error: null }),
    supabase.from('supplement_logs').select('date, completed').eq('client_id', clientId).gte('date', eightWeeksStr),
    supabase.from('supplements').select('name').eq('client_id', clientId),
  ])

  const bodyData = bodyRes.data || []
  const nutritionLogs = nutritionRes.data || []
  const trainingLogs = trainingRes.data || []
  const wellnessLogs = wellnessRes.data || []
  const labResults = labRes.data || []

  // 月經週期
  let lastPeriodDate: string | null = null
  if (periodRes.data && periodRes.data.length > 0) {
    lastPeriodDate = periodRes.data[0].date
  }

  // 補品依從率
  const suppLogs = suppLogsRes.data || []
  const suppList = suppListRes.data || []
  const suppComplianceRate = suppLogs.length > 0
    ? suppLogs.filter((s: { completed: boolean | null }) => s.completed).length / suppLogs.length
    : 0
  const suppDates = suppLogs.map((s: { date: string }) => s.date).sort()
  const suppWeeksDuration = suppDates.length > 0
    ? Math.floor((new Date().getTime() - new Date(suppDates[0]).getTime()) / (7 * 24 * 60 * 60 * 1000))
    : 0

  // 3. 計算週均體重
  const weeklyWeights: { week: number; avgWeight: number }[] = []
  for (let w = 0; w < 4; w++) {
    const weekEnd = new Date(today); weekEnd.setDate(today.getDate() - w * 7)
    const weekStart = new Date(weekEnd); weekStart.setDate(weekEnd.getDate() - 6)
    const startStr = weekStart.toISOString().split('T')[0]
    const endStr = weekEnd.toISOString().split('T')[0]
    const ww = bodyData.filter((b) => b.date >= startStr && b.date <= endStr).map((b) => b.weight as number)
    if (ww.length > 0) {
      weeklyWeights.push({ week: w, avgWeight: Math.round((ww.reduce((a: number, b: number) => a + b, 0) / ww.length) * 100) / 100 })
    }
  }

  // Goal-Driven 或備賽客戶只需 1 週數據即可反算赤字
  const hasGoalDrivenData = !!(client.target_weight && (client.competition_date || client.target_date))
  const isCompetition = isCompetitionMode(client.client_mode)
  if (weeklyWeights.length < 2) {
    if (weeklyWeights.length === 1 && (hasGoalDrivenData || isCompetition)) {
      weeklyWeights.push({ week: 1, avgWeight: weeklyWeights[0].avgWeight })
    } else {
      return { adjusted: false, debug: `skip: weeklyWeights=${weeklyWeights.length} (need ≥2)` }
    }
  }

  // 4. 合規率（近 14 天）
  const fourteenStr = new Date(today.getTime() - 13 * DAY_MS).toISOString().split('T')[0]
  const recent = nutritionLogs.filter((l) => l.date >= fourteenStr && l.date <= todayStr)
  const compliance = recent.length > 0 ? Math.round(recent.filter((l) => l.compliant).length / recent.length * 100) : 0

  // 5. 平均攝取
  const withCal = recent.filter((l) => l.calories != null)
  const avgCal = withCal.length > 0 ? Math.round(withCal.reduce((s: number, l) => s + (l.calories as number), 0) / withCal.length) : null

  // 6. 訓練天數
  const recentTraining = trainingLogs.filter((l) => l.date >= fourteenStr && l.date <= todayStr && isWeightTraining(l.training_type as string))
  const trainingDaysPerWeek = Math.round(recentTraining.length / 2)

  const latestWeight = bodyData[bodyData.length - 1]?.weight
  if (!latestWeight) return { adjusted: false, debug: 'skip: no latestWeight' }

  // 7. 體脂率 + 身高（反向找最近有值的紀錄）
  const latestBodyFat = [...bodyData].reverse().find((b: { body_fat: number | null }) => b.body_fat != null)?.body_fat as number | null ?? null
  const latestHeight = [...bodyData].reverse().find((b: { height: number | null }) => b.height != null)?.height as number | null ?? null

  // 8. 訓練量統計（近 7 天）
  const recentTrainingWithRPE = trainingLogs.filter((t: { date: string; training_type: string }) => t.date >= sevenDaysStr && isWeightTraining(t.training_type))
  const avgRPE = recentTrainingWithRPE.length > 0
    ? recentTrainingWithRPE.reduce((s: number, t: { rpe: number | null }) => s + (t.rpe ?? 6), 0) / recentTrainingWithRPE.length
    : null
  const avgDurationMin = recentTrainingWithRPE.length > 0
    ? recentTrainingWithRPE.reduce((s: number, t: { duration: number | null }) => s + ((t.duration as number) ?? 45), 0) / recentTrainingWithRPE.length
    : null

  // 9. 跑引擎（與 nutrition-suggestions API 一致的完整輸入）
  const suggestion = generateNutritionSuggestion({
    gender: client.gender || '男性',
    bodyWeight: latestWeight,
    height: latestHeight,
    bodyFatPct: latestBodyFat,
    goalType: client.goal_type,
    dietStartDate: client.diet_start_date || null,
    targetWeight: client.target_weight ?? null,
    targetBodyFatPct: (client.target_body_fat as number) ?? undefined,
    targetDate: client.competition_date || client.target_date || null,
    currentCalories: client.calories_target ?? null,
    currentProtein: client.protein_target ?? null,
    currentCarbs: client.carbs_target ?? null,
    currentFat: client.fat_target ?? null,
    currentCarbsTrainingDay: client.carbs_training_day ?? null,
    currentCarbsRestDay: client.carbs_rest_day ?? null,
    carbsCyclingEnabled: !!(client.carbs_training_day && client.carbs_rest_day),
    weeklyWeights,
    nutritionCompliance: compliance,
    avgDailyCalories: avgCal,
    trainingDaysPerWeek,
    prepPhase: client.prep_phase || undefined,
    clientMode: (client.client_mode as 'standard' | 'health' | 'bodybuilding' | 'athletic') || undefined,
    weighInGapHours: (client as any).weigh_in_gap_hours ?? undefined,
    activityProfile: (client.activity_profile as 'sedentary' | 'high_energy_flux') || undefined,
    geneticProfile: (client.gene_mthfr || client.gene_apoe || client.gene_depression_risk) ? {
      mthfr: client.gene_mthfr || undefined,
      apoe: client.gene_apoe || undefined,
      ...parseSerotoninField(client.gene_depression_risk),
    } : undefined,
    recentWellness: wellnessLogs.map((w: { date: string; energy_level: number | null; training_drive: number | null; device_recovery_score: number | null; resting_hr: number | null; hrv: number | null; wearable_sleep_score: number | null; respiratory_rate: number | null }) => ({
      date: w.date,
      energy_level: w.energy_level ?? null,
      training_drive: w.training_drive ?? null,
      device_recovery_score: w.device_recovery_score ?? null,
      resting_hr: w.resting_hr ?? null,
      hrv: w.hrv ?? null,
      wearable_sleep_score: w.wearable_sleep_score ?? null,
      respiratory_rate: w.respiratory_rate ?? null,
    })),
    recentTrainingLogs: trainingLogs
      .filter((t: { date: string }) => t.date >= sevenDaysStr)
      .map((t: { date: string; rpe: number | null }) => ({ date: t.date, rpe: t.rpe ?? null })),
    recentCarbsPerDay: nutritionLogs
      .filter((n: { date: string }) => n.date >= sevenDaysStr)
      .map((n: { date: string; carbs_grams: number | null }) => ({ date: n.date, carbs: n.carbs_grams ?? null })),
    lastPeriodDate: lastPeriodDate || undefined,
    labResults: labResults.map((l: { test_name: string; value: number; unit: string; status: string }) => ({
      test_name: l.test_name,
      value: l.value,
      unit: l.unit,
      status: l.status as 'normal' | 'attention' | 'alert',
    })),
    recentTrainingVolume: recentTrainingWithRPE.length > 0 ? {
      avgRPE,
      avgDurationMin,
      sessionsPerWeek: recentTrainingWithRPE.length,
    } : undefined,
    supplementCompliance: suppLogs.length > 0 ? {
      rate: suppComplianceRate,
      weeksDuration: suppWeeksDuration,
      supplements: suppList.map((s: { name: string }) => s.name),
    } : undefined,
  })

  const debugInfo = `status=${suggestion.status}, autoApply=${suggestion.autoApply}, compliance=${compliance}%, weeklyWeights=${weeklyWeights.length}, rate=${suggestion.weeklyWeightChangeRate?.toFixed(2)}%/wk, bf=${latestBodyFat ?? 'n/a'}%, wellness=${wellnessLogs.length}, labs=${labResults.length}`

  // 10. 自動套用（Goal-Driven 結果已 safety-capped，一律套用）
  if (suggestion.autoApply) {
    const updates: Record<string, number> = {}
    if (suggestion.suggestedCalories != null) updates.calories_target = suggestion.suggestedCalories
    if (suggestion.suggestedProtein != null) updates.protein_target = suggestion.suggestedProtein
    if (suggestion.suggestedCarbs != null) updates.carbs_target = suggestion.suggestedCarbs
    if (suggestion.suggestedFat != null) updates.fat_target = suggestion.suggestedFat
    if (suggestion.suggestedCarbsTrainingDay != null) updates.carbs_training_day = suggestion.suggestedCarbsTrainingDay
    if (suggestion.suggestedCarbsRestDay != null) updates.carbs_rest_day = suggestion.suggestedCarbsRestDay

    if (Object.keys(updates).length > 0) {
      await supabase.from('clients').update(updates).eq('id', clientId)
      return {
        adjusted: true,
        message: suggestion.message,
        calories: suggestion.suggestedCalories ?? undefined,
        protein: suggestion.suggestedProtein ?? undefined,
        carbs: suggestion.suggestedCarbs ?? undefined,
        fat: suggestion.suggestedFat ?? undefined,
        debug: debugInfo,
      }
    }
  }

  return { adjusted: false, debug: debugInfo }
}

export async function GET(request: NextRequest) {
  try {
    // GET 方法允許公開存取，學員可以用連結查看自己的資料

    // 獲取請求參數
    const { searchParams } = new URL(request.url)
    const clientId = searchParams.get('clientId')

    if (!clientId) {
      return createErrorResponse('缺少客戶 ID', 400)
    }

    // 獲取客戶 ID
    const { data: client } = await supabase
      .from('clients')
      .select('id')
      .eq('unique_code', clientId)
      .single()

    if (!client) {
      return createErrorResponse('找不到客戶', 404)
    }

    // 獲取身體數據記錄
    const { data, error } = await supabase
      .from('body_composition')
      .select('*')
      .eq('client_id', client.id)
      .order('date', { ascending: false })

    if (error) {
      return createErrorResponse('獲取身體數據失敗', 500)
    }

    return createSuccessResponse(data)

  } catch (error) {
    return createErrorResponse('伺服器錯誤', 500)
  }
}

export async function POST(request: NextRequest) {
  const ip = getClientIP(request)
  const { allowed } = await rateLimit(`body:${ip}`, 20, 60_000)
  if (!allowed) return createErrorResponse('請求過於頻繁，請稍後再試', 429)

  try {
    // 1. 獲取請求內容
    const body = await request.json()
    const { clientId, date, height, weight, bodyFat, muscleMass, visceralFat, bmi } = body

    // 驗證輸入
    if (!clientId || !date) {
      return createErrorResponse('缺少必要欄位', 400)
    }

    // 驗證日期
    const dateValidation = validateDate(date)
    if (!dateValidation.isValid) {
      return createErrorResponse(dateValidation.error, 400)
    }

    // 驗證身體數據
    const validations = []

    if (height != null) {
      validations.push(validateBodyComposition('height', height))
    }

    if (weight != null) {
      validations.push(validateBodyComposition('weight', weight))
    }

    if (bodyFat != null) {
      validations.push(validateBodyComposition('body_fat', bodyFat))
    }

    if (muscleMass != null) {
      validations.push(validateBodyComposition('muscle_mass', muscleMass))
    }

    if (visceralFat != null) {
      validations.push(validateBodyComposition('visceral_fat', visceralFat))
    }

    if (bmi != null) {
      validations.push(validateBodyComposition('bmi', bmi))
    }

    // 檢查所有驗證結果
    for (const validation of validations) {
      if (!validation.isValid) {
        return createErrorResponse(validation.error, 400)
      }
    }

    // 獲取客戶 ID
    const { data: client } = await supabase
      .from('clients')
      .select('id, expires_at')
      .eq('unique_code', clientId)
      .single()

    if (!client) {
      return createErrorResponse('找不到客戶', 404)
    }

    // 檢查客戶是否未過期
    if (client.expires_at && new Date(client.expires_at) < new Date()) {
      return createErrorResponse('客戶已過期', 403)
    }

    // 查詢同日是否已有記錄
    const { data: existing } = await supabase
      .from('body_composition')
      .select('id')
      .eq('client_id', client.id)
      .eq('date', date)
      .maybeSingle()

    const record = {
      client_id: client.id,
      date,
      height: height ?? null,
      weight: weight ?? null,
      body_fat: bodyFat ?? null,
      muscle_mass: muscleMass ?? null,
      visceral_fat: visceralFat ?? null,
      bmi: bmi ?? null,
    }

    let data, error
    if (existing) {
      // 同一天更新
      ;({ data, error } = await supabase
        .from('body_composition')
        .update(record)
        .eq('id', existing.id)
        .select()
        .single())
    } else {
      // 新增
      ;({ data, error } = await supabase
        .from('body_composition')
        .insert(record)
        .select()
        .single())
    }

    if (error) {
      return createErrorResponse('建立身體數據失敗', 500)
    }

    // 自動觸發營養分析引擎：如果有設定 goal_type 且記錄了體重
    let nutritionAdjusted: { adjusted: boolean; message?: string; calories?: number; protein?: number; carbs?: number; fat?: number; debug?: string } = { adjusted: false, debug: 'not triggered (weight is null)' }
    if (weight != null) {
      try {
        nutritionAdjusted = await autoAdjustNutrition(client.id)
      } catch (engineErr: unknown) {
        const errMsg = engineErr instanceof Error ? engineErr.message : String(engineErr)
        nutritionAdjusted = { adjusted: false, debug: `engine error: ${errMsg}` }
      }
    }

    return createSuccessResponse({ ...data, nutritionAdjusted })

  } catch (error) {
    return createErrorResponse('伺服器錯誤', 500)
  }
}

export async function PUT(request: NextRequest) {
  try {
    // 1. 驗證身份
    const { user, error: authError } = await verifyAuth(request)
    if (authError || !user) {
      return createErrorResponse(authError || '身份驗證失敗', 401)
    }

    // 2. 檢查權限（目前只有教練可以存取）
    if (!isCoach(user)) {
      return createErrorResponse('權限不足，需要教練角色', 403)
    }

    // 3. 獲取請求內容
    const body = await request.json()
    const { id, date, height, weight, bodyFat, muscleMass, visceralFat, bmi } = body

    // 驗證輸入
    if (!id) {
      return createErrorResponse('缺少身體數據 ID', 400)
    }

    // 驗證日期
    if (date) {
      const dateValidation = validateDate(date)
      if (!dateValidation.isValid) {
        return createErrorResponse(dateValidation.error, 400)
      }
    }

    // 驗證身體數據
    const validations = []
    const updateData: Record<string, string | number | null> = { date }

    if (height !== undefined) {
      validations.push(validateBodyComposition('height', height))
      updateData.height = height
    }

    if (weight !== undefined) {
      validations.push(validateBodyComposition('weight', weight))
      updateData.weight = weight
    }

    if (bodyFat !== undefined) {
      validations.push(validateBodyComposition('body_fat', bodyFat))
      updateData.body_fat = bodyFat
    }

    if (muscleMass !== undefined) {
      validations.push(validateBodyComposition('muscle_mass', muscleMass))
      updateData.muscle_mass = muscleMass
    }

    if (visceralFat !== undefined) {
      validations.push(validateBodyComposition('visceral_fat', visceralFat))
      updateData.visceral_fat = visceralFat
    }

    if (bmi !== undefined) {
      validations.push(validateBodyComposition('bmi', bmi))
      updateData.bmi = bmi
    }

    // 檢查所有驗證結果
    for (const validation of validations) {
      if (!validation.isValid) {
        return createErrorResponse(validation.error, 400)
      }
    }

    // 更新身體數據記錄
    const { data, error } = await supabase
      .from('body_composition')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return createErrorResponse('更新身體數據失敗', 500)
    }

    return createSuccessResponse(data)

  } catch (error) {
    return createErrorResponse('伺服器錯誤', 500)
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // 1. 驗證身份
    const { user, error: authError } = await verifyAuth(request)
    if (authError || !user) {
      return createErrorResponse(authError || '身份驗證失敗', 401)
    }

    // 2. 檢查權限（目前只有教練可以存取）
    if (!isCoach(user)) {
      return createErrorResponse('權限不足，需要教練角色', 403)
    }

    // 3. 獲取請求參數
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return createErrorResponse('缺少身體數據 ID', 400)
    }

    // 刪除身體數據記錄
    const { error } = await supabase
      .from('body_composition')
      .delete()
      .eq('id', id)

    if (error) {
      return createErrorResponse('刪除身體數據失敗', 500)
    }

    return createSuccessResponse({ success: true })

  } catch (error) {
    return createErrorResponse('伺服器錯誤', 500)
  }
}
