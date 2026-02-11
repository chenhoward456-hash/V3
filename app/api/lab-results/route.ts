import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { validateLabValue, validateDate, sanitizeInput } from '@/utils/validation'
import { verifyAuth, isCoach, createErrorResponse, createSuccessResponse } from '@/lib/auth-middleware'

function verifyCoachPin(request: NextRequest): boolean {
  const pin = request.headers.get('x-coach-pin')
  return !!pin && pin === process.env.COACH_PIN
}

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
    
    console.log('🔍 API GET /api/lab-results - clientId:', clientId)
    
    if (!clientId) {
      console.log('❌ 缺少客戶 ID')
      return createErrorResponse('缺少客戶 ID', 400)
    }
    
    // 獲取客戶 ID
    console.log('🔍 開始查詢客戶 ID...')
    const { data: client } = await supabase
      .from('clients')
      .select('id')
      .eq('unique_code', clientId)
      .single()
    
    console.log('📊 客戶 ID 查詢結果:', { client })
    
    if (!client) {
      console.log('❌ 找不到客戶')
      return createErrorResponse('找不到客戶', 404)
    }
    
    // 獲取血檢結果
    console.log('🔍 開始查詢血檢結果...')
    const { data, error } = await supabase
      .from('lab_results')
      .select('*')
      .eq('client_id', client.id)
      .order('date', { ascending: false })
    
    console.log('📊 血檢結果查詢:', { data, error })
    
    if (error) {
      console.log('❌ 獲取血檢結果失敗:', error)
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
    // 驗證教練權限（JWT 或 PIN）
    if (!verifyCoachPin(request)) {
      const { user, error: authError } = await verifyAuth(request)
      if (authError || !user || !isCoach(user)) {
        return createErrorResponse('權限不足', 403)
      }
    }
    const body = await request.json()
    const { clientId, testName, value, unit, referenceRange, date, customAdvice, customTarget } = body

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
        status: 'normal',
        custom_advice: customAdvice || null,
        custom_target: customTarget || null
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
    // 驗證教練權限（JWT 或 PIN）
    if (!verifyCoachPin(request)) {
      const { user, error: authError } = await verifyAuth(request)
      if (authError || !user || !isCoach(user)) {
        return createErrorResponse('權限不足', 403)
      }
    }
    const body = await request.json()
    const { id, testName, value, unit, referenceRange, date, customAdvice, customTarget } = body

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
        date,
        custom_advice: customAdvice || null,
        custom_target: customTarget || null
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
    // 驗證教練權限（JWT 或 PIN）
    if (!verifyCoachPin(request)) {
      const { user, error: authError } = await verifyAuth(request)
      if (authError || !user || !isCoach(user)) {
        return createErrorResponse('權限不足', 403)
      }
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
