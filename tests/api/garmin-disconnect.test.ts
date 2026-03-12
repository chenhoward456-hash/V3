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

const mockRateLimit = vi.fn()
const mockGetClientIP = vi.fn()

vi.mock('@/lib/supabase', () => ({
  createServiceSupabase: vi.fn(() => mockSupabase),
}))

vi.mock('@/lib/auth-middleware', () => ({
  rateLimit: (...args: any[]) => mockRateLimit(...args),
  getClientIP: (...args: any[]) => mockGetClientIP(...args),
}))

import { POST } from '@/app/api/garmin/disconnect/route'

// ── Helpers ──

function makePostRequest(body: any): NextRequest {
  return new NextRequest('http://localhost:3000/api/garmin/disconnect', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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

describe('POST /api/garmin/disconnect', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    for (const key of Object.keys(mockTableCalls)) {
      delete mockTableCalls[key]
    }
    resetFromMock()

    mockGetClientIP.mockReturnValue('127.0.0.1')
    mockRateLimit.mockReturnValue({ allowed: true, remaining: 4 })
  })

  it('disconnects successfully when client and connection exist', async () => {
    mockTableCalls['clients'] = {
      data: { id: 'client-uuid-1' },
      error: null,
    }
    mockTableCalls['garmin_connections'] = { data: null, error: null }

    const req = makePostRequest({ clientId: 'ABC123' })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.message).toBeDefined()
  })

  it('returns 400 when clientId is missing', async () => {
    const req = makePostRequest({})
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toBeDefined()
  })

  it('returns 404 when client not found', async () => {
    mockTableCalls['clients'] = { data: null, error: null }

    const req = makePostRequest({ clientId: 'NONEXISTENT' })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(404)
    expect(json.error).toBeDefined()
  })

  it('returns 429 when rate limited', async () => {
    mockRateLimit.mockReturnValue({ allowed: false, remaining: 0 })

    const req = makePostRequest({ clientId: 'ABC123' })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(429)
    expect(json.error).toBeDefined()
  })

  it('returns 500 when an unexpected error occurs', async () => {
    mockSupabase.from.mockImplementation(() => {
      throw new Error('Unexpected DB error')
    })

    const req = makePostRequest({ clientId: 'ABC123' })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.error).toBeDefined()
  })
})
