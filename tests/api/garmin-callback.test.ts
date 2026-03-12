import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ── Use vi.hoisted to declare mock state before vi.mock hoisting ──

const { mockSupabase, createMockQueryBuilder } = vi.hoisted(() => {
  function createMockQueryBuilder(data: any = null, error: any = null) {
    const builder: any = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
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
    from: vi.fn((_table: string) => createMockQueryBuilder(null, null)),
  }

  return { mockSupabase, createMockQueryBuilder }
})

const mockGetAccessToken = vi.hoisted(() => vi.fn())

vi.mock('@/lib/supabase', () => ({
  createServiceSupabase: vi.fn(() => mockSupabase),
}))

vi.mock('@/lib/garmin-api', () => ({
  getAccessToken: (...args: any[]) => mockGetAccessToken(...args),
}))

import { GET } from '@/app/api/garmin/callback/route'

// ── Helpers ──

function makeCallbackRequest(params: Record<string, string>): NextRequest {
  const url = new URL('http://localhost:3000/api/garmin/callback')
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }
  return new NextRequest(url.toString(), { method: 'GET' })
}

// ── Tests ──

describe('GET /api/garmin/callback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NEXT_PUBLIC_SITE_URL = 'https://example.com'

    mockGetAccessToken.mockResolvedValue({
      accessToken: 'access-token-abc',
      accessTokenSecret: 'access-secret-xyz',
    })
  })

  it('redirects with success on valid OAuth callback', async () => {
    let garminOAuthStatesCallCount = 0
    let garminConnectionsCallCount = 0

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'garmin_oauth_states') {
        garminOAuthStatesCallCount++
        if (garminOAuthStatesCallCount === 1) {
          // First call: select state by oauth_token
          return createMockQueryBuilder(
            {
              id: 'state-1',
              client_id: 'client-uuid-1',
              oauth_token: 'req-token-123',
              oauth_token_secret: 'req-secret-456',
              created_at: new Date().toISOString(), // not expired
            },
            null
          )
        }
        // Subsequent calls: delete state (cleanup)
        return createMockQueryBuilder(null, null)
      }
      if (table === 'garmin_connections') {
        garminConnectionsCallCount++
        // upsert access tokens
        return createMockQueryBuilder(null, null)
      }
      return createMockQueryBuilder(null, null)
    })

    const req = makeCallbackRequest({
      oauth_token: 'req-token-123',
      oauth_verifier: 'verifier-789',
    })
    const res = await GET(req)

    expect(res.status).toBe(307) // NextResponse.redirect
    const location = res.headers.get('location')!
    expect(location).toContain('garmin_status=success')
  })

  it('exchanges token with correct parameters', async () => {
    let garminOAuthStatesCallCount = 0

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'garmin_oauth_states') {
        garminOAuthStatesCallCount++
        if (garminOAuthStatesCallCount === 1) {
          return createMockQueryBuilder(
            {
              id: 'state-1',
              client_id: 'client-uuid-1',
              oauth_token: 'req-token-123',
              oauth_token_secret: 'req-secret-456',
              created_at: new Date().toISOString(),
            },
            null
          )
        }
        return createMockQueryBuilder(null, null)
      }
      return createMockQueryBuilder(null, null)
    })

    const req = makeCallbackRequest({
      oauth_token: 'req-token-123',
      oauth_verifier: 'verifier-789',
    })
    await GET(req)

    expect(mockGetAccessToken).toHaveBeenCalledWith(
      'req-token-123',
      'req-secret-456',
      'verifier-789'
    )
  })

  it('saves access tokens to garmin_connections via upsert', async () => {
    let garminOAuthStatesCallCount = 0

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'garmin_oauth_states') {
        garminOAuthStatesCallCount++
        if (garminOAuthStatesCallCount === 1) {
          return createMockQueryBuilder(
            {
              id: 'state-1',
              client_id: 'client-uuid-1',
              oauth_token: 'req-token-123',
              oauth_token_secret: 'req-secret-456',
              created_at: new Date().toISOString(),
            },
            null
          )
        }
        return createMockQueryBuilder(null, null)
      }
      return createMockQueryBuilder(null, null)
    })

    const req = makeCallbackRequest({
      oauth_token: 'req-token-123',
      oauth_verifier: 'verifier-789',
    })
    await GET(req)

    // Verify from('garmin_connections') was called for upsert
    const connectionCalls = mockSupabase.from.mock.calls.filter(
      (c: any[]) => c[0] === 'garmin_connections'
    )
    expect(connectionCalls.length).toBeGreaterThanOrEqual(1)
  })

  it('redirects with error when oauth_verifier is missing', async () => {
    const req = makeCallbackRequest({ oauth_token: 'req-token-123' })
    const res = await GET(req)

    expect(res.status).toBe(307)
    const location = res.headers.get('location')!
    expect(location).toContain('garmin_status=error')
    expect(mockGetAccessToken).not.toHaveBeenCalled()
  })

  it('redirects with error when oauth_token is missing', async () => {
    const req = makeCallbackRequest({ oauth_verifier: 'verifier-789' })
    const res = await GET(req)

    expect(res.status).toBe(307)
    const location = res.headers.get('location')!
    expect(location).toContain('garmin_status=error')
    expect(mockGetAccessToken).not.toHaveBeenCalled()
  })

  it('redirects with error when both params are missing', async () => {
    const req = makeCallbackRequest({})
    const res = await GET(req)

    expect(res.status).toBe(307)
    const location = res.headers.get('location')!
    expect(location).toContain('garmin_status=error')
  })

  it('redirects with error when OAuth state is not found (invalid state)', async () => {
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'garmin_oauth_states') {
        // Return null data with error to simulate state not found
        return createMockQueryBuilder(null, { message: 'No rows found' })
      }
      return createMockQueryBuilder(null, null)
    })

    const req = makeCallbackRequest({
      oauth_token: 'invalid-token',
      oauth_verifier: 'verifier-789',
    })
    const res = await GET(req)

    expect(res.status).toBe(307)
    const location = res.headers.get('location')!
    expect(location).toContain('garmin_status=error')
    expect(mockGetAccessToken).not.toHaveBeenCalled()
  })

  it('redirects with error when OAuth state is expired (older than 10 minutes)', async () => {
    const expiredTime = new Date(Date.now() - 11 * 60 * 1000).toISOString() // 11 minutes ago

    let garminOAuthStatesCallCount = 0
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'garmin_oauth_states') {
        garminOAuthStatesCallCount++
        if (garminOAuthStatesCallCount === 1) {
          return createMockQueryBuilder(
            {
              id: 'state-1',
              client_id: 'client-uuid-1',
              oauth_token: 'req-token-123',
              oauth_token_secret: 'req-secret-456',
              created_at: expiredTime,
            },
            null
          )
        }
        // Subsequent calls: delete expired state
        return createMockQueryBuilder(null, null)
      }
      return createMockQueryBuilder(null, null)
    })

    const req = makeCallbackRequest({
      oauth_token: 'req-token-123',
      oauth_verifier: 'verifier-789',
    })
    const res = await GET(req)

    expect(res.status).toBe(307)
    const location = res.headers.get('location')!
    expect(location).toContain('garmin_status=error')
    expect(mockGetAccessToken).not.toHaveBeenCalled()
  })

  it('redirects with error when token exchange fails', async () => {
    let garminOAuthStatesCallCount = 0

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'garmin_oauth_states') {
        garminOAuthStatesCallCount++
        if (garminOAuthStatesCallCount === 1) {
          return createMockQueryBuilder(
            {
              id: 'state-1',
              client_id: 'client-uuid-1',
              oauth_token: 'req-token-123',
              oauth_token_secret: 'req-secret-456',
              created_at: new Date().toISOString(),
            },
            null
          )
        }
        return createMockQueryBuilder(null, null)
      }
      return createMockQueryBuilder(null, null)
    })

    mockGetAccessToken.mockRejectedValue(new Error('Garmin access token failed'))

    const req = makeCallbackRequest({
      oauth_token: 'req-token-123',
      oauth_verifier: 'verifier-789',
    })
    const res = await GET(req)

    expect(res.status).toBe(307)
    const location = res.headers.get('location')!
    expect(location).toContain('garmin_status=error')
  })

  it('redirects with error when upsert to garmin_connections fails', async () => {
    let garminOAuthStatesCallCount = 0

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'garmin_oauth_states') {
        garminOAuthStatesCallCount++
        if (garminOAuthStatesCallCount === 1) {
          return createMockQueryBuilder(
            {
              id: 'state-1',
              client_id: 'client-uuid-1',
              oauth_token: 'req-token-123',
              oauth_token_secret: 'req-secret-456',
              created_at: new Date().toISOString(),
            },
            null
          )
        }
        return createMockQueryBuilder(null, null)
      }
      if (table === 'garmin_connections') {
        // Simulate upsert error
        return createMockQueryBuilder(null, { message: 'DB error' })
      }
      return createMockQueryBuilder(null, null)
    })

    const req = makeCallbackRequest({
      oauth_token: 'req-token-123',
      oauth_verifier: 'verifier-789',
    })
    const res = await GET(req)

    expect(res.status).toBe(307)
    const location = res.headers.get('location')!
    expect(location).toContain('garmin_status=error')
  })
})
