import { NextRequest, NextResponse } from 'next/server'
import { createLogger } from '@/lib/logger'
import { createServiceSupabase } from '@/lib/supabase'
import { sanitizeTextField, rateLimit, getClientIP } from '@/lib/auth-middleware'
import { validateBody } from '@/lib/schemas/validate'
import { trainingLogSchema } from '@/lib/schemas/api'

const logger = createLogger('api-training-logs')
const supabaseAdmin = createServiceSupabase()

function createErrorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
}

function createSuccessResponse(data: Record<string, unknown> | null, message?: string) {
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
    logger.error('GET /api/training-logs unexpected error', error)
    return createErrorResponse('伺服器錯誤', 500)
  }
}

export async function POST(request: NextRequest) {
  const ip = getClientIP(request)
  const { allowed } = await rateLimit(`training:${ip}`, 30, 60_000)
  if (!allowed) return NextResponse.json({ error: '請求過於頻繁，請稍後再試' }, { status: 429 })

  try {
    const body = await request.json()
    const parsed = validateBody(trainingLogSchema, body)
    if (!parsed.success) return parsed.response
    const { clientId, date, training_type, duration, sets, rpe, note } = parsed.data
    const compound_weight = body.compound_weight ?? null
    const compound_reps = body.compound_reps ?? null

    // Post-schema conditional validation
    if (training_type !== 'rest') {
      if (duration != null && duration <= 0) {
        return createErrorResponse('訓練時長必須大於 0', 400)
      }
      if (rpe != null && (rpe < 1 || rpe > 10)) {
        return createErrorResponse('RPE 必須在 1-10 之間', 400)
      }
    }

    // 清理 note 欄位
    const sanitizedNote = sanitizeTextField(note ?? null)

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

    // ── 恢復狀態檢查：高強度 + 恢復差 → 附帶警告 ──
    let recoveryWarning: string | null = null
    if (training_type !== 'rest' && rpe != null && rpe >= 8) {
      try {
        // 查最近 3 天 wellness（穿戴裝置 + 主觀）
        const { data: recentWellness } = await supabaseAdmin
          .from('daily_wellness')
          .select('date, energy_level, training_drive, device_recovery_score, resting_hr, hrv, wearable_sleep_score, sleep_quality')
          .eq('client_id', client.id)
          .order('date', { ascending: false })
          .limit(3)

        if (recentWellness && recentWellness.length > 0) {
          // 檢查穿戴裝置恢復分數
          const recoveryScores = recentWellness
            .filter((w: { device_recovery_score: number | null }) => w.device_recovery_score != null)
            .map((w: { device_recovery_score: number | null }) => w.device_recovery_score as number)
          const avgRecovery = recoveryScores.length > 0
            ? recoveryScores.reduce((s: number, v: number) => s + v, 0) / recoveryScores.length
            : null

          // 檢查主觀精力
          const energyScores = recentWellness
            .filter((w: { energy_level: number | null }) => w.energy_level != null)
            .map((w: { energy_level: number | null }) => w.energy_level as number)
          const avgEnergy = energyScores.length > 0
            ? energyScores.reduce((s: number, v: number) => s + v, 0) / energyScores.length
            : null

          // 檢查睡眠
          const sleepScores = recentWellness
            .filter((w: { sleep_quality: number | null }) => w.sleep_quality != null)
            .map((w: { sleep_quality: number | null }) => w.sleep_quality as number)
          const avgSleep = sleepScores.length > 0
            ? sleepScores.reduce((s: number, v: number) => s + v, 0) / sleepScores.length
            : null

          const warnings: string[] = []
          if (avgRecovery != null && avgRecovery < 35) {
            warnings.push(`裝置恢復分數偏低（${Math.round(avgRecovery)}/100）`)
          }
          if (avgEnergy != null && avgEnergy <= 2) {
            warnings.push(`近 3 天精力偏低（${avgEnergy.toFixed(1)}/5）`)
          }
          if (avgSleep != null && avgSleep <= 2) {
            warnings.push(`近 3 天睡眠品質差（${avgSleep.toFixed(1)}/5）`)
          }

          if (warnings.length > 0) {
            recoveryWarning = `⚠️ 恢復狀態不佳：${warnings.join('、')}。高強度訓練可能增加受傷風險，建議考慮降低強度。`
          }
        }
      } catch {
        // 恢復檢查失敗不影響訓練記錄
      }
    }

    const upsertData: Record<string, string | number | null> = {
      client_id: client.id,
      date,
      training_type,
      note: sanitizedNote,
    }

    if (training_type === 'rest') {
      upsertData.duration = null
      upsertData.sets = null
      upsertData.rpe = null
      upsertData.compound_weight = null
      upsertData.compound_reps = null
    } else {
      upsertData.duration = duration ?? null
      upsertData.sets = sets ?? null
      upsertData.rpe = rpe ?? null
      upsertData.compound_weight = typeof compound_weight === 'number' ? compound_weight : null
      upsertData.compound_reps = typeof compound_reps === 'number' ? compound_reps : null
    }

    const { data: training, error: trainingError } = await supabaseAdmin
      .from('training_logs')
      .upsert(upsertData, {
        onConflict: 'client_id,date'
      })
      .select()
      .single()

    if (trainingError) {
      logger.error('Upsert training_logs failed', { error: trainingError, upsertData })
      return createErrorResponse(`新增/更新訓練紀錄失敗: ${trainingError.message}`, 500)
    }

    return NextResponse.json({
      success: true,
      data: training,
      message: '訓練紀錄已記錄',
      ...(recoveryWarning && { recoveryWarning }),
    })

  } catch (error) {
    logger.error('POST /api/training-logs unexpected error', error)
    return createErrorResponse('伺服器錯誤', 500)
  }
}
