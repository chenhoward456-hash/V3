import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ── Hoisted mocks ──

const {
  mockFrom,
  mockSupabase,
} = vi.hoisted(() => {
  const mockFrom = vi.fn()
  const mockSupabase = { from: mockFrom }
  return { mockFrom, mockSupabase }
})

const { mockRateLimit } = vi.hoisted(() => {
  const mockRateLimit = vi.fn()
  return { mockRateLimit }
})

const { mockVerifyAuth, mockIsCoach } = vi.hoisted(() => {
  const mockVerifyAuth = vi.fn()
  const mockIsCoach = vi.fn()
  return { mockVerifyAuth, mockIsCoach }
})

const { mockValidateDate } = vi.hoisted(() => {
  const mockValidateDate = vi.fn()
  return { mockValidateDate }
})

// ── Module mocks ──

vi.mock('@/lib/supabase', () => ({
  createServiceSupabase: () => mockSupabase,
}))

vi.mock('@/lib/auth-middleware', () => ({
  rateLimit: mockRateLimit,
  getClientIP: vi.fn().mockReturnValue('127.0.0.1'),
  verifyAuth: mockVerifyAuth,
  isCoach: mockIsCoach,
  createErrorResponse: vi.fn().mockImplementation((message: string, status: number) => {
    const { NextResponse } = require('next/server')
    return NextResponse.json({ error: message, code: status }, { status })
  }),
  createSuccessResponse: vi.fn().mockImplementation((data: any) => {
    const { NextResponse } = require('next/server')
    return NextResponse.json({ success: true, data })
  }),
}))

vi.mock('@/utils/validation', () => ({
  validateDate: mockValidateDate,
}))

import { GET, POST } from '@/app/api/supplement-logs/route'

// ── Helpers ──

function buildGetRequest(params: Record<string, string>): NextRequest {
  const url = new URL('http://localhost:3000/api/supplement-logs')
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }
  return new NextRequest(url.toString(), { method: 'GET' })
}

function buildPostRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost:3000/api/supplement-logs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

// ── Tests ──

describe('GET /api/supplement-logs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockValidateDate.mockReturnValue({ isValid: true, error: '' })
  })

  it('returns supplement logs for valid client and date', async () => {
    const logs = [
      { id: 'sl-1', client_id: 'c1', supplement_id: 's1', date: '2024-03-01', completed: true },
    ]

    let fromCallCount = 0
    mockFrom.mockImplementation(() => {
      fromCallCount++
      if (fromCallCount === 1) {
        // clients table
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockReturnValue({ data: { id: 'c1' }, error: null }),
            }),
          }),
        }
      }
      // supplement_logs table
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({ data: logs, error: null }),
            }),
          }),
        }),
      }
    })

    const req = buildGetRequest({ clientId: 'UNIQUE123', date: '2024-03-01' })
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json).toEqual(logs)
  })

  it('returns empty array when no logs exist', async () => {
    let fromCallCount = 0
    mockFrom.mockImplementation(() => {
      fromCallCount++
      if (fromCallCount === 1) {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockReturnValue({ data: { id: 'c1' }, error: null }),
            }),
          }),
        }
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({ data: [], error: null }),
            }),
          }),
        }),
      }
    })

    const req = buildGetRequest({ clientId: 'UNIQUE123', date: '2024-03-01' })
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json).toEqual([])
  })

  it('returns 400 when clientId is missing', async () => {
    const req = buildGetRequest({ date: '2024-03-01' })
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toBeDefined()
  })

  it('returns 400 when date is invalid', async () => {
    mockValidateDate.mockReturnValue({ isValid: false, error: '無效的日期格式' })

    const req = buildGetRequest({ clientId: 'UNIQUE123', date: 'bad-date' })
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toBeDefined()
  })

  it('returns 404 when client not found', async () => {
    mockFrom.mockImplementation(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockReturnValue({ data: null, error: null }),
        }),
      }),
    }))

    const req = buildGetRequest({ clientId: 'NONEXISTENT', date: '2024-03-01' })
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(404)
    expect(json.error).toBeDefined()
  })

  it('returns 500 when supplement query fails', async () => {
    let fromCallCount = 0
    mockFrom.mockImplementation(() => {
      fromCallCount++
      if (fromCallCount === 1) {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockReturnValue({ data: { id: 'c1' }, error: null }),
            }),
          }),
        }
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({ data: null, error: { message: 'DB error' } }),
            }),
          }),
        }),
      }
    })

    const req = buildGetRequest({ clientId: 'UNIQUE123', date: '2024-03-01' })
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.error).toBeDefined()
  })

  it('uses today date when date param is not provided', async () => {
    let fromCallCount = 0
    mockFrom.mockImplementation(() => {
      fromCallCount++
      if (fromCallCount === 1) {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockReturnValue({ data: { id: 'c1' }, error: null }),
            }),
          }),
        }
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({ data: [], error: null }),
            }),
          }),
        }),
      }
    })

    const req = buildGetRequest({ clientId: 'UNIQUE123' })
    const res = await GET(req)

    expect(res.status).toBe(200)
  })
})

describe('POST /api/supplement-logs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRateLimit.mockResolvedValue({ allowed: true, remaining: 29 })
    mockValidateDate.mockReturnValue({ isValid: true, error: '' })
  })

  it('creates new supplement log', async () => {
    const savedRecord = {
      id: 'sl-1',
      client_id: 'c1',
      supplement_id: 's1',
      date: '2024-03-01',
      completed: true,
    }

    let fromCallCount = 0
    mockFrom.mockImplementation(() => {
      fromCallCount++
      if (fromCallCount === 1) {
        // clients table lookup
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockReturnValue({
                data: { id: 'c1', expires_at: null },
                error: null,
              }),
            }),
          }),
        }
      }
      // supplement_logs upsert
      return {
        upsert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockReturnValue({ data: savedRecord, error: null }),
          }),
        }),
      }
    })

    const req = buildPostRequest({
      clientId: 'UNIQUE123',
      supplementId: 's1',
      date: '2024-03-01',
      completed: true,
    })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data.completed).toBe(true)
  })

  it('validates required fields - missing clientId', async () => {
    const req = buildPostRequest({
      supplementId: 's1',
      date: '2024-03-01',
      completed: true,
    })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toBeDefined()
  })

  it('validates required fields - missing supplementId', async () => {
    const req = buildPostRequest({
      clientId: 'UNIQUE123',
      date: '2024-03-01',
      completed: true,
    })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toBeDefined()
  })

  it('validates required fields - missing date', async () => {
    const req = buildPostRequest({
      clientId: 'UNIQUE123',
      supplementId: 's1',
      completed: true,
    })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toBeDefined()
  })

  it('validates completed must be boolean', async () => {
    const req = buildPostRequest({
      clientId: 'UNIQUE123',
      supplementId: 's1',
      date: '2024-03-01',
      completed: 'yes',
    })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toBeDefined()
  })

  it('validates date format', async () => {
    mockValidateDate.mockReturnValue({ isValid: false, error: '日期格式必須為 YYYY-MM-DD' })

    const req = buildPostRequest({
      clientId: 'UNIQUE123',
      supplementId: 's1',
      date: 'bad-date',
      completed: true,
    })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toBeDefined()
  })

  it('returns 429 when rate limited', async () => {
    mockRateLimit.mockResolvedValue({ allowed: false, remaining: 0 })

    const req = buildPostRequest({
      clientId: 'UNIQUE123',
      supplementId: 's1',
      date: '2024-03-01',
      completed: true,
    })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(429)
    expect(json.error).toBeDefined()
  })

  it('returns 404 when client not found', async () => {
    mockFrom.mockImplementation(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockReturnValue({ data: null, error: null }),
        }),
      }),
    }))

    const req = buildPostRequest({
      clientId: 'NONEXISTENT',
      supplementId: 's1',
      date: '2024-03-01',
      completed: true,
    })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(404)
    expect(json.error).toBeDefined()
  })

  it('returns 403 when client is expired', async () => {
    mockFrom.mockImplementation(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockReturnValue({
            data: { id: 'c1', expires_at: '2020-01-01T00:00:00Z' },
            error: null,
          }),
        }),
      }),
    }))

    const req = buildPostRequest({
      clientId: 'UNIQUE123',
      supplementId: 's1',
      date: '2024-03-01',
      completed: true,
    })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(403)
    expect(json.error).toBeDefined()
  })

  it('returns 500 when upsert fails', async () => {
    let fromCallCount = 0
    mockFrom.mockImplementation(() => {
      fromCallCount++
      if (fromCallCount === 1) {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockReturnValue({
                data: { id: 'c1', expires_at: null },
                error: null,
              }),
            }),
          }),
        }
      }
      return {
        upsert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockReturnValue({ data: null, error: { message: 'Upsert failed' } }),
          }),
        }),
      }
    })

    const req = buildPostRequest({
      clientId: 'UNIQUE123',
      supplementId: 's1',
      date: '2024-03-01',
      completed: true,
    })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.error).toBeDefined()
  })

  it('returns 500 on unexpected exception', async () => {
    const req = new NextRequest('http://localhost:3000/api/supplement-logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-valid-json{{{',
    })

    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.error).toBeDefined()
  })

  it('allows client with no expiry date', async () => {
    const savedRecord = {
      id: 'sl-2',
      client_id: 'c1',
      supplement_id: 's2',
      date: '2024-03-01',
      completed: false,
    }

    let fromCallCount = 0
    mockFrom.mockImplementation(() => {
      fromCallCount++
      if (fromCallCount === 1) {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockReturnValue({
                data: { id: 'c1', expires_at: null },
                error: null,
              }),
            }),
          }),
        }
      }
      return {
        upsert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockReturnValue({ data: savedRecord, error: null }),
          }),
        }),
      }
    })

    const req = buildPostRequest({
      clientId: 'UNIQUE123',
      supplementId: 's2',
      date: '2024-03-01',
      completed: false,
    })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data.completed).toBe(false)
  })
})
