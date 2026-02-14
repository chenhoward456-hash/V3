import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { validateLabValue, validateDate, sanitizeInput } from '@/utils/validation'
import { verifyCoachAuth, createErrorResponse, createSuccessResponse, sanitizeTextField } from '@/lib/auth-middleware'

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
    return createErrorResponse('伺服器錯誤', 500)
  }
}

export async function POST(request: NextRequest) {
  try {
    // 驗證教練權限（JWT 或 PIN）
    const { authorized, error: authError } = await verifyCoachAuth(request)
    if (!authorized) {
      return createErrorResponse(authError || '權限不足', 403)
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

    // 清理 customAdvice 和 customTarget
    const sanitizedAdvice = sanitizeTextField(customAdvice, 1000)
    const sanitizedTarget = sanitizeTextField(customTarget, 500)

    // 驗證血檢數值
    const valueValidation = validateLabValue(sanitizedName, value)
    if (!valueValidation.isValid) {
      return createErrorResponse(valueValidation.error, 400)
    }

    // 驗證日期
    const dateValidation = validateDate(date)
    if (!dateValidation.isValid) {
      return createErrorResponse(dateValidation.error, 400)
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
        custom_advice: sanitizedAdvice,
        custom_target: sanitizedTarget
      })
      .select()
      .single()

    if (error) {
      return createErrorResponse('建立血檢結果失敗', 500)
    }

    return createSuccessResponse(data)

  } catch (error) {
    return createErrorResponse('伺服器錯誤', 500)
  }
}

export async function PUT(request: NextRequest) {
  try {
    // 驗證教練權限（JWT 或 PIN）
    const { authorized, error: authError } = await verifyCoachAuth(request)
    if (!authorized) {
      return createErrorResponse(authError || '權限不足', 403)
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

    // 清理 customAdvice 和 customTarget
    const sanitizedAdvice = sanitizeTextField(customAdvice, 1000)
    const sanitizedTarget = sanitizeTextField(customTarget, 500)

    // 驗證血檢數值
    const valueValidation = validateLabValue(sanitizedName, value)
    if (!valueValidation.isValid) {
      return createErrorResponse(valueValidation.error, 400)
    }

    // 驗證日期
    const dateValidation = validateDate(date)
    if (!dateValidation.isValid) {
      return createErrorResponse(dateValidation.error, 400)
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
        custom_advice: sanitizedAdvice,
        custom_target: sanitizedTarget
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return createErrorResponse('更新血檢結果失敗', 500)
    }

    return createSuccessResponse(data)

  } catch (error) {
    return createErrorResponse('伺服器錯誤', 500)
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // 驗證教練權限（JWT 或 PIN）
    const { authorized, error: authError } = await verifyCoachAuth(request)
    if (!authorized) {
      return createErrorResponse(authError || '權限不足', 403)
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
    return createErrorResponse('伺服器錯誤', 500)
  }
}
