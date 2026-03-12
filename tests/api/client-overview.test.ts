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

const { mockVerifyCoachAuth } = vi.hoisted(() => {
  const mockVerifyCoachAuth = vi.fn()
  return { mockVerifyCoachAuth }
})

// ── Module mocks ──

vi.mock('@/lib/supabase', () => ({
  createServiceSupabase: () => mockSupabase,
}))

vi.mock('@/lib/auth-middleware', () => ({
  verifyCoachAuth: mockVerifyCoachAuth,
}))

import { GET } from '@/app/api/client-overview/route'

// ── Helpers ──

function resetFromMock() {
  mockSupabase.from.mockImplementation((table: string) => {
    const result = mockTableCalls[table] || { data: null, error: null }
    return createMockQueryBuilder(result.data, result.error)
  })
}

function makeGetRequest(params: Record<string, string>): NextRequest {
  const url = new URL('http://localhost:3000/api/client-overview')
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }
  return new NextRequest(url.toString(), { method: 'GET' })
}

// ── Tests ──

describe('GET /api/client-overview', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    for (const key of Object.keys(mockTableCalls)) {
      delete mockTableCalls[key]
    }
    resetFromMock()
    mockVerifyCoachAuth.mockResolvedValue({ authorized: true })
  })

  it('returns 401 when coach auth fails', async () => {
    mockVerifyCoachAuth.mockResolvedValue({ authorized: false })

    const req = makeGetRequest({ clientId: 'ABC123' })
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json.error).toBeDefined()
  })

  it('returns 400 when clientId is missing', async () => {
    const req = makeGetRequest({})
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toBe('clientId is required')
  })

  it('returns 404 when client not found', async () => {
    mockTableCalls['clients'] = { data: null, error: { message: 'Not found' } }

    const req = makeGetRequest({ clientId: 'NONEXISTENT' })
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(404)
    expect(json.error).toBeDefined()
  })

  it('returns overview data for a valid unique_code clientId', async () => {
    const clientData = { id: 'uuid-1', unique_code: 'ABC123', name: 'Test Client' }

    // Use sequential from() calls because the route calls from('clients') multiple times
    // (once for lookup, once for update) and then 7 parallel queries
    let clientsCallCount = 0
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'clients') {
        clientsCallCount++
        if (clientsCallCount === 1) {
          // Lookup call
          return createMockQueryBuilder(clientData, null)
        }
        // Update call (fire-and-forget)
        return createMockQueryBuilder(null, null)
      }
      // All other tables return empty arrays
      const result = mockTableCalls[table] || { data: [], error: null }
      return createMockQueryBuilder(result.data, result.error)
    })

    const req = makeGetRequest({ clientId: 'ABC123' })
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.client).toEqual(clientData)
    expect(json.supplements).toEqual([])
    expect(json.supplementLogs).toEqual([])
    expect(json.wellness).toEqual([])
    expect(json.trainingLogs).toEqual([])
    expect(json.bodyData).toEqual([])
    expect(json.labResults).toEqual([])
    expect(json.nutritionLogs).toEqual([])
  })

  it('returns overview data with populated tables', async () => {
    const clientData = { id: 'uuid-1', unique_code: 'ABC123', name: 'Test Client' }
    const supplementsData = [{ id: 's1', name: 'Creatine' }]
    const wellnessData = [{ id: 'w1', date: '2024-03-01', energy_level: 4 }]

    let clientsCallCount = 0
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'clients') {
        clientsCallCount++
        if (clientsCallCount === 1) return createMockQueryBuilder(clientData, null)
        return createMockQueryBuilder(null, null)
      }
      if (table === 'supplements') return createMockQueryBuilder(supplementsData, null)
      if (table === 'daily_wellness') return createMockQueryBuilder(wellnessData, null)
      return createMockQueryBuilder([], null)
    })

    const req = makeGetRequest({ clientId: 'ABC123' })
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.client.name).toBe('Test Client')
    expect(json.supplements).toEqual(supplementsData)
    expect(json.wellness).toEqual(wellnessData)
  })

  it('returns overview data when queried by UUID', async () => {
    const uuid = '550e8400-e29b-41d4-a716-446655440000'
    const clientData = { id: uuid, unique_code: 'ABC123', name: 'UUID Client' }

    let clientsCallCount = 0
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'clients') {
        clientsCallCount++
        if (clientsCallCount === 1) return createMockQueryBuilder(clientData, null)
        return createMockQueryBuilder(null, null)
      }
      return createMockQueryBuilder([], null)
    })

    const req = makeGetRequest({ clientId: uuid })
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.client.id).toBe(uuid)
  })

  it('returns 500 on unexpected server error', async () => {
    // Force an exception by making from throw
    mockSupabase.from.mockImplementation(() => {
      throw new Error('Unexpected DB crash')
    })

    const req = makeGetRequest({ clientId: 'ABC123' })
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.error).toBeDefined()
  })
})
