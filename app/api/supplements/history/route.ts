import { NextRequest } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase'
import { createErrorResponse, createSuccessResponse } from '@/lib/auth-middleware'
import { resolveActiveClient } from '@/lib/active-client'

export const dynamic = 'force-dynamic'

const supabase = createServiceSupabase()

/**
 * GET /api/supplements/history?clientId=<unique_code>
 * 學員可公開讀取自己完整的補品歷史（含已封存）
 * 用於學員端「目前 protocol」+「過去 protocol」timeline
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const clientId = searchParams.get('clientId')
    if (!clientId) {
      return createErrorResponse('缺少 clientId', 400)
    }

    // 稽核 S-13：停用／過期帳號的碼不可再讀（後台封存補品清單走教練 cookie 可略過）
    const resolved = await resolveActiveClient(supabase, clientId, { request })
    if (resolved.response) return resolved.response
    const client = resolved.client

    const { data, error } = await supabase
      .from('supplements')
      .select(`
        id, name, dosage, timing, why, sort_order,
        started_at, archived_at, archive_reason, replaced_by_id,
        coach_rationale, mode_context, created_at
      `)
      .eq('client_id', client.id)
      .order('archived_at', { ascending: true, nullsFirst: true })  // null (active) 先
      .order('started_at', { ascending: false })

    if (error) {
      return createErrorResponse('讀取失敗', 500)
    }

    const all = data || []
    const active = all.filter(s => s.archived_at === null)
    const archived = all.filter(s => s.archived_at !== null)

    return createSuccessResponse({ active, archived, all })
  } catch (err) {
    console.error('[supplements/history] exception:', err)
    return createErrorResponse('伺服器錯誤', 500)
  }
}
