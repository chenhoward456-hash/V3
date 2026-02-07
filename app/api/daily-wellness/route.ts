import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createAdminClient } from '@supabase/supabase-js'

// 建立管理員客戶端（使用 Service Role Key）
const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// 建立回應函數
function createErrorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
}

function createSuccessResponse(data: any, message?: string) {
  return NextResponse.json({ 
    success: true, 
    data, 
    ...(message && { message })
  })
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const clientId = searchParams.get('clientId')
    const date = searchParams.get('date')
    
    console.log('🔍 API GET /api/daily-wellness - clientId:', clientId, 'date:', date)
    
    if (!clientId || !date) {
      console.log('❌ 缺少客戶 ID 或日期')
      return createErrorResponse('缺少客戶 ID 或日期', 400)
    }
    
    // 根據 unique_code 查詢客戶 ID
    const { data: client, error: clientError } = await supabaseAdmin
      .from('clients')
      .select('id')
      .eq('unique_code', clientId)
      .single()
    
    if (clientError || !client) {
      console.log('❌ 找不到客戶')
      return createErrorResponse('找不到客戶', 404)
    }
    
    // 查詢當日感受
    console.log('🔍 開始查詢當日感受...')
    const { data: wellness, error: wellnessError } = await supabaseAdmin
      .from('daily_wellness')
      .select('*')
      .eq('client_id', client.id)
      .eq('date', date)
      .maybeSingle() // 使用 maybeSingle() 而不是 single()
    
    console.log('📊 查詢結果:', { wellness, wellnessError })
    
    if (wellnessError) {
      console.log('❌ 當日感受查詢錯誤:', wellnessError)
      return createErrorResponse('查詢當日感受失敗', 500)
    }
    
    if (!wellness) {
      console.log('📄 當日感受為空，返回預設值')
      return createSuccessResponse({
        client_id: client.id,
        date,
        sleep_quality: null,
        energy_level: null,
        mood: null,
        note: null
      }, '當日感受尚未記錄')
    }
    
    console.log('✅ 成功取得當日感受')
    return createSuccessResponse(wellness)
    
  } catch (error) {
    console.error('❌ API 錯誤:', error)
    return createErrorResponse('伺服器錯誤', 500)
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { clientId, date, sleep_quality, energy_level, mood, note } = body
    
    console.log('🔍 API POST /api/daily-wellness - clientId:', clientId, 'date:', date)
    
    if (!clientId || !date) {
      console.log('❌ 缺少客戶 ID 或日期')
      return createErrorResponse('缺少客戶 ID 或日期', 400)
    }
    
    // 驗證分數範圍
    if (sleep_quality !== null && (sleep_quality < 1 || sleep_quality > 5)) {
      return createErrorResponse('睡眠品質分數必須在 1-5 之間', 400)
    }
    
    if (energy_level !== null && (energy_level < 1 || energy_level > 5)) {
      return createErrorResponse('能量水平分數必須在 1-5 之間', 400)
    }
    
    if (mood !== null && (mood < 1 || mood > 5)) {
      return createErrorResponse('心情分數必須在 1-5 之間', 400)
    }
    
    // 根據 unique_code 查詢客戶 ID
    const { data: client, error: clientError } = await supabaseAdmin
      .from('clients')
      .select('id')
      .eq('unique_code', clientId)
      .single()
    
    if (clientError || !client) {
      console.log('❌ 找不到客戶')
      return createErrorResponse('找不到客戶', 404)
    }
    
    // Upsert 當日感受
    console.log('🔍 開始新增/更新當日感受...')
    const { data: wellness, error: wellnessError } = await supabaseAdmin
      .from('daily_wellness')
      .upsert({
        client_id: client.id,
        date,
        sleep_quality,
        energy_level,
        mood,
        note
      }, {
        onConflict: 'client_id,date'
      })
      .select()
      .single()
    
    console.log('📊 Upsert 結果:', { wellness, wellnessError })
    
    if (wellnessError) {
      console.log('❌ 當日感受 Upsert 錯誤:', wellnessError)
      return createErrorResponse('新增/更新當日感受失敗', 500)
    }
    
    console.log('✅ 成功新增/更新當日感受')
    return createSuccessResponse(wellness, '當日感受已記錄')
    
  } catch (error) {
    console.error('❌ API 錯誤:', error)
    return createErrorResponse('伺服器錯誤', 500)
  }
}
