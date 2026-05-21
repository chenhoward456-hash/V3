import { NextRequest } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase'
import {
  verifyCoachAuth,
  createErrorResponse,
  createSuccessResponse,
} from '@/lib/auth-middleware'

export const dynamic = 'force-dynamic'

const supabase = createServiceSupabase()

/**
 * GET /api/admin/ai-audit/pending
 * 回傳「待教練審核的 auto-draft」數量 + 最新幾筆預覽
 * 用於 admin header 的紅點通知
 */
export async function GET(request: NextRequest) {
  try {
    const { authorized, error: authError } = await verifyCoachAuth(request)
    if (!authorized) return createErrorResponse(authError || '權限不足', 403)

    // 未審核 = coach_saved_at NULL + 未被新版本取代 + source = auto_after_upload
    const { data, error, count } = await supabase
      .from('ai_draft_audit')
      .select(`
        id, client_id, panel_date, findings_count, trigger_lab_count, created_at,
        clients!ai_draft_audit_client_id_fkey ( name, unique_code )
      `, { count: 'exact' })
      .eq('source', 'auto_after_upload')
      .is('coach_saved_at', null)
      .is('superseded_by_id', null)
      .order('created_at', { ascending: false })
      .limit(10)

    if (error) {
      console.error('[ai-audit/pending] error:', error)
      return createErrorResponse('讀取失敗', 500)
    }

    type Row = {
      id: string
      client_id: string
      panel_date: string
      findings_count: number | null
      trigger_lab_count: number | null
      created_at: string
      clients: { name?: string; unique_code?: string } | null
    }

    const items = (data as Row[] | null ?? []).map(r => ({
      id: r.id,
      client_id: r.client_id,
      client_name: r.clients?.name ?? '(未知)',
      client_unique_code: r.clients?.unique_code ?? null,
      panel_date: r.panel_date,
      findings_count: r.findings_count,
      trigger_lab_count: r.trigger_lab_count,
      created_at: r.created_at,
    }))

    return createSuccessResponse({ count: count ?? items.length, items })
  } catch (err) {
    console.error('[ai-audit/pending] exception:', err)
    return createErrorResponse('伺服器錯誤', 500)
  }
}
