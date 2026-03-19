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
    mockSupabase,
  }
})

const { mockRateLimit } = vi.hoisted(() => {
  const mockRateLimit = vi.fn()
  return { mockRateLimit }
})

function resetChainMocks() {
  mockSingle.mockReturnValue({ data: null, error: null })
  mockMaybeSingle.mockReturnValue({ data: null, error: null })
  mockOrder.mockReturnValue({ data: [], error: null })
  mockEq.mockImplementation(() => ({
    single: mockSingle,
    maybeSingle: mockMaybeSingle,
    order: mockOrder,
    eq: mockEq,
    select: mockSelect,
  }))
  mockSelect.mockImplementation(() => ({
    eq: mockEq,
    single: mockSingle,
  }))
  mockUpsert.mockReturnValue({ select: mockSelect })
  mockInsert.mockReturnValue({ select: mockSelect })
  mockUpdate.mockReturnValue({ select: mockSelect, eq: mockEq })
  mockFrom.mockImplementation(() => ({
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
    upsert: mockUpsert,
  }))
}

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

import { GET, POST } from '@/app/api/nutrition-logs/route'

// ── Helpers ──

function buildGetRequest(params: Record<string, string>): NextRequest {
  const url = new URL('http://localhost:3000/api/nutrition-logs')
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }
  return new NextRequest(url.toString(), { method: 'GET' })
}

function buildPostRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost:3000/api/nutrition-logs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

// ── Tests ──

describe('GET /api/nutrition-logs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetChainMocks()
  })

  it('returns nutrition log for valid client and date', async () => {
    const nutritionRecord = {
      id: 'nl-1',
      client_id: 'c1',
      date: '2024-03-01',
      compliant: true,
      note: 'Good day',
      protein_grams: 150,
      water_ml: 3000,
    }

    // First call: clients table -> select -> eq -> single
    // Second call: nutrition_logs table -> select -> eq -> eq -> maybeSingle
    let fromCallCount = 0
    mockFrom.mockImplementation(() => {
      fromCallCount++
      if (fromCallCount === 1) {
        // clients table
        return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: vi.fn().mockReturnValue({ data: { id: 'c1' }, error: null }) }) }) }
      }
      // nutrition_logs table
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockReturnValue({ data: nutritionRecord, error: null }),
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
    expect(json.data.compliant).toBe(true)
    expect(json.data.protein_grams).toBe(150)
  })

  it('returns empty record when no log exists for the date', async () => {
    let fromCallCount = 0
    mockFrom.mockImplementation(() => {
      fromCallCount++
      if (fromCallCount === 1) {
        return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: vi.fn().mockReturnValue({ data: { id: 'c1' }, error: null }) }) }) }
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
    // Route returns a stub object with null fields when no nutrition log
    expect(json.data.compliant).toBeNull()
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

  it('returns 500 when nutrition query fails', async () => {
    let fromCallCount = 0
    mockFrom.mockImplementation(() => {
      fromCallCount++
      if (fromCallCount === 1) {
        return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: vi.fn().mockReturnValue({ data: { id: 'c1' }, error: null }) }) }) }
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

describe('POST /api/nutrition-logs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetChainMocks()
    mockRateLimit.mockResolvedValue({ allowed: true, remaining: 29 })
  })

  it('creates new nutrition log', async () => {
    const savedRecord = {
      id: 'nl-1',
      client_id: 'c1',
      date: '2024-03-01',
      compliant: true,
      note: 'Good day',
      protein_grams: 150,
      water_ml: 3000,
      carbs_grams: null,
      fat_grams: null,
      calories: null,
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
                data: { id: 'c1', is_active: true, expires_at: null },
                error: null,
              }),
            }),
          }),
        }
      }
      // nutrition_logs upsert
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
      compliant: true,
      note: 'Good day',
      protein_grams: 150,
      water_ml: 3000,
    })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data.compliant).toBe(true)
    expect(json.data.protein_grams).toBe(150)
  })

  it('validates required fields - missing clientId', async () => {
    const req = buildPostRequest({ date: '2024-03-01', compliant: true })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toBeDefined()
  })

  it('validates required fields - missing date', async () => {
    const req = buildPostRequest({ clientId: 'UNIQUE123', compliant: true })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toBeDefined()
  })

  it('validates compliant must be boolean or null', async () => {
    const req = buildPostRequest({
      clientId: 'UNIQUE123',
      date: '2024-03-01',
      compliant: 'yes',
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
      compliant: true,
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
      compliant: true,
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
      compliant: true,
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
      compliant: true,
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
      compliant: true,
    })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.error).toBeDefined()
  })

  it('accepts null compliant value', async () => {
    const savedRecord = {
      id: 'nl-2',
      client_id: 'c1',
      date: '2024-03-01',
      compliant: null,
      note: null,
      protein_grams: null,
      water_ml: null,
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
      compliant: null,
    })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data.compliant).toBeNull()
  })

  it('validates protein_grams must be a valid number', async () => {
    const req = buildPostRequest({
      clientId: 'UNIQUE123',
      date: '2024-03-01',
      compliant: true,
      protein_grams: 'not-a-number',
    })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toBeDefined()
  })

  it('returns 500 on unexpected exception', async () => {
    // Send malformed body to trigger a parse error in the catch block
    const req = new NextRequest('http://localhost:3000/api/nutrition-logs', {
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
