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

const { mockVerifyCoachAuth } = vi.hoisted(() => {
  const mockVerifyCoachAuth = vi.fn()
  return { mockVerifyCoachAuth }
})

const { mockValidateLabValue, mockValidateDate, mockSanitizeInput } = vi.hoisted(() => {
  const mockValidateLabValue = vi.fn()
  const mockValidateDate = vi.fn()
  const mockSanitizeInput = vi.fn()
  return { mockValidateLabValue, mockValidateDate, mockSanitizeInput }
})

// ── Module mocks ──

vi.mock('@/lib/supabase', () => ({
  createServiceSupabase: () => mockSupabase,
}))

vi.mock('@/lib/auth-middleware', () => ({
  rateLimit: mockRateLimit,
  getClientIP: vi.fn().mockReturnValue('127.0.0.1'),
  verifyCoachAuth: mockVerifyCoachAuth,
  createErrorResponse: vi.fn().mockImplementation((message: string, status: number) => {
    const { NextResponse } = require('next/server')
    return NextResponse.json({ error: message, code: status }, { status })
  }),
  createSuccessResponse: vi.fn().mockImplementation((data: any) => {
    const { NextResponse } = require('next/server')
    return NextResponse.json({ success: true, data })
  }),
  sanitizeTextField: vi.fn().mockImplementation((input: string | null | undefined) => {
    if (!input || typeof input !== 'string') return null
    return input.trim()
  }),
}))

vi.mock('@/utils/validation', () => ({
  validateLabValue: mockValidateLabValue,
  validateDate: mockValidateDate,
  sanitizeInput: mockSanitizeInput,
}))

import { GET, POST } from '@/app/api/lab-results/route'

// ── Helpers ──

function buildGetRequest(params: Record<string, string>): NextRequest {
  const url = new URL('http://localhost:3000/api/lab-results')
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }
  return new NextRequest(url.toString(), { method: 'GET' })
}

function buildPostRequest(body: Record<string, unknown>, headers?: Record<string, string>): NextRequest {
  return new NextRequest('http://localhost:3000/api/lab-results', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
}

// ── Tests ──

describe('GET /api/lab-results', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns lab results for valid client', async () => {
    const labRecords = [
      { id: 'lr-1', client_id: 'c1', test_name: '空腹血糖', value: 95, unit: 'mg/dL', date: '2024-03-01', status: 'normal' },
      { id: 'lr-2', client_id: 'c1', test_name: '維生素D', value: 45, unit: 'ng/mL', date: '2024-02-15', status: 'normal' },
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
      // lab_results table
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({ data: labRecords, error: null }),
          }),
        }),
      }
    })

    const req = buildGetRequest({ clientId: 'UNIQUE123' })
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data).toHaveLength(2)
    expect(json.data[0].test_name).toBe('空腹血糖')
  })

  it('returns empty array when no lab results exist', async () => {
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
            order: vi.fn().mockReturnValue({ data: [], error: null }),
          }),
        }),
      }
    })

    const req = buildGetRequest({ clientId: 'UNIQUE123' })
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data).toEqual([])
  })

  it('returns 400 when clientId is missing', async () => {
    const req = buildGetRequest({})
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

    const req = buildGetRequest({ clientId: 'NONEXISTENT' })
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(404)
    expect(json.error).toBeDefined()
  })

  it('returns 500 when lab results query fails', async () => {
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
            order: vi.fn().mockReturnValue({ data: null, error: { message: 'DB error' } }),
          }),
        }),
      }
    })

    const req = buildGetRequest({ clientId: 'UNIQUE123' })
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.error).toBeDefined()
  })
})

describe('POST /api/lab-results', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRateLimit.mockReturnValue({ allowed: true, remaining: 9 })
    mockValidateLabValue.mockReturnValue({ isValid: true, error: '' })
    mockValidateDate.mockReturnValue({ isValid: true, error: '' })
    mockSanitizeInput.mockImplementation((input: string) => input?.trim() || '')
    mockVerifyCoachAuth.mockResolvedValue({ authorized: true })
  })

  it('creates new lab result with coach auth', async () => {
    const savedRecord = {
      id: 'lr-1',
      client_id: 'c1',
      test_name: '空腹血糖',
      value: 95,
      unit: 'mg/dL',
      reference_range: '70-100',
      date: '2024-03-01',
      status: 'normal',
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
                data: { id: 'c1', is_active: true, expires_at: null, lab_enabled: true },
                error: null,
              }),
            }),
          }),
        }
      }
      // lab_results insert
      return {
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockReturnValue({ data: savedRecord, error: null }),
          }),
        }),
      }
    })

    const req = buildPostRequest({
      clientId: 'UNIQUE123',
      testName: '空腹血糖',
      value: 95,
      unit: 'mg/dL',
      referenceRange: '70-100',
      date: '2024-03-01',
    })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data.test_name).toBe('空腹血糖')
    expect(json.data.value).toBe(95)
  })

  it('creates lab result via selfEntry mode', async () => {
    const savedRecord = {
      id: 'lr-2',
      client_id: 'c1',
      test_name: '維生素D',
      value: 45,
      unit: 'ng/mL',
      date: '2024-03-01',
      status: 'normal',
      custom_advice: null,
      custom_target: null,
    }

    let fromCallCount = 0
    mockFrom.mockImplementation(() => {
      fromCallCount++
      if (fromCallCount === 1) {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockReturnValue({
                data: { id: 'c1', is_active: true, expires_at: null, lab_enabled: true },
                error: null,
              }),
            }),
          }),
        }
      }
      return {
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockReturnValue({ data: savedRecord, error: null }),
          }),
        }),
      }
    })

    const req = buildPostRequest({
      clientId: 'UNIQUE123',
      testName: '維生素D',
      value: 45,
      unit: 'ng/mL',
      date: '2024-03-01',
      selfEntry: true,
    })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data.custom_advice).toBeNull()
    expect(json.data.custom_target).toBeNull()
  })

  it('validates required fields - missing clientId', async () => {
    const req = buildPostRequest({
      testName: '空腹血糖',
      value: 95,
      date: '2024-03-01',
    })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toBeDefined()
  })

  it('validates required fields - missing testName', async () => {
    const req = buildPostRequest({
      clientId: 'UNIQUE123',
      value: 95,
      date: '2024-03-01',
    })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toBeDefined()
  })

  it('validates required fields - missing value', async () => {
    const req = buildPostRequest({
      clientId: 'UNIQUE123',
      testName: '空腹血糖',
      date: '2024-03-01',
    })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toBeDefined()
  })

  it('validates required fields - missing date', async () => {
    const req = buildPostRequest({
      clientId: 'UNIQUE123',
      testName: '空腹血糖',
      value: 95,
    })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toBeDefined()
  })

  it('validates lab value', async () => {
    mockValidateLabValue.mockReturnValue({ isValid: false, error: '檢測數值必須為正數' })

    const req = buildPostRequest({
      clientId: 'UNIQUE123',
      testName: '空腹血糖',
      value: -5,
      date: '2024-03-01',
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
      testName: '空腹血糖',
      value: 95,
      date: 'bad-date',
    })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toBeDefined()
  })

  it('returns 403 when not coach and not selfEntry', async () => {
    mockVerifyCoachAuth.mockResolvedValue({ authorized: false, error: '權限不足' })

    const req = buildPostRequest({
      clientId: 'UNIQUE123',
      testName: '空腹血糖',
      value: 95,
      date: '2024-03-01',
    })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(403)
    expect(json.error).toBeDefined()
  })

  it('returns 429 when rate limited in selfEntry mode', async () => {
    mockRateLimit.mockReturnValue({ allowed: false, remaining: 0 })

    const req = buildPostRequest({
      clientId: 'UNIQUE123',
      testName: '空腹血糖',
      value: 95,
      date: '2024-03-01',
      selfEntry: true,
    })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(429)
    expect(json.error).toBeDefined()
  })

  it('returns 404 when client not found', async () => {
    let fromCallCount = 0
    mockFrom.mockImplementation(() => {
      fromCallCount++
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockReturnValue({ data: null, error: null }),
          }),
        }),
      }
    })

    const req = buildPostRequest({
      clientId: 'NONEXISTENT',
      testName: '空腹血糖',
      value: 95,
      date: '2024-03-01',
    })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(404)
    expect(json.error).toBeDefined()
  })

  it('returns 403 when selfEntry client is inactive', async () => {
    mockFrom.mockImplementation(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockReturnValue({
            data: { id: 'c1', is_active: false, expires_at: null, lab_enabled: true },
            error: null,
          }),
        }),
      }),
    }))

    const req = buildPostRequest({
      clientId: 'UNIQUE123',
      testName: '空腹血糖',
      value: 95,
      date: '2024-03-01',
      selfEntry: true,
    })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(403)
    expect(json.error).toBeDefined()
  })

  it('returns 403 when selfEntry client is expired', async () => {
    mockFrom.mockImplementation(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockReturnValue({
            data: { id: 'c1', is_active: true, expires_at: '2020-01-01T00:00:00Z', lab_enabled: true },
            error: null,
          }),
        }),
      }),
    }))

    const req = buildPostRequest({
      clientId: 'UNIQUE123',
      testName: '空腹血糖',
      value: 95,
      date: '2024-03-01',
      selfEntry: true,
    })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(403)
    expect(json.error).toBeDefined()
  })

  it('returns 403 when selfEntry but lab_enabled is false', async () => {
    mockFrom.mockImplementation(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockReturnValue({
            data: { id: 'c1', is_active: true, expires_at: null, lab_enabled: false },
            error: null,
          }),
        }),
      }),
    }))

    const req = buildPostRequest({
      clientId: 'UNIQUE123',
      testName: '空腹血糖',
      value: 95,
      date: '2024-03-01',
      selfEntry: true,
    })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(403)
    expect(json.error).toBeDefined()
  })

  it('returns 500 when insert fails', async () => {
    let fromCallCount = 0
    mockFrom.mockImplementation(() => {
      fromCallCount++
      if (fromCallCount === 1) {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockReturnValue({
                data: { id: 'c1', is_active: true, expires_at: null, lab_enabled: true },
                error: null,
              }),
            }),
          }),
        }
      }
      return {
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockReturnValue({ data: null, error: { message: 'Insert failed' } }),
          }),
        }),
      }
    })

    const req = buildPostRequest({
      clientId: 'UNIQUE123',
      testName: '空腹血糖',
      value: 95,
      date: '2024-03-01',
    })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.error).toBeDefined()
  })

  it('returns 500 on unexpected exception', async () => {
    const req = new NextRequest('http://localhost:3000/api/lab-results', {
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
