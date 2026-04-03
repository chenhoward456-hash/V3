import { NextRequest, NextResponse } from 'next/server'
import { createLogger } from '@/lib/logger'
import { createServiceSupabase } from '@/lib/supabase'
import { sanitizeTextField, rateLimit, getClientIP } from '@/lib/auth-middleware'
import { validateBody } from '@/lib/schemas/validate'
import { trainingSetsSchema } from '@/lib/schemas/api'

const logger = createLogger('api-training-sets')
const supabaseAdmin = createServiceSupabase()

function createErrorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
}

function createSuccessResponse(data: Record<string, unknown> | unknown[] | null, message?: string) {
  return NextResponse.json({
    success: true,
    data,
    ...(message && { message })
  })
}

/**
 * Look up a client's internal ID by their unique_code.
 * Returns the UUID or null if not found.
 */
async function resolveClientId(uniqueCode: string): Promise<string | null> {
  const { data: client, error } = await supabaseAdmin
    .from('clients')
    .select('id')
    .eq('unique_code', uniqueCode)
    .single()

  if (error || !client) return null
  return client.id as string
}

// ─────────────────────────────────────────────
// GET /api/training-sets?clientId=xxx&date=2026-04-03&trainingType=push
// ─────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const ip = getClientIP(request)
  const { allowed } = await rateLimit(`training-sets-get:${ip}`, 20, 60_000)
  if (!allowed) return createErrorResponse('請求過於頻繁，請稍後再試', 429)

  try {
    const { searchParams } = new URL(request.url)
    const clientId = searchParams.get('clientId')
    const date = searchParams.get('date')
    const trainingType = searchParams.get('trainingType')

    if (!clientId || !date) {
      return createErrorResponse('缺少客戶 ID 或日期', 400)
    }

    const resolvedId = await resolveClientId(clientId)
    if (!resolvedId) {
      return createErrorResponse('找不到客戶', 404)
    }

    // 1) Fetch today's training sets
    const { data: todaySets, error: todayError } = await supabaseAdmin
      .from('training_sets')
      .select('*')
      .eq('client_id', resolvedId)
      .eq('date', date)
      .order('set_number', { ascending: true })

    if (todayError) {
      logger.error('GET training_sets query failed', todayError)
      return createErrorResponse('查詢訓練組數失敗', 500)
    }

    // 2) "Last same type" lookup — only when trainingType is provided
    let lastSameTypeSets: typeof todaySets = []
    let lastSameTypeDate: string | null = null

    if (trainingType) {
      // Find the most recent training_log of the same type that is NOT the current date
      const { data: lastLog, error: lastLogError } = await supabaseAdmin
        .from('training_logs')
        .select('date')
        .eq('client_id', resolvedId)
        .eq('training_type', trainingType)
        .lt('date', date)
        .order('date', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (lastLogError) {
        logger.warn('Last same-type log query failed', { message: lastLogError.message, code: lastLogError.code })
        // Non-fatal — continue without last sets
      }

      if (lastLog) {
        lastSameTypeDate = lastLog.date as string

        const { data: prevSets, error: prevError } = await supabaseAdmin
          .from('training_sets')
          .select('*')
          .eq('client_id', resolvedId)
          .eq('date', lastSameTypeDate)
          .order('set_number', { ascending: true })

        if (prevError) {
          logger.warn('Last same-type sets query failed', { message: prevError.message, code: prevError.code })
        } else {
          lastSameTypeSets = prevSets ?? []
        }
      }
    }

    return createSuccessResponse({
      client_id: resolvedId,
      date,
      sets: todaySets ?? [],
      lastSameType: {
        date: lastSameTypeDate,
        sets: lastSameTypeSets,
      },
    })

  } catch (error) {
    logger.error('GET /api/training-sets unexpected error', error)
    return createErrorResponse('伺服器錯誤', 500)
  }
}

// ─────────────────────────────────────────────
// POST /api/training-sets  (upsert — delete + insert)
// ─────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const ip = getClientIP(request)
  const { allowed } = await rateLimit(`training-sets-post:${ip}`, 10, 60_000)
  if (!allowed) return createErrorResponse('請求過於頻繁，請稍後再試', 429)

  try {
    const body = await request.json()
    const parsed = validateBody(trainingSetsSchema, body)
    if (!parsed.success) return parsed.response

    const { clientId, date, sets } = parsed.data

    const resolvedId = await resolveClientId(clientId)
    if (!resolvedId) {
      return createErrorResponse('找不到客戶', 404)
    }

    // Sanitize note fields
    const rows = sets.map((s) => ({
      client_id: resolvedId,
      date,
      exercise_name: s.exercise_name,
      muscle_group: s.muscle_group ?? null,
      set_number: s.set_number,
      weight: s.weight ?? null,
      reps: s.reps ?? null,
      rpe: s.rpe ?? null,
      is_main_lift: s.is_main_lift ?? false,
      note: sanitizeTextField(s.note ?? null),
    }))

    // Upsert strategy: delete all existing rows for this client+date, then bulk insert
    const { error: deleteError } = await supabaseAdmin
      .from('training_sets')
      .delete()
      .eq('client_id', resolvedId)
      .eq('date', date)

    if (deleteError) {
      logger.error('POST training_sets delete failed', deleteError)
      return createErrorResponse('儲存訓練組數失敗（清除舊資料）', 500)
    }

    // If sets array is empty, the delete above is all we need (clear the day)
    if (rows.length === 0) {
      return createSuccessResponse([], '訓練組數已清除')
    }

    const { data: inserted, error: insertError } = await supabaseAdmin
      .from('training_sets')
      .insert(rows)
      .select()

    if (insertError) {
      logger.error('POST training_sets insert failed', insertError)
      return createErrorResponse('儲存訓練組數失敗', 500)
    }

    return createSuccessResponse(inserted as Record<string, unknown>[], '訓練組數已儲存')

  } catch (error) {
    logger.error('POST /api/training-sets unexpected error', error)
    return createErrorResponse('伺服器錯誤', 500)
  }
}

// ─────────────────────────────────────────────
// DELETE /api/training-sets?clientId=xxx&date=2026-04-03
// ─────────────────────────────────────────────
export async function DELETE(request: NextRequest) {
  const ip = getClientIP(request)
  const { allowed } = await rateLimit(`training-sets-del:${ip}`, 10, 60_000)
  if (!allowed) return createErrorResponse('請求過於頻繁，請稍後再試', 429)

  try {
    const { searchParams } = new URL(request.url)
    const clientId = searchParams.get('clientId')
    const date = searchParams.get('date')

    if (!clientId || !date) {
      return createErrorResponse('缺少客戶 ID 或日期', 400)
    }

    const resolvedId = await resolveClientId(clientId)
    if (!resolvedId) {
      return createErrorResponse('找不到客戶', 404)
    }

    const { error: deleteError, count } = await supabaseAdmin
      .from('training_sets')
      .delete({ count: 'exact' })
      .eq('client_id', resolvedId)
      .eq('date', date)

    if (deleteError) {
      logger.error('DELETE training_sets failed', deleteError)
      return createErrorResponse('刪除訓練組數失敗', 500)
    }

    return createSuccessResponse(
      { deleted: count ?? 0 },
      '訓練組數已刪除'
    )

  } catch (error) {
    logger.error('DELETE /api/training-sets unexpected error', error)
    return createErrorResponse('伺服器錯誤', 500)
  }
}
