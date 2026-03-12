import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ── Use vi.hoisted to declare mock state before vi.mock hoisting ──

const { mockTableCalls, mockSupabase, createMockQueryBuilder } = vi.hoisted(() => {
  const mockTableCalls: Record<string, { data: any; error: any }> = {}

  function createMockQueryBuilder(data: any = null, error: any = null) {
    const builder: any = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      single: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      upsert: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
    }
    Object.defineProperty(builder, 'then', {
      value(onFulfilled: any) {
        return Promise.resolve({ data, error }).then(onFulfilled)
      },
    })
    return builder
  }

  const mockSupabase = {
    from: vi.fn((table: string) => {
      const result = mockTableCalls[table] || { data: null, error: null }
      return createMockQueryBuilder(result.data, result.error)
    }),
  }

  return { mockTableCalls, mockSupabase, createMockQueryBuilder }
})

const mockGetRequestToken = vi.hoisted(() => vi.fn())
const mockRateLimit = vi.hoisted(() => vi.fn())
const mockGetClientIP = vi.hoisted(() => vi.fn())

vi.mock('@/lib/supabase', () => ({
  createServiceSupabase: vi.fn(() => mockSupabase),
}))

vi.mock('@/lib/garmin-api', () => ({
  getRequestToken: (...args: any[]) => mockGetRequestToken(...args),
}))

vi.mock('@/lib/auth-middleware', () => ({
  rateLimit: (...args: any[]) => mockRateLimit(...args),
  getClientIP: (...args: any[]) => mockGetClientIP(...args),
}))

import { POST } from '@/app/api/garmin/connect/route'

// ── Helpers ──

function makePostRequest(body: any, ip: string = '127.0.0.1'): NextRequest {
  return new NextRequest('http://localhost:3000/api/garmin/connect', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-forwarded-for': ip,
    },
    body: JSON.stringify(body),
  })
}

function resetFromMock() {
  mockSupabase.from.mockImplementation((table: string) => {
    const result = mockTableCalls[table] || { data: null, error: null }
    return createMockQueryBuilder(result.data, result.error)
  })
}

// ── Tests ──

describe('POST /api/garmin/connect', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    for (const key of Object.keys(mockTableCalls)) {
      delete mockTableCalls[key]
    }
    resetFromMock()

    // Default mock behaviour
    mockGetClientIP.mockReturnValue('127.0.0.1')
    mockRateLimit.mockReturnValue({ allowed: true, remaining: 4 })
    mockGetRequestToken.mockResolvedValue({
      oauthToken: 'req-token-123',
      oauthTokenSecret: 'req-secret-456',
      authorizeUrl: 'https://connect.garmin.com/oauthConfirm?oauth_token=req-token-123',
    })

    process.env.NEXT_PUBLIC_SITE_URL = 'https://example.com'
  })

  it('returns authorizeUrl on successful OAuth request token', async () => {
    mockTableCalls['clients'] = {
      data: { id: 'client-uuid-1', unique_code: 'ABC123', is_active: true, expires_at: null },
      error: null,
    }

    const req = makePostRequest({ clientId: 'ABC123' })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.authorizeUrl).toBe('https://connect.garmin.com/oauthConfirm?oauth_token=req-token-123')
    expect(json.message).toBeDefined()
  })

  it('calls getRequestToken with correct callback URL', async () => {
    mockTableCalls['clients'] = {
      data: { id: 'client-uuid-1', unique_code: 'ABC123', is_active: true, expires_at: null },
      error: null,
    }

    const req = makePostRequest({ clientId: 'ABC123' })
    await POST(req)

    expect(mockGetRequestToken).toHaveBeenCalledWith('https://example.com/api/garmin/callback')
  })

  it('saves OAuth state to garmin_oauth_states', async () => {
    mockTableCalls['clients'] = {
      data: { id: 'client-uuid-1', unique_code: 'ABC123', is_active: true, expires_at: null },
      error: null,
    }

    const req = makePostRequest({ clientId: 'ABC123' })
    await POST(req)

    // Verify from('garmin_oauth_states') was called for delete (cleanup) and insert
    const garminCalls = mockSupabase.from.mock.calls.filter(
      (c: any[]) => c[0] === 'garmin_oauth_states'
    )
    expect(garminCalls.length).toBeGreaterThanOrEqual(2)
  })

  it('returns 400 when clientId is missing', async () => {
    const req = makePostRequest({})
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toBeDefined()
  })

  it('returns 404 when client is not found', async () => {
    mockTableCalls['clients'] = {
      data: null,
      error: { message: 'No rows found' },
    }

    const req = makePostRequest({ clientId: 'NONEXISTENT' })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(404)
    expect(json.error).toBeDefined()
  })

  it('returns 403 when client account is inactive', async () => {
    mockTableCalls['clients'] = {
      data: { id: 'client-uuid-1', unique_code: 'ABC123', is_active: false, expires_at: null },
      error: null,
    }

    const req = makePostRequest({ clientId: 'ABC123' })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(403)
    expect(json.error).toBeDefined()
  })

  it('returns 429 when rate limited', async () => {
    mockRateLimit.mockReturnValue({ allowed: false, remaining: 0 })

    const req = makePostRequest({ clientId: 'ABC123' })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(429)
    expect(json.error).toBeDefined()
    // Should not attempt to fetch request token
    expect(mockGetRequestToken).not.toHaveBeenCalled()
  })

  it('calls rateLimit with IP-based key', async () => {
    mockGetClientIP.mockReturnValue('10.0.0.1')

    const req = makePostRequest({ clientId: 'ABC123' }, '10.0.0.1')
    await POST(req)

    expect(mockRateLimit).toHaveBeenCalledTimes(1)
    const [key, maxRequests, windowMs] = mockRateLimit.mock.calls[0]
    expect(key).toContain('10.0.0.1')
    expect(key).toContain('garmin-connect')
    expect(maxRequests).toBe(5)
    expect(windowMs).toBe(60_000)
  })

  it('returns 500 when getRequestToken fails', async () => {
    mockTableCalls['clients'] = {
      data: { id: 'client-uuid-1', unique_code: 'ABC123', is_active: true, expires_at: null },
      error: null,
    }
    mockGetRequestToken.mockRejectedValue(new Error('Garmin request token failed'))

    const req = makePostRequest({ clientId: 'ABC123' })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.error).toBeDefined()
  })

  it('returns 501 when Garmin API is not configured', async () => {
    mockTableCalls['clients'] = {
      data: { id: 'client-uuid-1', unique_code: 'ABC123', is_active: true, expires_at: null },
      error: null,
    }
    mockGetRequestToken.mockRejectedValue(new Error('Garmin API 尚未設定'))

    const req = makePostRequest({ clientId: 'ABC123' })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(501)
    expect(json.error).toContain('尚未設定')
  })
})
