import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ── Hoisted mocks ──

const { mockTableCalls, mockSupabase, createMockQueryBuilder } = vi.hoisted(() => {
  const mockTableCalls: Record<string, { data: any; error: any }> = {}

  function createMockQueryBuilder(data: any = null, error: any = null) {
    const builder: any = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      single: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      upsert: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      not: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
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
const mockFetchGarminDailies = vi.fn()

vi.mock('@/lib/supabase', () => ({
  createServiceSupabase: vi.fn(() => mockSupabase),
}))

vi.mock('@/lib/auth-middleware', () => ({
  rateLimit: (...args: any[]) => mockRateLimit(...args),
  getClientIP: (...args: any[]) => mockGetClientIP(...args),
}))

vi.mock('@/lib/garmin-api', () => ({
  fetchGarminDailies: (...args: any[]) => mockFetchGarminDailies(...args),
}))

import { POST } from '@/app/api/garmin/sync/route'

// ── Helpers ──

function makePostRequest(body: any): NextRequest {
  return new NextRequest('http://localhost:3000/api/garmin/sync', {
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

describe('POST /api/garmin/sync', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    for (const key of Object.keys(mockTableCalls)) {
      delete mockTableCalls[key]
    }
    resetFromMock()

    mockGetClientIP.mockReturnValue('127.0.0.1')
    mockRateLimit.mockResolvedValue({ allowed: true, remaining: 2 })
  })

  it('syncs successfully with Garmin data', async () => {
    let clientsCallCount = 0
    let garminCallCount = 0
    let dailyWellnessCallCount = 0

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'clients') {
        return createMockQueryBuilder(
          { id: 'client-uuid-1', is_active: true, expires_at: null },
          null
        )
      }
      if (table === 'garmin_connections') {
        garminCallCount++
        if (garminCallCount === 1) {
          // First: select access tokens
          return createMockQueryBuilder(
            { access_token: 'token', access_token_secret: 'secret' },
            null
          )
        }
        // Subsequent: update last_sync_at
        return createMockQueryBuilder(null, null)
      }
      if (table === 'daily_wellness') {
        dailyWellnessCallCount++
        if (dailyWellnessCallCount === 1) {
          // select existing records
          return createMockQueryBuilder([], null)
        }
        // upsert
        return createMockQueryBuilder(null, null)
      }
      return createMockQueryBuilder(null, null)
    })

    mockFetchGarminDailies.mockResolvedValue([
      { date: '2024-06-15', device_recovery_score: 80, resting_hr: 55, hrv: 45, wearable_sleep_score: 85, respiratory_rate: 15 },
    ])

    const req = makePostRequest({ clientId: 'ABC123', days: 7 })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.imported).toBe(1)
    expect(json.total).toBe(1)
  })

  it('returns 400 when clientId is missing', async () => {
    const req = makePostRequest({})
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toBeDefined()
  })

  it('returns 404 when client not found', async () => {
    mockTableCalls['clients'] = { data: null, error: { message: 'not found' } }

    const req = makePostRequest({ clientId: 'NONEXISTENT' })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(404)
    expect(json.error).toBeDefined()
  })

  it('returns 404 when no Garmin connection exists', async () => {
    let garminCallCount = 0
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'clients') {
        return createMockQueryBuilder(
          { id: 'client-uuid-1', is_active: true, expires_at: null },
          null
        )
      }
      if (table === 'garmin_connections') {
        return createMockQueryBuilder(null, { message: 'no rows' })
      }
      return createMockQueryBuilder(null, null)
    })

    const req = makePostRequest({ clientId: 'ABC123' })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(404)
    expect(json.error).toBeDefined()
  })

  it('returns 401 when Garmin API token is expired', async () => {
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'clients') {
        return createMockQueryBuilder(
          { id: 'client-uuid-1', is_active: true, expires_at: null },
          null
        )
      }
      if (table === 'garmin_connections') {
        return createMockQueryBuilder(
          { access_token: 'expired', access_token_secret: 'secret' },
          null
        )
      }
      return createMockQueryBuilder(null, null)
    })

    mockFetchGarminDailies.mockRejectedValue(new Error('401 Unauthorized'))

    const req = makePostRequest({ clientId: 'ABC123' })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json.needReconnect).toBe(true)
  })

  it('returns 403 when client account is inactive', async () => {
    mockTableCalls['clients'] = {
      data: { id: 'client-uuid-1', is_active: false, expires_at: null },
      error: null,
    }

    const req = makePostRequest({ clientId: 'ABC123' })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(403)
    expect(json.error).toBeDefined()
  })

  it('returns 429 when rate limited', async () => {
    mockRateLimit.mockResolvedValue({ allowed: false, remaining: 0 })

    const req = makePostRequest({ clientId: 'ABC123' })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(429)
    expect(json.error).toBeDefined()
  })

  it('handles empty Garmin data gracefully', async () => {
    let garminCallCount = 0
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'clients') {
        return createMockQueryBuilder(
          { id: 'client-uuid-1', is_active: true, expires_at: null },
          null
        )
      }
      if (table === 'garmin_connections') {
        garminCallCount++
        if (garminCallCount === 1) {
          return createMockQueryBuilder(
            { access_token: 'token', access_token_secret: 'secret' },
            null
          )
        }
        return createMockQueryBuilder(null, null)
      }
      return createMockQueryBuilder(null, null)
    })

    mockFetchGarminDailies.mockResolvedValue([])

    const req = makePostRequest({ clientId: 'ABC123' })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.imported).toBe(0)
  })
})
