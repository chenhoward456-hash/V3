import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminSession } from '@/lib/auth-middleware'
import { createServiceSupabase } from '@/lib/supabase'
import { actOnProposal, sweepExpiredProposals, type ProposalAction } from '@/lib/proposal-actions'

export const dynamic = 'force-dynamic'
const supabase = createServiceSupabase()

function checkAuth(request: NextRequest): boolean {
  const token = request.cookies.get('admin_session')?.value
  return !!token && verifyAdminSession(token)
}

// GET: list pending proposals
export async function GET(request: NextRequest) {
  if (!checkAuth(request)) return NextResponse.json({ error: '未授權' }, { status: 401 })

  // 先把過了 expires_at 卻還掛 pending 的掃成 expired ——
  // 沒這步，這頁的「待審」會把屍體算進去（Sean 那 10 筆就是這樣長出來的）。
  await sweepExpiredProposals(supabase)

  const { searchParams } = new URL(request.url)
  const statusFilter = searchParams.get('status') ?? 'pending'
  const clientId = searchParams.get('clientId')

  let query = supabase
    .from('pending_proposals')
    .select(`
      id, client_id, proposed_by, proposed_at, expires_at, status,
      proposal_type, current_state, proposed_changes, reasoning,
      triggering_context, safety_check_result, reviewed_by, reviewed_at, review_note,
      clients (name)
    `)
    .order('proposed_at', { ascending: false })
    .limit(50)

  if (statusFilter !== 'all') query = query.eq('status', statusFilter)
  if (clientId) query = query.eq('client_id', clientId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true, data: data ?? [] })
}

// POST: act on a proposal (approve / reject / discuss)
//
// ⚠️ 實作在 `lib/proposal-actions.ts` —— LINE 晨報的「回一個字就套用」走同一支（紅線 6）。
// 這裡只做驗證與轉譯。特別是 coach_macro_override 同步那段（2026-08-16 的坑）
// 必須只有一份，兩邊各寫一次一定有一邊會漏。
export async function POST(request: NextRequest) {
  if (!checkAuth(request)) return NextResponse.json({ error: '未授權' }, { status: 401 })

  try {
    const body = await request.json()
    const { proposal_id, action, review_note, allow_expired } = body

    if (!proposal_id || !action) return NextResponse.json({ error: '缺少 proposal_id 或 action' }, { status: 400 })
    if (!['approve', 'reject', 'discuss'].includes(action)) {
      return NextResponse.json({ error: 'action 必須是 approve/reject/discuss' }, { status: 400 })
    }

    const result = await actOnProposal(supabase, {
      proposalId: proposal_id,
      action: action as ProposalAction,
      reviewNote: review_note ?? null,
      // 後台看得到完整內容，教練勾了就讓他覆蓋過期保護
      allowExpired: allow_expired === true,
    })

    if (!result.ok) {
      const status = result.code === 'not_found' ? 404 : result.code === 'write_failed' ? 500 : 400
      return NextResponse.json({ error: result.reason, code: result.code }, { status })
    }

    return NextResponse.json({
      success: true,
      status: result.status,
      applied_log_id: result.appliedLogId ?? null,
    })
  } catch (err) {
    console.error('[proposals POST] error:', err)
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
