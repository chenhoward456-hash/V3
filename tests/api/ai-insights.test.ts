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
const mockAnalyzeDietaryPatterns = vi.fn()
const mockPredictTrend = vi.fn()
const mockGetTrainingAdvice = vi.fn()
const mockGenerateSmartAlerts = vi.fn()
const mockCompareLabResults = vi.fn()
const mockGenerateWeeklyAIReport = vi.fn()
const mockGenerateMealSuggestion = vi.fn()
const mockGenerateLabComparisonSummary = vi.fn()

vi.mock('@/lib/supabase', () => ({
  createServiceSupabase: vi.fn(() => mockSupabase),
}))

vi.mock('@/lib/auth-middleware', () => ({
  rateLimit: (...args: any[]) => mockRateLimit(...args),
  getClientIP: (...args: any[]) => mockGetClientIP(...args),
}))

vi.mock('@/lib/logger', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
}))

vi.mock('@/lib/ai-insights', () => ({
  analyzeDietaryPatterns: (...args: any[]) => mockAnalyzeDietaryPatterns(...args),
  predictTrend: (...args: any[]) => mockPredictTrend(...args),
  getTrainingAdvice: (...args: any[]) => mockGetTrainingAdvice(...args),
  generateSmartAlerts: (...args: any[]) => mockGenerateSmartAlerts(...args),
  compareLabResults: (...args: any[]) => mockCompareLabResults(...args),
  generateWeeklyAIReport: (...args: any[]) => mockGenerateWeeklyAIReport(...args),
  generateMealSuggestion: (...args: any[]) => mockGenerateMealSuggestion(...args),
  generateLabComparisonSummary: (...args: any[]) => mockGenerateLabComparisonSummary(...args),
}))

import { GET } from '@/app/api/ai/insights/route'

// ── Helpers ──

function makeGetRequest(params: Record<string, string>): NextRequest {
  const url = new URL('http://localhost:3000/api/ai/insights')
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

function setActiveClient() {
  mockTableCalls['clients'] = {
    data: {
      id: 'client-uuid-1',
      name: 'Test User',
      gender: 'male',
      goal_type: 'fat_loss',
      target_weight: 75,
      is_active: true,
      expires_at: null,
      ai_chat_enabled: true,
      calories_target: 2000,
      protein_target: 150,
      carbs_target: 200,
      fat_target: 60,
      water_target: 3000,
    },
    error: null,
  }
}

// ── Tests ──

describe('GET /api/ai/insights', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    for (const key of Object.keys(mockTableCalls)) {
      delete mockTableCalls[key]
    }
    resetFromMock()

    mockGetClientIP.mockReturnValue('127.0.0.1')
    mockRateLimit.mockReturnValue({ allowed: true, remaining: 19 })

    // Default AI function mocks
    mockAnalyzeDietaryPatterns.mockReturnValue({ avgCalories: 1800, complianceRate: 0.85 })
    mockPredictTrend.mockReturnValue({ prediction: 'on track' })
    mockGetTrainingAdvice.mockReturnValue({ advice: 'rest day recommended' })
    mockGenerateSmartAlerts.mockReturnValue([])
    mockCompareLabResults.mockReturnValue([])
  })

  it('returns all non-AI insights for type=all', async () => {
    setActiveClient()

    const req = makeGetRequest({ clientId: 'ABC123', type: 'all' })
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.dietaryPatterns).toBeDefined()
    expect(json.trendPrediction).toBeDefined()
    expect(json.trainingAdvice).toBeDefined()
    expect(json.smartAlerts).toBeDefined()
    expect(json.labComparisons).toBeDefined()
  })

  it('returns 400 when clientId is missing', async () => {
    const req = makeGetRequest({ type: 'all' })
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toBeDefined()
  })

  it('returns 401 when client not found', async () => {
    mockTableCalls['clients'] = { data: null, error: { message: 'not found' } }

    const req = makeGetRequest({ clientId: 'INVALID' })
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json.error).toBeDefined()
  })

  it('returns 403 when client is inactive', async () => {
    mockTableCalls['clients'] = {
      data: {
        id: 'client-uuid-1', name: 'Test', is_active: false, expires_at: null,
        gender: null, goal_type: null, target_weight: null,
        ai_chat_enabled: false, calories_target: null, protein_target: null,
        carbs_target: null, fat_target: null, water_target: null,
      },
      error: null,
    }

    const req = makeGetRequest({ clientId: 'ABC123' })
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(403)
    expect(json.error).toBeDefined()
  })

  it('returns 403 when client account is expired', async () => {
    mockTableCalls['clients'] = {
      data: {
        id: 'client-uuid-1', name: 'Test', is_active: true,
        expires_at: '2020-01-01T00:00:00Z', // expired
        gender: null, goal_type: null, target_weight: null,
        ai_chat_enabled: false, calories_target: null, protein_target: null,
        carbs_target: null, fat_target: null, water_target: null,
      },
      error: null,
    }

    const req = makeGetRequest({ clientId: 'ABC123' })
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(403)
    expect(json.error).toBeDefined()
  })

  it('returns 500 when ANTHROPIC_API_KEY missing for weekly-report', async () => {
    setActiveClient()
    delete process.env.ANTHROPIC_API_KEY

    const req = makeGetRequest({ clientId: 'ABC123', type: 'weekly-report' })
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.error).toBeDefined()
  })

  it('returns dietary patterns for type=dietary-patterns', async () => {
    setActiveClient()

    const req = makeGetRequest({ clientId: 'ABC123', type: 'dietary-patterns' })
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.dietaryPatterns).toBeDefined()
    expect(json.trendPrediction).toBeUndefined()
  })

  it('returns 429 when rate limited', async () => {
    mockRateLimit.mockReturnValue({ allowed: false, remaining: 0 })

    const req = makeGetRequest({ clientId: 'ABC123' })
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(429)
    expect(json.error).toBeDefined()
  })

  it('returns 500 when AI analysis throws', async () => {
    setActiveClient()

    mockAnalyzeDietaryPatterns.mockImplementation(() => {
      throw new Error('AI analysis failed')
    })

    const req = makeGetRequest({ clientId: 'ABC123', type: 'all' })
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.error).toBeDefined()
  })
})
