import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ── Hoisted mocks ──

const { mockTableCalls, mockSupabase, createMockQueryBuilder } = vi.hoisted(() => {
  const mockTableCalls: Record<string, { data: any; error: any }> = {}

  function createMockQueryBuilder(data: any = null, error: any = null) {
    const builder: any = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
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

const { mockRateLimit } = vi.hoisted(() => {
  const mockRateLimit = vi.fn()
  return { mockRateLimit }
})

// ── Module mocks ──

vi.mock('@/lib/supabase', () => ({
  createServiceSupabase: () => mockSupabase,
}))

vi.mock('@/lib/auth-middleware', () => ({
  rateLimit: mockRateLimit,
  getClientIP: vi.fn().mockReturnValue('127.0.0.1'),
  createErrorResponse: vi.fn().mockImplementation((message: string, status: number) => {
    const { NextResponse } = require('next/server')
    return NextResponse.json({ error: message, code: status, timestamp: new Date().toISOString() }, { status })
  }),
  createSuccessResponse: vi.fn().mockImplementation((data: any) => {
    const { NextResponse } = require('next/server')
    return NextResponse.json({ success: true, data, timestamp: new Date().toISOString() })
  }),
}))

import { PUT } from '@/app/api/prep-phase/route'

// ── Helpers ──

function resetFromMock() {
  mockSupabase.from.mockImplementation((table: string) => {
    const result = mockTableCalls[table] || { data: null, error: null }
    return createMockQueryBuilder(result.data, result.error)
  })
}

function makePutRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost:3000/api/prep-phase', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

// ── Tests ──

describe('PUT /api/prep-phase', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    for (const key of Object.keys(mockTableCalls)) {
      delete mockTableCalls[key]
    }
    resetFromMock()
    mockRateLimit.mockReturnValue({ allowed: true, remaining: 9 })
  })

  it('returns 429 when rate limited', async () => {
    mockRateLimit.mockReturnValue({ allowed: false, remaining: 0 })

    const req = makePutRequest({ clientId: 'ABC123', prepPhase: 'bulk' })
    const res = await PUT(req)
    const json = await res.json()

    expect(res.status).toBe(429)
    expect(json.error).toBeDefined()
  })

  it('returns 400 when clientId is missing', async () => {
    const req = makePutRequest({ prepPhase: 'bulk' })
    const res = await PUT(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toBeDefined()
  })

  it('returns 400 when prepPhase is missing', async () => {
    const req = makePutRequest({ clientId: 'ABC123' })
    const res = await PUT(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toBeDefined()
  })

  it('returns 400 for invalid prep phase value', async () => {
    mockTableCalls['clients'] = {
      data: { id: 'uuid-1', client_mode: 'bodybuilding', competition_enabled: true },
      error: null,
    }

    const req = makePutRequest({ clientId: 'ABC123', prepPhase: 'invalid_phase' })
    const res = await PUT(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toBeDefined()
  })

  it('returns 404 when client not found', async () => {
    mockTableCalls['clients'] = { data: null, error: { message: 'Not found' } }

    const req = makePutRequest({ clientId: 'NONEXISTENT', prepPhase: 'bulk' })
    const res = await PUT(req)
    const json = await res.json()

    expect(res.status).toBe(404)
    expect(json.error).toBeDefined()
  })

  it('returns 400 when client_mode is standard (not competition mode)', async () => {
    let clientsCallCount = 0
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'clients') {
        clientsCallCount++
        if (clientsCallCount === 1) {
          return createMockQueryBuilder(
            { id: 'uuid-1', client_mode: 'standard', competition_enabled: false },
            null
          )
        }
        return createMockQueryBuilder(null, null)
      }
      return createMockQueryBuilder(null, null)
    })

    const req = makePutRequest({ clientId: 'ABC123', prepPhase: 'bulk' })
    const res = await PUT(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toBeDefined()
  })

  it('returns 400 when client_mode is health (not competition mode)', async () => {
    let clientsCallCount = 0
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'clients') {
        clientsCallCount++
        if (clientsCallCount === 1) {
          return createMockQueryBuilder(
            { id: 'uuid-1', client_mode: 'health', health_mode_enabled: true, competition_enabled: false },
            null
          )
        }
        return createMockQueryBuilder(null, null)
      }
      return createMockQueryBuilder(null, null)
    })

    const req = makePutRequest({ clientId: 'ABC123', prepPhase: 'bulk' })
    const res = await PUT(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toBeDefined()
  })

  it('updates prep phase successfully for bodybuilding client', async () => {
    let clientsCallCount = 0
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'clients') {
        clientsCallCount++
        if (clientsCallCount === 1) {
          // Lookup
          return createMockQueryBuilder(
            { id: 'uuid-1', client_mode: 'bodybuilding', competition_enabled: true },
            null
          )
        }
        // Update
        return createMockQueryBuilder(null, null)
      }
      return createMockQueryBuilder(null, null)
    })

    const req = makePutRequest({ clientId: 'ABC123', prepPhase: 'bulk' })
    const res = await PUT(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data.prepPhase).toBe('bulk')
  })

  it('updates prep phase successfully for athletic client', async () => {
    let clientsCallCount = 0
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'clients') {
        clientsCallCount++
        if (clientsCallCount === 1) {
          return createMockQueryBuilder(
            { id: 'uuid-1', client_mode: 'athletic', competition_enabled: true },
            null
          )
        }
        return createMockQueryBuilder(null, null)
      }
      return createMockQueryBuilder(null, null)
    })

    const req = makePutRequest({ clientId: 'ABC123', prepPhase: 'weight_cut' })
    const res = await PUT(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data.prepPhase).toBe('weight_cut')
  })

  it('accepts all valid bodybuilding phase values', async () => {
    const validPhases = ['off_season', 'bulk', 'cut', 'peak_week', 'competition', 'recovery']

    for (const phase of validPhases) {
      vi.clearAllMocks()
      resetFromMock()
      mockRateLimit.mockReturnValue({ allowed: true, remaining: 9 })

      let clientsCallCount = 0
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'clients') {
          clientsCallCount++
          if (clientsCallCount === 1) {
            return createMockQueryBuilder(
              { id: 'uuid-1', client_mode: 'bodybuilding', competition_enabled: true },
              null
            )
          }
          return createMockQueryBuilder(null, null)
        }
        return createMockQueryBuilder(null, null)
      })

      const req = makePutRequest({ clientId: 'ABC123', prepPhase: phase })
      const res = await PUT(req)

      expect(res.status).toBe(200)
    }
  })

  it('accepts all valid athletic phase values', async () => {
    const validPhases = ['off_season', 'training_camp', 'weight_cut', 'weigh_in', 'rebound', 'competition', 'recovery']

    for (const phase of validPhases) {
      vi.clearAllMocks()
      resetFromMock()
      mockRateLimit.mockReturnValue({ allowed: true, remaining: 9 })

      let clientsCallCount = 0
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'clients') {
          clientsCallCount++
          if (clientsCallCount === 1) {
            return createMockQueryBuilder(
              { id: 'uuid-1', client_mode: 'athletic', competition_enabled: true },
              null
            )
          }
          return createMockQueryBuilder(null, null)
        }
        return createMockQueryBuilder(null, null)
      })

      const req = makePutRequest({ clientId: 'ABC123', prepPhase: phase })
      const res = await PUT(req)

      expect(res.status).toBe(200)
    }
  })

  it('rejects bodybuilding-only phases for athletic client', async () => {
    const bodybuildingOnlyPhases = ['bulk', 'cut', 'peak_week']

    for (const phase of bodybuildingOnlyPhases) {
      vi.clearAllMocks()
      resetFromMock()
      mockRateLimit.mockReturnValue({ allowed: true, remaining: 9 })

      let clientsCallCount = 0
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'clients') {
          clientsCallCount++
          if (clientsCallCount === 1) {
            return createMockQueryBuilder(
              { id: 'uuid-1', client_mode: 'athletic', competition_enabled: true },
              null
            )
          }
          return createMockQueryBuilder(null, null)
        }
        return createMockQueryBuilder(null, null)
      })

      const req = makePutRequest({ clientId: 'ABC123', prepPhase: phase })
      const res = await PUT(req)

      expect(res.status).toBe(400)
    }
  })

  it('rejects athletic-only phases for bodybuilding client', async () => {
    const athleticOnlyPhases = ['training_camp', 'weight_cut', 'weigh_in', 'rebound']

    for (const phase of athleticOnlyPhases) {
      vi.clearAllMocks()
      resetFromMock()
      mockRateLimit.mockReturnValue({ allowed: true, remaining: 9 })

      let clientsCallCount = 0
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'clients') {
          clientsCallCount++
          if (clientsCallCount === 1) {
            return createMockQueryBuilder(
              { id: 'uuid-1', client_mode: 'bodybuilding', competition_enabled: true },
              null
            )
          }
          return createMockQueryBuilder(null, null)
        }
        return createMockQueryBuilder(null, null)
      })

      const req = makePutRequest({ clientId: 'ABC123', prepPhase: phase })
      const res = await PUT(req)

      expect(res.status).toBe(400)
    }
  })

  it('returns 500 when update fails', async () => {
    let clientsCallCount = 0
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'clients') {
        clientsCallCount++
        if (clientsCallCount === 1) {
          return createMockQueryBuilder(
            { id: 'uuid-1', client_mode: 'bodybuilding', competition_enabled: true },
            null
          )
        }
        // Update fails
        return createMockQueryBuilder(null, { message: 'DB write error' })
      }
      return createMockQueryBuilder(null, null)
    })

    const req = makePutRequest({ clientId: 'ABC123', prepPhase: 'cut' })
    const res = await PUT(req)
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.error).toBeDefined()
  })

  it('returns 500 on unexpected exception', async () => {
    const req = new NextRequest('http://localhost:3000/api/prep-phase', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-valid-json{{{',
    })

    const res = await PUT(req)
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.error).toBeDefined()
  })
})
