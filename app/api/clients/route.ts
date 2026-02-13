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
    
    console.log('🔍 API GET /api/clients - clientId:', clientId)
    
    if (!clientId) {
      console.log('❌ 缺少客戶 ID')
      return createErrorResponse('缺少客戶 ID', 400)
    }
    
    // 獲取客戶資料
    console.log('🔍 開始查詢客戶資料...')
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select(`
        *,
        lab_results (*),
        supplements (*)
      `)
      .eq('unique_code', clientId)
      .single()
    
    console.log('📊 查詢結果:', { client, clientError })
    
    if (clientError) {
      console.log('❌ 客戶查詢錯誤:', clientError)
      return createErrorResponse('找不到客戶資料', 404)
    }
    
    if (!client) {
      console.log('❌ 客戶資料為空')
      return createErrorResponse('客戶資料不存在', 404)
    }
    
    // 檢查是否過期
    if (new Date(client.expires_at) < new Date()) {
      return createErrorResponse('客戶資料已過期', 403)
    }
    
    // 獲取今日補品打卡記錄
    const today = new Date().toISOString().split('T')[0]
    const { data: logs, error: logsError } = await supabase
      .from('supplement_logs')
      .select('*')
      .eq('client_id', client.id)
      .eq('date', today)
    
    if (logsError) {
      console.warn('獲取補品打卡記錄失敗:', logsError)
    }
    
    // 獲取身體數據記錄
    const { data: bodyRecords, error: bodyError } = await supabase
      .from('body_composition')
      .select('*')
      .eq('client_id', client.id)
      .order('date', { ascending: false })
    
    if (bodyError) {
      console.warn('獲取身體數據記錄失敗:', bodyError)
    }
    
    // 獲取最近 30 天的每日感受記錄
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    
    const { data: wellnessData, error: wellnessError } = await supabase
      .from('daily_wellness')
      .select('*')
      .eq('client_id', client.id)
      .gte('date', thirtyDaysAgo.toISOString().split('T')[0])
      .order('date', { ascending: false })
    
    if (wellnessError) {
      console.warn('獲取每日感受記錄失敗:', wellnessError)
    }

    // 獲取最近 30 天訓練紀錄（僅在 training_enabled 時查詢）
    let trainingLogs: any[] = []
    if (client.training_enabled) {
      const { data: trainingData, error: trainingError } = await supabase
        .from('training_logs')
        .select('*')
        .eq('client_id', client.id)
        .gte('date', thirtyDaysAgo.toISOString().split('T')[0])
        .order('date', { ascending: false })

      if (trainingError) {
        console.warn('獲取訓練紀錄失敗:', trainingError)
      } else {
        trainingLogs = trainingData || []
      }
    }

    // 獲取最近 30 天補品打卡記錄
    const { data: recentLogs, error: recentLogsError } = await supabase
      .from('supplement_logs')
      .select('*')
      .eq('client_id', client.id)
      .gte('date', thirtyDaysAgo.toISOString().split('T')[0])
      .order('date', { ascending: false })

    if (recentLogsError) {
      console.warn('獲取近期補品打卡記錄失敗:', recentLogsError)
    }

    return createSuccessResponse({
      client,
      todayLogs: logs || [],
      bodyData: bodyRecords || [],
      wellness: wellnessData || [],
      recentLogs: recentLogs || [],
      trainingLogs,
    })
    
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

    // 3. 獲取請求內容
    const body = await request.json()
    const { name, age, gender } = body
    
    // 驗證輸入
    if (!name || typeof name !== 'string' || name.length < 1 || name.length > 100) {
      return createErrorResponse('無效的姓名', 400)
    }
    
    if (!age || typeof age !== 'number' || age < 0 || age > 150) {
      return createErrorResponse('無效的年齡', 400)
    }
    
    if (!gender || !['男性', '女性', '其他'].includes(gender)) {
      return createErrorResponse('無效的性別', 400)
    }
    
    // 生成唯一代碼
    const uniqueCode = Math.random().toString(36).substring(2, 9)
    
    const { data, error } = await supabase
      .from('clients')
      .insert({
        unique_code: uniqueCode,
        name,
        age,
        gender,
        expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString() // 90天後過期
      })
      .select()
      .single()
    
    if (error) {
      return createErrorResponse('建立客戶失敗', 500)
    }
    
    return createSuccessResponse(data)
    
  } catch (error) {
    console.error('API 錯誤:', error)
    return createErrorResponse('伺服器錯誤', 500)
  }
}
