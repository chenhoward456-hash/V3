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
 * GET /api/admin/ai-audit
 * 教練後台用：列出 AI 草稿 audit log（含 AI 寫的 vs 教練改完的）
 */
export async function GET(request: NextRequest) {
  try {
    const { authorized, error: authError } = await verifyCoachAuth(request)
    if (!authorized) return createErrorResponse(authError || '權限不足', 403)

    const { searchParams } = new URL(request.url)
    const limit = Math.min(Number(searchParams.get('limit') ?? 50), 200)

    // 拉 audit + 對應的 client name
    const { data, error } = await supabase
      .from('ai_draft_audit')
      .select(`
        id, client_id, panel_date, client_mode, findings_count,
        ai_summary, ai_priorities, coach_saved_summary, coach_saved_priorities,
        model_used, created_at, coach_saved_at,
        clients!ai_draft_audit_client_id_fkey ( name, unique_code, subscription_tier )
      `)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('[admin/ai-audit] error:', error)
      return createErrorResponse('讀取失敗', 500)
    }

    type Row = {
      id: string; client_id: string; panel_date: string
      client_mode: string | null; findings_count: number | null
      ai_summary: string | null; ai_priorities: string | null
      coach_saved_summary: string | null; coach_saved_priorities: string | null
      model_used: string | null; created_at: string; coach_saved_at: string | null
      clients: { name?: string; unique_code?: string; subscription_tier?: string } | null
    }

    // 計算「教練改了多少」(粗略：字數差 + 字元 diff 比例)
    const enriched = (data as Row[] | null ?? []).map(r => {
      const aiSum = r.ai_summary ?? ''
      const csSum = r.coach_saved_summary ?? ''
      const aiPri = r.ai_priorities ?? ''
      const csPri = r.coach_saved_priorities ?? ''

      const saved = !!r.coach_saved_at
      // diff 估算：教練最終總字數 - AI 寫的總字數
      const aiTotal = aiSum.length + aiPri.length
      const csTotal = csSum.length + csPri.length
      const sizeDelta = csTotal - aiTotal
      const sizeRatio = aiTotal > 0 ? csTotal / aiTotal : null

      return {
        id: r.id,
        client: {
          id: r.client_id,
          name: r.clients?.name ?? '(未知)',
          unique_code: r.clients?.unique_code ?? null,
          subscription_tier: r.clients?.subscription_tier ?? null,
        },
        panel_date: r.panel_date,
        client_mode: r.client_mode,
        findings_count: r.findings_count,
        model_used: r.model_used,
        created_at: r.created_at,
        coach_saved_at: r.coach_saved_at,
        saved,
        ai: { summary: aiSum, priorities: aiPri, total_chars: aiTotal },
        coach: saved ? { summary: csSum, priorities: csPri, total_chars: csTotal } : null,
        diff: saved
          ? { size_delta: sizeDelta, size_ratio: sizeRatio }
          : null,
      }
    })

    // 摘要統計
    const total = enriched.length
    const saved = enriched.filter(e => e.saved).length
    const totalAiChars = enriched.reduce((s, e) => s + e.ai.total_chars, 0)
    const totalCoachChars = enriched.filter(e => e.coach).reduce((s, e) => s + (e.coach?.total_chars ?? 0), 0)

    return createSuccessResponse({
      counts: { total, saved, pending: total - saved },
      avg_chars: {
        ai: total > 0 ? Math.round(totalAiChars / total) : 0,
        coach: saved > 0 ? Math.round(totalCoachChars / saved) : 0,
      },
      entries: enriched,
    })
  } catch (err) {
    console.error('[admin/ai-audit] exception:', err)
    return createErrorResponse('伺服器錯誤', 500)
  }
}
