import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ── Hoisted mocks ──

const { mockRateLimit, mockGetClientIP, mockCreateErrorResponse } = vi.hoisted(() => ({
  mockRateLimit: vi.fn(),
  mockGetClientIP: vi.fn(),
  mockCreateErrorResponse: vi.fn(),
}))

const { mockFrom, mockSupabase } = vi.hoisted(() => {
  const mockFrom = vi.fn()
  const mockSupabase = { from: mockFrom }
  return { mockFrom, mockSupabase }
})

// ── Module mocks ──

vi.mock('@/lib/auth-middleware', () => ({
  rateLimit: (...args: any[]) => mockRateLimit(...args),
  getClientIP: (...args: any[]) => mockGetClientIP(...args),
  createErrorResponse: (...args: any[]) => mockCreateErrorResponse(...args),
}))

vi.mock('@/lib/supabase', () => ({
  createServiceSupabase: () => mockSupabase,
}))

// ── Helpers ──

function buildRequest(
  params: Record<string, string>,
  cookies?: Record<string, string>,
): NextRequest {
  const url = new URL('http://localhost:3000/api/subscribe/verify')
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

describe('GET /api/subscribe/verify', () => {
  let GET: (request: NextRequest) => Promise<Response>

  beforeEach(async () => {
    vi.resetModules()
    vi.restoreAllMocks()

    mockRateLimit.mockReset()
    mockGetClientIP.mockReset()
    mockCreateErrorResponse.mockReset()
    mockFrom.mockReset()

    mockGetClientIP.mockReturnValue('127.0.0.1')
    mockRateLimit.mockResolvedValue({ allowed: true, remaining: 29 })
    mockCreateErrorResponse.mockImplementation((message: string, status: number) => {
      const { NextResponse } = require('next/server')
      return NextResponse.json({ error: message }, { status })
    })

    vi.doMock('@/lib/auth-middleware', () => ({
      rateLimit: (...args: any[]) => mockRateLimit(...args),
      getClientIP: (...args: any[]) => mockGetClientIP(...args),
      createErrorResponse: (...args: any[]) => mockCreateErrorResponse(...args),
    }))
    vi.doMock('@/lib/supabase', () => ({
      createServiceSupabase: () => mockSupabase,
    }))

    const mod = await import('@/app/api/subscribe/verify/route')
    GET = mod.GET
  })

  it('returns 400 when order_id is missing', async () => {
    const req = buildRequest({})
    const res = await GET(req)

    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBeDefined()
  })

  it('returns 429 when rate limited', async () => {
    mockRateLimit.mockResolvedValue({ allowed: false, remaining: 0 })

    const req = buildRequest({ order_id: 'ORDER123' })
    const res = await GET(req)

    expect(res.status).toBe(429)
    const json = await res.json()
    expect(json.error).toBeDefined()
  })

  it('returns completed:false when purchase not found', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    })

    const req = buildRequest({ order_id: 'NONEXISTENT' })
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.completed).toBe(false)
  })

  it('returns completed:true with tier and name for completed purchase (no signature)', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              status: 'completed',
              client_id: 'client-1',
              subscription_tier: 'premium',
              name: 'Alice',
            },
            error: null,
          }),
        }),
      }),
    })

    const req = buildRequest({ order_id: 'ORDER123' })
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.completed).toBe(true)
    expect(json.tier).toBe('premium')
    expect(json.name).toBe('Alice')
    // Without valid signature, uniqueCode should not be present
    expect(json.uniqueCode).toBeUndefined()
  })

  it('returns completed:true with uniqueCode for valid signature owner', async () => {
    // We need to generate a valid signature to test this path
    // The verifyOrderSignature uses HMAC-SHA256 with SESSION_SECRET env var
    process.env.SESSION_SECRET = 'test-secret'
    const crypto = await import('crypto')
    const orderId = 'ORDER456'
    const sig = crypto.createHmac('sha256', 'test-secret').update(orderId).digest('hex').slice(0, 32)

    // Re-import to pick up new env
    vi.resetModules()
    vi.doMock('@/lib/auth-middleware', () => ({
      rateLimit: (...args: any[]) => mockRateLimit(...args),
      getClientIP: (...args: any[]) => mockGetClientIP(...args),
      createErrorResponse: (...args: any[]) => mockCreateErrorResponse(...args),
    }))
    vi.doMock('@/lib/supabase', () => ({
      createServiceSupabase: () => mockSupabase,
    }))

    const mod = await import('@/app/api/subscribe/verify/route')
    const freshGET = mod.GET

    let fromCallCount = 0
    mockFrom.mockImplementation(() => {
      fromCallCount++
      if (fromCallCount === 1) {
        // subscription_purchases query
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  status: 'completed',
                  client_id: 'client-1',
                  subscription_tier: 'basic',
                  name: 'Bob',
                },
                error: null,
              }),
            }),
          }),
        }
      }
      // clients query for unique_code
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { unique_code: 'UNIQUE123' },
              error: null,
            }),
          }),
        }),
      }
    })

    const req = buildRequest({ order_id: orderId }, { order_sig: sig })
    const res = await freshGET(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.completed).toBe(true)
    expect(json.uniqueCode).toBe('UNIQUE123')
    expect(json.tier).toBe('basic')
    expect(json.name).toBe('Bob')
  })

  it('returns completed:false with failed:true for failed purchase', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              status: 'failed',
              client_id: null,
              subscription_tier: 'basic',
              name: 'Failed',
            },
            error: null,
          }),
        }),
      }),
    })

    const req = buildRequest({ order_id: 'ORDER_FAIL' })
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.completed).toBe(false)
    expect(json.failed).toBe(true)
  })

  it('returns completed:false with status:pending for pending purchase', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              status: 'pending',
              client_id: null,
              subscription_tier: 'basic',
              name: 'Pending',
            },
            error: null,
          }),
        }),
      }),
    })

    const req = buildRequest({ order_id: 'ORDER_PEND' })
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.completed).toBe(false)
    expect(json.status).toBe('pending')
  })

  it('returns 500 on unexpected exception', async () => {
    mockFrom.mockImplementation(() => {
      throw new Error('DB connection error')
    })

    const req = buildRequest({ order_id: 'ORDER_ERR' })
    const res = await GET(req)

    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.error).toBeDefined()
  })
})
