import { describe, it, expect } from 'vitest'
import { loadHypothesisUpdates } from '@/lib/hypothesis-updates'

// 迷你 supabase：from(table).select().in().in() 都回同一份資料
const fake = (tables: Record<string, unknown[]>) => ({
  from: (t: string) => {
    const q: any = { select: () => q, in: () => q, then: (r: (v: unknown) => unknown) => Promise.resolve({ data: tables[t], error: null }).then(r) }
    return q
  },
})

const hyp = (o: Record<string, unknown> = {}) => ({
  id: 'h1', client_id: 'c1', marker: '睪固酮', baseline_date: '2026-03-20', baseline_value: 404,
  cause: null, action: null, expected_direction: 'up', expected_value: 550, retest_by: '2026-09-26', note: null,
  created_at: '2026-09-23', notified_status: null,
  clients: { id: 'c1', name: '陳', unique_code: 'x', line_user_id: 'U1', is_active: true }, ...o,
})

describe('loadHypothesisUpdates：通知去重', () => {
  it('結果出來、還沒通知過 → graded', async () => {
    const r = await loadHypothesisUpdates(fake({ lab_hypotheses: [hyp()], lab_results: [{ client_id: 'c1', test_name: '睪固酮', value: 600, unit: null, date: '2026-09-26' }] }), '2026-09-27')
    expect(r.graded.map(g => g.status)).toEqual(['confirmed'])
  })
  it('同一個判決已經通知過 → 不再列', async () => {
    const r = await loadHypothesisUpdates(fake({ lab_hypotheses: [hyp({ notified_status: 'confirmed' })], lab_results: [{ client_id: 'c1', test_name: '睪固酮', value: 600, unit: null, date: '2026-09-26' }] }), '2026-09-27')
    expect(r.graded).toHaveLength(0)
  })
  it('過了重測日沒結果 → overdue（每天都列，但不推學員）', async () => {
    const r = await loadHypothesisUpdates(fake({ lab_hypotheses: [hyp()], lab_results: [] }), '2026-10-01')
    expect(r.overdue).toHaveLength(1)
    expect(r.graded).toHaveLength(0)
  })
  it('停用帳號不處理', async () => {
    const r = await loadHypothesisUpdates(fake({ lab_hypotheses: [hyp({ clients: { id: 'c1', name: '陳', unique_code: 'x', line_user_id: 'U1', is_active: false } })], lab_results: [] }), '2026-10-01')
    expect(r.overdue).toHaveLength(0)
  })
})
