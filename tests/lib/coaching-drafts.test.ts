import { describe, it, expect, vi } from 'vitest'
import { buildCoachingDrafts } from '@/lib/coaching-drafts'
vi.mock('@/lib/notify', () => ({ sendRoutineReminder: vi.fn() }))
function db(failed?: string) {
  const from = vi.fn((table: string) => {
    const result = table === 'clients' ? { data: [{ id: 'a', name: 'Example', unique_code: 'x', line_user_id: null }], error: null } : { data: [], error: table === failed ? { message: 'network' } : null }
    const query: any = { select: () => query, eq: () => query, in: () => query, gte: () => query, then: (resolve: any) => Promise.resolve(result).then(resolve) }
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
