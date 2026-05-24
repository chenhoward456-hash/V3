import { NextRequest } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase'
import { createErrorResponse, createSuccessResponse } from '@/lib/auth-middleware'

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

    const { data: client } = await supabase
      .from('clients')
      .select('id')
      .eq('unique_code', clientId)
      .maybeSingle<{ id: string }>()

    if (!client) return createErrorResponse('找不到客戶', 404)

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
