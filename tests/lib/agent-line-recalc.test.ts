import { afterEach, beforeEach, expect, it, vi } from 'vitest'
const state = vi.hoisted(() => ({ reply: vi.fn() }))
vi.mock('@/lib/line', () => ({ replyMessage: state.reply, pushMessage: vi.fn() }))
vi.mock('@/lib/agent-runner', () => ({ runAgent: vi.fn() }))
vi.mock('@/lib/line-handlers', () => ({ tryCoachQuickLog: vi.fn() }))
vi.mock('@/lib/proposal-actions', () => ({ actOnProposal: vi.fn() }))
vi.mock('@/lib/supabase', () => ({ createServiceSupabase: vi.fn() }))
import { handleCoachActionPostback } from '@/lib/agent-line'
const fetchMock = vi.fn()
beforeEach(() => { state.reply.mockReset(); fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock); vi.stubEnv('ADMIN_LINE_USER_ID', 'fixture-admin'); vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'http://fixture.invalid'); vi.stubEnv('CRON_SECRET', 'fake') })
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs() })
it.each(['failed', 'unknown'])('force_recalc relays %s notification without false completion or retry', async notification => {
  fetchMock.mockResolvedValue(new Response(JSON.stringify({ error: '請先核對，勿整批重送', notification, decision: 'would_propose' }), { status: 502 }))
  await handleCoachActionPostback('coach_action:force_recalc:fixture-client', 'fixture-reply', {} as any, 'fixture-admin')
  expect(fetchMock).toHaveBeenCalledOnce(); expect(fetchMock.mock.calls[0][1].method).toBe('POST')
  const text = state.reply.mock.calls[0][1][0].text
  expect(text).toContain('分析已完成'); expect(text).toContain('請先核對'); expect(text).not.toContain('強制重算完成')
})
it('force_recalc permission denial never invokes the command', async () => {
  await handleCoachActionPostback('coach_action:force_recalc:fixture-client', 'fixture-reply', {} as any, 'other-user')
  expect(fetchMock).not.toHaveBeenCalled(); expect(state.reply.mock.calls[0][1][0].text).toContain('沒有權限')
})
