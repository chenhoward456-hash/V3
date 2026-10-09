/** 每天早上 cron 跑的那段（要讀 DB）；純文字邏輯在 lib/coach-summary-draft.ts，報告頁（瀏覽器）也用得到 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { loadLabConsult } from './lab-consult-data'
import { COACH_SUMMARY_DRAFT_TYPE, buildCoachSummaryDraft, needsDraft, writtenDate } from './coach-summary-draft'

/** 抽血超過這麼久才補草稿就沒意義了（顧問卡也只在 60 天內顯示） */
const DRAFT_WINDOW_DAYS = 60
const DRAFT_TTL_DAYS = 14
const DAY_MS = 86_400_000

/**
 * 每天早上跑：最近 60 天內有新抽血、教練補充還沒寫到那次 → 起草一筆提案（同一次抽血只起草一次，
 * 退掉也不會再提）。只寫 pending_proposals，不碰 clients。
 */
export async function proposeCoachSummaryDrafts(
  supabase: SupabaseClient,
  today: string,
): Promise<{ proposed: number; errors: string[] }> {
  const errors: string[] = []
  let proposed = 0
  const since = new Date(Date.parse(today) - DRAFT_WINDOW_DAYS * DAY_MS).toISOString().slice(0, 10)

  const { data: clients, error } = await supabase.from('clients')
    .select('id, name, coach_summary, health_goals').eq('is_active', true)
  if (error) return { proposed, errors: [`clients: ${error.message}`] }

  for (const c of (clients ?? []) as { id: string; name: string; coach_summary: string | null; health_goals: string | null }[]) {
    try {
      const { data: latest } = await supabase.from('lab_results').select('date')
        .eq('client_id', c.id).order('date', { ascending: false }).limit(1)
      const drawDate = (latest as { date: string }[] | null)?.[0]?.date
      if (!drawDate || drawDate < since || !needsDraft(c.coach_summary, drawDate)) continue

      const { data: prior } = await supabase.from('pending_proposals').select('proposed_changes')
        .eq('client_id', c.id).eq('proposal_type', COACH_SUMMARY_DRAFT_TYPE)
      if (((prior ?? []) as { proposed_changes: { drawDate?: string } | null }[]).some(p => p.proposed_changes?.drawDate === drawDate)) continue

      const loaded = await loadLabConsult(supabase, c.id)
      if (!loaded?.consult || loaded.consult.drawDate !== drawDate) continue
      const draft = buildCoachSummaryDraft(loaded.consult)

      const { error: insErr } = await supabase.from('pending_proposals').insert({
        client_id: c.id,
        proposed_by: 'system_engine',
        proposal_type: COACH_SUMMARY_DRAFT_TYPE,
        status: 'pending',
        current_state: { coach_summary: c.coach_summary, health_goals: c.health_goals },
        proposed_changes: { drawDate, coach_summary: draft.summary, health_goals: draft.healthGoals },
        reasoning: `${drawDate} 新血檢，教練補充還停在 ${writtenDate(c.coach_summary) ?? '（沒寫日期）'}`,
        expires_at: new Date(Date.now() + DRAFT_TTL_DAYS * DAY_MS).toISOString(),
      })
      if (insErr) errors.push(`${c.name}: ${insErr.message}`)
      else proposed++
    } catch (err) {
      errors.push(`${c.name}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }
  return { proposed, errors }
}
