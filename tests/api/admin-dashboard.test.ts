import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ── Use vi.hoisted to declare mock state before vi.mock hoisting ──

const { mockSupabase, createMockQueryBuilder } = vi.hoisted(() => {
  function createMockQueryBuilder(data: any = null, error: any = null) {
    const builder: any = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      not: vi.fn().mockReturnThis(),
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
    from: vi.fn((_table: string) => {
      return createMockQueryBuilder([], null)
    }),
  }

  return { mockSupabase, createMockQueryBuilder }
})

const mockVerifyAdminSession = vi.hoisted(() => vi.fn())

vi.mock('@/lib/supabase', () => ({
  createServiceSupabase: vi.fn(() => mockSupabase),
}))

vi.mock('@/lib/auth-middleware', () => ({
  verifyAdminSession: (...args: any[]) => mockVerifyAdminSession(...args),
}))

vi.mock('@/lib/logger', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
}))

import { GET } from '@/app/api/admin/dashboard/route'

// ── Helpers ──

function makeGetRequest(options: { withSession?: boolean } = {}): NextRequest {
  const { withSession = true } = options
  const headers: Record<string, string> = {}
  if (withSession) {
    headers['Cookie'] = 'admin_session=valid-token-123'
  }
  return new NextRequest('http://localhost:3000/api/admin/dashboard', {
    method: 'GET',
    headers,
  })
}

// ── Tests ──

describe('GET /api/admin/dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockVerifyAdminSession.mockReturnValue(true)
    // Default: all queries return empty arrays
    mockSupabase.from.mockImplementation((_table: string) => {
      return createMockQueryBuilder([], null)
    })
  })

  it('returns 401 without admin session cookie', async () => {
    const req = makeGetRequest({ withSession: false })
    const res = await GET(req)

    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.error).toBeDefined()
  })

  it('returns 401 when session token is invalid', async () => {
    mockVerifyAdminSession.mockReturnValue(false)

    const req = makeGetRequest()
    const res = await GET(req)

    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.error).toBeDefined()
  })

  it('returns all expected data keys on success', async () => {
    const req = makeGetRequest()
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json).toHaveProperty('clients')
    expect(json).toHaveProperty('supplementLogs')
    expect(json).toHaveProperty('supplements')
    expect(json).toHaveProperty('todayWellness')
    expect(json).toHaveProperty('todayLogs')
    expect(json).toHaveProperty('todayTraining')
    expect(json).toHaveProperty('todayNutrition')
    expect(json).toHaveProperty('todayBody')
    expect(json).toHaveProperty('recentBody')
    expect(json).toHaveProperty('recentNutrition')
    expect(json).toHaveProperty('recentWellness')
    expect(json).toHaveProperty('recentTrainingRPE')
  })

  it('returns client data from Supabase', async () => {
    const clients = [
      { id: 'c1', name: 'Client 1', unique_code: 'ABC', status: 'active', is_active: true },
      { id: 'c2', name: 'Client 2', unique_code: 'DEF', status: 'active', is_active: true },
    ]

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'clients') {
        return createMockQueryBuilder(clients, null)
      }
      return createMockQueryBuilder([], null)
    })

    const req = makeGetRequest()
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.clients).toEqual(clients)
    expect(json.clients).toHaveLength(2)
  })

  it('applies .limit(500) on the clients query', async () => {
    const limitSpy = vi.fn()

    mockSupabase.from.mockImplementation((table: string) => {
      const builder = createMockQueryBuilder([], null)
      if (table === 'clients') {
        // Replace limit with our spy, returning the builder so .then resolves
        limitSpy.mockReturnValue(builder)
        builder.limit = limitSpy
      }
      return builder
    })

    const req = makeGetRequest()
    await GET(req)

    expect(limitSpy).toHaveBeenCalledWith(500)
  })

  it('returns empty arrays when Supabase returns null data', async () => {
    mockSupabase.from.mockImplementation((_table: string) => {
      return createMockQueryBuilder(null, null)
    })

    const req = makeGetRequest()
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    // Route uses `|| []` fallback for null data
    expect(json.clients).toEqual([])
    expect(json.supplementLogs).toEqual([])
    expect(json.todayWellness).toEqual([])
  })

  it('still returns 200 when individual queries have errors (logs warning)', async () => {
    // Some queries succeed, some fail - the route logs warnings but does not block
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'clients') {
        return createMockQueryBuilder([{ id: 'c1', name: 'Test' }], null)
      }
      if (table === 'supplement_logs') {
        return createMockQueryBuilder(null, { message: 'timeout' })
      }
      return createMockQueryBuilder([], null)
    })

    const req = makeGetRequest()
    const res = await GET(req)
    const json = await res.json()

    // Still returns 200, with fallback empty arrays for failed queries
    expect(res.status).toBe(200)
    expect(json.clients).toHaveLength(1)
    expect(json.supplementLogs).toEqual([])
  })

  it('returns 500 when an unexpected exception occurs', async () => {
    // Force the Promise.all to reject by throwing in from()
    mockSupabase.from.mockImplementation(() => {
      throw new Error('Unexpected connection error')
    })

    const req = makeGetRequest()
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.error).toBeDefined()
  })

  it('calls verifyAdminSession with the cookie value', async () => {
    const req = makeGetRequest()
    await GET(req)

    expect(mockVerifyAdminSession).toHaveBeenCalledWith('valid-token-123')
  })
})
