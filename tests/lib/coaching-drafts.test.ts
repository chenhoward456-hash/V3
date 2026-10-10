import { describe, it, expect, vi } from 'vitest'
import { buildCoachingDrafts } from '@/lib/coaching-drafts'
vi.mock('@/lib/notify', () => ({ sendRoutineReminder: vi.fn() }))
function db(failed?: string) {
  const from = vi.fn((table: string) => {
    const result = table === 'clients' ? { data: [{ id: 'a', name: 'Example', unique_code: 'x', line_user_id: null }], error: null } : { data: [], error: table === failed ? { message: 'network' } : null }
    const query: any = { select: () => query, eq: () => query, in: () => query, gte: () => query, lte: () => query, then: (resolve: any) => Promise.resolve(result).then(resolve) }
    return query
  })
  return { from } as any
}
describe('draft loading fails closed', () => {
  it.each(['body_composition', 'nutrition_logs', 'training_logs', 'daily_wellness', 'lab_results', 'push_subscriptions', 'training_sets', 'macro_adjustment_log'])('rejects failed %s rather than generating no-data advice', async table => {
    await expect(buildCoachingDrafts(db(table))).rejects.toThrow('部分資料讀取失敗')
  })
  it('preserves no-data drafts only when sources loaded successfully', async () => {
    const [draft] = await buildCoachingDrafts(db())
    expect(draft.mode).toBe('accountability')
    expect(draft.needsCoachReview).toBe(true)
    expect(draft.evidence.sources.every(s => s.records === 0)).toBe(true)
  })
})

describe('snapshot dates match evidence and real engine', () => {
  const client = { id: 'a', name: 'Example', unique_code: 'x', line_user_id: null, calories_target: 2000, goal_type: 'cut' }
  const nutrition = ['2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10'].map(date => ({ client_id: 'a', date, calories: 2000 }))
  function fixture(rows: Record<string, unknown[]>) {
    return { from: (table: string) => {
      const query: any = { select: () => query, eq: () => query, in: () => query, gte: () => query, lte: () => query, then: (resolve: any) => Promise.resolve({ data: table === 'clients' ? [client] : rows[table] ?? [], error: null }).then(resolve) }
      return query
    } } as any
  }
  async function atSnapshot(fn: () => Promise<void>) {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-10T03:00:00Z'))
    try { await fn() } finally { vi.useRealTimers() }
  }
  it('ignores future and invalid training rows in both engine claims and evidence', () => atSnapshot(async () => {
    const base = { body_composition: [{ client_id: 'a', date: '2026-10-10', weight: 80 }], nutrition_logs: nutrition }
    const [clean] = await buildCoachingDrafts(fixture(base))
    const [dirty] = await buildCoachingDrafts(fixture({ ...base, training_sets: ['2026-10-11','2026-10-12','2026-10-13','2026-10-14','2026-09-31','invalid'].map(date => ({ client_id: 'a', date, exercise_name: '深蹲' })) }))
    expect(dirty).toEqual(clean)
    expect(dirty.bullets.join(' ')).not.toContain('4 天共 4 組')
  }))
  it('does not let a future weight change the no-recent-weight mode', () => atSnapshot(async () => {
    const rows = { nutrition_logs: nutrition, body_composition: [{ client_id: 'a', date: '2026-10-01', weight: 80 }, { client_id: 'a', date: '2026-10-11', weight: 80 }] }
    const [draft] = await buildCoachingDrafts(fixture(rows))
    expect(draft.mode).toBe('accountability')
    expect(draft.evidence.sources[0].latestDate).toBe('2026-10-01')
  }))
  it('uses Taiwan midnight for the real repletion boundary and evidence', () => atSnapshot(async () => {
    const [draft] = await buildCoachingDrafts(fixture({ body_composition: [{ client_id: 'a', date: '2026-10-10', weight: 80 }], nutrition_logs: nutrition, macro_adjustment_log: [{ client_id: 'a', applied_at: '2026-09-26T16:00:00Z', old_macros: { carbs_target: 100 }, new_macros: { carbs_target: 200 } }] }))
    expect(draft.bullets.join(' ')).toContain('碳水剛往上調')
    expect(draft.evidence.sources.find(s => s.key === 'macroChanges')?.latestDate).toBe('2026-09-27')
  }))
  it('excludes later-today macro timestamps beyond the exact captured instant', () => atSnapshot(async () => {
    const base = { body_composition: [{ client_id: 'a', date: '2026-10-10', weight: 80 }], nutrition_logs: nutrition }
    const [clean] = await buildCoachingDrafts(fixture(base))
    const [future] = await buildCoachingDrafts(fixture({ ...base, macro_adjustment_log: [{ client_id: 'a', applied_at: '2026-10-10T03:00:01Z', old_macros: { carbs_target: 100 }, new_macros: { carbs_target: 200 } }] }))
    expect(future).toEqual(clean)
  }))
})
