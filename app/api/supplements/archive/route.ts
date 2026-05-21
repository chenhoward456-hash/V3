import { NextRequest } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase'
import {
  verifyCoachAuth,
  createErrorResponse,
  createSuccessResponse,
  sanitizeTextField,
} from '@/lib/auth-middleware'

const supabase = createServiceSupabase()

/**
 * POST /api/supplements/archive
 * 教練專用：把一個補品標為「封存」（停止），可選填 reason + 取代它的新補品 id。
 *
 * body: {
 *   supplementId: string (UUID),
 *   reason?: string,
 *   replacedById?: string (UUID),
 *   archivedAt?: string (YYYY-MM-DD, 預設今天)
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const { authorized, error: authError } = await verifyCoachAuth(request)
    if (!authorized) {
      return createErrorResponse(authError || '權限不足', 403)
    }

    const body = await request.json()
    const { supplementId, reason, replacedById, archivedAt } = body
    if (!supplementId) {
      return createErrorResponse('缺少 supplementId', 400)
    }

    const archiveDate =
      archivedAt && /^\d{4}-\d{2}-\d{2}$/.test(archivedAt)
        ? archivedAt
        : new Date().toISOString().slice(0, 10)

    // 驗證 replacedById 存在且 belongs to 同一個 client
    let validReplaceId: string | null = null
    if (replacedById) {
      const { data: target } = await supabase
        .from('supplements')
        .select('id, client_id')
        .eq('id', replacedById)
        .maybeSingle()
      if (target?.id) {
        validReplaceId = target.id
      }
    }

    const update: Record<string, unknown> = {
      archived_at: archiveDate,
      archive_reason: sanitizeTextField(reason, 500),
    }
    if (validReplaceId) update.replaced_by_id = validReplaceId

    const { data, error } = await supabase
      .from('supplements')
      .update(update)
      .eq('id', supplementId)
      .select()
      .single()

    if (error) {
      console.error('[supplements/archive] error:', error)
      return createErrorResponse('封存失敗', 500)
    }

    return createSuccessResponse(data)
  } catch (err) {
    console.error('[supplements/archive] exception:', err)
    return createErrorResponse('伺服器錯誤', 500)
  }
}

/**
 * DELETE /api/supplements/archive?supplementId=xxx
 * 取消封存（reactivate）— 設回 archived_at = NULL。
 */
export async function DELETE(request: NextRequest) {
  try {
    const { authorized, error: authError } = await verifyCoachAuth(request)
    if (!authorized) {
      return createErrorResponse(authError || '權限不足', 403)
    }

    const { searchParams } = new URL(request.url)
    const supplementId = searchParams.get('supplementId')
    if (!supplementId) return createErrorResponse('缺少 supplementId', 400)

    const { data, error } = await supabase
      .from('supplements')
      .update({
        archived_at: null,
        archive_reason: null,
        replaced_by_id: null,
      })
      .eq('id', supplementId)
      .select()
      .single()

    if (error) {
      return createErrorResponse('還原失敗', 500)
    }

    return createSuccessResponse(data)
  } catch (err) {
    return createErrorResponse('伺服器錯誤', 500)
  }
}
