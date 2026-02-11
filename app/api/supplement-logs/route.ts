import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { validateDate } from '@/utils/validation'
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
    const date = searchParams.get('date')
    
    console.log('🔍 API GET /api/supplement-logs - clientId:', clientId, 'date:', date)
    
    if (!clientId) {
      console.log('❌ 缺少客戶 ID')
      return createErrorResponse('缺少客戶 ID', 400)
    }
    
    // 驗證日期
    if (date) {
      const dateValidation = validateDate(date)
      if (!dateValidation.isValid) {
        return NextResponse.json({ error: dateValidation.error }, { status: 400 })
      }
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
    
    // 獲取打卡記錄
    let query = supabase
      .from('supplement_logs')
      .select('*')
      .eq('client_id', client.id)
    
    if (date) {
      query = query.eq('date', date)
    } else {
      // 如果沒有指定日期，獲取今天的記錄
      const today = new Date().toISOString().split('T')[0]
      query = query.eq('date', today)
    }
    
    const { data, error } = await query.order('date', { ascending: false })
    
    if (error) {
      return NextResponse.json({ error: '獲取打卡記錄失敗' }, { status: 500 })
    }
    
    return NextResponse.json(data)
    
  } catch (error) {
    console.error('API 錯誤:', error)
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { clientId, supplementId, date, completed } = body

    // 驗證輸入
    if (!clientId || !supplementId || !date) {
      return createErrorResponse('缺少必要欄位', 400)
    }

    // 驗證日期
    const dateValidation = validateDate(date)
    if (!dateValidation.isValid) {
      return createErrorResponse(dateValidation.error, 400)
    }

    // 驗證 completed
    if (typeof completed !== 'boolean') {
      return createErrorResponse('completed 必須是布林值', 400)
    }

    // 根據 unique_code 查詢客戶
    const { data: client } = await supabase
      .from('clients')
      .select('id, expires_at')
      .eq('unique_code', clientId)
      .single()

    if (!client) {
      return createErrorResponse('找不到客戶', 404)
    }

    // 檢查是否過期
    if (client.expires_at && new Date(client.expires_at) < new Date()) {
      return createErrorResponse('客戶已過期', 403)
    }

    // 創建或更新打卡記錄
    const { data, error } = await supabase
      .from('supplement_logs')
      .upsert({
        client_id: client.id,
        supplement_id: supplementId,
        date,
        completed
      })
      .select()
      .single()

    if (error) {
      return createErrorResponse('記錄打卡失敗', 500)
    }

    return createSuccessResponse(data)

  } catch (error) {
    console.error('API 錯誤:', error)
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
    const { id, completed } = body
    
    // 驗證輸入
    if (!id) {
      return createErrorResponse('缺少打卡記錄 ID', 400)
    }
    
    // 驗證 completed
    if (typeof completed !== 'boolean') {
      return createErrorResponse('completed 必須是布林值', 400)
    }
    
    // 更新打卡記錄
    const { data, error } = await supabase
      .from('supplement_logs')
      .update({ completed })
      .eq('id', id)
      .select()
      .single()
    
    if (error) {
      return createErrorResponse('更新打卡記錄失敗', 500)
    }
    
    return createSuccessResponse(data)
    
  } catch (error) {
    console.error('API 錯誤:', error)
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
      return createErrorResponse('缺少打卡記錄 ID', 400)
    }
    
    // 刪除打卡記錄
    const { error } = await supabase
      .from('supplement_logs')
      .delete()
      .eq('id', id)
    
    if (error) {
      return createErrorResponse('刪除打卡記錄失敗', 500)
    }
    
    return createSuccessResponse({ success: true })
    
  } catch (error) {
    console.error('API 錯誤:', error)
    return createErrorResponse('伺服器錯誤', 500)
  }
}
