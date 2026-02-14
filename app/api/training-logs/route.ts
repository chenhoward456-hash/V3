import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sanitizeTextField, validateNumericField } from '@/lib/auth-middleware'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

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

const VALID_TRAINING_TYPES = ['push', 'pull', 'legs', 'full_body', 'cardio', 'rest', 'chest', 'shoulder', 'arms']

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const clientId = searchParams.get('clientId')
    const date = searchParams.get('date')

    if (!clientId || !date) {
      return createErrorResponse('缺少客戶 ID 或日期', 400)
    }

    const { data: client, error: clientError } = await supabaseAdmin
      .from('clients')
      .select('id')
      .eq('unique_code', clientId)
      .single()

    if (clientError || !client) {
      return createErrorResponse('找不到客戶', 404)
    }

    const { data: training, error: trainingError } = await supabaseAdmin
      .from('training_logs')
      .select('*')
      .eq('client_id', client.id)
      .eq('date', date)
      .maybeSingle()

    if (trainingError) {
      return createErrorResponse('查詢訓練紀錄失敗', 500)
    }

    if (!training) {
      return createSuccessResponse({
        client_id: client.id,
        date,
        training_type: null,
        duration: null,
        rpe: null,
        note: null
      }, '當日訓練尚未記錄')
    }

    return createSuccessResponse(training)

  } catch (error) {
    return createErrorResponse('伺服器錯誤', 500)
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { clientId, date, training_type, duration, sets, rpe, note } = body

    if (!clientId || !date) {
      return createErrorResponse('缺少客戶 ID 或日期', 400)
    }

    if (!training_type || !VALID_TRAINING_TYPES.includes(training_type)) {
      return createErrorResponse('訓練類型無效', 400)
    }

    if (training_type !== 'rest') {
      if (duration == null || duration <= 0) {
        return createErrorResponse('訓練時長必須大於 0', 400)
      }
      if (rpe == null || rpe < 1 || rpe > 10) {
        return createErrorResponse('RPE 必須在 1-10 之間', 400)
      }
    }

    // 驗證 sets 欄位
    const setsValidation = validateNumericField(sets, 0, 100, 'sets')
    if (!setsValidation.isValid) {
      return createErrorResponse(setsValidation.error, 400)
    }

    // 清理 note 欄位
    const sanitizedNote = sanitizeTextField(note)

    const { data: client, error: clientError } = await supabaseAdmin
      .from('clients')
      .select('id')
      .eq('unique_code', clientId)
      .single()

    if (clientError || !client) {
      return createErrorResponse('找不到客戶', 404)
    }

    const upsertData: any = {
      client_id: client.id,
      date,
      training_type,
      note: sanitizedNote,
    }

    if (training_type === 'rest') {
      upsertData.duration = null
      upsertData.sets = null
      upsertData.rpe = null
    } else {
      upsertData.duration = duration
      upsertData.sets = sets || null
      upsertData.rpe = rpe
    }

    const { data: training, error: trainingError } = await supabaseAdmin
      .from('training_logs')
      .upsert(upsertData, {
        onConflict: 'client_id,date'
      })
      .select()
      .single()

    if (trainingError) {
      return createErrorResponse('新增/更新訓練紀錄失敗', 500)
    }

    return createSuccessResponse(training, '訓練紀錄已記錄')

  } catch (error) {
    return createErrorResponse('伺服器錯誤', 500)
  }
}
