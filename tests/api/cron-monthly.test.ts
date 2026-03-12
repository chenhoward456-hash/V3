import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ── Stub environment ──
vi.stubEnv('CRON_SECRET', 'test-cron-secret')
vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://test.example.com')

// ── Mock supabase ──
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
  }
  Object.defineProperty(builder, 'then', {
    value(onFulfilled: any) {
      return Promise.resolve({ data, error }).then(onFulfilled)
    },
  })
  return builder
}

const mockFromResults: Record<string, { data: any; error: any }> = {}

const mockSupabase = {
  from: vi.fn((table: string) => {
    const result = mockFromResults[table] || { data: null, error: null }
    return createMockQueryBuilder(result.data, result.error)
  }),
}

vi.mock('@/lib/supabase', () => ({
  createServiceSupabase: vi.fn(() => mockSupabase),
}))

vi.mock('@/lib/line', () => ({
  pushMessage: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/auth-middleware', () => ({
  verifyAdminSession: vi.fn(() => false),
}))

vi.mock('@/components/client/types', () => ({
  isWeightTraining: vi.fn((type: string) => ['重訓', '力量訓練', 'weight_training'].includes(type)),
}))

vi.mock('@/lib/logger', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
}))

import { GET } from '@/app/api/cron/monthly/route'
import { pushMessage } from '@/lib/line'

function makeRequest(options?: { authHeader?: string }): NextRequest {
  const req = new NextRequest('http://localhost/api/cron/monthly', { method: 'GET' })
  if (options?.authHeader) {
    req.headers.set('authorization', options.authHeader)
  }
  return req
}

describe('GET /api/cron/monthly', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mockFromResults['clients'] = { data: [], error: null }
    mockFromResults['body_composition'] = { data: [], error: null }
    mockFromResults['nutrition_logs'] = { data: [], error: null }
    mockFromResults['training_logs'] = { data: [], error: null }
    mockFromResults['daily_wellness'] = { data: [], error: null }
  })

  // ── Authorization Tests ──

  it('should return 401 when no authorization header is provided', async () => {
    const req = makeRequest()
    const res = await GET(req)
    const body = await res.json()

    expect(res.status).toBe(401)
    expect(body.error).toBe('未授權')
  })

  it('should return 401 when CRON_SECRET is wrong', async () => {
    const req = makeRequest({ authHeader: 'Bearer bad-secret' })
    const res = await GET(req)

    expect(res.status).toBe(401)
  })

  it('should authenticate successfully with correct CRON_SECRET', async () => {
    const req = makeRequest({ authHeader: 'Bearer test-cron-secret' })
    const res = await GET(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toHaveProperty('success')
  })

  // ── Client Fetch Error ──

  it('should return 500 when clients query fails', async () => {
    mockFromResults['clients'] = { data: null, error: { message: 'timeout' } }

    const req = makeRequest({ authHeader: 'Bearer test-cron-secret' })
    const res = await GET(req)
    const body = await res.json()

    expect(res.status).toBe(500)
    expect(body.error).toBe('無法取得學員')
    expect(body.detail).toBe('timeout')
  })

  // ── Empty Client List ──

  it('should return success with zero reports when no clients exist', async () => {
    mockFromResults['clients'] = { data: [], error: null }

    const req = makeRequest({ authHeader: 'Bearer test-cron-secret' })
    const res = await GET(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.reportsSent).toBe(0)
    expect(body.totalClients).toBe(0)
    expect(body.errors).toEqual([])
  })

  // ── Response Structure ──

  it('should return expected response structure', async () => {
    const req = makeRequest({ authHeader: 'Bearer test-cron-secret' })
    const res = await GET(req)
    const body = await res.json()

    expect(body).toHaveProperty('success')
    expect(body).toHaveProperty('monthName')
    expect(body).toHaveProperty('reportsSent')
    expect(body).toHaveProperty('totalClients')
    expect(body).toHaveProperty('errors')
    expect(typeof body.monthName).toBe('string')
    expect(typeof body.reportsSent).toBe('number')
    expect(typeof body.totalClients).toBe('number')
    expect(Array.isArray(body.errors)).toBe(true)
  })

  // ── Send Monthly Report ──

  it('should send monthly report to clients with body data', async () => {
    const now = new Date()
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const monthStart = lastMonth.toISOString().split('T')[0]
    const midMonth = new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 15).toISOString().split('T')[0]
    const monthEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0]

    const clients = [
      {
        id: 'c1',
        name: 'Monthly Client',
        line_user_id: 'U400',
        unique_code: 'abc123',
        subscription_tier: 'coached',
        goal_type: 'cut',
      },
    ]
    mockFromResults['clients'] = { data: clients, error: null }
    mockFromResults['body_composition'] = {
      data: [
        { client_id: 'c1', date: monthStart, weight: 80.0, body_fat: 20 },
        { client_id: 'c1', date: monthEnd, weight: 78.5, body_fat: 19 },
      ],
      error: null,
    }
    mockFromResults['nutrition_logs'] = {
      data: [
        { client_id: 'c1', date: midMonth, compliant: true, calories: 1800, protein_grams: 140 },
      ],
      error: null,
    }
    mockFromResults['training_logs'] = {
      data: [
        { client_id: 'c1', date: midMonth, training_type: '重訓', duration: 60 },
      ],
      error: null,
    }
    mockFromResults['daily_wellness'] = {
      data: [
        { client_id: 'c1', date: midMonth, energy_level: 4, sleep_quality: 3, mood: 4 },
      ],
      error: null,
    }

    const req = makeRequest({ authHeader: 'Bearer test-cron-secret' })
    const res = await GET(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.reportsSent).toBe(1)
    expect(body.totalClients).toBe(1)
    expect(pushMessage).toHaveBeenCalledWith('U400', expect.any(Array))

    // Verify the message contains key elements
    const msgArg = vi.mocked(pushMessage).mock.calls[0][1][0] as any
    expect(msgArg.type).toBe('text')
    expect(msgArg.text).toContain('Monthly Client')
    expect(msgArg.text).toContain('成果報告')
  })

  // ── Skip Clients Without Any Data ──

  it('should skip clients who have no data for the month', async () => {
    const clients = [
      {
        id: 'c1',
        name: 'No Data Client',
        line_user_id: 'U500',
        unique_code: 'xyz789',
        subscription_tier: 'self_managed',
        goal_type: 'maintain',
      },
    ]
    mockFromResults['clients'] = { data: clients, error: null }
    mockFromResults['body_composition'] = { data: [], error: null }
    mockFromResults['nutrition_logs'] = { data: [], error: null }
    mockFromResults['training_logs'] = { data: [], error: null }
    mockFromResults['daily_wellness'] = { data: [], error: null }

    const req = makeRequest({ authHeader: 'Bearer test-cron-secret' })
    const res = await GET(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.reportsSent).toBe(0)
    expect(pushMessage).not.toHaveBeenCalled()
  })

  // ── Handle LINE Push Error Gracefully ──

  it('should record error when LINE push fails but continue processing', async () => {
    const now = new Date()
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const monthStart = lastMonth.toISOString().split('T')[0]
    const monthEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0]

    const clients = [
      {
        id: 'c1',
        name: 'Error Client',
        line_user_id: 'U600',
        unique_code: 'err123',
        subscription_tier: 'coached',
        goal_type: 'bulk',
      },
    ]
    mockFromResults['clients'] = { data: clients, error: null }
    mockFromResults['body_composition'] = {
      data: [
        { client_id: 'c1', date: monthStart, weight: 70.0, body_fat: null },
        { client_id: 'c1', date: monthEnd, weight: 71.5, body_fat: null },
      ],
      error: null,
    }
    mockFromResults['nutrition_logs'] = { data: [], error: null }
    mockFromResults['training_logs'] = { data: [], error: null }
    mockFromResults['daily_wellness'] = { data: [], error: null }

    vi.mocked(pushMessage).mockRejectedValueOnce(new Error('LINE API rate limit'))

    const req = makeRequest({ authHeader: 'Bearer test-cron-secret' })
    const res = await GET(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(false)
    expect(body.errors.length).toBeGreaterThan(0)
    expect(body.errors[0]).toContain('Error Client')
    expect(body.reportsSent).toBe(0)
  })

  // ── Closing Remark For Weight Loss Success ──

  it('should include positive remark for successful weight loss on cut goal', async () => {
    const now = new Date()
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const monthStart = lastMonth.toISOString().split('T')[0]
    const monthEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0]

    const clients = [
      {
        id: 'c1',
        name: 'Cutter',
        line_user_id: 'U700',
        unique_code: 'cut01',
        subscription_tier: 'coached',
        goal_type: 'cut',
      },
    ]
    mockFromResults['clients'] = { data: clients, error: null }
    mockFromResults['body_composition'] = {
      data: [
        { client_id: 'c1', date: monthStart, weight: 80.0, body_fat: null },
        { client_id: 'c1', date: monthEnd, weight: 78.0, body_fat: null },
      ],
      error: null,
    }
    mockFromResults['nutrition_logs'] = { data: [], error: null }
    mockFromResults['training_logs'] = { data: [], error: null }
    mockFromResults['daily_wellness'] = { data: [], error: null }

    const req = makeRequest({ authHeader: 'Bearer test-cron-secret' })
    const res = await GET(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.reportsSent).toBe(1)
    const msgText = vi.mocked(pushMessage).mock.calls[0][1][0] as any
    expect(msgText.text).toContain('減脂方向正確')
  })
})
