import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ── Hoisted mocks ──

const {
  mockSingle,
  mockMaybeSingle,
  mockOrder,
  mockEq,
  mockSelect,
  mockInsert,
  mockUpdate,
  mockUpsert,
  mockFrom,
  mockLimit,
  mockSupabase,
} = vi.hoisted(() => {
  const mockSingle = vi.fn()
  const mockMaybeSingle = vi.fn()
  const mockOrder = vi.fn()
  const mockEq = vi.fn()
  const mockSelect = vi.fn()
  const mockInsert = vi.fn()
  const mockUpdate = vi.fn()
  const mockUpsert = vi.fn()
  const mockFrom = vi.fn()
  const mockLimit = vi.fn()
  const mockSupabase = { from: mockFrom }
  return {
    mockSingle,
    mockMaybeSingle,
    mockOrder,
    mockEq,
    mockSelect,
    mockInsert,
    mockUpdate,
    mockUpsert,
    mockFrom,
    mockLimit,
    mockSupabase,
  }
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
  validateNumericField: vi.fn().mockImplementation(
    (value: any, min: number, max: number, fieldName: string) => {
      if (value === null || value === undefined) return { isValid: true, error: '' }
      if (typeof value !== 'number' || isNaN(value)) {
        return { isValid: false, error: `${fieldName} 必須是有效的數字` }
      }
      if (value < min || value > max) {
        return { isValid: false, error: `${fieldName} 的有效範圍是 ${min} - ${max}` }
      }
      return { isValid: true, error: '' }
    }
  ),
}))

import { GET, POST } from '@/app/api/training-logs/route'

// ── Helpers ──

function buildGetRequest(params: Record<string, string>): NextRequest {
  const url = new URL('http://localhost:3000/api/training-logs')
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }
  return new NextRequest(url.toString(), { method: 'GET' })
}

function buildPostRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost:3000/api/training-logs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

// ── Tests ──

describe('GET /api/training-logs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns training log for valid client and date', async () => {
    const trainingRecord = {
      id: 'tl-1',
      client_id: 'c1',
      date: '2024-03-01',
      training_type: 'push',
      duration: 60,
      rpe: 8,
      note: 'Felt strong',
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
      // training_logs table
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockReturnValue({ data: trainingRecord, error: null }),
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
    expect(json.data.training_type).toBe('push')
    expect(json.data.rpe).toBe(8)
    expect(json.data.duration).toBe(60)
  })

  it('returns stub record when no training log exists for the date', async () => {
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
    expect(json.data.training_type).toBeNull()
    expect(json.data.duration).toBeNull()
    expect(json.data.rpe).toBeNull()
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

  it('returns 500 when training query fails', async () => {
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

describe('POST /api/training-logs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRateLimit.mockResolvedValue({ allowed: true, remaining: 29 })
  })

  it('creates new training log', async () => {
    const savedRecord = {
      id: 'tl-1',
      client_id: 'c1',
      date: '2024-03-01',
      training_type: 'push',
      duration: 60,
      sets: 20,
      rpe: 8,
      note: 'Great session',
    }

    let fromCallCount = 0
    mockFrom.mockImplementation((table: string) => {
      fromCallCount++
      if (fromCallCount === 1) {
        // clients table lookup
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
      if (table === 'daily_wellness') {
        // Recovery check query
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({ data: [], error: null }),
              }),
            }),
          }),
        }
      }
      // training_logs upsert
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
      training_type: 'push',
      duration: 60,
      sets: 20,
      rpe: 8,
      note: 'Great session',
    })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data.training_type).toBe('push')
    expect(json.data.rpe).toBe(8)
  })

  it('validates training type - rejects invalid type', async () => {
    const req = buildPostRequest({
      clientId: 'UNIQUE123',
      date: '2024-03-01',
      training_type: 'invalid_type',
      duration: 60,
      rpe: 8,
    })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toBeDefined()
  })

  it('validates training type - missing training_type', async () => {
    const req = buildPostRequest({
      clientId: 'UNIQUE123',
      date: '2024-03-01',
      duration: 60,
      rpe: 8,
    })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toBeDefined()
  })

  it('validates required fields - missing clientId', async () => {
    const req = buildPostRequest({
      date: '2024-03-01',
      training_type: 'push',
      duration: 60,
      rpe: 8,
    })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toBeDefined()
  })

  it('validates required fields - missing date', async () => {
    const req = buildPostRequest({
      clientId: 'UNIQUE123',
      training_type: 'push',
      duration: 60,
      rpe: 8,
    })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toBeDefined()
  })

  it('requires duration > 0 for non-rest types', async () => {
    const req = buildPostRequest({
      clientId: 'UNIQUE123',
      date: '2024-03-01',
      training_type: 'push',
      duration: 0,
      rpe: 8,
    })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toBeDefined()
  })

  it('requires RPE in 1-10 range for weight training types', async () => {
    const req = buildPostRequest({
      clientId: 'UNIQUE123',
      date: '2024-03-01',
      training_type: 'push',
      duration: 60,
      rpe: 15,
    })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toBeDefined()
  })

  it('allows rest type without duration or rpe', async () => {
    const savedRecord = {
      id: 'tl-rest',
      client_id: 'c1',
      date: '2024-03-01',
      training_type: 'rest',
      duration: null,
      sets: null,
      rpe: null,
      note: 'Rest day',
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
      training_type: 'rest',
      note: 'Rest day',
    })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data.training_type).toBe('rest')
    expect(json.data.duration).toBeNull()
    expect(json.data.rpe).toBeNull()
  })

  it('allows cardio type without RPE', async () => {
    const savedRecord = {
      id: 'tl-cardio',
      client_id: 'c1',
      date: '2024-03-01',
      training_type: 'cardio',
      duration: 45,
      sets: null,
      rpe: null,
      note: null,
    }

    let fromCallCount = 0
    mockFrom.mockImplementation(() => {
      fromCallCount++
      if (fromCallCount === 1) {
        // clients lookup
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
      // For cardio without rpe >= 8, no daily_wellness query is made.
      // The second from() call is directly training_logs upsert.
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
      training_type: 'cardio',
      duration: 45,
    })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data.training_type).toBe('cardio')
  })

  it('returns 429 when rate limited', async () => {
    mockRateLimit.mockResolvedValue({ allowed: false, remaining: 0 })

    const req = buildPostRequest({
      clientId: 'UNIQUE123',
      date: '2024-03-01',
      training_type: 'push',
      duration: 60,
      rpe: 8,
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
      training_type: 'push',
      duration: 60,
      rpe: 8,
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
      training_type: 'push',
      duration: 60,
      rpe: 8,
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
      training_type: 'push',
      duration: 60,
      rpe: 8,
    })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(403)
    expect(json.error).toBeDefined()
  })

  it('returns 500 when upsert fails', async () => {
    let fromCallCount = 0
    mockFrom.mockImplementation((table: string) => {
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
      if (table === 'daily_wellness') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({ data: [], error: null }),
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
      training_type: 'push',
      duration: 60,
      rpe: 8,
    })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.error).toBeDefined()
  })

  it('includes recovery warning when RPE is high and recovery is poor', async () => {
    const savedRecord = {
      id: 'tl-2',
      client_id: 'c1',
      date: '2024-03-01',
      training_type: 'push',
      duration: 60,
      rpe: 9,
      note: null,
    }

    let fromCallCount = 0
    mockFrom.mockImplementation((table: string) => {
      fromCallCount++
      if (fromCallCount === 1) {
        // clients lookup
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
      if (table === 'daily_wellness') {
        // Return wellness data with poor recovery
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  data: [
                    { date: '2024-02-29', energy_level: 1, training_drive: 1, device_recovery_score: 20, resting_hr: null, hrv: null, wearable_sleep_score: null, sleep_quality: 1 },
                    { date: '2024-02-28', energy_level: 2, training_drive: 2, device_recovery_score: 25, resting_hr: null, hrv: null, wearable_sleep_score: null, sleep_quality: 2 },
                  ],
                  error: null,
                }),
              }),
            }),
          }),
        }
      }
      // training_logs upsert
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
      training_type: 'push',
      duration: 60,
      rpe: 9,
    })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.recoveryWarning).toBeDefined()
    expect(json.recoveryWarning).toContain('恢復狀態不佳')
  })

  it('returns 500 on unexpected exception', async () => {
    const req = new NextRequest('http://localhost:3000/api/training-logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-valid-json{{{',
    })

    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.error).toBeDefined()
  })

  it('accepts all valid training types', async () => {
    const validTypes = ['push', 'pull', 'legs', 'full_body', 'cardio', 'rest', 'chest', 'shoulder', 'arms']

    for (const trainingType of validTypes) {
      vi.clearAllMocks()
      mockRateLimit.mockResolvedValue({ allowed: true, remaining: 29 })

      const isRest = trainingType === 'rest'
      const savedRecord = {
        id: `tl-${trainingType}`,
        client_id: 'c1',
        date: '2024-03-01',
        training_type: trainingType,
        duration: isRest ? null : 60,
        rpe: isRest ? null : (trainingType === 'cardio' ? null : 7),
        note: null,
      }

      let fromCallCount = 0
      mockFrom.mockImplementation((table: string) => {
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
        if (table === 'daily_wellness') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({ data: [], error: null }),
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

      const body: Record<string, unknown> = {
        clientId: 'UNIQUE123',
        date: '2024-03-01',
        training_type: trainingType,
      }
      if (!isRest) {
        body.duration = 60
        if (trainingType !== 'cardio') {
          body.rpe = 7
        }
      }

      const req = buildPostRequest(body)
      const res = await POST(req)

      expect(res.status).toBe(200)
    }
  })
})
