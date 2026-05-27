import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminSession } from '@/lib/auth-middleware'
import { createServiceSupabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
const supabase = createServiceSupabase()

function checkAuth(request: NextRequest): boolean {
  const token = request.cookies.get('admin_session')?.value
  return !!token && verifyAdminSession(token)
}

// GET: list pending proposals
export async function GET(request: NextRequest) {
  if (!checkAuth(request)) return NextResponse.json({ error: '未授權' }, { status: 401 })

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
export async function POST(request: NextRequest) {
  if (!checkAuth(request)) return NextResponse.json({ error: '未授權' }, { status: 401 })

  try {
    const body = await request.json()
    const { proposal_id, action, review_note } = body

    if (!proposal_id || !action) return NextResponse.json({ error: '缺少 proposal_id 或 action' }, { status: 400 })
    if (!['approve', 'reject', 'discuss'].includes(action)) {
      return NextResponse.json({ error: 'action 必須是 approve/reject/discuss' }, { status: 400 })
    }

    const { data: proposal, error: fetchErr } = await supabase
      .from('pending_proposals')
      .select('*')
      .eq('id', proposal_id)
      .single()

    if (fetchErr || !proposal) return NextResponse.json({ error: '找不到提案' }, { status: 404 })
    if (proposal.status !== 'pending') {
      return NextResponse.json({ error: `提案已是 ${proposal.status} 狀態，無法再處理` }, { status: 400 })
    }

    const now = new Date().toISOString()

    if (action === 'reject' || action === 'discuss') {
      const newStatus = action === 'reject' ? 'rejected' : 'discussing'
      await supabase
        .from('pending_proposals')
        .update({ status: newStatus, reviewed_by: 'coach', reviewed_at: now, review_note: review_note ?? null })
        .eq('id', proposal_id)
      return NextResponse.json({ success: true, status: newStatus })
    }

    // 兩種 proposal type 分別處理：personal_note 寫進 personal_notes、其他寫進 clients + log
    if (proposal.proposal_type === 'personal_note') {
      const ch = (proposal.proposed_changes ?? {}) as any
      const { error: insErr } = await supabase.from('personal_notes').insert({
        client_id: proposal.client_id,
        added_by: 'ai_agent',
        category: ch.category,
        note: ch.note,
        weight: ch.weight ?? 5,
        relevant_until: ch.relevant_until ?? null,
        source_proposal_id: proposal.id,
      })
      if (insErr) return NextResponse.json({ error: 'personal_notes 寫入失敗: ' + insErr.message }, { status: 500 })

      await supabase
        .from('pending_proposals')
        .update({
          status: 'approved',
          reviewed_by: 'coach',
          reviewed_at: now,
          review_note: review_note ?? null,
        })
        .eq('id', proposal_id)
      return NextResponse.json({ success: true, status: 'approved', type: 'personal_note' })
    }

    // approve: apply changes + write to macro_adjustment_log + update clients
    const changes = proposal.proposed_changes as Record<string, number>
    const clientUpdates: Record<string, any> = { last_auto_adjust_at: now }
    const trackedFields = ['calories_target', 'protein_target', 'carbs_target', 'fat_target', 'carbs_training_day', 'carbs_rest_day', 'cardio_minutes_per_day']
    for (const f of trackedFields) {
      if (changes[f] != null) clientUpdates[f] = changes[f]
    }

    if (Object.keys(clientUpdates).length > 1) {
      const { error: updErr } = await supabase
        .from('clients')
        .update(clientUpdates)
        .eq('id', proposal.client_id)
      if (updErr) return NextResponse.json({ error: 'apply clients 失敗: ' + updErr.message }, { status: 500 })
    }

    const { data: logRow, error: logErr } = await supabase
      .from('macro_adjustment_log')
      .insert({
        client_id: proposal.client_id,
        applied_by: 'coach',
        trigger_source: 'manual',
        old_macros: proposal.current_state,
        new_macros: proposal.proposed_changes,
        reason: `AI 提案教練核准：${proposal.reasoning}` + (review_note ? `\n[教練註記] ${review_note}` : ''),
        trajectory_data: { ai_proposal_id: proposal.id, ...((proposal.trajectory_data as any) ?? {}) },
      })
      .select()
      .single()

    await supabase
      .from('pending_proposals')
      .update({
        status: 'approved',
        reviewed_by: 'coach',
        reviewed_at: now,
        review_note: review_note ?? null,
        applied_log_id: logRow?.id ?? null,
      })
      .eq('id', proposal_id)

    return NextResponse.json({ success: true, status: 'approved', applied_log_id: logRow?.id ?? null })
  } catch (err) {
    console.error('[proposals POST] error:', err)
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
