import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase'
import { validateLabValue, validateDate, sanitizeInput } from '@/utils/validation'
import { verifyCoachAuth, createErrorResponse, createSuccessResponse, sanitizeTextField, rateLimit, getClientIP } from '@/lib/auth-middleware'

const supabase = createServiceSupabase()

/**
 * 根據數值和參考範圍自動判斷 status
 * 參考範圍格式支援：
 *   "70-120"      → min=70, max=120
 *   "<1.4"        → max=1.4
 *   ">30"         → min=30
 *   "80"          → max=80 (單一上限)
 *   "3.5"         → min=3.5 (單一下限，搭配 test_name 推斷)
 */
function determineLabStatus(value: number, referenceRange: string | null): 'normal' | 'attention' | 'alert' {
  if (!referenceRange || !referenceRange.trim()) return 'normal'
  const ref = referenceRange.trim()

  let min: number | null = null
  let max: number | null = null

  // 格式："70-120" 或 "0.4-4.0"
  const rangeMatch = ref.match(/^(\d+\.?\d*)\s*[-–~]\s*(\d+\.?\d*)$/)
  if (rangeMatch) {
    min = parseFloat(rangeMatch[1])
    max = parseFloat(rangeMatch[2])
  }
  // 格式："<1.4" 或 "< 80"
  else if (/^[<＜≤]\s*(\d+\.?\d*)/.test(ref)) {
    const m = ref.match(/[<＜≤]\s*(\d+\.?\d*)/)
    if (m) max = parseFloat(m[1])
  }
  // 格式：">30" 或 "> 3.5"
  else if (/^[>＞≥]\s*(\d+\.?\d*)/.test(ref)) {
    const m = ref.match(/[>＞≥]\s*(\d+\.?\d*)/)
    if (m) min = parseFloat(m[1])
  }
  // 單一數值："80" → 當作上限
  else {
    const single = parseFloat(ref)
    if (!isNaN(single)) max = single
  }

  if (min === null && max === null) return 'normal'

  // 判斷邏輯
  if (min !== null && max !== null) {
    // 範圍型：超出範圍 10% 以上 = alert，剛超出 = attention
    const range = max - min
    const margin = range * 0.1 || 1 // 至少 1 的 margin
    if (value < min - margin || value > max + margin) return 'alert'
    if (value < min || value > max) return 'attention'
    return 'normal'
  }
  if (max !== null) {
    // 只有上限
    const margin = max * 0.1 || 1
    if (value > max + margin) return 'alert'
    if (value > max) return 'attention'
    return 'normal'
  }
  if (min !== null) {
    // 只有下限
    const margin = min * 0.1 || 1
    if (value < min - margin) return 'alert'
    if (value < min) return 'attention'
    return 'normal'
  }

  return 'normal'
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
    const body = await request.json()
    const { clientId, testName, value, unit, referenceRange, date, customAdvice, customTarget, selfEntry } = body

    // 驗證輸入
    if (!clientId || !testName || value === undefined || !date) {
      return createErrorResponse('缺少必要欄位', 400)
    }

    // 學員自行新增模式：不需要教練權限，但需額外驗證
    if (selfEntry) {
      // selfEntry 需要速率限制，防止濫用
      const ip = getClientIP(request)
      const { allowed } = await rateLimit(`lab-self:${ip}`, 10, 60_000)
      if (!allowed) {
        return createErrorResponse('請求過於頻繁，請稍後再試', 429)
      }
    } else {
      const { authorized, error: authError } = await verifyCoachAuth(request)
      if (!authorized) {
        return createErrorResponse(authError || '權限不足', 403)
      }
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

    // 獲取客戶資料
    const { data: client } = await supabase
      .from('clients')
      .select('id, is_active, expires_at, lab_enabled')
      .eq('unique_code', clientId)
      .single()

    if (!client) {
      return createErrorResponse('找不到客戶', 404)
    }

    // selfEntry 模式需額外驗證客戶狀態
    if (selfEntry) {
      if (client.is_active === false) {
        return createErrorResponse('帳號已停用', 403)
      }
      if (client.expires_at && new Date(client.expires_at) < new Date()) {
        return createErrorResponse('帳號已過期', 403)
      }
      if (client.lab_enabled === false) {
        return createErrorResponse('血檢功能未啟用', 403)
      }
    }

    // 創建血檢結果（學員自行新增時不允許填寫自訂建議/目標）
    const { data, error } = await supabase
      .from('lab_results')
      .insert({
        client_id: client.id,
        test_name: sanitizedName,
        value,
        unit: sanitizedUnit,
        reference_range: sanitizedReference,
        date,
        status: determineLabStatus(value, sanitizedReference),
        custom_advice: selfEntry ? null : sanitizedAdvice,
        custom_target: selfEntry ? null : sanitizedTarget
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
        status: determineLabStatus(value, sanitizedReference),
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
