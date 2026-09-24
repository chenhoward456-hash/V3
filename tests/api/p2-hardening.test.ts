import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockVerifyCoachAuth, fromImpl } = vi.hoisted(() => ({
  mockVerifyCoachAuth: vi.fn(async () => ({ authorized: false } as { authorized: boolean })),
  fromImpl: { fn: (_t: string): any => null },
}))

vi.mock('@/lib/supabase', () => ({
  createServiceSupabase: () => ({ from: (t: string) => fromImpl.fn(t) }),
}))
vi.mock('@/lib/auth-middleware', async (orig) => {
  const actual = await orig<Record<string, unknown>>()
  return { ...actual, verifyCoachAuth: mockVerifyCoachAuth }
})

function chainReturning(result: { data: unknown; error: unknown }, extra: Record<string, unknown> = {}) {
  const chain: any = {}
  for (const m of ['select', 'eq', 'order', 'gte', 'insert', 'update', 'is']) chain[m] = vi.fn(() => chain)
  chain.single = vi.fn(async () => result)
  chain.maybeSingle = vi.fn(async () => result)
  chain.then = (r: any) => Promise.resolve(result).then(r)
  return Object.assign(chain, extra)
}

beforeEach(() => {
  mockVerifyCoachAuth.mockReset()
  mockVerifyCoachAuth.mockResolvedValue({ authorized: false })
})

// 稽核 S-09：/api/consent 的 UUID 路徑限教練
describe('/api/consent UUID path', () => {
  it('POST with a UUID and no coach auth → 403, nothing inserted', async () => {
    const insert = vi.fn()
    fromImpl.fn = () => chainReturning({ data: null, error: null }, { insert })
    const { POST } = await import('@/app/api/consent/route')
    const res = await POST(new NextRequest('http://localhost/api/consent', {
      method: 'POST',
      body: JSON.stringify({ clientId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', types: ['terms'] }),
    }))
    expect(res.status).toBe(403)
    expect(insert).not.toHaveBeenCalled()
  })

  it('POST insert error does not leak the Postgres message (S-14)', async () => {
    fromImpl.fn = (t) => t === 'clients'
      ? chainReturning({ data: { id: 'c1', line_user_id: null }, error: null })
      : chainReturning({ data: null, error: { message: 'duplicate key value violates unique constraint "secret_idx"' } })
    const { POST } = await import('@/app/api/consent/route')
    const res = await POST(new NextRequest('http://localhost/api/consent', {
      method: 'POST',
      body: JSON.stringify({ clientId: 'Abc123Def456', types: ['terms'] }),
    }))
    expect(res.status).toBe(500)
    expect(JSON.stringify(await res.json())).not.toContain('secret_idx')
  })
})

// 稽核 S-14
describe('/api/health', () => {
  it('does not expose DB error text or missing env names', async () => {
    fromImpl.fn = () => chainReturning({ data: null, error: { message: 'connection to 10.0.0.5 refused' } })
    const saved = process.env.ANTHROPIC_API_KEY
    delete process.env.ANTHROPIC_API_KEY
    const { GET } = await import('@/app/api/health/route')
    const res = await GET()
    const body = JSON.stringify(await res.json())
    if (saved !== undefined) process.env.ANTHROPIC_API_KEY = saved
    expect(res.status).toBe(503)
    expect(body).not.toContain('10.0.0.5')
    expect(body).not.toContain('ANTHROPIC_API_KEY')
  })
})

describe('/api/unsubscribe', () => {
  it('a token of the wrong length is rejected as invalid (403), not a 500', async () => {
    process.env.CRON_SECRET = 'test-cron-secret'
    fromImpl.fn = () => chainReturning({ data: null, error: null })
    const { GET } = await import('@/app/api/unsubscribe/route')
    const res = await GET(new NextRequest('http://localhost/api/unsubscribe?clientId=abc&token=short'))
    expect(res.status).toBe(403)
  })
})

// 稽核 S-13：讀取 API 擋停用／過期
describe('/api/lab-findings', () => {
  it('returns 403 for an expired account', async () => {
    fromImpl.fn = (t) => t === 'clients'
      ? chainReturning({ data: { id: 'c1', gender: '男性', is_active: true, expires_at: '2000-01-01T00:00:00Z' }, error: null })
      : chainReturning({ data: [], error: null })
    const { GET } = await import('@/app/api/lab-findings/route')
    const res = await GET(new NextRequest('http://localhost/api/lab-findings?clientId=Abc123Def456'))
    expect(res.status).toBe(403)
  })
})
