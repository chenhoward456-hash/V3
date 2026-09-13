/**
 * 提案佇列：套用／退掉／掃過期。
 *
 * ## 為什麼抽出來（2026-09-14）
 *
 * 批准邏輯原本只活在 `app/api/admin/proposals/route.ts` 裡，而那條路只有
 * **開後台**才走得到。Howard 不開後台（他的原話：「我都懶得開」），於是：
 *
 *   `pending_proposals` 有 **10 筆 pending，全是 Sean，8/24–9/05**，一筆都沒被處理。
 *
 * 要讓晨報能「回一個字就套用」，這段邏輯必須被 LINE 也叫得到。
 * 它不是搬家就好的東西 —— 裡面有 `coach_macro_override` 同步那個坑
 * （2026-08-16 修的：核准後若 override 還鎖著舊值，nutrition-suggestions 下次會把
 * 教練剛核准的調整默默還原回去）。重寫一份必定漏掉它，所以是抽出來共用，不是複製。
 *
 * ## 順手修掉兩個讓那 10 筆長出來的 bug
 *
 * 1. **沒有任何東西把過期提案掃掉。** `expires_at` 有預設 24h，但沒有 sweeper ——
 *    那 10 筆**全部都已經過了 expires_at**，卻還掛在 `status='pending'`。
 *    `/admin` 顯示「10 筆待審」其實全是屍體。→ `sweepExpiredProposals()`
 *
 * 2. **cron 的去重只看「24 小時內有沒有 pending」**（`.gte(proposed_at, now-24h)`）。
 *    25 小時前那筆擋不住今天這筆 → 每天長一筆。
 *    掃過期之後，「還是 pending」＝「還有效」，去重改看這個就對了。
 *
 * ## ⚠️ 那 10 筆為什麼不能直接批准（Sean 的實例）
 *
 * 每一筆的 `current_state` 都是 2250，因為前一筆從來沒被套用 ——
 * 它們不是連續調整，是**同一個決定被重算了十次**（砍到 1830／1780／1890／2000…）。
 * 連續批准兩筆＝疊加砍兩次。
 * 而且那段期間 Sean 的飲食紀錄 **0 筆有熱量**（2026-09-12 修好的 LINE 缺口），
 * 引擎只看得到體重曲線。所以是**壞輸入算出來的提案**，該作廢重算，不是照單全收。
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export type ProposalAction = 'approve' | 'reject' | 'discuss'

export type ProposalRow = {
  id: string
  client_id: string
  proposed_by: string | null
  proposed_at: string
  expires_at: string | null
  status: string
  proposal_type: string
  current_state: Record<string, unknown> | null
  proposed_changes: Record<string, unknown> | null
  reasoning: string | null
  trajectory_data?: Record<string, unknown> | null
}

/** 批准時會寫回 clients 的欄位 */
const TRACKED_FIELDS = [
  'calories_target', 'protein_target', 'carbs_target', 'fat_target',
  'carbs_training_day', 'carbs_rest_day', 'cardio_minutes_per_day',
] as const

/** 沒設 expires_at 時，幾天後視為過期 */
export const DEFAULT_TTL_DAYS = 3

export function isProposalExpired(p: Pick<ProposalRow, 'expires_at' | 'proposed_at'>, now = new Date()): boolean {
  if (p.expires_at) return new Date(p.expires_at).getTime() < now.getTime()
  return new Date(p.proposed_at).getTime() < now.getTime() - DEFAULT_TTL_DAYS * 86400000
}

/**
 * 把「status 還是 pending 但已經過了 expires_at」的提案標成 expired。
 * 沒有這支，`/admin` 的「待審」數字跟晨報都會把屍體算進去。
 */
export async function sweepExpiredProposals(
  supabase: SupabaseClient,
  now = new Date(),
): Promise<{ swept: number }> {
  const { data } = await supabase
    .from('pending_proposals')
    .select('id, proposed_at, expires_at')
    .eq('status', 'pending')

  const dead = (data ?? []).filter(p => isProposalExpired(p as ProposalRow, now)).map(p => p.id)
  if (dead.length === 0) return { swept: 0 }

  await supabase
    .from('pending_proposals')
    .update({
      status: 'expired',
      reviewed_by: 'system',
      reviewed_at: now.toISOString(),
      review_note: '超過有效期未處理，自動作廢（引擎會用新資料重算）',
    })
    .in('id', dead)

  return { swept: dead.length }
}

/** 還「活著」的提案：status=pending 且沒過期 */
export async function listActionableProposals(
  supabase: SupabaseClient,
  opts: { clientId?: string; now?: Date } = {},
): Promise<ProposalRow[]> {
  const now = opts.now ?? new Date()
  let q = supabase
    .from('pending_proposals')
    .select('id, client_id, proposed_by, proposed_at, expires_at, status, proposal_type, current_state, proposed_changes, reasoning, trajectory_data')
    .eq('status', 'pending')
    .order('proposed_at', { ascending: false })
  if (opts.clientId) q = q.eq('client_id', opts.clientId)

  const { data } = await q
  return ((data ?? []) as ProposalRow[]).filter(p => !isProposalExpired(p, now))
}

/** 一行人話：這筆提案要改什麼。給 LINE 用，沒有 markdown。 */
export function describeProposal(p: ProposalRow): string {
  if (p.proposal_type === 'personal_note') {
    const ch = (p.proposed_changes ?? {}) as { note?: string }
    return `加一筆筆記：${String(ch.note ?? '').slice(0, 40)}`
  }
  const cur = (p.current_state ?? {}) as Record<string, number | null>
  const nxt = (p.proposed_changes ?? {}) as Record<string, number | null>
  const label: Record<string, string> = {
    calories_target: '熱量', protein_target: '蛋白', carbs_target: '碳水', fat_target: '脂肪',
    carbs_training_day: '訓練日碳', carbs_rest_day: '休息日碳', cardio_minutes_per_day: '有氧',
  }
  const parts = TRACKED_FIELDS
    .filter(f => nxt[f] != null && nxt[f] !== cur[f])
    .map(f => `${label[f]} ${cur[f] ?? '?'}→${nxt[f]}`)
  return parts.length ? parts.join('、') : '（無數值變更）'
}

export type ActResult =
  | { ok: true; status: 'approved' | 'rejected' | 'discussing'; appliedLogId?: string | null }
  | { ok: false; reason: string; code: 'not_found' | 'not_pending' | 'expired' | 'write_failed' }

/**
 * 套用／退掉一筆提案。
 *
 * `allowExpired` 預設 false：**過期的提案不能用一個字批准**。
 * 那正是 Sean 那 10 筆的狀態，而它們是壞輸入算出來的（見檔頭）。
 * 要硬套用得明講，不能靠手滑。
 */
export async function actOnProposal(
  supabase: SupabaseClient,
  opts: {
    proposalId: string
    action: ProposalAction
    reviewNote?: string | null
    reviewedBy?: string
    allowExpired?: boolean
  },
): Promise<ActResult> {
  const { proposalId, action, reviewNote = null, reviewedBy = 'coach', allowExpired = false } = opts

  const { data: proposal, error: fetchErr } = await supabase
    .from('pending_proposals')
    .select('*')
    .eq('id', proposalId)
    .single()

  if (fetchErr || !proposal) return { ok: false, reason: '找不到提案', code: 'not_found' }
  if (proposal.status !== 'pending') {
    return { ok: false, reason: `提案已是 ${proposal.status} 狀態，無法再處理`, code: 'not_pending' }
  }
  if (action === 'approve' && !allowExpired && isProposalExpired(proposal as ProposalRow)) {
    return {
      ok: false,
      code: 'expired',
      reason: '這筆提案已過有效期。引擎當時看到的資料跟現在不一樣了，直接套用會用舊結論改今天的處方。',
    }
  }

  const now = new Date().toISOString()

  if (action === 'reject' || action === 'discuss') {
    const newStatus = action === 'reject' ? 'rejected' : 'discussing'
    await supabase
      .from('pending_proposals')
      .update({ status: newStatus, reviewed_by: reviewedBy, reviewed_at: now, review_note: reviewNote })
      .eq('id', proposalId)
    return { ok: true, status: newStatus }
  }

  // personal_note：寫進 personal_notes，不動 macros
  if (proposal.proposal_type === 'personal_note') {
    const ch = (proposal.proposed_changes ?? {}) as Record<string, unknown>
    const { error: insErr } = await supabase.from('personal_notes').insert({
      client_id: proposal.client_id,
      added_by: 'ai_agent',
      category: ch.category,
      note: ch.note,
      weight: ch.weight ?? 5,
      relevant_until: ch.relevant_until ?? null,
      source_proposal_id: proposal.id,
    })
    if (insErr) return { ok: false, reason: 'personal_notes 寫入失敗: ' + insErr.message, code: 'write_failed' }

    await supabase.from('pending_proposals')
      .update({ status: 'approved', reviewed_by: reviewedBy, reviewed_at: now, review_note: reviewNote })
      .eq('id', proposalId)
    return { ok: true, status: 'approved' }
  }

  // macro 類：套用到 clients + 寫 macro_adjustment_log
  const changes = (proposal.proposed_changes ?? {}) as Record<string, number>
  const clientUpdates: Record<string, unknown> = { last_auto_adjust_at: now }
  for (const f of TRACKED_FIELDS) {
    if (changes[f] != null) clientUpdates[f] = changes[f]
  }

  if (Object.keys(clientUpdates).length > 1) {
    // ⚠️ 2026-08-16：教練批准後若 coach_macro_override 還鎖著舊值，
    //    nutrition-suggestions 會在下次跑時把 macro「還原」回 override_values ——
    //    教練剛核准的調整被系統默默吃掉。套用時要把 override 的值同步成新值
    //    （鎖繼續有效，只是內容更新）。搬家時最容易漏的就是這段。
    const { data: cur } = await supabase
      .from('clients')
      .select('coach_macro_override')
      .eq('id', proposal.client_id)
      .maybeSingle<{ coach_macro_override: Record<string, unknown> | null }>()

    const ov = cur?.coach_macro_override
    if (ov && typeof ov === 'object') {
      const lockedFields: string[] = Array.isArray(ov.locked_fields) ? ov.locked_fields as string[] : []
      const nextValues = { ...((ov.override_values ?? {}) as Record<string, unknown>) }
      for (const f of lockedFields) {
        if (clientUpdates[f] != null) nextValues[f] = clientUpdates[f]
      }
      clientUpdates.coach_macro_override = {
        ...ov,
        override_values: nextValues,
        locked_at: now,
        reason: `${ov.reason ?? ''}｜${now.slice(0, 10)} 教練核准引擎提案後同步鎖定值`.slice(0, 500),
      }
    }

    const { error: updErr } = await supabase.from('clients').update(clientUpdates).eq('id', proposal.client_id)
    if (updErr) return { ok: false, reason: 'apply clients 失敗: ' + updErr.message, code: 'write_failed' }
  }

  const { data: logRow } = await supabase
    .from('macro_adjustment_log')
    .insert({
      client_id: proposal.client_id,
      applied_by: 'coach',
      trigger_source: 'manual',
      old_macros: proposal.current_state,
      new_macros: proposal.proposed_changes,
      reason: `AI 提案教練核准：${proposal.reasoning}` + (reviewNote ? `\n[教練註記] ${reviewNote}` : ''),
      trajectory_data: { ai_proposal_id: proposal.id, ...((proposal.trajectory_data ?? {}) as object) },
    })
    .select()
    .single()

  await supabase.from('pending_proposals')
    .update({
      status: 'approved',
      reviewed_by: reviewedBy,
      reviewed_at: now,
      review_note: reviewNote,
      applied_log_id: logRow?.id ?? null,
    })
    .eq('id', proposalId)

  return { ok: true, status: 'approved', appliedLogId: logRow?.id ?? null }
}
