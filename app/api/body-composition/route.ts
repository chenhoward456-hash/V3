import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { validateBodyComposition, validateDate } from '@/utils/validation'
import { verifyAuth, isCoach, createErrorResponse, createSuccessResponse } from '@/lib/auth-middleware'
import { generateNutritionSuggestion, NutritionInput } from '@/lib/nutrition-engine'

// 檢查環境變數
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing required environment variables for Supabase')
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

// 自動調整營養素目標
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

  // 2. 取得近 30 天數據
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const sinceDate = thirtyDaysAgo.toISOString().split('T')[0]
  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]

  const [bodyRes, nutritionRes, trainingRes] = await Promise.all([
    supabase.from('body_composition').select('date, weight').eq('client_id', clientId)
      .gte('date', sinceDate).not('weight', 'is', null).order('date', { ascending: true }),
    supabase.from('nutrition_logs').select('date, compliant, calories').eq('client_id', clientId)
      .gte('date', sinceDate).order('date', { ascending: true }),
    supabase.from('training_logs').select('date, training_type').eq('client_id', clientId)
      .gte('date', sinceDate).order('date', { ascending: true }),
  ])

  const bodyData = bodyRes.data || []
  const nutritionLogs = nutritionRes.data || []
  const trainingLogs = trainingRes.data || []

  // 3. 計算週均體重
  const weeklyWeights: { week: number; avgWeight: number }[] = []
  for (let w = 0; w < 4; w++) {
    const weekEnd = new Date(today); weekEnd.setDate(today.getDate() - w * 7)
    const weekStart = new Date(weekEnd); weekStart.setDate(weekEnd.getDate() - 6)
    const startStr = weekStart.toISOString().split('T')[0]
    const endStr = weekEnd.toISOString().split('T')[0]
    const ww = bodyData.filter((b: any) => b.date >= startStr && b.date <= endStr).map((b: any) => b.weight)
    if (ww.length > 0) {
      weeklyWeights.push({ week: w, avgWeight: Math.round((ww.reduce((a: number, b: number) => a + b, 0) / ww.length) * 100) / 100 })
    }
  }

  if (weeklyWeights.length < 2) return { adjusted: false, debug: `skip: weeklyWeights=${weeklyWeights.length} (need ≥2)` }

  // 4. 合規率
  const fourteenStr = new Date(today.getTime() - 13 * 86400000).toISOString().split('T')[0]
  const recent = nutritionLogs.filter((l: any) => l.date >= fourteenStr && l.date <= todayStr)
  const compliance = recent.length > 0 ? Math.round(recent.filter((l: any) => l.compliant).length / recent.length * 100) : 0

  // 5. 平均攝取
  const withCal = recent.filter((l: any) => l.calories != null)
  const avgCal = withCal.length > 0 ? Math.round(withCal.reduce((s: number, l: any) => s + l.calories, 0) / withCal.length) : null

  // 6. 訓練天數
  const recentTraining = trainingLogs.filter((l: any) => l.date >= fourteenStr && l.date <= todayStr && l.training_type !== 'rest')
  const trainingDays = Math.round(recentTraining.length / 2)

  const latestWeight = bodyData[bodyData.length - 1]?.weight
  if (!latestWeight) return { adjusted: false, debug: 'skip: no latestWeight' }

  // 7. 跑引擎
  const suggestion = generateNutritionSuggestion({
    gender: client.gender || '男性',
    bodyWeight: latestWeight,
    goalType: client.goal_type,
    dietStartDate: client.diet_start_date || null,
    targetWeight: client.target_weight || null,
    targetDate: client.competition_date || null,
    currentCalories: client.calories_target || null,
    currentProtein: client.protein_target || null,
    currentCarbs: client.carbs_target || null,
    currentFat: client.fat_target || null,
    currentCarbsTrainingDay: client.carbs_training_day || null,
    currentCarbsRestDay: client.carbs_rest_day || null,
    carbsCyclingEnabled: !!(client.carbs_training_day && client.carbs_rest_day),
    weeklyWeights,
    nutritionCompliance: compliance,
    avgDailyCalories: avgCal,
    trainingDaysPerWeek: trainingDays,
  })

  const debugInfo = `status=${suggestion.status}, autoApply=${suggestion.autoApply}, compliance=${compliance}%, weeklyWeights=${weeklyWeights.length}, rate=${suggestion.weeklyWeightChangeRate?.toFixed(2)}%/wk`

  // 8. 自動套用
  if (suggestion.autoApply) {
    const updates: Record<string, any> = {}
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

    // 自動觸發營養建議引擎：如果有設定 goal_type 且記錄了體重
    let nutritionAdjusted: { adjusted: boolean; message?: string; calories?: number; protein?: number; carbs?: number; fat?: number; debug?: string } = { adjusted: false }
    if (weight != null) {
      try {
        nutritionAdjusted = await autoAdjustNutrition(client.id)
      } catch {
        // 引擎失敗不影響體重記錄
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
    const updateData: any = { date }

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
