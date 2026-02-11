import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { validateSupplementName, validateSupplementDosage, sanitizeInput } from '@/utils/validation'
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
    
    console.log('🔍 API GET /api/supplements - clientId:', clientId)
    
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
    
    // 獲取補品列表
    console.log('🔍 開始查詢補品列表...')
    const { data, error } = await supabase
      .from('supplements')
      .select('*')
      .eq('client_id', client.id)
      .order('sort_order', { ascending: true })
    
    console.log('📊 補品列表查詢:', { data, error })
    
    if (error) {
      console.log('❌ 獲取補品列表失敗:', error)
      return createErrorResponse('獲取補品列表失敗', 500)
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

    // 3. 獲取請求內容
    const body = await request.json()
    const { clientId, name, dosage, timing, why, sortOrder } = body
    
    // 驗證輸入
    if (!clientId || !name || !dosage || !timing) {
      return createErrorResponse('缺少必要欄位', 400)
    }
    
    // 驗證並清理輸入
    const sanitizedName = sanitizeInput(name)
    const sanitizedDosage = sanitizeInput(dosage)
    const sanitizedTiming = sanitizeInput(timing)
    const sanitizedWhy = sanitizeInput(why || '')
    
    // 驗證補品名稱
    const nameValidation = validateSupplementName(sanitizedName)
    if (!nameValidation.isValid) {
      return createErrorResponse(nameValidation.error, 400)
    }
    
    // 驗證補品劑量
    const dosageValidation = validateSupplementDosage(sanitizedDosage)
    if (!dosageValidation.isValid) {
      return createErrorResponse(dosageValidation.error, 400)
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
    
    // 創建補品
    const { data, error } = await supabase
      .from('supplements')
      .insert({
        client_id: client.id,
        name: sanitizedName,
        dosage: sanitizedDosage,
        timing: sanitizedTiming,
        why: sanitizedWhy,
        sort_order: sortOrder || 0
      })
      .select()
      .single()
    
    if (error) {
      return createErrorResponse('建立補品失敗', 500)
    }
    
    return createSuccessResponse(data)
    
  } catch (error) {
    console.error('API 錯誤:', error)
    return createErrorResponse('伺服器錯誤', 500)
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

    // 3. 獲取請求內容
    const body = await request.json()
    const { id, name, dosage, timing, why, sortOrder } = body
    
    // 驗證輸入
    if (!id || !name || !dosage || !timing) {
      return createErrorResponse('缺少必要欄位', 400)
    }
    
    // 驗證並清理輸入
    const sanitizedName = sanitizeInput(name)
    const sanitizedDosage = sanitizeInput(dosage)
    const sanitizedTiming = sanitizeInput(timing)
    const sanitizedWhy = sanitizeInput(why || '')
    
    // 驗證補品名稱
    const nameValidation = validateSupplementName(sanitizedName)
    if (!nameValidation.isValid) {
      return createErrorResponse(nameValidation.error, 400)
    }
    
    // 驗證補品劑量
    const dosageValidation = validateSupplementDosage(sanitizedDosage)
    if (!dosageValidation.isValid) {
      return createErrorResponse(dosageValidation.error, 400)
    }
    
    // 更新補品
    const { data, error } = await supabase
      .from('supplements')
      .update({
        name: sanitizedName,
        dosage: sanitizedDosage,
        timing: sanitizedTiming,
        why: sanitizedWhy,
        sort_order: sortOrder || 0
      })
      .eq('id', id)
      .select()
      .single()
    
    if (error) {
      return createErrorResponse('更新補品失敗', 500)
    }
    
    return createSuccessResponse(data)
    
  } catch (error) {
    console.error('API 錯誤:', error)
    return createErrorResponse('伺服器錯誤', 500)
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

    // 3. 獲取請求參數
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    
    if (!id) {
      return createErrorResponse('缺少補品 ID', 400)
    }
    
    // 刪除補品
    const { error } = await supabase
      .from('supplements')
      .delete()
      .eq('id', id)
    
    if (error) {
      return createErrorResponse('刪除補品失敗', 500)
    }
    
    return createSuccessResponse({ success: true })
    
  } catch (error) {
    console.error('API 錯誤:', error)
    return createErrorResponse('伺服器錯誤', 500)
  }
}
