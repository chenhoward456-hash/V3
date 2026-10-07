import { describe, expect, it } from 'vitest'
import { buildCoachWorkflow, type CoachWorkflowClient } from '@/lib/coach-workflow'
import { buildCoachDigest, loadCoachDigest, type CoachDigestInput } from '@/lib/coach-digest'
import { loadHypothesisUpdates } from '@/lib/hypothesis-updates'
import { loadExperimentUpdates } from '@/lib/body-experiments'
const today = '2026-10-07'
const client = (id: string, note = '', lastActive = today): CoachWorkflowClient => ({
  id, name: id, lastActive,
  signalInput: { today, caloriesTarget: 2000, proteinTarget: 150, weights: [], nutrition: [], training: note ? [{ date: today, note }] : [] },
})
describe('shared coach workflow', () => {
  it('keeps students with a question in queue even when active and merges all reasons', () => {
    const c = client('ask', '划船是不是要延展？')
    c.reasons = [{ kind: 'proposal', priority: 40, reason: '提案', action: '審核', review: { date: null, label: '未設定' } }]
    const [row] = buildCoachWorkflow([c], today)
    expect(row.reason).toContain('是不是')
    expect(row.reasons).toHaveLength(2)
    expect(row.review.date).toBeNull()
    expect(row.signals).toHaveLength(1)
  })
  it('sorts discomfort before overdue labs, questions, then offline, independently of client order', () => {
    const lab = client('lab'); lab.reasons = [{ kind: 'lab', priority: 90, reason: '逾期', action: '安排回檢', review: { date: '2026-10-01', label: '回檢日' } }]
    const rows = [client('offline', '', '2026-10-01'), client('ask', '是不是？'), lab, client('pain', '膝蓋痛')]
    expect(buildCoachWorkflow(rows, today).map(r => r.clientId)).toEqual(['pain', 'lab', 'ask', 'offline'])
    expect(buildCoachWorkflow([...rows].reverse(), today).map(r => r.clientId)).toEqual(['pain', 'lab', 'ask', 'offline'])
    expect(buildCoachWorkflow([lab], today)[0].review.date).toBe('2026-10-01')
  })
  it('does not invent tasks for active quiet or >30 day silent students, and read does not mean done', () => {
    const c = client('active'); c.latestMessage = { sentAt: '2026-10-06', readAt: today }
    expect(buildCoachWorkflow([c, client('old', '', '2026-08-01')], today)).toEqual([])
    c.signalInput!.training = [{ date: today, note: '要不要換動作？' }]
    expect(buildCoachWorkflow([c], today)[0].latestMessage?.readAt).toBe(today)
    expect(buildCoachWorkflow([c], today)[0].review.date).toBeNull()
  })
  it('includes the same sorted queue in digest and preserves existing details', () => {
    const workflowClients = [client('offline', '', '2026-10-01'), client('ask', '是不是？')]
    const input: CoachDigestInput = { today, clients: workflowClients, workflowClients,
      yesterdayWeightIds: [], yesterdayNutritionIds: [], yesterdayTraining: [], yesterdayWellness: [],
      lastActiveByClient: { offline: '2026-10-01', ask: today }, recentWeights: [], competitions: [], labsDue: [], proposals: [], adminUrl: 'https://example.test' }
    const digest = buildCoachDigest(input)
    expect(digest.workflow).toEqual(buildCoachWorkflow(workflowClients, today))
    expect(digest.text).toContain('今天先處理這 2 位')
    expect(digest.text).toContain('1 個人掉線了')
    expect(digest.text).toContain('https://example.test/admin/clients/ask/overview?workflow=1')
    expect(digest.text!.indexOf('• ask')).toBeLessThan(digest.text!.indexOf('• offline'))
  })
})

// A loader regression: question text must reach both surfaces without invoking a writer.
it('loads the shared queue from real field names without database writes', async () => {
  const rows: Record<string, object[]> = {
    clients: [{ id: 'ask', name: '阿明', calories_target: 2000, protein_target: 150, is_active: true }],
    training_logs: [{ client_id: 'ask', date: today, note: '划船是不是要延展？' }],
    coach_messages: [{ client_id: 'ask', created_at: '2026-10-06T08:00:00Z', read_at: null }],
  }
  const queried: string[] = []
  const supabase = { from(table: string) {
    queried.push(table)
    const query = {
      select() { return query }, eq() { return query }, gte() { return query }, lt() { return query },
      in() { return query }, not() { return query }, order() { return query }, limit() { return query },
      then(resolve: (result: { data: object[]; error: null }) => unknown) { return Promise.resolve(resolve({ data: rows[table] ?? [], error: null })) },
    }
    return query
  } }
  const digest = await loadCoachDigest(supabase as never, { today, adminUrl: 'https://example.test' })
  expect(digest.workflow[0].reason).toContain('是不是')
  expect(digest.workflow[0].latestMessage).toEqual({ sentAt: '2026-10-06T08:00:00Z', readAt: null })
  expect(digest.text).toContain(digest.workflow[0].reason)
  expect(queried).toContain('coach_messages')
})

it.each(['clients', 'body_composition', 'nutrition_logs', 'training_logs', 'daily_wellness', 'lab_panel_notes', 'lab_panel_templates', 'coach_messages', 'pending_proposals', 'lab_hypotheses', 'body_experiments'])('does not turn failed %s reads into a reassuring empty queue', async failedTable => {
  const supabase = { from(table: string) {
    const q = {
      select() { return q }, eq() { return q }, gte() { return q }, lt() { return q },
      in() { return q }, not() { return q }, order() { return q }, limit() { return q },
      then(resolve: (result: { data: object[] | null; error: object | null }) => unknown) {
        return Promise.resolve(resolve(table === failedTable
          ? { data: null, error: { message: 'unavailable' } } : { data: table === 'clients' ? [{ id: 'c1', name: '阿明' }] : [], error: null }))
      },
    }
    return q
  } }
  await expect(loadCoachDigest(supabase as never, { today, adminUrl: 'https://example.test' })).rejects.toThrow('讀取失敗')
})

it('uses the workflow headline for an active student question and shows the date together with its meaning', () => {
  const c = client('ask', '是不是？')
  c.reasons = [{ kind: 'lab', priority: 90, reason: '回檢已逾期', action: '確認安排', review: { date: '2026-10-01', label: '既有回檢日，待你確認' } }]
  const input: CoachDigestInput = { today, clients: [c], workflowClients: [c],
    yesterdayWeightIds: [], yesterdayNutritionIds: [], yesterdayTraining: [], yesterdayWellness: [],
    lastActiveByClient: { ask: today }, recentWeights: [], competitions: [], labsDue: [], proposals: [], adminUrl: 'https://example.test' }
  const digest = buildCoachDigest(input)
  expect(digest.text!.split('\n')[1]).toContain('1 位有關注事項')
  expect(digest.text).not.toContain('沒人掉線，其餘看下面')
  expect(digest.text).toContain('2026-10-01｜既有回檢日，待你確認')
})


it('keeps recently produced results visible after notification, without treating notifications as coach completion', async () => {
  const tables: Record<string, object[]> = {
    clients: [{ id: 'c1', name: '阿明', calories_target: 2000, protein_target: 150 }],
    lab_hypotheses: [
      { id: 'new-h', client_id: 'c1', marker: '睪固酮', baseline_date: '2026-08-25', baseline_value: 404,
        expected_direction: 'up', expected_value: 550, retest_by: '2026-09-26', notified_status: 'confirmed',
        clients: { id: 'c1', name: '阿明', is_active: true } },
      { id: 'old-h', client_id: 'c1', marker: '睪固酮', baseline_date: '2026-03-20', baseline_value: 404,
        expected_direction: 'up', expected_value: 550, retest_by: '2026-08-20', notified_status: 'confirmed',
        clients: { id: 'c1', name: '阿明', is_active: true } },
    ],
    lab_results: [
      { client_id: 'c1', test_name: '睪固酮', value: 600, date: '2026-09-26' },
      { client_id: 'c1', test_name: '睪固酮', value: 600, date: '2026-08-20' },
    ],
    body_experiments: [
      { id: 'new-e', client_id: 'c1', title: '近期實驗', metric: 'energy_level', start_date: '2026-09-20', end_date: '2026-10-01', baseline_days: 14, expected_direction: 'up', notified_status: 'insufficient', clients: { name: '阿明', is_active: true } },
      { id: 'old-e', client_id: 'c1', title: '舊實驗', metric: 'energy_level', start_date: '2026-07-20', end_date: '2026-08-01', baseline_days: 14, expected_direction: 'up', notified_status: 'insufficient', clients: { name: '阿明', is_active: true } },
    ],
    coach_messages: [{ client_id: 'c1', created_at: '2026-07-01', read_at: null }],
  }
  const queries: { table: string; gte: string[]; eq: [string, string][]; limit: number | null }[] = []
  const supabase = { from(table: string) {
    const seen = { table, gte: [] as string[], eq: [] as [string, string][], limit: null as number | null }; queries.push(seen)
    const q = { select() { return q }, eq(field: string, value: string) { seen.eq.push([field, value]); return q }, gte(field: string) { seen.gte.push(field); return q }, lt() { return q },
      in() { return q }, not() { return q }, order() { return q }, limit(n: number) { seen.limit = n; return q },
      then(resolve: (r: { data: object[]; error: null }) => unknown) { return Promise.resolve(resolve({ data: tables[table] ?? [], error: null })) },
    }; return q
  } }
  const digest = await loadCoachDigest(supabase as never, { today, adminUrl: 'https://example.test' })
  expect(digest.hypothesisUpdates?.graded).toHaveLength(0)
  expect(digest.experimentUpdates).toHaveLength(0)
  const row = digest.workflow.find(r => r.clientId === 'c1')!
  const results = row.reasons.filter(r => r.kind === 'result')
  expect(results).toHaveLength(2)
  expect(results.every(r => r.priority === 20 && r.action.includes('系統未記錄是否已複核'))).toBe(true)
  expect(results.map(r => r.review.date).sort()).toEqual(['2026-09-26', '2026-10-01'])
  expect(row.reasons.some(r => r.reason.includes('舊實驗'))).toBe(false)
  expect(row.latestMessage?.sentAt).toBe('2026-07-01')
  expect(queries.filter(q => q.table === 'coach_messages')).toEqual([{ table: 'coach_messages', gte: [], eq: [['client_id', 'c1']], limit: 1 }])
})


// A present parent row must not turn a failed evidence query into an empty result.
it.each(['lab_results', 'daily_wellness', 'body_composition'])('rejects unavailable result evidence: %s', async failingTable => {
  const tables: Record<string, object[]> = {
    lab_hypotheses: [{ id: 'h1', client_id: 'c1', marker: '睪固酮', clients: { is_active: true } }],
    body_experiments: [{ id: 'e1', client_id: 'c1', start_date: '2026-09-20', baseline_days: 14, clients: { is_active: true } }],
  }
  const supabase = { from(table: string) {
    const q = { select() { return q }, in() { return q }, gte() { return q }, lt() { return q },
      then(resolve: (result: { data: object[] | null; error: { message: string } | null }) => unknown) {
        return Promise.resolve(resolve(table === failingTable ? { data: null, error: { message: 'evidence unavailable' } } : { data: tables[table] ?? [], error: null }))
      },
    }; return q
  } }
  const read = failingTable === 'lab_results' ? loadHypothesisUpdates : loadExperimentUpdates
  await expect(read(supabase as never, today, { includeNotified: true, throwOnReadError: true })).rejects.toThrow('結果讀取失敗')
})
