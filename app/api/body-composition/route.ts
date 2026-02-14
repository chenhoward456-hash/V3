import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { validateBodyComposition, validateDate } from '@/utils/validation'
import { verifyAuth, isCoach, createErrorResponse, createSuccessResponse } from '@/lib/auth-middleware'

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

    return createSuccessResponse(data)

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
