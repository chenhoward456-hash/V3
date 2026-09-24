import { NextRequest } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase'
import { createErrorResponse, createSuccessResponse } from '@/lib/auth-middleware'
import { resolveActiveClient } from '@/lib/active-client'

export const dynamic = 'force-dynamic'

const supabase = createServiceSupabase()

/**
 * GET /api/auto-draft-status?clientId=<unique_code>
 * 學員可公開讀取 — 回傳「教練尚未審核的 AI 草稿」資訊
 * 用於學員 timeline 顯示「🤖 AI 草稿生成中 / 教練審核中」狀態
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const clientId = searchParams.get('clientId')
    if (!clientId) return createErrorResponse('缺少 clientId', 400)

    // 稽核 S-13：停用／過期帳號的碼不可再讀
    const resolved = await resolveActiveClient(supabase, clientId, { request })
    if (resolved.response) return resolved.response
    const client = resolved.client

    // 找最近 24 小時內的 auto-draft（教練未審 + 未被新版覆蓋）
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { data, error } = await supabase
      .from('ai_draft_audit')
      .select('id, panel_date, created_at, trigger_lab_count')
      .eq('client_id', client.id)
      .eq('source', 'auto_after_upload')
      .is('coach_saved_at', null)
      .is('superseded_by_id', null)
      .gte('created_at', since)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[auto-draft-status] error:', error)
      return createErrorResponse('讀取失敗', 500)
    }

    const items = data ?? []
    return createSuccessResponse({
      pendingCount: items.length,
      panelDates: items.map(r => r.panel_date),
      latest: items[0]?.created_at ?? null,
    })
  } catch (err) {
    console.error('[auto-draft-status] exception:', err)
    return createErrorResponse('伺服器錯誤', 500)
  }
}
