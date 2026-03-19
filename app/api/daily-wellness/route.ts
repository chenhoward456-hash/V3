import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase'
import { sanitizeTextField, rateLimit, getClientIP } from '@/lib/auth-middleware'

// 建立管理員客戶端（使用 Service Role Key）
const supabaseAdmin = createServiceSupabase()

// 建立回應函數
function createErrorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
}

function createSuccessResponse(data: unknown, message?: string) {
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
  const ip = getClientIP(request)
  const { allowed } = await rateLimit(`wellness:${ip}`, 30, 60_000)
  if (!allowed) return NextResponse.json({ error: '請求過於頻繁，請稍後再試' }, { status: 429 })

  try {
    const body = await request.json()
    const { clientId, date, sleep_quality, energy_level, mood, note, training_drive, cognitive_clarity, stress_level, period_start, resting_hr, hrv, wearable_sleep_score, respiratory_rate, device_recovery_score } = body

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

    if (training_drive != null && (training_drive < 1 || training_drive > 5)) {
      return createErrorResponse('訓練慾望分數必須在 1-5 之間', 400)
    }
    if (cognitive_clarity != null && (cognitive_clarity < 1 || cognitive_clarity > 5)) {
      return createErrorResponse('認知清晰度分數必須在 1-5 之間', 400)
    }
    if (stress_level != null && (stress_level < 1 || stress_level > 5)) {
      return createErrorResponse('壓力指數分數必須在 1-5 之間', 400)
    }

    // 驗證穿戴裝置生理指標
    if (resting_hr != null && (resting_hr < 30 || resting_hr > 150)) {
      return createErrorResponse('靜息心率必須在 30-150 bpm 之間', 400)
    }
    if (hrv != null && (hrv < 0 || hrv > 300)) {
      return createErrorResponse('HRV 必須在 0-300 ms 之間', 400)
    }
    if (wearable_sleep_score != null && (wearable_sleep_score < 0 || wearable_sleep_score > 100)) {
      return createErrorResponse('睡眠分數必須在 0-100 之間', 400)
    }
    if (respiratory_rate != null && (respiratory_rate < 5 || respiratory_rate > 40)) {
      return createErrorResponse('呼吸速率必須在 5-40 次/分之間', 400)
    }
    if (device_recovery_score != null && (device_recovery_score < 0 || device_recovery_score > 100)) {
      return createErrorResponse('裝置恢復分數必須在 0-100 之間', 400)
    }

    // 清理 note 欄位
    const sanitizedNote = sanitizeTextField(note)

    // 根據 unique_code 查詢客戶 ID
    const { data: client, error: clientError } = await supabaseAdmin
      .from('clients')
      .select('id, is_active, expires_at')
      .eq('unique_code', clientId)
      .single()

    if (clientError || !client) {
      return createErrorResponse('找不到客戶', 404)
    }

    if (client.is_active === false) {
      return createErrorResponse('帳號已暫停', 403)
    }
    if (client.expires_at && new Date(client.expires_at) < new Date()) {
      return createErrorResponse('帳號已過期', 403)
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
        hunger: null,
        digestion: null,
        training_drive: training_drive ?? null,
        cognitive_clarity: cognitive_clarity ?? null,
        stress_level: stress_level ?? null,
        period_start: period_start || false,
        resting_hr: resting_hr ?? null,
        hrv: hrv ?? null,
        wearable_sleep_score: wearable_sleep_score ?? null,
        respiratory_rate: respiratory_rate ?? null,
        device_recovery_score: device_recovery_score ?? null,
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
