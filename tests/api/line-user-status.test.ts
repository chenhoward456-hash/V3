import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ── Hoisted mocks ──

const { mockVerifyCoachAuth } = vi.hoisted(() => {
  const mockVerifyCoachAuth = vi.fn()
  return { mockVerifyCoachAuth }
})

const { mockFrom, mockSupabase } = vi.hoisted(() => {
  const mockFrom = vi.fn()
  const mockSupabase = { from: mockFrom }
  return { mockFrom, mockSupabase }
})

// ── Module mocks ──

vi.mock('@/lib/auth-middleware', () => ({
  verifyCoachAuth: mockVerifyCoachAuth,
}))

vi.mock('@/lib/supabase', () => ({
  createServiceSupabase: () => mockSupabase,
}))

import { GET } from '@/app/api/line/user-status/route'

// ── Helpers ──

function buildRequest(params: Record<string, string>, cookies?: Record<string, string>): NextRequest {
  const url = new URL('http://localhost:3000/api/line/user-status')
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }
  const headers: Record<string, string> = {}
  if (cookies) {
    headers.Cookie = Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ')
  }
  return new NextRequest(url.toString(), { method: 'GET', headers })
}

// ── Tests ──

describe('GET /api/line/user-status', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockVerifyCoachAuth.mockResolvedValue({ authorized: false })
  })

  it('returns 401 when not authorized as coach', async () => {
    const req = buildRequest({ clientId: 'c1' })
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json.error).toBeDefined()
  })

  it('returns 400 when clientId is missing', async () => {
    mockVerifyCoachAuth.mockResolvedValue({ authorized: true })

    const req = buildRequest({})
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toContain('clientId')
  })

  it('returns 404 when client not found', async () => {
    mockVerifyCoachAuth.mockResolvedValue({ authorized: true })
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } }),
        }),
      }),
    })

    const req = buildRequest({ clientId: 'nonexistent-id' })
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(404)
    expect(json.error).toBeDefined()
  })

  it('returns bound status with online user', async () => {
    mockVerifyCoachAuth.mockResolvedValue({ authorized: true })
    const recentTime = new Date(Date.now() - 2 * 60 * 1000).toISOString() // 2 min ago

    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: 'c1',
              name: 'Alice',
              line_user_id: 'U1234',
              last_line_activity: recentTime,
            },
            error: null,
          }),
        }),
      }),
    })

    const req = buildRequest({ clientId: 'c1' })
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.clientId).toBe('c1')
    expect(json.name).toBe('Alice')
    expect(json.lineLinked).toBe(true)
    expect(json.isOnline).toBe(true)
    expect(json.lastLineActivity).toBe(recentTime)
  })

  it('returns bound status with offline user (activity > 5 min ago)', async () => {
    mockVerifyCoachAuth.mockResolvedValue({ authorized: true })
    const oldTime = new Date(Date.now() - 10 * 60 * 1000).toISOString() // 10 min ago

    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: 'c1',
              name: 'Bob',
              line_user_id: 'U5678',
              last_line_activity: oldTime,
            },
            error: null,
          }),
        }),
      }),
    })

    const req = buildRequest({ clientId: 'c1' })
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.lineLinked).toBe(true)
    expect(json.isOnline).toBe(false)
  })

  it('returns unbound status when line_user_id is null', async () => {
    mockVerifyCoachAuth.mockResolvedValue({ authorized: true })

    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: 'c1',
              name: 'Charlie',
              line_user_id: null,
              last_line_activity: null,
            },
            error: null,
          }),
        }),
      }),
    })

    const req = buildRequest({ clientId: 'c1' })
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.lineLinked).toBe(false)
    expect(json.isOnline).toBe(false)
    expect(json.lastLineActivity).toBeNull()
  })

  it('returns offline when linked but no last_line_activity', async () => {
    mockVerifyCoachAuth.mockResolvedValue({ authorized: true })

    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: 'c1',
              name: 'Dan',
              line_user_id: 'U9999',
              last_line_activity: null,
            },
            error: null,
          }),
        }),
      }),
    })

    const req = buildRequest({ clientId: 'c1' })
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.lineLinked).toBe(true)
    expect(json.isOnline).toBe(false)
  })
})
