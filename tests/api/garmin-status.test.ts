import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ── Use vi.hoisted to declare mock state before vi.mock hoisting ──

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

vi.mock('@/lib/supabase', () => ({
  createServiceSupabase: vi.fn(() => mockSupabase),
}))

import { GET } from '@/app/api/garmin/status/route'

// ── Helpers ──

function makeGetRequest(params: Record<string, string>): NextRequest {
  const url = new URL('http://localhost:3000/api/garmin/status')
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

describe('GET /api/garmin/status', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    for (const key of Object.keys(mockTableCalls)) {
      delete mockTableCalls[key]
    }
    resetFromMock()

    process.env.GARMIN_CONSUMER_KEY = 'test-consumer-key'
    process.env.GARMIN_CONSUMER_SECRET = 'test-consumer-secret'
  })

  it('returns connected status when garmin_connections exists', async () => {
    mockTableCalls['clients'] = {
      data: { id: 'client-uuid-1' },
      error: null,
    }
    mockTableCalls['garmin_connections'] = {
      data: { last_sync_at: '2024-06-15T10:00:00Z', created_at: '2024-06-01T08:00:00Z' },
      error: null,
    }

    const req = makeGetRequest({ clientId: 'ABC123' })
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.connected).toBe(true)
    expect(json.configured).toBe(true)
    expect(json.lastSyncAt).toBe('2024-06-15T10:00:00Z')
    expect(json.connectedAt).toBe('2024-06-01T08:00:00Z')
  })

  it('returns disconnected status when no garmin_connections found', async () => {
    mockTableCalls['clients'] = {
      data: { id: 'client-uuid-1' },
      error: null,
    }
    // garmin_connections returns null (no connection)
    mockTableCalls['garmin_connections'] = {
      data: null,
      error: null,
    }

    const req = makeGetRequest({ clientId: 'ABC123' })
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.connected).toBe(false)
    expect(json.lastSyncAt).toBeNull()
    expect(json.connectedAt).toBeNull()
  })

  it('returns configured: false when GARMIN env vars are missing', async () => {
    delete process.env.GARMIN_CONSUMER_KEY
    delete process.env.GARMIN_CONSUMER_SECRET

    mockTableCalls['clients'] = {
      data: { id: 'client-uuid-1' },
      error: null,
    }
    mockTableCalls['garmin_connections'] = {
      data: null,
      error: null,
    }

    const req = makeGetRequest({ clientId: 'ABC123' })
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.configured).toBe(false)
  })

  it('returns 400 when clientId is missing', async () => {
    const req = makeGetRequest({})
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toBeDefined()
  })

  it('returns 404 when client is not found', async () => {
    mockTableCalls['clients'] = {
      data: null,
      error: null,
    }

    const req = makeGetRequest({ clientId: 'NONEXISTENT' })
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(404)
    expect(json.error).toBeDefined()
  })

  it('returns 500 when an unexpected error occurs', async () => {
    // Simulate a throw by making the from() call throw
    mockSupabase.from.mockImplementation(() => {
      throw new Error('Unexpected DB error')
    })

    const req = makeGetRequest({ clientId: 'ABC123' })
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.error).toBeDefined()
  })
})
