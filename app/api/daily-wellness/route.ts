import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sanitizeTextField } from '@/lib/auth-middleware'

// 建立管理員客戶端（使用 Service Role Key）
const supabaseAdmin = createClient(
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

    if (!clientId || !date) {
      return createErrorResponse('缺少客戶 ID 或日期', 400)
    }

    // 根據 unique_code 查詢客戶 ID
    const { data: client, error: clientError } = await supabaseAdmin
      .from('clients')
      .select('id')
      .eq('unique_code', clientId)
      .single()

    if (clientError || !client) {
      return createErrorResponse('找不到客戶', 404)
    }

    // 查詢當日感受
    const { data: wellness, error: wellnessError } = await supabaseAdmin
      .from('daily_wellness')
      .select('*')
      .eq('client_id', client.id)
      .eq('date', date)
      .maybeSingle()

    if (wellnessError) {
      return createErrorResponse('查詢當日感受失敗', 500)
    }

    if (!wellness) {
      return createSuccessResponse({
        client_id: client.id,
        date,
        sleep_quality: null,
        energy_level: null,
        mood: null,
        note: null
      }, '當日感受尚未記錄')
    }

    return createSuccessResponse(wellness)

  } catch (error) {
    return createErrorResponse('伺服器錯誤', 500)
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { clientId, date, sleep_quality, energy_level, mood, note, hunger, digestion, training_drive } = body

    if (!clientId || !date) {
      return createErrorResponse('缺少客戶 ID 或日期', 400)
    }

    // 驗證分數範圍（使用 != null 避免 undefined 繞過驗證）
    if (sleep_quality != null && (sleep_quality < 1 || sleep_quality > 5)) {
      return createErrorResponse('睡眠品質分數必須在 1-5 之間', 400)
    }

    if (energy_level != null && (energy_level < 1 || energy_level > 5)) {
      return createErrorResponse('能量水平分數必須在 1-5 之間', 400)
    }

    if (mood != null && (mood < 1 || mood > 5)) {
      return createErrorResponse('心情分數必須在 1-5 之間', 400)
    }

    // 驗證備賽感受欄位
    if (hunger != null && (hunger < 1 || hunger > 5)) {
      return createErrorResponse('飢餓感分數必須在 1-5 之間', 400)
    }
    if (digestion != null && (digestion < 1 || digestion > 5)) {
      return createErrorResponse('消化狀況分數必須在 1-5 之間', 400)
    }
    if (training_drive != null && (training_drive < 1 || training_drive > 5)) {
      return createErrorResponse('訓練慾望分數必須在 1-5 之間', 400)
    }

    // 清理 note 欄位
    const sanitizedNote = sanitizeTextField(note)

    // 根據 unique_code 查詢客戶 ID
    const { data: client, error: clientError } = await supabaseAdmin
      .from('clients')
      .select('id')
      .eq('unique_code', clientId)
      .single()

    if (clientError || !client) {
      return createErrorResponse('找不到客戶', 404)
    }

    // Upsert 當日感受
    const { data: wellness, error: wellnessError } = await supabaseAdmin
      .from('daily_wellness')
      .upsert({
        client_id: client.id,
        date,
        sleep_quality,
        energy_level,
        mood,
        note: sanitizedNote,
        hunger: hunger ?? null,
        digestion: digestion ?? null,
        training_drive: training_drive ?? null,
      }, {
        onConflict: 'client_id,date'
      })
      .select()
      .single()

    if (wellnessError) {
      return createErrorResponse('新增/更新當日感受失敗', 500)
    }

    return createSuccessResponse(wellness, '當日感受已記錄')

  } catch (error) {
    return createErrorResponse('伺服器錯誤', 500)
  }
}
