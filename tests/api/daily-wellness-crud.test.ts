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

// ── Module mocks ──

vi.mock('@/lib/supabase', () => ({
  createServiceSupabase: () => mockSupabase,
}))

vi.mock('@/lib/auth-middleware', () => ({
  rateLimit: mockRateLimit,
  getClientIP: vi.fn().mockReturnValue('127.0.0.1'),
  sanitizeTextField: vi.fn().mockImplementation((input: string | null | undefined) => {
    if (!input || typeof input !== 'string') return null
    return input.trim()
  }),
}))

import { GET, POST } from '@/app/api/daily-wellness/route'

// ── Helpers ──

function buildGetRequest(params: Record<string, string>): NextRequest {
  const url = new URL('http://localhost:3000/api/daily-wellness')
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }
  return new NextRequest(url.toString(), { method: 'GET' })
}

function buildPostRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost:3000/api/daily-wellness', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

// ── Tests ──

describe('GET /api/daily-wellness', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns wellness data for valid client and date', async () => {
    const wellnessRecord = {
      id: 'w-1',
      client_id: 'c1',
      date: '2024-03-01',
      sleep_quality: 4,
      energy_level: 3,
      mood: 5,
      note: 'Feeling good',
    }

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
      // daily_wellness table
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockReturnValue({ data: wellnessRecord, error: null }),
            }),
          }),
        }),
      }
    })

    const req = buildGetRequest({ clientId: 'UNIQUE123', date: '2024-03-01' })
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data.sleep_quality).toBe(4)
    expect(json.data.energy_level).toBe(3)
    expect(json.data.mood).toBe(5)
  })

  it('returns stub record when no wellness log exists', async () => {
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
              maybeSingle: vi.fn().mockReturnValue({ data: null, error: null }),
            }),
          }),
        }),
      }
    })

    const req = buildGetRequest({ clientId: 'UNIQUE123', date: '2024-03-01' })
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data.sleep_quality).toBeNull()
    expect(json.data.energy_level).toBeNull()
    expect(json.data.mood).toBeNull()
    expect(json.data.note).toBeNull()
    expect(json.message).toBeDefined()
  })

  it('returns 400 when clientId is missing', async () => {
    const req = buildGetRequest({ date: '2024-03-01' })
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toBeDefined()
  })

  it('returns 400 when date is missing', async () => {
    const req = buildGetRequest({ clientId: 'UNIQUE123' })
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toBeDefined()
  })

  it('returns 404 when client not found', async () => {
    mockFrom.mockImplementation(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockReturnValue({ data: null, error: { message: 'Not found' } }),
        }),
      }),
    }))

    const req = buildGetRequest({ clientId: 'NONEXISTENT', date: '2024-03-01' })
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(404)
    expect(json.error).toBeDefined()
  })

  it('returns 500 when wellness query fails', async () => {
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
              maybeSingle: vi.fn().mockReturnValue({ data: null, error: { message: 'DB error' } }),
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
})

describe('POST /api/daily-wellness', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRateLimit.mockResolvedValue({ allowed: true, remaining: 29 })
  })

  it('creates new wellness log', async () => {
    const savedRecord = {
      id: 'w-1',
      client_id: 'c1',
      date: '2024-03-01',
      sleep_quality: 4,
      energy_level: 3,
      mood: 5,
      note: 'Great day',
    }

    let fromCallCount = 0
    mockFrom.mockImplementation(() => {
      fromCallCount++
      if (fromCallCount === 1) {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockReturnValue({
                data: { id: 'c1', is_active: true, expires_at: null },
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
      date: '2024-03-01',
      sleep_quality: 4,
      energy_level: 3,
      mood: 5,
      note: 'Great day',
    })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data.sleep_quality).toBe(4)
    expect(json.data.energy_level).toBe(3)
    expect(json.message).toBeDefined()
  })

  it('validates required fields - missing clientId', async () => {
    const req = buildPostRequest({ date: '2024-03-01', sleep_quality: 3 })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toBeDefined()
  })

  it('validates required fields - missing date', async () => {
    const req = buildPostRequest({ clientId: 'UNIQUE123', sleep_quality: 3 })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toBeDefined()
  })

  it('validates sleep_quality range - too high', async () => {
    const req = buildPostRequest({
      clientId: 'UNIQUE123',
      date: '2024-03-01',
      sleep_quality: 6,
    })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toBeDefined()
  })

  it('validates sleep_quality range - too low', async () => {
    const req = buildPostRequest({
      clientId: 'UNIQUE123',
      date: '2024-03-01',
      sleep_quality: 0,
    })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toBeDefined()
  })

  it('validates energy_level range', async () => {
    const req = buildPostRequest({
      clientId: 'UNIQUE123',
      date: '2024-03-01',
      energy_level: 10,
    })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toBeDefined()
  })

  it('validates mood range', async () => {
    const req = buildPostRequest({
      clientId: 'UNIQUE123',
      date: '2024-03-01',
      mood: -1,
    })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toBeDefined()
  })

  it('validates training_drive range', async () => {
    const req = buildPostRequest({
      clientId: 'UNIQUE123',
      date: '2024-03-01',
      training_drive: 6,
    })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toBeDefined()
  })

  it('validates cognitive_clarity range', async () => {
    const req = buildPostRequest({
      clientId: 'UNIQUE123',
      date: '2024-03-01',
      cognitive_clarity: 0,
    })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toBeDefined()
  })

  it('validates stress_level range', async () => {
    const req = buildPostRequest({
      clientId: 'UNIQUE123',
      date: '2024-03-01',
      stress_level: 7,
    })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toBeDefined()
  })

  it('validates resting_hr range', async () => {
    const req = buildPostRequest({
      clientId: 'UNIQUE123',
      date: '2024-03-01',
      resting_hr: 200,
    })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toBeDefined()
  })

  it('validates hrv range', async () => {
    const req = buildPostRequest({
      clientId: 'UNIQUE123',
      date: '2024-03-01',
      hrv: 500,
    })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toBeDefined()
  })

  it('validates wearable_sleep_score range', async () => {
    const req = buildPostRequest({
      clientId: 'UNIQUE123',
      date: '2024-03-01',
      wearable_sleep_score: 101,
    })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toBeDefined()
  })

  it('validates respiratory_rate range', async () => {
    const req = buildPostRequest({
      clientId: 'UNIQUE123',
      date: '2024-03-01',
      respiratory_rate: 50,
    })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toBeDefined()
  })

  it('validates device_recovery_score range', async () => {
    const req = buildPostRequest({
      clientId: 'UNIQUE123',
      date: '2024-03-01',
      device_recovery_score: 150,
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
      date: '2024-03-01',
      sleep_quality: 3,
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
          single: vi.fn().mockReturnValue({ data: null, error: { message: 'Not found' } }),
        }),
      }),
    }))

    const req = buildPostRequest({
      clientId: 'NONEXISTENT',
      date: '2024-03-01',
      sleep_quality: 3,
    })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(404)
    expect(json.error).toBeDefined()
  })

  it('returns 403 when client is inactive', async () => {
    mockFrom.mockImplementation(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockReturnValue({
            data: { id: 'c1', is_active: false, expires_at: null },
            error: null,
          }),
        }),
      }),
    }))

    const req = buildPostRequest({
      clientId: 'UNIQUE123',
      date: '2024-03-01',
      sleep_quality: 3,
    })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(403)
    expect(json.error).toBeDefined()
  })

  it('returns 403 when client is expired', async () => {
    mockFrom.mockImplementation(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockReturnValue({
            data: { id: 'c1', is_active: true, expires_at: '2020-01-01T00:00:00Z' },
            error: null,
          }),
        }),
      }),
    }))

    const req = buildPostRequest({
      clientId: 'UNIQUE123',
      date: '2024-03-01',
      sleep_quality: 3,
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
                data: { id: 'c1', is_active: true, expires_at: null },
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
      date: '2024-03-01',
      sleep_quality: 3,
    })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.error).toBeDefined()
  })

  it('accepts null score values', async () => {
    const savedRecord = {
      id: 'w-2',
      client_id: 'c1',
      date: '2024-03-01',
      sleep_quality: null,
      energy_level: null,
      mood: null,
      note: null,
    }

    let fromCallCount = 0
    mockFrom.mockImplementation(() => {
      fromCallCount++
      if (fromCallCount === 1) {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockReturnValue({
                data: { id: 'c1', is_active: true, expires_at: null },
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
      date: '2024-03-01',
    })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
  })

  it('returns 500 on unexpected exception', async () => {
    const req = new NextRequest('http://localhost:3000/api/daily-wellness', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-valid-json{{{',
    })

    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.error).toBeDefined()
  })
})
