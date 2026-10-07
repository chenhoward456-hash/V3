import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const state = vi.hoisted(() => {
  const verify = vi.fn()
  const load = vi.fn()
  const rows: Record<string, Record<string, unknown>[]> = {}
  const errors: Record<string, unknown> = {}
  const queries: { table: string; fields: string; filters: [string, string][]; order: string; limit: number }[] = []
  const write = vi.fn(() => { throw new Error('Database write is forbidden in this GET') })
  const from = vi.fn((table: string) => {
    const q = { table, fields: '', filters: [] as [string, string][], order: '', limit: Infinity }
    queries.push(q)
    const builder = {
      select(fields: string) { q.fields = fields; return builder },
      eq(field: string, value: string) { q.filters.push([field, value]); return builder },
      order(field: string) { q.order = field; return builder },
      limit(count: number) { q.limit = count; return builder },
      insert: write, update: write, upsert: write, delete: write,
      then(resolve: (value: { data: Record<string, unknown>[] | null; error: unknown }) => unknown) {
        const data = (rows[table] ?? []).filter(row => q.filters.every(([f, v]) => row[f] === v)).slice(0, q.limit)
        return Promise.resolve(resolve({ data: errors[table] ? null : data, error: errors[table] ?? null }))
      },
    }
    return builder
  })
  const create = vi.fn(() => ({ from }))
  return { verify, load, rows, errors, queries, write, from, create }
})
vi.mock('@/lib/auth-middleware', () => ({ verifyAdminSession: state.verify }))
vi.mock('@/lib/supabase', () => ({ createServiceSupabase: state.create }))
vi.mock('@/lib/coach-digest', () => ({ loadCoachDigest: state.load }))
vi.mock('@/lib/date-utils', () => ({ getLocalDateStr: () => '2026-10-07' }))

import { GET } from '@/app/api/admin/coach-workflow/route'
const a = '11111111-1111-1111-1111-111111111111'
const b = '22222222-2222-2222-2222-222222222222'
const workflow = [{ clientId: b, name: '乙', priority: 100 }, { clientId: a, name: '甲', priority: 70 }]
function request(clientId?: string, token: string | null = 'valid') {
  const url = new URL('https://example.test/api/admin/coach-workflow')
  if (clientId !== undefined) url.searchParams.set('clientId', clientId)
  return new NextRequest(url, { headers: token ? { Cookie: `admin_session=${token}` } : {} })
}
beforeEach(() => {
  vi.clearAllMocks()
  state.queries.length = 0
  for (const k of Object.keys(state.rows)) delete state.rows[k]
  for (const k of Object.keys(state.errors)) delete state.errors[k]
  state.verify.mockReturnValue(true)
  state.load.mockResolvedValue({ workflow })
})
describe('GET /api/admin/coach-workflow read-only contract', () => {
  it.each([null, 'invalid'])('rejects unauthorized session %s before touching the database', async token => {
    if (token) state.verify.mockReturnValue(false)
    const response = await GET(request(undefined, token))
    expect(response.status).toBe(401)
    expect(state.create).not.toHaveBeenCalled()
    expect(state.load).not.toHaveBeenCalled()
    expect(state.from).not.toHaveBeenCalled()
  })
  it.each(['bad-id', '../../clients', '11111111-1111-1111-1111-11111111111'])('rejects invalid UUID %s before touching data', async id => {
    expect((await GET(request(id))).status).toBe(400)
    expect(state.create).not.toHaveBeenCalled()
    expect(state.load).not.toHaveBeenCalled()
  })
  it('returns exactly the digest queue in its original priority order without extra queries', async () => {
    const response = await GET(request())
    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(await response.json()).toEqual({ today: '2026-10-07', items: workflow })
    expect(state.from).not.toHaveBeenCalled()
    expect(state.write).not.toHaveBeenCalled()
  })
  it('scopes both histories to client_id and returns only the chosen workflow item', async () => {
    state.rows.coach_messages = [
      { client_id: a, id: 'message-a', body: '本人', read_at: null },
      { client_id: b, id: 'message-b', body: '別人' },
    ]
    state.rows.macro_adjustment_log = [
      { client_id: a, id: 'change-a', applied_at: '2026-10-06', reason: '教練確認' },
      { client_id: b, id: 'change-b', reason: '別人' },
    ]
    const response = await GET(request(a))
    const body = await response.json()
    expect(body.items).toEqual([workflow[1]])
    expect(body.history.messages.map((r: { id: string }) => r.id)).toEqual(['message-a'])
    expect(body.history.adjustments.map((r: { id: string }) => r.id)).toEqual(['change-a'])
    expect(body.history.unavailable).toBe(false)
    expect(state.queries).toEqual([
      { table: 'coach_messages', fields: 'id,title,body,created_at,read_at,sent_via', filters: [['client_id', a]], order: 'created_at', limit: 3 },
      { table: 'macro_adjustment_log', fields: 'id,applied_at,reason,applied_by,old_macros,new_macros', filters: [['client_id', a]], order: 'applied_at', limit: 3 },
    ])
    expect(state.write).not.toHaveBeenCalled()
  })
  it.each(['coach_messages', 'macro_adjustment_log'])('marks %s history failure as unavailable while preserving the working history', async table => {
    state.rows.coach_messages = [{ client_id: a, id: 'message-a' }]
    state.rows.macro_adjustment_log = [{ client_id: a, id: 'change-a' }]
    state.errors[table] = { message: 'Read failed' }
    const response = await GET(request(a))
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.history.unavailable).toBe(true)
    expect(body.items).toEqual([workflow[1]])
    expect(table === 'coach_messages' ? body.history.adjustments : body.history.messages).toHaveLength(1)
    expect(state.write).not.toHaveBeenCalled()
  })
  it('does not expose a loader exception or disguise failure as an empty queue', async () => {
    state.load.mockRejectedValue(new Error('private diagnostic'))
    const response = await GET(request())
    expect(response.status).toBe(500)
    const body = await response.json()
    expect(body.error).toContain('載入失敗')
    expect(JSON.stringify(body)).not.toContain('private diagnostic')
    expect(body.items).toBeUndefined()
    expect(state.from).not.toHaveBeenCalled()
  })
})
