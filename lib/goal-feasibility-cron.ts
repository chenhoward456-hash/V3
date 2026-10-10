/** 每天早上：目標日到不了 → 起草「改目標日」提案（晨報列出，教練回「套用 名字」才寫 clients.target_date） */
import type { SupabaseClient } from '@supabase/supabase-js'
import { assessGoalFeasibility } from './goal-feasibility'

export const TARGET_DATE_PROPOSAL = 'target_date_change'
const DAY = 86_400_000
/** 同一個人提過（不管套用或退掉）這麼多天內不再提 */
const QUIET_DAYS = 14

export async function proposeTargetDateChanges(supabase: SupabaseClient, today: string): Promise<{ proposed: number; errors: string[] }> {
  const errors: string[] = []
  let proposed = 0
  const since = new Date(Date.parse(`${today}T00:00:00Z`) - 35 * DAY).toISOString().slice(0, 10)
  const { data: clients, error } = await supabase.from('clients')
    .select('id, name, goal_type, target_weight, target_date').eq('is_active', true).not('target_date', 'is', null)
  if (error) return { proposed, errors: [`clients: ${error.message}`] }

  for (const c of (clients ?? []) as { id: string; name: string; goal_type: string | null; target_weight: number | null; target_date: string | null }[]) {
    try {
      const { data: w } = await supabase.from('body_composition').select('date, weight')
        .eq('client_id', c.id).gte('date', since).not('weight', 'is', null)
      const f = assessGoalFeasibility({
        goalType: c.goal_type, targetWeight: c.target_weight == null ? null : Number(c.target_weight), targetDate: c.target_date,
        weights: ((w ?? []) as { date: string; weight: number }[]).map(r => ({ date: r.date, weight: Number(r.weight) })), today,
      })
      if (!f) continue
      // 建議日：照現在速度和照建議速度取較晚的（照現在速度都到不了的日期，提了也只是下個月再提一次）
      const newDate = [f.projectedDate, f.suggestedDate].filter((d): d is string => !!d).sort().at(-1)
      if (!newDate || newDate <= (c.target_date ?? '')) continue

      const quietSince = new Date(Date.now() - QUIET_DAYS * DAY).toISOString()
      const { data: prior } = await supabase.from('pending_proposals').select('id')
        .eq('client_id', c.id).eq('proposal_type', TARGET_DATE_PROPOSAL).gte('proposed_at', quietSince).limit(1)
      if ((prior ?? []).length) continue

      const { error: insErr } = await supabase.from('pending_proposals').insert({
        client_id: c.id,
        proposed_by: 'system_engine',
        proposal_type: TARGET_DATE_PROPOSAL,
        status: 'pending',
        current_state: { target_date: c.target_date, target_weight: c.target_weight },
        proposed_changes: { target_date: newDate, avg7: f.avg7, trend_per_week: f.trendPerWeek },
        reasoning: f.line,
        expires_at: new Date(Date.now() + 7 * DAY).toISOString(),
      })
      if (insErr) errors.push(`${c.name}: ${insErr.message}`)
      else proposed++
    } catch (err) {
      errors.push(`${c.name}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }
  return { proposed, errors }
}
