import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminSession } from '@/lib/auth-middleware'
import { createServiceSupabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

/**
 * GET /api/assessment/list
 * 已產生的體測報告清單 —— 教練用來回答「會員到底有沒有點開」。
 *
 * 不回傳報告內容，只回傳判斷落地成效需要的欄位。
 */
export async function GET(request: NextRequest) {
  const session = request.cookies.get('admin_session')?.value
  if (!session || !verifyAdminSession(session)) {
    return NextResponse.json({ error: '未授權' }, { status: 401 })
  }

  const supabase = createServiceSupabase()
  const { data, error } = await supabase
    .from('assessments')
    .select('token, created_at, measured_at, label, view_count, first_viewed_at, last_viewed_at, revoked_at, reading')
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rows = (data ?? []).map(a => ({
    token: a.token,
    createdAt: a.created_at,
    measuredAt: a.measured_at,
    label: a.label,
    viewCount: a.view_count ?? 0,
    firstViewedAt: a.first_viewed_at,
    revoked: !!a.revoked_at,
    // 給教練認人用的最小線索（沒有姓名，所以用性別/年齡/體重）
    hint: [
      (a.reading as { gender?: string } | null)?.gender,
      (a.reading as { age?: number } | null)?.age ? `${(a.reading as { age?: number }).age}歲` : null,
      (a.reading as { weight?: number } | null)?.weight ? `${(a.reading as { weight?: number }).weight}kg` : null,
    ].filter(Boolean).join(' · '),
  }))

  const total = rows.filter(r => !r.revoked).length
  const opened = rows.filter(r => !r.revoked && r.viewCount > 0).length

  return NextResponse.json({
    success: true,
    rows,
    summary: { total, opened, openRate: total > 0 ? Math.round(opened / total * 100) : null },
  })
}
