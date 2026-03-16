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

const { mockVerifyAdminSession } = vi.hoisted(() => {
  const mockVerifyAdminSession = vi.fn()
  return { mockVerifyAdminSession }
})

const { mockCalculateHealthScore } = vi.hoisted(() => {
  const mockCalculateHealthScore = vi.fn()
  return { mockCalculateHealthScore }
})

const { mockGenerateLabNutritionAdvice } = vi.hoisted(() => {
  const mockGenerateLabNutritionAdvice = vi.fn()
  return { mockGenerateLabNutritionAdvice }
})

// ── Module mocks ──

vi.mock('@/lib/supabase', () => ({
  createServiceSupabase: () => mockSupabase,
}))

vi.mock('@/lib/auth-middleware', () => ({
  verifyAdminSession: mockVerifyAdminSession,
}))

vi.mock('@/lib/health-score-engine', () => ({
  calculateHealthScore: mockCalculateHealthScore,
}))

vi.mock('@/lib/lab-nutrition-advisor', () => ({
  generateLabNutritionAdvice: mockGenerateLabNutritionAdvice,
}))

import { GET } from '@/app/api/health-report/route'

// ── Helpers ──

function buildGetRequest(params: Record<string, string>, cookies?: Record<string, string>): NextRequest {
  const url = new URL('http://localhost:3000/api/health-report')
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }
  const req = new NextRequest(url.toString(), { method: 'GET' })
  if (cookies) {
    // NextRequest cookies are read-only in the constructor, so we build a cookie header
    const cookieHeader = Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ')
    return new NextRequest(url.toString(), {
      method: 'GET',
      headers: { Cookie: cookieHeader },
    })
  }
  return req
}

// Helper to mock all six parallel queries in fetchQuarterData (body_composition, daily_wellness, nutrition_logs, training_logs, lab_results, supplement_logs)
function createEmptyQuarterMock() {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        gte: vi.fn().mockReturnValue({
          lte: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({ data: [], error: null }),
            // For nutrition_logs and supplement_logs (no order)
            then: undefined,
          }),
        }),
      }),
    }),
  }
}

// ── Tests ──

describe('GET /api/health-report', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockVerifyAdminSession.mockReturnValue(false)
    mockCalculateHealthScore.mockReturnValue(null)
    mockGenerateLabNutritionAdvice.mockReturnValue([])
  })

  it('returns 400 when clientId is missing', async () => {
    const req = buildGetRequest({})
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toBeDefined()
  })

  it('returns 401 when not admin and no code provided', async () => {
    const req = buildGetRequest({ clientId: 'some-uuid' })
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(401)
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

    const req = buildGetRequest({ clientId: 'nonexistent-uuid', code: 'SOME_CODE' })
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(404)
    expect(json.error).toBeDefined()
  })

  it('returns 401 when code does not match client unique_code', async () => {
    mockFrom.mockImplementation(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockReturnValue({
            data: {
              id: 'c1',
              gender: 'male',
              client_mode: 'health',
              health_mode_enabled: true,
              quarterly_cycle_start: '2024-01-01',
              unique_code: 'CORRECT_CODE',
            },
            error: null,
          }),
        }),
      }),
    }))

    const req = buildGetRequest({ clientId: 'c1', code: 'WRONG_CODE' })
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json.error).toBeDefined()
  })

  it('returns 403 when client_mode is not health', async () => {
    mockFrom.mockImplementation(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockReturnValue({
            data: {
              id: 'c1',
              gender: 'male',
              client_mode: 'standard',
              health_mode_enabled: false,
              quarterly_cycle_start: '2024-01-01',
              unique_code: 'CODE123',
            },
            error: null,
          }),
        }),
      }),
    }))

    const req = buildGetRequest({ clientId: 'c1', code: 'CODE123' })
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(403)
    expect(json.error).toBeDefined()
  })

  it('returns report with null quarterly_cycle_start', async () => {
    mockFrom.mockImplementation(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockReturnValue({
            data: {
              id: 'c1',
              gender: 'male',
              client_mode: 'health',
              health_mode_enabled: true,
              quarterly_cycle_start: null,
              unique_code: 'CODE123',
            },
            error: null,
          }),
        }),
      }),
    }))

    const req = buildGetRequest({ clientId: 'c1', code: 'CODE123' })
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.error).toBeDefined()
    expect(json.report).toBeNull()
  })

  it('returns full report for valid client with admin session', async () => {
    mockVerifyAdminSession.mockReturnValue(true)
    mockCalculateHealthScore.mockReturnValue({
      total: 75,
      grade: 'B',
      pillars: [
        { pillar: 'sleep', label: '睡眠', score: 80, emoji: '😴', detail: '' },
      ],
      labPenalty: 0,
      labBonus: 0,
      daysInCycle: 30,
    })
    mockGenerateLabNutritionAdvice.mockReturnValue([])

    // First call: client lookup
    let fromCallCount = 0
    mockFrom.mockImplementation((table: string) => {
      fromCallCount++

      // First call is the client lookup
      if (fromCallCount === 1) {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockReturnValue({
                data: {
                  id: 'c1',
                  gender: 'male',
                  client_mode: 'health',
                  health_mode_enabled: true,
                  quarterly_cycle_start: '2024-01-01',
                  unique_code: 'CODE123',
                },
                error: null,
              }),
            }),
          }),
        }
      }

      // All subsequent calls are for fetchQuarterData (2 quarters x 6 tables = 12 calls)
      // Each table chain: select -> eq -> gte -> lte -> order (or no order)
      const mockGte = vi.fn().mockReturnValue({
        lte: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({ data: [], error: null }),
          // nutrition_logs/supplement_logs have no .order()
          data: [],
          error: null,
        }),
      })

      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            gte: mockGte,
          }),
        }),
      }
    })

    const req = buildGetRequest({ clientId: 'c1' }, { admin_session: 'valid-token' })
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.report).toBeDefined()
    expect(json.labNutritionAdvice).toBeDefined()
    expect(json.currentQuarter).toBeDefined()
    expect(json.previousQuarter).toBeDefined()
  })

  it('returns full report for valid client with code auth', async () => {
    mockCalculateHealthScore.mockReturnValue(null)
    mockGenerateLabNutritionAdvice.mockReturnValue([])

    let fromCallCount = 0
    mockFrom.mockImplementation(() => {
      fromCallCount++

      if (fromCallCount === 1) {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockReturnValue({
                data: {
                  id: 'c1',
                  gender: 'female',
                  client_mode: 'health',
                  health_mode_enabled: true,
                  quarterly_cycle_start: '2024-01-15',
                  unique_code: 'MY_CODE',
                },
                error: null,
              }),
            }),
          }),
        }
      }

      const mockGte = vi.fn().mockReturnValue({
        lte: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({ data: [], error: null }),
          data: [],
          error: null,
        }),
      })

      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            gte: mockGte,
          }),
        }),
      }
    })

    const req = buildGetRequest({ clientId: 'c1', code: 'MY_CODE' })
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.report).toBeDefined()
    expect(json.currentQuarter).toBeDefined()
    expect(json.previousQuarter).toBeDefined()
  })

  it('returns 500 on unexpected exception', async () => {
    mockVerifyAdminSession.mockReturnValue(true)

    mockFrom.mockImplementation(() => {
      throw new Error('Unexpected error')
    })

    const req = buildGetRequest({ clientId: 'c1' }, { admin_session: 'valid-token' })
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.error).toBeDefined()
  })
})
