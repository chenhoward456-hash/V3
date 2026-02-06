import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { validateLabValue, validateDate, sanitizeInput } from '@/utils/validation'
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
      return NextResponse.json({ error: '找不到客戶' }, { status: 404 })
    }
    
    // 獲取血檢結果
    const { data, error } = await supabase
      .from('lab_results')
      .select('*')
      .eq('client_id', client.id)
      .order('date', { ascending: false })
    
    if (error) {
      return createErrorResponse('獲取血檢結果失敗', 500)
    }
    
    return createSuccessResponse(data)
    
  } catch (error) {
    console.error('API 錯誤:', error)
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
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
    const body = await request.json()
    const { clientId, testName, value, unit, referenceRange, date } = body
    
    // 驗證輸入
    if (!clientId || !testName || value === undefined || !date) {
      return createErrorResponse('缺少必要欄位', 400)
    }
    
    // 驗證並清理輸入
    const sanitizedName = sanitizeInput(testName)
    const sanitizedUnit = sanitizeInput(unit || '')
    const sanitizedReference = sanitizeInput(referenceRange || '')
    
    // 驗證血檢數值
    const valueValidation = validateLabValue(sanitizedName, value)
    if (!valueValidation.isValid) {
      return NextResponse.json({ error: valueValidation.error }, { status: 400 })
    }
    
    // 驗證日期
    const dateValidation = validateDate(date)
    if (!dateValidation.isValid) {
      return NextResponse.json({ error: dateValidation.error }, { status: 400 })
    }
    
    // 獲取客戶 ID
    const { data: client } = await supabase
      .from('clients')
      .select('id')
      .eq('unique_code', clientId)
      .single()
    
    if (!client) {
      return NextResponse.json({ error: '找不到客戶' }, { status: 404 })
    }
    
    // 創建血檢結果
    const { data, error } = await supabase
      .from('lab_results')
      .insert({
        client_id: client.id,
        test_name: sanitizedName,
        value,
        unit: sanitizedUnit,
        reference_range: sanitizedReference,
        date,
        status: 'normal' // 會由觸發器自動更新
      })
      .select()
      .single()
    
    if (error) {
      return createErrorResponse('建立血檢結果失敗', 500)
    }
    
    return createSuccessResponse(data)
    
  } catch (error) {
    console.error('API 錯誤:', error)
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 })
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
    const body = await request.json()
    const { id, testName, value, unit, referenceRange, date } = body
    
    // 驗證輸入
    if (!id || !testName || value === undefined || !date) {
      return createErrorResponse('缺少必要欄位', 400)
    }
    
    // 驗證並清理輸入
    const sanitizedName = sanitizeInput(testName)
    const sanitizedUnit = sanitizeInput(unit || '')
    const sanitizedReference = sanitizeInput(referenceRange || '')
    
    // 驗證血檢數值
    const valueValidation = validateLabValue(sanitizedName, value)
    if (!valueValidation.isValid) {
      return NextResponse.json({ error: valueValidation.error }, { status: 400 })
    }
    
    // 驗證日期
    const dateValidation = validateDate(date)
    if (!dateValidation.isValid) {
      return NextResponse.json({ error: dateValidation.error }, { status: 400 })
    }
    
    // 更新血檢結果
    const { data, error } = await supabase
      .from('lab_results')
      .update({
        test_name: sanitizedName,
        value,
        unit: sanitizedUnit,
        reference_range: sanitizedReference,
        date
      })
      .eq('id', id)
      .select()
      .single()
    
    if (error) {
      return createErrorResponse('更新血檢結果失敗', 500)
    }
    
    return createSuccessResponse(data)
    
  } catch (error) {
    console.error('API 錯誤:', error)
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 })
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
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    
    if (!id) {
      return createErrorResponse('缺少血檢結果 ID', 400)
    }
    
    // 刪除血檢結果
    const { error } = await supabase
      .from('lab_results')
      .delete()
      .eq('id', id)
    
    if (error) {
      return createErrorResponse('刪除血檢結果失敗', 500)
    }
    
    return createSuccessResponse({ success: true })
    
  } catch (error) {
    console.error('API 錯誤:', error)
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 })
  }
}
