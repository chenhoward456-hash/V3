import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockVerifyCoachAuth } = vi.hoisted(() => ({
  mockVerifyCoachAuth: vi.fn(async () => ({ authorized: false } as { authorized: boolean })),
}))
vi.mock('@/lib/auth-middleware', async (orig) => {
  const actual = await orig<Record<string, unknown>>()
  return { ...actual, verifyCoachAuth: mockVerifyCoachAuth }
})

import { getClientAccessBlock, denyInactiveClient, resolveActiveClient } from '@/lib/active-client'

// 稽核 S-13：停用／過期帳號的碼不可再讀學員資料
describe('getClientAccessBlock', () => {
  const now = new Date('2026-09-25T00:00:00Z')
  it('allows active, non-expiring clients', () => {
    expect(getClientAccessBlock({ is_active: true, expires_at: null }, now)).toBeNull()
  })
  it('blocks deactivated clients', () => {
    expect(getClientAccessBlock({ is_active: false, expires_at: null }, now)?.status).toBe(403)
  })
  it('blocks expired clients', () => {
    expect(getClientAccessBlock({ is_active: true, expires_at: '2026-09-01T00:00:00Z' }, now)?.status).toBe(403)
  })
  it('allows clients expiring in the future', () => {
    expect(getClientAccessBlock({ is_active: true, expires_at: '2026-12-01T00:00:00Z' }, now)).toBeNull()
  })
})

describe('denyInactiveClient', () => {
  beforeEach(() => mockVerifyCoachAuth.mockReset())
  const req = new NextRequest('http://localhost/api/x')

  it('returns 403 for an expired client without coach auth', async () => {
    mockVerifyCoachAuth.mockResolvedValue({ authorized: false })
    const res = await denyInactiveClient({ is_active: true, expires_at: '2000-01-01' }, req)
    expect(res?.status).toBe(403)
  })
  it('lets the coach (admin cookie) read an expired client', async () => {
    mockVerifyCoachAuth.mockResolvedValue({ authorized: true })
    const res = await denyInactiveClient({ is_active: false, expires_at: null }, req)
    expect(res).toBeNull()
  })
  it('does not call coach auth for active clients', async () => {
    const res = await denyInactiveClient({ is_active: true, expires_at: null }, req)
    expect(res).toBeNull()
    expect(mockVerifyCoachAuth).not.toHaveBeenCalled()
  })
})

describe('resolveActiveClient', () => {
  function sb(data: unknown) {
    const chain: any = {}
    chain.select = vi.fn(() => chain)
    chain.eq = vi.fn(() => chain)
    chain.maybeSingle = vi.fn(async () => ({ data, error: null }))
    return { from: vi.fn(() => chain) } as any
  }
  it('404 when the code does not exist', async () => {
    const r = await resolveActiveClient(sb(null), 'nope')
    expect(r.response?.status).toBe(404)
  })
  it('403 when the account is deactivated', async () => {
    const r = await resolveActiveClient(sb({ id: 'c1', is_active: false, expires_at: null }), 'abc')
    expect(r.response?.status).toBe(403)
  })
  it('returns the client when active', async () => {
    const r = await resolveActiveClient(sb({ id: 'c1', is_active: true, expires_at: null }), 'abc')
    expect(r.client?.id).toBe('c1')
  })
})
