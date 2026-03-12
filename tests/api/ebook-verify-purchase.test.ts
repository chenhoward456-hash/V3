import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ── Hoisted mocks ──

const { mockTableCalls, mockSupabase, createMockQueryBuilder } = vi.hoisted(() => {
  const mockTableCalls: Record<string, { data: any; error: any }> = {}

  function createMockQueryBuilder(data: any = null, error: any = null) {
    const builder: any = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
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

const mockRateLimit = vi.fn()
const mockGetClientIP = vi.fn()

vi.mock('@/lib/supabase', () => ({
  createServiceSupabase: vi.fn(() => mockSupabase),
}))

vi.mock('@/lib/auth-middleware', () => ({
  rateLimit: (...args: any[]) => mockRateLimit(...args),
  getClientIP: (...args: any[]) => mockGetClientIP(...args),
  createErrorResponse: (message: string, status: number) => {
    const { NextResponse } = require('next/server')
    return NextResponse.json({ error: message, code: status }, { status })
  },
}))

import { GET } from '@/app/api/ebook/verify-purchase/route'

// ── Helpers ──

function makeGetRequest(params: Record<string, string>): NextRequest {
  const url = new URL('http://localhost:3000/api/ebook/verify-purchase')
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }
  return new NextRequest(url.toString(), { method: 'GET' })
}

function resetFromMock() {
  mockSupabase.from.mockImplementation((table: string) => {
    const result = mockTableCalls[table] || { data: null, error: null }
    return createMockQueryBuilder(result.data, result.error)
  })
}

// ── Tests ──

describe('GET /api/ebook/verify-purchase', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    for (const key of Object.keys(mockTableCalls)) {
      delete mockTableCalls[key]
    }
    resetFromMock()

    mockGetClientIP.mockReturnValue('127.0.0.1')
    mockRateLimit.mockReturnValue({ allowed: true, remaining: 29 })
  })

  it('returns purchased=true with downloadToken for completed purchase', async () => {
    mockTableCalls['ebook_purchases'] = {
      data: {
        status: 'completed',
        download_token: 'token-abc-123',
        email: 'buyer@example.com',
      },
      error: null,
    }

    const req = makeGetRequest({ order_id: 'HP20240101000001' })
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.purchased).toBe(true)
    expect(json.downloadToken).toBe('token-abc-123')
    expect(json.email).toBe('buyer@example.com')
  })

  it('returns purchased=false when order not found', async () => {
    mockTableCalls['ebook_purchases'] = { data: null, error: null }

    const req = makeGetRequest({ order_id: 'NONEXISTENT' })
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.purchased).toBe(false)
  })

  it('returns purchased=false with status for pending orders', async () => {
    mockTableCalls['ebook_purchases'] = {
      data: { status: 'pending', download_token: null, email: 'buyer@example.com' },
      error: null,
    }

    const req = makeGetRequest({ order_id: 'HP20240101000002' })
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.purchased).toBe(false)
    expect(json.status).toBe('pending')
  })

  it('returns 400 when order_id is missing', async () => {
    const req = makeGetRequest({})
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toBeDefined()
  })

  it('returns 429 when rate limited', async () => {
    mockRateLimit.mockReturnValue({ allowed: false, remaining: 0 })

    const req = makeGetRequest({ order_id: 'HP20240101000001' })
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(429)
    expect(json.error).toBeDefined()
  })

  it('returns 500 when DB throws', async () => {
    mockSupabase.from.mockImplementation(() => {
      throw new Error('Unexpected DB error')
    })

    const req = makeGetRequest({ order_id: 'HP20240101000001' })
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.error).toBeDefined()
  })
})
