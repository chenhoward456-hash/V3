import { NextRequest, NextResponse } from 'next/server'
import { createLogger } from '@/lib/logger'
import { createServiceSupabase } from '@/lib/supabase'
import { sanitizeTextField, rateLimit, getClientIP } from '@/lib/auth-middleware'
import { validateBody } from '@/lib/schemas/validate'
import { trainingSetsSchema } from '@/lib/schemas/api'
import { getClientAccessBlock } from '@/lib/active-client'

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
 * 稽核 S-13：同時擋停用／過期帳號（原本只查碼存不存在，停用的碼照樣讀寫訓練組數）。
 * 回傳 { id } 或已組好的錯誤 response（404 找不到 / 403 停用或過期）。
 */
async function resolveClientId(uniqueCode: string): Promise<{ id: string; response?: undefined } | { id?: undefined; response: NextResponse }> {
  const { data: client, error } = await supabaseAdmin
    .from('clients')
    .select('id, is_active, expires_at')
    .eq('unique_code', uniqueCode)
    .single()

  if (error || !client) return { response: createErrorResponse('找不到客戶', 404) }
  const block = getClientAccessBlock(client)
  if (block) return { response: createErrorResponse(block.message, block.status) }
  return { id: client.id as string }
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

    const resolved = await resolveClientId(clientId)
    if (resolved.response) return resolved.response
    const resolvedId = resolved.id

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

    // 3) 每個動作各自的「上次」
    //    同一個分化可能排兩天（例：拉A 背厚度 / 拉B 背寬度），只看 lastSameType
    //    會抓到另一天的動作清單與重量。改成逐動作找它自己的上一次紀錄。
    const sinceDate = new Date(date + 'T00:00:00Z')
    sinceDate.setUTCDate(sinceDate.getUTCDate() - 120)
    const sinceStr = sinceDate.toISOString().slice(0, 10)

    const { data: recentSets, error: recentError } = await supabaseAdmin
      .from('training_sets')
      .select('exercise_name, muscle_group, weight, reps, rpe, is_main_lift, date, set_number')
      .eq('client_id', resolvedId)
      .lt('date', date)
      .gte('date', sinceStr)
      .order('date', { ascending: false })
      .order('set_number', { ascending: true })

    if (recentError) {
      logger.warn('lastByExercise query failed', { message: recentError.message, code: recentError.code })
    }

    const lastByExercise: Record<string, {
      exercise_name: string
      muscle_group: string | null
      date: string
      weight: number | null
      reps: number | null
      num_sets: number
    }> = {}

    for (const s of recentSets ?? []) {
      const key = s.exercise_name as string
      const existing = lastByExercise[key]
      if (!existing) {
        // rows 已按日期新到舊排序 → 第一次遇到的就是最近一次
        lastByExercise[key] = {
          exercise_name: key,
          muscle_group: (s.muscle_group as string) ?? null,
          date: s.date as string,
          weight: s.weight as number | null,
          reps: s.reps as number | null,
          num_sets: 1,
        }
      } else if (existing.date === s.date) {
        existing.num_sets += 1   // 同一天的其他組 → 累加組數
      }
      // 更舊日期的同名動作直接忽略
    }

    return createSuccessResponse({
      client_id: resolvedId,
      date,
      sets: todaySets ?? [],
      lastSameType: {
        date: lastSameTypeDate,
        sets: lastSameTypeSets,
      },
      lastByExercise,
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

    const resolved = await resolveClientId(clientId)
    if (resolved.response) return resolved.response
    const resolvedId = resolved.id

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

    // Upsert strategy：整天覆蓋。
    // 稽核 D5：原本「先刪再 insert」不在同一交易，insert 失敗就等於當天的組全被刪光。
    // 改成：先記下舊列 id → insert 新列 → 成功後才刪舊列。insert 失敗時舊資料完整保留。
    const { data: oldRows, error: oldError } = await supabaseAdmin
      .from('training_sets')
      .select('id')
      .eq('client_id', resolvedId)
      .eq('date', date)

    if (oldError) {
      logger.error('POST training_sets read-old failed', oldError)
      return createErrorResponse('儲存訓練組數失敗（讀取舊資料）', 500)
    }
    const oldIds = (oldRows ?? []).map((r: { id: string }) => r.id)

    let inserted: unknown[] = []
    if (rows.length > 0) {
      const { data: insertedRows, error: insertError } = await supabaseAdmin
        .from('training_sets')
        .insert(rows)
        .select()

      if (insertError) {
        logger.error('POST training_sets insert failed', insertError)
        return createErrorResponse('儲存訓練組數失敗', 500)
      }
      inserted = insertedRows ?? []
    }

    if (oldIds.length > 0) {
      const { error: deleteError } = await supabaseAdmin
        .from('training_sets')
        .delete()
        .eq('client_id', resolvedId)
        .in('id', oldIds)

      if (deleteError) {
        // 新資料已寫入、舊的沒刪掉 → 會重複。回錯誤讓學員再按一次（再存一次會把兩批都換掉）。
        logger.error('POST training_sets delete-old failed', deleteError)
        return createErrorResponse('儲存訓練組數失敗（清除舊資料）', 500)
      }
    }

    // If sets array is empty, the delete above is all we need (clear the day)
    if (rows.length === 0) {
      return createSuccessResponse([], '訓練組數已清除')
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

    const resolved = await resolveClientId(clientId)
    if (resolved.response) return resolved.response
    const resolvedId = resolved.id

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
