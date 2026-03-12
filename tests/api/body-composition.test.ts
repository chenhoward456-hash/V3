import { NextRequest } from 'next/server'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Hoisted mocks -- required because the route module calls
// createServiceSupabase() at module-level (top-level const).
// vi.hoisted() ensures variables exist before vi.mock() factories execute.
// ---------------------------------------------------------------------------
const {
  mockSingle,
  mockMaybeSingle,
  mockOrder,
  mockEq,
  mockGte,
  mockNot,
  mockSelect,
  mockInsert,
  mockUpdate,
  mockDelete,
  mockFrom,
  mockLimit,
  mockSupabase,
} = vi.hoisted(() => {
  const mockSingle = vi.fn()
  const mockMaybeSingle = vi.fn()
  const mockOrder = vi.fn()
  const mockEq = vi.fn()
  const mockGte = vi.fn()
  const mockNot = vi.fn()
  const mockSelect = vi.fn()
  const mockInsert = vi.fn()
  const mockUpdate = vi.fn()
  const mockDelete = vi.fn()
  const mockFrom = vi.fn()
  const mockLimit = vi.fn()
  const mockSupabase = { from: mockFrom }
  return {
    mockSingle,
    mockMaybeSingle,
    mockOrder,
    mockEq,
    mockGte,
    mockNot,
    mockSelect,
    mockInsert,
    mockUpdate,
    mockDelete,
    mockFrom,
    mockLimit,
    mockSupabase,
  }
})

// Hoisted auth mocks so we can override per-test
const { mockVerifyAuth, mockIsCoach, mockRateLimit } = vi.hoisted(() => {
  const mockVerifyAuth = vi.fn()
  const mockIsCoach = vi.fn()
  const mockRateLimit = vi.fn()
  return { mockVerifyAuth, mockIsCoach, mockRateLimit }
})

// Hoisted validation mocks
const { mockValidateBodyComposition, mockValidateDate } = vi.hoisted(() => {
  const mockValidateBodyComposition = vi.fn()
  const mockValidateDate = vi.fn()
  return { mockValidateBodyComposition, mockValidateDate }
})

// Hoisted nutrition engine mock
const { mockGenerateNutritionSuggestion } = vi.hoisted(() => {
  const mockGenerateNutritionSuggestion = vi.fn()
  return { mockGenerateNutritionSuggestion }
})

function resetChainMocks() {
  mockMaybeSingle.mockReturnValue({ data: null, error: null })
  mockSingle.mockReturnValue({ data: null, error: null })
  mockLimit.mockReturnValue({ data: [], error: null })
  mockOrder.mockImplementation(() => ({
    data: [],
    error: null,
    limit: mockLimit,
  }))
  mockEq.mockImplementation(() => ({
    single: mockSingle,
    maybeSingle: mockMaybeSingle,
    order: mockOrder,
    eq: mockEq,
    gte: mockGte,
    not: mockNot,
    select: mockSelect,
  }))
  mockGte.mockReturnValue({ order: mockOrder, not: mockNot, eq: mockEq })
  mockNot.mockReturnValue({ order: mockOrder })
  mockSelect.mockImplementation(() => ({
    eq: mockEq,
    single: mockSingle,
  }))
  mockInsert.mockReturnValue({ select: mockSelect })
  mockUpdate.mockReturnValue({ select: mockSelect, eq: mockEq })
  mockDelete.mockReturnValue({ eq: mockEq })
  mockFrom.mockImplementation(() => ({
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
    delete: mockDelete,
  }))
}

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------
vi.mock('@/lib/supabase', () => ({
  createServiceSupabase: () => mockSupabase,
}))

vi.mock('@/lib/auth-middleware', () => ({
  verifyAuth: mockVerifyAuth,
  isCoach: mockIsCoach,
  createErrorResponse: vi.fn().mockImplementation((message: string, status: number) => {
    return new Response(JSON.stringify({ error: message, code: status }), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
  }),
  createSuccessResponse: vi.fn().mockImplementation((data: unknown) => {
    return new Response(JSON.stringify({ success: true, data }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }),
  rateLimit: mockRateLimit,
  getClientIP: vi.fn().mockReturnValue('127.0.0.1'),
}))

vi.mock('@/utils/validation', () => ({
  validateBodyComposition: mockValidateBodyComposition,
  validateDate: mockValidateDate,
}))

vi.mock('@/lib/nutrition-engine', () => ({
  generateNutritionSuggestion: mockGenerateNutritionSuggestion,
}))

vi.mock('@/components/client/types', () => ({
  isWeightTraining: vi.fn().mockReturnValue(true),
}))

// Import route handlers AFTER mocks are set up
import { GET, POST, PUT, DELETE } from '@/app/api/body-composition/route'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function buildGetRequest(url: string): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost'))
}

function buildPostRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest(new URL('http://localhost/api/body-composition'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function buildPutRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest(new URL('http://localhost/api/body-composition'), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function buildDeleteRequest(url: string): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost'), {
    method: 'DELETE',
  })
}

/**
 * Helper: sets up mockFrom to handle multiple table calls in sequence.
 * Each table name maps to an object with the chain methods it should expose.
 */
function setupFromForTables(tableMap: Record<string, any>) {
  mockFrom.mockImplementation((table: string) => {
    if (tableMap[table]) {
      return tableMap[table]
    }
    // Default fallback for any other table
    return { select: mockSelect, insert: mockInsert, update: mockUpdate, delete: mockDelete }
  })
}

/**
 * Creates a complete auto-adjust nutrition mock setup.
 * This handles the complex multi-table parallel query in autoAdjustNutrition().
 */
function setupAutoAdjustMocks(options: {
  client?: any
  bodyData?: any[]
  nutritionLogs?: any[]
  trainingLogs?: any[]
  wellnessLogs?: any[]
  labResults?: any[]
  periodData?: any[]
  suppLogs?: any[]
  suppList?: any[]
} = {}) {
  const {
    client = {
      id: 'uuid-1',
      goal_type: 'fat_loss',
      nutrition_enabled: true,
      gender: '男性',
      calories_target: 2000,
      protein_target: 150,
      carbs_target: 200,
      fat_target: 60,
      diet_start_date: '2024-01-01',
      target_weight: null,
      target_body_fat: null,
      competition_date: null,
      target_date: null,
      competition_enabled: false,
      prep_phase: null,
      activity_profile: null,
      gene_mthfr: null,
      gene_apoe: null,
      gene_depression_risk: null,
      carbs_training_day: null,
      carbs_rest_day: null,
    },
    bodyData = [],
    nutritionLogs = [],
    trainingLogs = [],
    wellnessLogs = [],
    labResults = [],
    periodData = [],
    suppLogs = [],
    suppList = [],
  } = options

  // The autoAdjustNutrition function makes multiple supabase calls.
  // We use a call counter approach for each table.
  const clientCalls: any[] = []
  let clientCallIndex = 0

  const bodyCompCalls: any[] = []
  let bodyCompCallIndex = 0

  // Client table: first call is the auto-adjust client lookup (.single())
  // Possibly more client calls for update
  const clientSelectChain = {
    eq: vi.fn().mockImplementation(() => ({
      single: vi.fn().mockReturnValue({ data: client, error: null }),
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockReturnValue({ data: client, error: null }),
        maybeSingle: vi.fn().mockReturnValue({ data: null, error: null }),
      }),
    })),
  }

  const clientUpdateChain = {
    eq: vi.fn().mockReturnValue({ data: null, error: null }),
  }

  // body_composition: select with gte, not, order chain
  const bodySelectChain = {
    eq: vi.fn().mockReturnValue({
      gte: vi.fn().mockReturnValue({
        not: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({ data: bodyData, error: null }),
        }),
      }),
    }),
  }

  // nutrition_logs: select with eq, gte, order
  const nutritionSelectChain = {
    eq: vi.fn().mockReturnValue({
      gte: vi.fn().mockReturnValue({
        order: vi.fn().mockReturnValue({ data: nutritionLogs, error: null }),
      }),
    }),
  }

  // training_logs
  const trainingSelectChain = {
    eq: vi.fn().mockReturnValue({
      gte: vi.fn().mockReturnValue({
        order: vi.fn().mockReturnValue({ data: trainingLogs, error: null }),
      }),
    }),
  }

  // daily_wellness
  const wellnessSelectChain = {
    eq: vi.fn().mockImplementation(() => ({
      gte: vi.fn().mockReturnValue({
        order: vi.fn().mockReturnValue({ data: wellnessLogs, error: null }),
      }),
      eq: vi.fn().mockReturnValue({
        gte: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({ data: periodData, error: null }),
          }),
        }),
      }),
    })),
  }

  // lab_results
  const labSelectChain = {
    eq: vi.fn().mockReturnValue({
      order: vi.fn().mockReturnValue({
        limit: vi.fn().mockReturnValue({ data: labResults, error: null }),
      }),
    }),
  }

  // supplement_logs
  const suppLogSelectChain = {
    eq: vi.fn().mockReturnValue({
      gte: vi.fn().mockReturnValue({ data: suppLogs, error: null }),
    }),
  }

  // supplements
  const suppListSelectChain = {
    eq: vi.fn().mockReturnValue({ data: suppList, error: null }),
  }

  return {
    client,
    clientSelectChain,
    clientUpdateChain,
    bodySelectChain,
    nutritionSelectChain,
    trainingSelectChain,
    wellnessSelectChain,
    labSelectChain,
    suppLogSelectChain,
    suppListSelectChain,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('GET /api/body-composition', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetChainMocks()
    mockRateLimit.mockReturnValue({ allowed: true, remaining: 19 })
    mockVerifyAuth.mockResolvedValue({ user: { id: 'coach-1', role: 'coach' }, error: null })
    mockIsCoach.mockReturnValue(true)
    mockValidateBodyComposition.mockReturnValue({ isValid: true, error: '' })
    mockValidateDate.mockReturnValue({ isValid: true, error: '' })
    mockGenerateNutritionSuggestion.mockReturnValue({
      status: 'ok',
      autoApply: false,
      message: 'No adjustment needed',
      weeklyWeightChangeRate: 0.5,
    })
  })

  it('returns 400 if clientId is missing', async () => {
    const req = buildGetRequest('http://localhost/api/body-composition')
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toBeDefined()
  })

  it('returns 404 if client is not found', async () => {
    mockSingle.mockReturnValue({ data: null, error: null })

    const req = buildGetRequest('http://localhost/api/body-composition?clientId=nonexistent')
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(404)
    expect(json.error).toBeDefined()
  })

  it('returns body composition data for a valid client', async () => {
    const mockBodyData = [
      { id: '1', client_id: 'uuid-1', date: '2024-06-15', weight: 75, body_fat: 15, height: 175 },
      { id: '2', client_id: 'uuid-1', date: '2024-06-14', weight: 75.2, body_fat: 15.1, height: 175 },
    ]

    // First call: client lookup -> returns client
    let singleCallCount = 0
    mockSingle.mockImplementation(() => {
      singleCallCount++
      if (singleCallCount === 1) {
        return { data: { id: 'uuid-1' }, error: null }
      }
      return { data: null, error: null }
    })

    // Second chain: body_composition query -> returns data
    let fromCallCount = 0
    mockFrom.mockImplementation(() => {
      fromCallCount++
      if (fromCallCount === 1) {
        // clients table
        return { select: mockSelect }
      }
      // body_composition table
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({ data: mockBodyData, error: null }),
          }),
        }),
      }
    })

    const req = buildGetRequest('http://localhost/api/body-composition?clientId=valid-code')
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data).toEqual(mockBodyData)
  })

  it('returns 500 when database query fails', async () => {
    // Client lookup succeeds
    let singleCallCount = 0
    mockSingle.mockImplementation(() => {
      singleCallCount++
      if (singleCallCount === 1) {
        return { data: { id: 'uuid-1' }, error: null }
      }
      return { data: null, error: null }
    })

    let fromCallCount = 0
    mockFrom.mockImplementation(() => {
      fromCallCount++
      if (fromCallCount === 1) {
        return { select: mockSelect }
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({ data: null, error: { message: 'DB error' } }),
          }),
        }),
      }
    })

    const req = buildGetRequest('http://localhost/api/body-composition?clientId=valid-code')
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.error).toBeDefined()
  })

  it('returns 500 when an unexpected exception is thrown', async () => {
    mockFrom.mockImplementation(() => {
      throw new Error('Unexpected')
    })

    const req = buildGetRequest('http://localhost/api/body-composition?clientId=abc')
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.error).toBeDefined()
  })
})

describe('POST /api/body-composition', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetChainMocks()
    mockRateLimit.mockReturnValue({ allowed: true, remaining: 19 })
    mockVerifyAuth.mockResolvedValue({ user: { id: 'coach-1', role: 'coach' }, error: null })
    mockIsCoach.mockReturnValue(true)
    mockValidateBodyComposition.mockReturnValue({ isValid: true, error: '' })
    mockValidateDate.mockReturnValue({ isValid: true, error: '' })
    mockGenerateNutritionSuggestion.mockReturnValue({
      status: 'on_track',
      autoApply: false,
      message: 'No adjustment needed',
      weeklyWeightChangeRate: 0.5,
    })
  })

  it('returns 429 when rate limit is exceeded', async () => {
    mockRateLimit.mockReturnValue({ allowed: false, remaining: 0 })

    const req = buildPostRequest({ clientId: 'valid-code', date: '2024-06-15', weight: 75 })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(429)
    expect(json.error).toBeDefined()
  })

  it('returns 400 if required fields (clientId, date) are missing', async () => {
    const req = buildPostRequest({ weight: 75 })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toBeDefined()
  })

  it('returns 400 when clientId is present but date is missing', async () => {
    const req = buildPostRequest({ clientId: 'valid-code', weight: 75 })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toBeDefined()
  })

  it('returns 400 if date validation fails', async () => {
    mockValidateDate.mockReturnValue({ isValid: false, error: '無效的日期格式' })

    const req = buildPostRequest({ clientId: 'valid-code', date: 'not-a-date', weight: 75 })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toContain('日期')
  })

  it('returns 400 if body composition validation fails for height', async () => {
    mockValidateBodyComposition.mockImplementation((field: string) => {
      if (field === 'height') return { isValid: false, error: 'height 的有效範圍是 100 - 250' }
      return { isValid: true, error: '' }
    })

    const req = buildPostRequest({ clientId: 'valid-code', date: '2024-06-15', height: 999 })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toContain('height')
  })

  it('returns 400 if body composition validation fails for weight', async () => {
    mockValidateBodyComposition.mockImplementation((field: string) => {
      if (field === 'weight') return { isValid: false, error: 'weight 必須為正數' }
      return { isValid: true, error: '' }
    })

    const req = buildPostRequest({ clientId: 'valid-code', date: '2024-06-15', weight: -5 })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toContain('weight')
  })

  it('returns 400 if body composition validation fails for bodyFat', async () => {
    mockValidateBodyComposition.mockImplementation((field: string) => {
      if (field === 'body_fat') return { isValid: false, error: 'body_fat 的有效範圍是 0 - 100' }
      return { isValid: true, error: '' }
    })

    const req = buildPostRequest({ clientId: 'valid-code', date: '2024-06-15', bodyFat: 200 })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toContain('body_fat')
  })

  it('returns 400 if body composition validation fails for muscleMass', async () => {
    mockValidateBodyComposition.mockImplementation((field: string) => {
      if (field === 'muscle_mass') return { isValid: false, error: 'muscle_mass 的有效範圍是 0 - 200' }
      return { isValid: true, error: '' }
    })

    const req = buildPostRequest({ clientId: 'valid-code', date: '2024-06-15', muscleMass: 999 })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toContain('muscle_mass')
  })

  it('returns 400 if body composition validation fails for visceralFat', async () => {
    mockValidateBodyComposition.mockImplementation((field: string) => {
      if (field === 'visceral_fat') return { isValid: false, error: 'visceral_fat 的有效範圍是 1 - 30' }
      return { isValid: true, error: '' }
    })

    const req = buildPostRequest({ clientId: 'valid-code', date: '2024-06-15', visceralFat: 99 })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toContain('visceral_fat')
  })

  it('returns 400 if body composition validation fails for bmi', async () => {
    mockValidateBodyComposition.mockImplementation((field: string) => {
      if (field === 'bmi') return { isValid: false, error: 'bmi 的有效範圍是 10 - 50' }
      return { isValid: true, error: '' }
    })

    const req = buildPostRequest({ clientId: 'valid-code', date: '2024-06-15', bmi: 100 })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toContain('bmi')
  })

  it('returns 404 if client is not found', async () => {
    mockSingle.mockReturnValue({ data: null, error: null })

    const req = buildPostRequest({ clientId: 'nonexistent', date: '2024-06-15', weight: 75 })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(404)
    expect(json.error).toBeDefined()
  })

  it('returns 403 if client is expired', async () => {
    // Client found but expired
    mockSingle.mockReturnValue({
      data: { id: 'uuid-1', expires_at: '2020-01-01T00:00:00Z' },
      error: null,
    })

    const req = buildPostRequest({ clientId: 'expired-code', date: '2024-06-15', weight: 75 })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(403)
    expect(json.error).toBeDefined()
  })

  it('creates a new body composition entry when no existing record for the date', async () => {
    const createdRecord = {
      id: 'rec-1',
      client_id: 'uuid-1',
      date: '2024-06-15',
      weight: 75,
      body_fat: null,
      height: null,
      muscle_mass: null,
      visceral_fat: null,
      bmi: null,
    }

    // We need to track from() calls by table name
    let clientSingleCalled = false
    mockFrom.mockImplementation((table: string) => {
      if (table === 'clients') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockImplementation(() => {
                if (!clientSingleCalled) {
                  clientSingleCalled = true
                  return { data: { id: 'uuid-1', expires_at: null }, error: null }
                }
                // autoAdjustNutrition client lookup
                return {
                  data: {
                    id: 'uuid-1', goal_type: null, nutrition_enabled: false,
                  },
                  error: null,
                }
              }),
            }),
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({ data: null, error: null }),
          }),
        }
      }
      if (table === 'body_composition') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockReturnValue({ data: null, error: null }),
              }),
              gte: vi.fn().mockReturnValue({
                not: vi.fn().mockReturnValue({
                  order: vi.fn().mockReturnValue({ data: [], error: null }),
                }),
              }),
            }),
          }),
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockReturnValue({ data: createdRecord, error: null }),
            }),
          }),
        }
      }
      // Default for other auto-adjust tables
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            gte: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({ data: [], error: null }),
              not: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({ data: [], error: null }),
              }),
            }),
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({ data: [], error: null }),
            }),
            eq: vi.fn().mockReturnValue({
              gte: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({ data: [], error: null }),
                }),
              }),
            }),
          }),
        }),
      }
    })

    const req = buildPostRequest({
      clientId: 'valid-code',
      date: '2024-06-15',
      weight: 75,
    })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data.id).toBe('rec-1')
    // autoAdjust should not have adjusted (goal_type is null)
    expect(json.data.nutritionAdjusted.adjusted).toBe(false)
  })

  it('updates an existing body composition entry for the same date', async () => {
    const updatedRecord = {
      id: 'existing-rec',
      client_id: 'uuid-1',
      date: '2024-06-15',
      weight: 76,
      body_fat: 14,
      height: 175,
      muscle_mass: null,
      visceral_fat: null,
      bmi: null,
    }

    mockFrom.mockImplementation((table: string) => {
      if (table === 'clients') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockReturnValue({
                data: { id: 'uuid-1', expires_at: null, goal_type: null, nutrition_enabled: false },
                error: null,
              }),
            }),
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({ data: null, error: null }),
          }),
        }
      }
      if (table === 'body_composition') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockReturnValue({ data: { id: 'existing-rec' }, error: null }),
              }),
              gte: vi.fn().mockReturnValue({
                not: vi.fn().mockReturnValue({
                  order: vi.fn().mockReturnValue({ data: [], error: null }),
                }),
              }),
            }),
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockReturnValue({ data: updatedRecord, error: null }),
              }),
            }),
          }),
        }
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            gte: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({ data: [], error: null }),
              not: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({ data: [], error: null }),
              }),
            }),
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({ data: [], error: null }),
            }),
            eq: vi.fn().mockReturnValue({
              gte: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({ data: [], error: null }),
                }),
              }),
            }),
          }),
        }),
      }
    })

    const req = buildPostRequest({
      clientId: 'valid-code',
      date: '2024-06-15',
      weight: 76,
      bodyFat: 14,
      height: 175,
    })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data.weight).toBe(76)
  })

  it('returns 500 when insert fails with database error', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'clients') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockReturnValue({
                data: { id: 'uuid-1', expires_at: null },
                error: null,
              }),
            }),
          }),
        }
      }
      if (table === 'body_composition') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockReturnValue({ data: null, error: null }),
              }),
            }),
          }),
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockReturnValue({ data: null, error: { message: 'insert failed' } }),
            }),
          }),
        }
      }
      return { select: mockSelect }
    })

    const req = buildPostRequest({
      clientId: 'valid-code',
      date: '2024-06-15',
      weight: 75,
    })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.error).toBeDefined()
  })

  it('skips nutrition auto-adjust when weight is null', async () => {
    const createdRecord = {
      id: 'rec-2',
      client_id: 'uuid-1',
      date: '2024-06-15',
      weight: null,
      body_fat: 15,
      height: null,
      muscle_mass: null,
      visceral_fat: null,
      bmi: null,
    }

    mockFrom.mockImplementation((table: string) => {
      if (table === 'clients') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockReturnValue({
                data: { id: 'uuid-1', expires_at: null },
                error: null,
              }),
            }),
          }),
        }
      }
      if (table === 'body_composition') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockReturnValue({ data: null, error: null }),
              }),
            }),
          }),
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockReturnValue({ data: createdRecord, error: null }),
            }),
          }),
        }
      }
      return { select: mockSelect }
    })

    const req = buildPostRequest({
      clientId: 'valid-code',
      date: '2024-06-15',
      bodyFat: 15,
      // No weight field
    })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.data.nutritionAdjusted.adjusted).toBe(false)
    expect(json.data.nutritionAdjusted.debug).toContain('not triggered')
  })

  it('handles autoAdjustNutrition engine error gracefully', async () => {
    const createdRecord = {
      id: 'rec-3',
      client_id: 'uuid-1',
      date: '2024-06-15',
      weight: 75,
      body_fat: null,
      height: null,
      muscle_mass: null,
      visceral_fat: null,
      bmi: null,
    }

    // Make the first client lookup succeed for POST, then throw on autoAdjust's client lookup
    let clientCallCount = 0
    mockFrom.mockImplementation((table: string) => {
      if (table === 'clients') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockImplementation(() => {
                clientCallCount++
                if (clientCallCount === 1) {
                  return { data: { id: 'uuid-1', expires_at: null }, error: null }
                }
                // The autoAdjustNutrition client lookup
                throw new Error('Engine DB failure')
              }),
            }),
          }),
        }
      }
      if (table === 'body_composition') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockReturnValue({ data: null, error: null }),
              }),
            }),
          }),
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockReturnValue({ data: createdRecord, error: null }),
            }),
          }),
        }
      }
      return { select: mockSelect }
    })

    const req = buildPostRequest({
      clientId: 'valid-code',
      date: '2024-06-15',
      weight: 75,
    })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.data.nutritionAdjusted.adjusted).toBe(false)
    expect(json.data.nutritionAdjusted.debug).toContain('engine error')
  })

  it('returns 500 when an unexpected error occurs', async () => {
    mockFrom.mockImplementation(() => {
      throw new Error('Unexpected failure')
    })

    const req = buildPostRequest({
      clientId: 'valid-code',
      date: '2024-06-15',
      weight: 75,
    })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.error).toBeDefined()
  })

  it('autoAdjustNutrition skips when client has no goal_type', async () => {
    const createdRecord = {
      id: 'rec-no-goal',
      client_id: 'uuid-1',
      date: '2024-06-15',
      weight: 75,
      body_fat: null,
      height: null,
      muscle_mass: null,
      visceral_fat: null,
      bmi: null,
    }

    let clientCallCount = 0
    mockFrom.mockImplementation((table: string) => {
      if (table === 'clients') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockImplementation(() => {
                clientCallCount++
                if (clientCallCount === 1) {
                  return { data: { id: 'uuid-1', expires_at: null }, error: null }
                }
                // autoAdjustNutrition: client has no goal_type
                return {
                  data: { id: 'uuid-1', goal_type: null, nutrition_enabled: true },
                  error: null,
                }
              }),
            }),
          }),
        }
      }
      if (table === 'body_composition') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockReturnValue({ data: null, error: null }),
              }),
            }),
          }),
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockReturnValue({ data: createdRecord, error: null }),
            }),
          }),
        }
      }
      return { select: mockSelect }
    })

    const req = buildPostRequest({
      clientId: 'valid-code',
      date: '2024-06-15',
      weight: 75,
    })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.data.nutritionAdjusted.adjusted).toBe(false)
    expect(json.data.nutritionAdjusted.debug).toContain('skip')
  })

  it('autoAdjustNutrition skips when client has nutrition_enabled=false', async () => {
    const createdRecord = {
      id: 'rec-no-nutr',
      client_id: 'uuid-1',
      date: '2024-06-15',
      weight: 75,
      body_fat: null,
      height: null,
      muscle_mass: null,
      visceral_fat: null,
      bmi: null,
    }

    let clientCallCount = 0
    mockFrom.mockImplementation((table: string) => {
      if (table === 'clients') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockImplementation(() => {
                clientCallCount++
                if (clientCallCount === 1) {
                  return { data: { id: 'uuid-1', expires_at: null }, error: null }
                }
                return {
                  data: { id: 'uuid-1', goal_type: 'fat_loss', nutrition_enabled: false },
                  error: null,
                }
              }),
            }),
          }),
        }
      }
      if (table === 'body_composition') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockReturnValue({ data: null, error: null }),
              }),
            }),
          }),
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockReturnValue({ data: createdRecord, error: null }),
            }),
          }),
        }
      }
      return { select: mockSelect }
    })

    const req = buildPostRequest({
      clientId: 'valid-code',
      date: '2024-06-15',
      weight: 75,
    })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.data.nutritionAdjusted.adjusted).toBe(false)
    expect(json.data.nutritionAdjusted.debug).toContain('nutrition_enabled=false')
  })

  it('autoAdjustNutrition skips when insufficient weekly weights and no goal-driven data', async () => {
    const createdRecord = {
      id: 'rec-insuf',
      client_id: 'uuid-1',
      date: '2024-06-15',
      weight: 75,
      body_fat: null,
      height: null,
      muscle_mass: null,
      visceral_fat: null,
      bmi: null,
    }

    let clientCallCount = 0
    mockFrom.mockImplementation((table: string) => {
      if (table === 'clients') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockImplementation(() => {
                clientCallCount++
                if (clientCallCount === 1) {
                  return { data: { id: 'uuid-1', expires_at: null }, error: null }
                }
                // autoAdjust: has goal_type but no target_weight/competition_date
                return {
                  data: {
                    id: 'uuid-1',
                    goal_type: 'fat_loss',
                    nutrition_enabled: true,
                    gender: '男性',
                    target_weight: null,
                    competition_date: null,
                    target_date: null,
                    competition_enabled: false,
                    calories_target: 2000,
                    protein_target: 150,
                    carbs_target: 200,
                    fat_target: 60,
                    diet_start_date: null,
                    prep_phase: null,
                    activity_profile: null,
                    gene_mthfr: null,
                    gene_apoe: null,
                    gene_depression_risk: null,
                    carbs_training_day: null,
                    carbs_rest_day: null,
                    target_body_fat: null,
                  },
                  error: null,
                }
              }),
            }),
          }),
        }
      }
      if (table === 'body_composition') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockReturnValue({ data: null, error: null }),
              }),
              gte: vi.fn().mockReturnValue({
                not: vi.fn().mockReturnValue({
                  order: vi.fn().mockReturnValue({
                    // Return empty body data => 0 weekly weights
                    data: [],
                    error: null,
                  }),
                }),
              }),
            }),
          }),
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockReturnValue({ data: createdRecord, error: null }),
            }),
          }),
        }
      }
      // nutrition_logs, training_logs, daily_wellness, lab_results, supplement_logs, supplements
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            gte: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({ data: [], error: null }),
              not: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({ data: [], error: null }),
              }),
            }),
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({ data: [], error: null }),
            }),
            eq: vi.fn().mockReturnValue({
              gte: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({ data: [], error: null }),
                }),
              }),
            }),
          }),
        }),
      }
    })

    const req = buildPostRequest({
      clientId: 'valid-code',
      date: '2024-06-15',
      weight: 75,
    })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.data.nutritionAdjusted.adjusted).toBe(false)
    expect(json.data.nutritionAdjusted.debug).toContain('weeklyWeights')
  })

  it('autoAdjustNutrition skips when no latestWeight in body data', async () => {
    const createdRecord = {
      id: 'rec-nw',
      client_id: 'uuid-1',
      date: '2024-06-15',
      weight: 75,
      body_fat: null,
      height: null,
      muscle_mass: null,
      visceral_fat: null,
      bmi: null,
    }

    const today = new Date()
    // Create body data that has weights in week0 and week1 range but weight is null
    // Actually, the body data is filtered by `not('weight', 'is', null)` so if we return entries
    // with weight=null from a mocked perspective, the code will still see them.
    // The "no latestWeight" path is hit when bodyData is non-empty but last entry has no weight.
    // Actually, the query already filters nulls. So we need 2 weeks of data for weekly weights
    // but the last entry has no weight? That's contradictory since null weights are filtered.
    // The path is: bodyData has entries (for weekly weights) but bodyData[bodyData.length - 1]?.weight is falsy.
    // Since the data comes from a query that filters null weight, this would only happen with weight=0.
    // Let's test with weight=0 entries (falsy but not null).

    const bodyDataWithZeroWeight = [
      { date: today.toISOString().split('T')[0], weight: 0, body_fat: 15, height: 175 },
    ]

    let clientCallCount = 0
    mockFrom.mockImplementation((table: string) => {
      if (table === 'clients') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockImplementation(() => {
                clientCallCount++
                if (clientCallCount === 1) {
                  return { data: { id: 'uuid-1', expires_at: null }, error: null }
                }
                return {
                  data: {
                    id: 'uuid-1',
                    goal_type: 'fat_loss',
                    nutrition_enabled: true,
                    gender: '男性',
                    target_weight: null,
                    competition_date: null,
                    target_date: null,
                    competition_enabled: false,
                    calories_target: 2000,
                    protein_target: 150,
                    carbs_target: 200,
                    fat_target: 60,
                    diet_start_date: null,
                    prep_phase: null,
                    activity_profile: null,
                    gene_mthfr: null,
                    gene_apoe: null,
                    gene_depression_risk: null,
                    carbs_training_day: null,
                    carbs_rest_day: null,
                    target_body_fat: null,
                  },
                  error: null,
                }
              }),
            }),
          }),
        }
      }
      if (table === 'body_composition') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockReturnValue({ data: null, error: null }),
              }),
              gte: vi.fn().mockReturnValue({
                not: vi.fn().mockReturnValue({
                  order: vi.fn().mockReturnValue({
                    data: bodyDataWithZeroWeight,
                    error: null,
                  }),
                }),
              }),
            }),
          }),
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockReturnValue({ data: createdRecord, error: null }),
            }),
          }),
        }
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            gte: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({ data: [], error: null }),
              not: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({ data: [], error: null }),
              }),
            }),
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({ data: [], error: null }),
            }),
            eq: vi.fn().mockReturnValue({
              gte: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({ data: [], error: null }),
                }),
              }),
            }),
          }),
        }),
      }
    })

    const req = buildPostRequest({
      clientId: 'valid-code',
      date: '2024-06-15',
      weight: 75,
    })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    // The latestWeight is 0 (falsy), so autoAdjust returns skip
    expect(json.data.nutritionAdjusted.adjusted).toBe(false)
    expect(json.data.nutritionAdjusted.debug).toContain('skip')
  })

  it('autoAdjustNutrition runs engine and auto-applies when autoApply=true', async () => {
    const createdRecord = {
      id: 'rec-auto',
      client_id: 'uuid-1',
      date: '2024-06-15',
      weight: 75,
      body_fat: 15,
      height: 175,
      muscle_mass: null,
      visceral_fat: null,
      bmi: null,
    }

    const today = new Date()
    const todayStr = today.toISOString().split('T')[0]
    // Create body data spanning 2 weeks so weeklyWeights.length >= 2
    const sevenDaysAgo = new Date(today)
    sevenDaysAgo.setDate(today.getDate() - 7)
    const bodyData = [
      { date: sevenDaysAgo.toISOString().split('T')[0], weight: 76, body_fat: 16, height: 175 },
      { date: todayStr, weight: 75, body_fat: 15, height: 175 },
    ]

    // Engine returns autoApply=true with suggested values
    mockGenerateNutritionSuggestion.mockReturnValue({
      status: 'on_track',
      autoApply: true,
      message: 'Reduced calories by 100',
      suggestedCalories: 1900,
      suggestedProtein: 155,
      suggestedCarbs: 190,
      suggestedFat: 55,
      suggestedCarbsTrainingDay: null,
      suggestedCarbsRestDay: null,
      weeklyWeightChangeRate: -0.5,
    })

    let clientCallCount = 0
    const clientUpdateEq = vi.fn().mockReturnValue({ data: null, error: null })
    mockFrom.mockImplementation((table: string) => {
      if (table === 'clients') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockImplementation(() => {
                clientCallCount++
                if (clientCallCount === 1) {
                  return { data: { id: 'uuid-1', expires_at: null }, error: null }
                }
                return {
                  data: {
                    id: 'uuid-1',
                    goal_type: 'fat_loss',
                    nutrition_enabled: true,
                    gender: '男性',
                    target_weight: null,
                    competition_date: null,
                    target_date: null,
                    competition_enabled: false,
                    calories_target: 2000,
                    protein_target: 150,
                    carbs_target: 200,
                    fat_target: 60,
                    diet_start_date: '2024-01-01',
                    prep_phase: null,
                    activity_profile: null,
                    gene_mthfr: null,
                    gene_apoe: null,
                    gene_depression_risk: null,
                    carbs_training_day: null,
                    carbs_rest_day: null,
                    target_body_fat: null,
                  },
                  error: null,
                }
              }),
            }),
          }),
          update: vi.fn().mockReturnValue({
            eq: clientUpdateEq,
          }),
        }
      }
      if (table === 'body_composition') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockReturnValue({ data: null, error: null }),
              }),
              gte: vi.fn().mockReturnValue({
                not: vi.fn().mockReturnValue({
                  order: vi.fn().mockReturnValue({ data: bodyData, error: null }),
                }),
              }),
            }),
          }),
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockReturnValue({ data: createdRecord, error: null }),
            }),
          }),
        }
      }
      if (table === 'nutrition_logs') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              gte: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  data: [
                    { date: todayStr, compliant: true, calories: 1950, carbs_grams: 180 },
                  ],
                  error: null,
                }),
              }),
            }),
          }),
        }
      }
      if (table === 'training_logs') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              gte: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  data: [
                    { date: todayStr, training_type: 'weight', rpe: 7, duration: 60 },
                  ],
                  error: null,
                }),
              }),
            }),
          }),
        }
      }
      if (table === 'daily_wellness') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              gte: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  data: [
                    { date: todayStr, energy_level: 7, training_drive: 8, device_recovery_score: null, resting_hr: null, hrv: null, wearable_sleep_score: null, respiratory_rate: null },
                  ],
                  error: null,
                }),
              }),
              eq: vi.fn().mockReturnValue({
                gte: vi.fn().mockReturnValue({
                  order: vi.fn().mockReturnValue({
                    limit: vi.fn().mockReturnValue({ data: [], error: null }),
                  }),
                }),
              }),
            }),
          }),
        }
      }
      if (table === 'lab_results') {
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
      if (table === 'supplement_logs') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              gte: vi.fn().mockReturnValue({ data: [], error: null }),
            }),
          }),
        }
      }
      if (table === 'supplements') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({ data: [], error: null }),
          }),
        }
      }
      return { select: mockSelect }
    })

    const req = buildPostRequest({
      clientId: 'valid-code',
      date: '2024-06-15',
      weight: 75,
      bodyFat: 15,
      height: 175,
    })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.data.nutritionAdjusted.adjusted).toBe(true)
    expect(json.data.nutritionAdjusted.calories).toBe(1900)
    expect(json.data.nutritionAdjusted.protein).toBe(155)
    expect(json.data.nutritionAdjusted.carbs).toBe(190)
    expect(json.data.nutritionAdjusted.fat).toBe(55)
    expect(json.data.nutritionAdjusted.message).toContain('Reduced')
    // Verify the engine was called
    expect(mockGenerateNutritionSuggestion).toHaveBeenCalled()
    // Verify the client update was called
    expect(clientUpdateEq).toHaveBeenCalled()
  })

  it('autoAdjustNutrition does not apply when engine returns autoApply=false', async () => {
    const createdRecord = {
      id: 'rec-no-apply',
      client_id: 'uuid-1',
      date: '2024-06-15',
      weight: 75,
      body_fat: 15,
      height: 175,
      muscle_mass: null,
      visceral_fat: null,
      bmi: null,
    }

    const today = new Date()
    const todayStr = today.toISOString().split('T')[0]
    const sevenDaysAgo = new Date(today)
    sevenDaysAgo.setDate(today.getDate() - 7)
    const bodyData = [
      { date: sevenDaysAgo.toISOString().split('T')[0], weight: 75.5, body_fat: 15.5, height: 175 },
      { date: todayStr, weight: 75, body_fat: 15, height: 175 },
    ]

    mockGenerateNutritionSuggestion.mockReturnValue({
      status: 'on_track',
      autoApply: false,
      message: 'On track, no changes needed',
      suggestedCalories: null,
      suggestedProtein: null,
      suggestedCarbs: null,
      suggestedFat: null,
      weeklyWeightChangeRate: -0.3,
    })

    let clientCallCount = 0
    mockFrom.mockImplementation((table: string) => {
      if (table === 'clients') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockImplementation(() => {
                clientCallCount++
                if (clientCallCount === 1) {
                  return { data: { id: 'uuid-1', expires_at: null }, error: null }
                }
                return {
                  data: {
                    id: 'uuid-1',
                    goal_type: 'fat_loss',
                    nutrition_enabled: true,
                    gender: '男性',
                    target_weight: null,
                    competition_date: null,
                    target_date: null,
                    competition_enabled: false,
                    calories_target: 2000,
                    protein_target: 150,
                    carbs_target: 200,
                    fat_target: 60,
                    diet_start_date: '2024-01-01',
                    prep_phase: null,
                    activity_profile: null,
                    gene_mthfr: null,
                    gene_apoe: null,
                    gene_depression_risk: null,
                    carbs_training_day: null,
                    carbs_rest_day: null,
                    target_body_fat: null,
                  },
                  error: null,
                }
              }),
            }),
          }),
        }
      }
      if (table === 'body_composition') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockReturnValue({ data: null, error: null }),
              }),
              gte: vi.fn().mockReturnValue({
                not: vi.fn().mockReturnValue({
                  order: vi.fn().mockReturnValue({ data: bodyData, error: null }),
                }),
              }),
            }),
          }),
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockReturnValue({ data: createdRecord, error: null }),
            }),
          }),
        }
      }
      // Other tables return empty
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            gte: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({ data: [], error: null }),
              not: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({ data: [], error: null }),
              }),
            }),
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({ data: [], error: null }),
            }),
            eq: vi.fn().mockReturnValue({
              gte: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({ data: [], error: null }),
                }),
              }),
            }),
          }),
        }),
      }
    })

    const req = buildPostRequest({
      clientId: 'valid-code',
      date: '2024-06-15',
      weight: 75,
      bodyFat: 15,
      height: 175,
    })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.data.nutritionAdjusted.adjusted).toBe(false)
    expect(mockGenerateNutritionSuggestion).toHaveBeenCalled()
  })

  it('autoAdjustNutrition handles female client with period data', async () => {
    const createdRecord = {
      id: 'rec-female',
      client_id: 'uuid-f',
      date: '2024-06-15',
      weight: 60,
      body_fat: 22,
      height: 165,
      muscle_mass: null,
      visceral_fat: null,
      bmi: null,
    }

    const today = new Date()
    const todayStr = today.toISOString().split('T')[0]
    const sevenDaysAgo = new Date(today)
    sevenDaysAgo.setDate(today.getDate() - 7)
    const bodyData = [
      { date: sevenDaysAgo.toISOString().split('T')[0], weight: 60.5, body_fat: 22, height: 165 },
      { date: todayStr, weight: 60, body_fat: 22, height: 165 },
    ]

    mockGenerateNutritionSuggestion.mockReturnValue({
      status: 'on_track',
      autoApply: false,
      message: 'On track',
      weeklyWeightChangeRate: -0.4,
    })

    let clientCallCount = 0
    mockFrom.mockImplementation((table: string) => {
      if (table === 'clients') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockImplementation(() => {
                clientCallCount++
                if (clientCallCount === 1) {
                  return { data: { id: 'uuid-f', expires_at: null }, error: null }
                }
                return {
                  data: {
                    id: 'uuid-f',
                    goal_type: 'fat_loss',
                    nutrition_enabled: true,
                    gender: '女性',
                    target_weight: null,
                    competition_date: null,
                    target_date: null,
                    competition_enabled: false,
                    calories_target: 1600,
                    protein_target: 120,
                    carbs_target: 160,
                    fat_target: 50,
                    diet_start_date: '2024-01-01',
                    prep_phase: null,
                    activity_profile: null,
                    gene_mthfr: null,
                    gene_apoe: null,
                    gene_depression_risk: null,
                    carbs_training_day: null,
                    carbs_rest_day: null,
                    target_body_fat: null,
                  },
                  error: null,
                }
              }),
            }),
          }),
        }
      }
      if (table === 'body_composition') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockReturnValue({ data: null, error: null }),
              }),
              gte: vi.fn().mockReturnValue({
                not: vi.fn().mockReturnValue({
                  order: vi.fn().mockReturnValue({ data: bodyData, error: null }),
                }),
              }),
            }),
          }),
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockReturnValue({ data: createdRecord, error: null }),
            }),
          }),
        }
      }
      if (table === 'daily_wellness') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockImplementation((_field: string, _value: any) => {
              // This handles both the regular wellness query and the period query
              return {
                gte: vi.fn().mockReturnValue({
                  order: vi.fn().mockReturnValue({
                    data: [],
                    error: null,
                    limit: vi.fn().mockReturnValue({ data: [{ date: '2024-06-10' }], error: null }),
                  }),
                }),
                eq: vi.fn().mockReturnValue({
                  gte: vi.fn().mockReturnValue({
                    order: vi.fn().mockReturnValue({
                      limit: vi.fn().mockReturnValue({ data: [{ date: '2024-06-10' }], error: null }),
                    }),
                  }),
                }),
              }
            }),
          }),
        }
      }
      // Other tables
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            gte: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({ data: [], error: null }),
              not: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({ data: [], error: null }),
              }),
            }),
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({ data: [], error: null }),
            }),
            eq: vi.fn().mockReturnValue({
              gte: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({ data: [], error: null }),
                }),
              }),
            }),
          }),
        }),
      }
    })

    const req = buildPostRequest({
      clientId: 'valid-code',
      date: '2024-06-15',
      weight: 60,
      bodyFat: 22,
      height: 165,
    })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    // Engine should have been called with lastPeriodDate
    expect(mockGenerateNutritionSuggestion).toHaveBeenCalled()
  })

  it('autoAdjustNutrition handles goal-driven client with 1 week of data', async () => {
    const createdRecord = {
      id: 'rec-gd',
      client_id: 'uuid-gd',
      date: '2024-06-15',
      weight: 80,
      body_fat: null,
      height: null,
      muscle_mass: null,
      visceral_fat: null,
      bmi: null,
    }

    const today = new Date()
    const todayStr = today.toISOString().split('T')[0]
    // Only 1 week of body data
    const bodyData = [
      { date: todayStr, weight: 80, body_fat: null, height: null },
    ]

    mockGenerateNutritionSuggestion.mockReturnValue({
      status: 'goal_driven',
      autoApply: true,
      message: 'Goal-driven adjustment',
      suggestedCalories: 1800,
      suggestedProtein: 160,
      suggestedCarbs: 180,
      suggestedFat: 50,
      suggestedCarbsTrainingDay: null,
      suggestedCarbsRestDay: null,
      weeklyWeightChangeRate: -0.7,
    })

    let clientCallCount = 0
    const clientUpdateEq = vi.fn().mockReturnValue({ data: null, error: null })
    mockFrom.mockImplementation((table: string) => {
      if (table === 'clients') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockImplementation(() => {
                clientCallCount++
                if (clientCallCount === 1) {
                  return { data: { id: 'uuid-gd', expires_at: null }, error: null }
                }
                return {
                  data: {
                    id: 'uuid-gd',
                    goal_type: 'fat_loss',
                    nutrition_enabled: true,
                    gender: '男性',
                    target_weight: 72,
                    competition_date: '2024-09-01',
                    target_date: null,
                    competition_enabled: true,
                    calories_target: 2000,
                    protein_target: 150,
                    carbs_target: 200,
                    fat_target: 60,
                    diet_start_date: '2024-01-01',
                    prep_phase: null,
                    activity_profile: null,
                    gene_mthfr: null,
                    gene_apoe: null,
                    gene_depression_risk: null,
                    carbs_training_day: null,
                    carbs_rest_day: null,
                    target_body_fat: null,
                  },
                  error: null,
                }
              }),
            }),
          }),
          update: vi.fn().mockReturnValue({
            eq: clientUpdateEq,
          }),
        }
      }
      if (table === 'body_composition') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockReturnValue({ data: null, error: null }),
              }),
              gte: vi.fn().mockReturnValue({
                not: vi.fn().mockReturnValue({
                  order: vi.fn().mockReturnValue({ data: bodyData, error: null }),
                }),
              }),
            }),
          }),
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockReturnValue({ data: createdRecord, error: null }),
            }),
          }),
        }
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            gte: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({ data: [], error: null }),
              not: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({ data: [], error: null }),
              }),
            }),
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({ data: [], error: null }),
            }),
            eq: vi.fn().mockReturnValue({
              gte: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({ data: [], error: null }),
                }),
              }),
            }),
          }),
        }),
      }
    })

    const req = buildPostRequest({
      clientId: 'valid-code',
      date: '2024-06-15',
      weight: 80,
    })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.data.nutritionAdjusted.adjusted).toBe(true)
    expect(json.data.nutritionAdjusted.calories).toBe(1800)
    // With goal-driven + competition, 1 week data should suffice (duplicates week 0)
    expect(mockGenerateNutritionSuggestion).toHaveBeenCalled()
  })

  it('autoAdjustNutrition handles client with genetic profile and supplement data', async () => {
    const createdRecord = {
      id: 'rec-gene',
      client_id: 'uuid-gene',
      date: '2024-06-15',
      weight: 75,
      body_fat: 15,
      height: 175,
      muscle_mass: null,
      visceral_fat: null,
      bmi: null,
    }

    const today = new Date()
    const todayStr = today.toISOString().split('T')[0]
    const sevenDaysAgo = new Date(today)
    sevenDaysAgo.setDate(today.getDate() - 7)
    const bodyData = [
      { date: sevenDaysAgo.toISOString().split('T')[0], weight: 75.5, body_fat: 15.5, height: 175 },
      { date: todayStr, weight: 75, body_fat: 15, height: 175 },
    ]

    mockGenerateNutritionSuggestion.mockReturnValue({
      status: 'on_track',
      autoApply: false,
      message: 'On track',
      weeklyWeightChangeRate: -0.3,
    })

    let clientCallCount = 0
    mockFrom.mockImplementation((table: string) => {
      if (table === 'clients') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockImplementation(() => {
                clientCallCount++
                if (clientCallCount === 1) {
                  return { data: { id: 'uuid-gene', expires_at: null }, error: null }
                }
                return {
                  data: {
                    id: 'uuid-gene',
                    goal_type: 'fat_loss',
                    nutrition_enabled: true,
                    gender: '男性',
                    target_weight: null,
                    competition_date: null,
                    target_date: null,
                    competition_enabled: false,
                    calories_target: 2000,
                    protein_target: 150,
                    carbs_target: 200,
                    fat_target: 60,
                    diet_start_date: '2024-01-01',
                    prep_phase: null,
                    activity_profile: 'high_energy_flux',
                    gene_mthfr: 'CT',
                    gene_apoe: 'E3/E4',
                    gene_depression_risk: 'SL',
                    carbs_training_day: 250,
                    carbs_rest_day: 150,
                    target_body_fat: 12,
                  },
                  error: null,
                }
              }),
            }),
          }),
        }
      }
      if (table === 'body_composition') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockReturnValue({ data: null, error: null }),
              }),
              gte: vi.fn().mockReturnValue({
                not: vi.fn().mockReturnValue({
                  order: vi.fn().mockReturnValue({ data: bodyData, error: null }),
                }),
              }),
            }),
          }),
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockReturnValue({ data: createdRecord, error: null }),
            }),
          }),
        }
      }
      if (table === 'supplement_logs') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              gte: vi.fn().mockReturnValue({
                data: [
                  { date: todayStr, completed: true },
                  { date: sevenDaysAgo.toISOString().split('T')[0], completed: false },
                ],
                error: null,
              }),
            }),
          }),
        }
      }
      if (table === 'supplements') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              data: [{ name: 'Creatine' }, { name: 'Vitamin D' }],
              error: null,
            }),
          }),
        }
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            gte: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({ data: [], error: null }),
              not: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({ data: [], error: null }),
              }),
            }),
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({ data: [], error: null }),
            }),
            eq: vi.fn().mockReturnValue({
              gte: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({ data: [], error: null }),
                }),
              }),
            }),
          }),
        }),
      }
    })

    const req = buildPostRequest({
      clientId: 'valid-code',
      date: '2024-06-15',
      weight: 75,
      bodyFat: 15,
      height: 175,
    })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(mockGenerateNutritionSuggestion).toHaveBeenCalled()
    const callArgs = mockGenerateNutritionSuggestion.mock.calls[0][0]
    // Verify genetic profile was passed
    expect(callArgs.geneticProfile).toBeDefined()
    expect(callArgs.geneticProfile.mthfr).toBe('CT')
    expect(callArgs.geneticProfile.apoe).toBe('E3/E4')
    expect(callArgs.geneticProfile.serotonin).toBe('SL')
    // Verify supplement compliance
    expect(callArgs.supplementCompliance).toBeDefined()
    expect(callArgs.supplementCompliance.rate).toBe(0.5)
    expect(callArgs.supplementCompliance.supplements).toEqual(['Creatine', 'Vitamin D'])
    // Verify carbs cycling
    expect(callArgs.carbsCyclingEnabled).toBe(true)
    expect(callArgs.currentCarbsTrainingDay).toBe(250)
    expect(callArgs.currentCarbsRestDay).toBe(150)
    expect(callArgs.activityProfile).toBe('high_energy_flux')
  })

  it('autoAdjustNutrition handles depression risk genetic field', async () => {
    const createdRecord = {
      id: 'rec-dep',
      client_id: 'uuid-dep',
      date: '2024-06-15',
      weight: 75,
      body_fat: null,
      height: null,
      muscle_mass: null,
      visceral_fat: null,
      bmi: null,
    }

    const today = new Date()
    const todayStr = today.toISOString().split('T')[0]
    const sevenDaysAgo = new Date(today)
    sevenDaysAgo.setDate(today.getDate() - 7)
    const bodyData = [
      { date: sevenDaysAgo.toISOString().split('T')[0], weight: 75.5, body_fat: null, height: null },
      { date: todayStr, weight: 75, body_fat: null, height: null },
    ]

    mockGenerateNutritionSuggestion.mockReturnValue({
      status: 'on_track',
      autoApply: false,
      message: 'On track',
      weeklyWeightChangeRate: -0.3,
    })

    let clientCallCount = 0
    mockFrom.mockImplementation((table: string) => {
      if (table === 'clients') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockImplementation(() => {
                clientCallCount++
                if (clientCallCount === 1) {
                  return { data: { id: 'uuid-dep', expires_at: null }, error: null }
                }
                return {
                  data: {
                    id: 'uuid-dep',
                    goal_type: 'fat_loss',
                    nutrition_enabled: true,
                    gender: '男性',
                    target_weight: null,
                    competition_date: null,
                    target_date: null,
                    competition_enabled: false,
                    calories_target: 2000,
                    protein_target: 150,
                    carbs_target: 200,
                    fat_target: 60,
                    diet_start_date: null,
                    prep_phase: null,
                    activity_profile: null,
                    gene_mthfr: null,
                    gene_apoe: null,
                    gene_depression_risk: 'high',
                    carbs_training_day: null,
                    carbs_rest_day: null,
                    target_body_fat: null,
                  },
                  error: null,
                }
              }),
            }),
          }),
        }
      }
      if (table === 'body_composition') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockReturnValue({ data: null, error: null }),
              }),
              gte: vi.fn().mockReturnValue({
                not: vi.fn().mockReturnValue({
                  order: vi.fn().mockReturnValue({ data: bodyData, error: null }),
                }),
              }),
            }),
          }),
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockReturnValue({ data: createdRecord, error: null }),
            }),
          }),
        }
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            gte: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({ data: [], error: null }),
              not: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({ data: [], error: null }),
              }),
            }),
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({ data: [], error: null }),
            }),
            eq: vi.fn().mockReturnValue({
              gte: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({ data: [], error: null }),
                }),
              }),
            }),
          }),
        }),
      }
    })

    const req = buildPostRequest({
      clientId: 'valid-code',
      date: '2024-06-15',
      weight: 75,
    })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(mockGenerateNutritionSuggestion).toHaveBeenCalled()
    const callArgs = mockGenerateNutritionSuggestion.mock.calls[0][0]
    // depression_risk 'high' should be parsed as depressionRisk
    expect(callArgs.geneticProfile).toBeDefined()
    expect(callArgs.geneticProfile.depressionRisk).toBe('high')
  })
})

// ---------------------------------------------------------------------------
// PUT /api/body-composition
// ---------------------------------------------------------------------------
describe('PUT /api/body-composition', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetChainMocks()
    mockRateLimit.mockReturnValue({ allowed: true, remaining: 19 })
    mockVerifyAuth.mockResolvedValue({ user: { id: 'coach-1', role: 'coach' }, error: null })
    mockIsCoach.mockReturnValue(true)
    mockValidateBodyComposition.mockReturnValue({ isValid: true, error: '' })
    mockValidateDate.mockReturnValue({ isValid: true, error: '' })
  })

  it('returns 401 when auth fails', async () => {
    mockVerifyAuth.mockResolvedValue({ user: null, error: 'Token expired' })

    const req = buildPutRequest({ id: 'rec-1', date: '2024-06-15', weight: 76 })
    const res = await PUT(req)
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json.error).toBeDefined()
  })

  it('returns 401 when user is null with no error message', async () => {
    mockVerifyAuth.mockResolvedValue({ user: null, error: null })

    const req = buildPutRequest({ id: 'rec-1', date: '2024-06-15', weight: 76 })
    const res = await PUT(req)
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json.error).toBeDefined()
  })

  it('returns 403 when user is not a coach', async () => {
    mockVerifyAuth.mockResolvedValue({ user: { id: 'user-1', role: 'client' }, error: null })
    mockIsCoach.mockReturnValue(false)

    const req = buildPutRequest({ id: 'rec-1', date: '2024-06-15', weight: 76 })
    const res = await PUT(req)
    const json = await res.json()

    expect(res.status).toBe(403)
    expect(json.error).toContain('教練')
  })

  it('returns 400 when id is missing', async () => {
    const req = buildPutRequest({ date: '2024-06-15', weight: 76 })
    const res = await PUT(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toContain('ID')
  })

  it('returns 400 when date validation fails', async () => {
    mockValidateDate.mockReturnValue({ isValid: false, error: '日期格式必須為 YYYY-MM-DD' })

    const req = buildPutRequest({ id: 'rec-1', date: 'bad-date', weight: 76 })
    const res = await PUT(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toContain('日期')
  })

  it('returns 400 when body composition field validation fails', async () => {
    mockValidateBodyComposition.mockImplementation((field: string) => {
      if (field === 'weight') return { isValid: false, error: 'weight 必須為正數' }
      return { isValid: true, error: '' }
    })

    const req = buildPutRequest({ id: 'rec-1', date: '2024-06-15', weight: -5 })
    const res = await PUT(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toContain('weight')
  })

  it('returns 400 when height validation fails', async () => {
    mockValidateBodyComposition.mockImplementation((field: string) => {
      if (field === 'height') return { isValid: false, error: 'height out of range' }
      return { isValid: true, error: '' }
    })

    const req = buildPutRequest({ id: 'rec-1', date: '2024-06-15', height: 999 })
    const res = await PUT(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toContain('height')
  })

  it('returns 400 when bodyFat validation fails', async () => {
    mockValidateBodyComposition.mockImplementation((field: string) => {
      if (field === 'body_fat') return { isValid: false, error: 'body_fat out of range' }
      return { isValid: true, error: '' }
    })

    const req = buildPutRequest({ id: 'rec-1', date: '2024-06-15', bodyFat: 200 })
    const res = await PUT(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toContain('body_fat')
  })

  it('returns 400 when muscleMass validation fails', async () => {
    mockValidateBodyComposition.mockImplementation((field: string) => {
      if (field === 'muscle_mass') return { isValid: false, error: 'muscle_mass out of range' }
      return { isValid: true, error: '' }
    })

    const req = buildPutRequest({ id: 'rec-1', date: '2024-06-15', muscleMass: 999 })
    const res = await PUT(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toContain('muscle_mass')
  })

  it('returns 400 when visceralFat validation fails', async () => {
    mockValidateBodyComposition.mockImplementation((field: string) => {
      if (field === 'visceral_fat') return { isValid: false, error: 'visceral_fat out of range' }
      return { isValid: true, error: '' }
    })

    const req = buildPutRequest({ id: 'rec-1', date: '2024-06-15', visceralFat: 99 })
    const res = await PUT(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toContain('visceral_fat')
  })

  it('returns 400 when bmi validation fails', async () => {
    mockValidateBodyComposition.mockImplementation((field: string) => {
      if (field === 'bmi') return { isValid: false, error: 'bmi out of range' }
      return { isValid: true, error: '' }
    })

    const req = buildPutRequest({ id: 'rec-1', date: '2024-06-15', bmi: 100 })
    const res = await PUT(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toContain('bmi')
  })

  it('successfully updates a body composition record', async () => {
    const updatedRecord = {
      id: 'rec-1',
      client_id: 'uuid-1',
      date: '2024-06-15',
      weight: 76,
      body_fat: 14.5,
      height: 175,
      muscle_mass: 60,
      visceral_fat: 8,
      bmi: 24.8,
    }

    mockFrom.mockImplementation(() => ({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockReturnValue({ data: updatedRecord, error: null }),
          }),
        }),
      }),
    }))

    const req = buildPutRequest({
      id: 'rec-1',
      date: '2024-06-15',
      weight: 76,
      bodyFat: 14.5,
      height: 175,
      muscleMass: 60,
      visceralFat: 8,
      bmi: 24.8,
    })
    const res = await PUT(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data).toEqual(updatedRecord)
  })

  it('updates only specified fields (partial update)', async () => {
    const updatedRecord = {
      id: 'rec-1',
      client_id: 'uuid-1',
      date: '2024-06-15',
      weight: 76,
      body_fat: null,
      height: null,
      muscle_mass: null,
      visceral_fat: null,
      bmi: null,
    }

    mockFrom.mockImplementation(() => ({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockReturnValue({ data: updatedRecord, error: null }),
          }),
        }),
      }),
    }))

    const req = buildPutRequest({ id: 'rec-1', date: '2024-06-15', weight: 76 })
    const res = await PUT(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
  })

  it('skips date validation when date is not provided', async () => {
    const updatedRecord = {
      id: 'rec-1',
      client_id: 'uuid-1',
      date: '2024-06-15',
      weight: 76,
    }

    mockFrom.mockImplementation(() => ({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockReturnValue({ data: updatedRecord, error: null }),
          }),
        }),
      }),
    }))

    const req = buildPutRequest({ id: 'rec-1', weight: 76 })
    const res = await PUT(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(mockValidateDate).not.toHaveBeenCalled()
  })

  it('returns 500 when database update fails', async () => {
    mockFrom.mockImplementation(() => ({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockReturnValue({ data: null, error: { message: 'update failed' } }),
          }),
        }),
      }),
    }))

    const req = buildPutRequest({ id: 'rec-1', date: '2024-06-15', weight: 76 })
    const res = await PUT(req)
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.error).toBeDefined()
  })

  it('returns 500 when an unexpected exception is thrown', async () => {
    mockVerifyAuth.mockRejectedValue(new Error('Unexpected auth failure'))

    const req = buildPutRequest({ id: 'rec-1', date: '2024-06-15', weight: 76 })
    const res = await PUT(req)
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.error).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// DELETE /api/body-composition
// ---------------------------------------------------------------------------
describe('DELETE /api/body-composition', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetChainMocks()
    mockRateLimit.mockReturnValue({ allowed: true, remaining: 19 })
    mockVerifyAuth.mockResolvedValue({ user: { id: 'coach-1', role: 'coach' }, error: null })
    mockIsCoach.mockReturnValue(true)
  })

  it('returns 401 when auth fails', async () => {
    mockVerifyAuth.mockResolvedValue({ user: null, error: 'Unauthorized' })

    const req = buildDeleteRequest('http://localhost/api/body-composition?id=rec-1')
    const res = await DELETE(req)
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json.error).toBeDefined()
  })

  it('returns 401 when user is null with no error message', async () => {
    mockVerifyAuth.mockResolvedValue({ user: null, error: null })

    const req = buildDeleteRequest('http://localhost/api/body-composition?id=rec-1')
    const res = await DELETE(req)
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json.error).toBeDefined()
  })

  it('returns 403 when user is not a coach', async () => {
    mockVerifyAuth.mockResolvedValue({ user: { id: 'user-1', role: 'client' }, error: null })
    mockIsCoach.mockReturnValue(false)

    const req = buildDeleteRequest('http://localhost/api/body-composition?id=rec-1')
    const res = await DELETE(req)
    const json = await res.json()

    expect(res.status).toBe(403)
    expect(json.error).toContain('教練')
  })

  it('returns 400 when id is missing', async () => {
    const req = buildDeleteRequest('http://localhost/api/body-composition')
    const res = await DELETE(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toContain('ID')
  })

  it('successfully deletes a body composition record', async () => {
    mockFrom.mockImplementation(() => ({
      delete: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({ error: null }),
      }),
    }))

    const req = buildDeleteRequest('http://localhost/api/body-composition?id=rec-1')
    const res = await DELETE(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data.success).toBe(true)
  })

  it('returns 500 when database delete fails', async () => {
    mockFrom.mockImplementation(() => ({
      delete: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({ error: { message: 'delete failed' } }),
      }),
    }))

    const req = buildDeleteRequest('http://localhost/api/body-composition?id=rec-1')
    const res = await DELETE(req)
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.error).toBeDefined()
  })

  it('returns 500 when an unexpected exception is thrown', async () => {
    mockVerifyAuth.mockRejectedValue(new Error('Unexpected'))

    const req = buildDeleteRequest('http://localhost/api/body-composition?id=rec-1')
    const res = await DELETE(req)
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.error).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// parseSerotoninField (tested indirectly via autoAdjustNutrition)
// ---------------------------------------------------------------------------
describe('parseSerotoninField edge cases', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetChainMocks()
    mockRateLimit.mockReturnValue({ allowed: true, remaining: 19 })
    mockVerifyAuth.mockResolvedValue({ user: { id: 'coach-1', role: 'coach' }, error: null })
    mockIsCoach.mockReturnValue(true)
    mockValidateBodyComposition.mockReturnValue({ isValid: true, error: '' })
    mockValidateDate.mockReturnValue({ isValid: true, error: '' })
    mockGenerateNutritionSuggestion.mockReturnValue({
      status: 'on_track',
      autoApply: false,
      message: 'On track',
      weeklyWeightChangeRate: -0.3,
    })
  })

  it('handles gene_depression_risk with unknown value (returns empty object)', async () => {
    const createdRecord = {
      id: 'rec-unk',
      client_id: 'uuid-unk',
      date: '2024-06-15',
      weight: 75,
      body_fat: null,
      height: null,
      muscle_mass: null,
      visceral_fat: null,
      bmi: null,
    }

    const today = new Date()
    const todayStr = today.toISOString().split('T')[0]
    const sevenDaysAgo = new Date(today)
    sevenDaysAgo.setDate(today.getDate() - 7)
    const bodyData = [
      { date: sevenDaysAgo.toISOString().split('T')[0], weight: 75.5, body_fat: null, height: null },
      { date: todayStr, weight: 75, body_fat: null, height: null },
    ]

    let clientCallCount = 0
    mockFrom.mockImplementation((table: string) => {
      if (table === 'clients') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockImplementation(() => {
                clientCallCount++
                if (clientCallCount === 1) {
                  return { data: { id: 'uuid-unk', expires_at: null }, error: null }
                }
                return {
                  data: {
                    id: 'uuid-unk',
                    goal_type: 'fat_loss',
                    nutrition_enabled: true,
                    gender: '男性',
                    target_weight: null,
                    competition_date: null,
                    target_date: null,
                    competition_enabled: false,
                    calories_target: 2000,
                    protein_target: 150,
                    carbs_target: 200,
                    fat_target: 60,
                    diet_start_date: null,
                    prep_phase: null,
                    activity_profile: null,
                    gene_mthfr: null,
                    gene_apoe: null,
                    gene_depression_risk: 'unknown_value',
                    carbs_training_day: null,
                    carbs_rest_day: null,
                    target_body_fat: null,
                  },
                  error: null,
                }
              }),
            }),
          }),
        }
      }
      if (table === 'body_composition') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockReturnValue({ data: null, error: null }),
              }),
              gte: vi.fn().mockReturnValue({
                not: vi.fn().mockReturnValue({
                  order: vi.fn().mockReturnValue({ data: bodyData, error: null }),
                }),
              }),
            }),
          }),
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockReturnValue({ data: createdRecord, error: null }),
            }),
          }),
        }
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            gte: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({ data: [], error: null }),
              not: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({ data: [], error: null }),
              }),
            }),
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({ data: [], error: null }),
            }),
            eq: vi.fn().mockReturnValue({
              gte: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({ data: [], error: null }),
                }),
              }),
            }),
          }),
        }),
      }
    })

    const req = buildPostRequest({
      clientId: 'valid-code',
      date: '2024-06-15',
      weight: 75,
    })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(mockGenerateNutritionSuggestion).toHaveBeenCalled()
    const callArgs = mockGenerateNutritionSuggestion.mock.calls[0][0]
    // 'unknown_value' is truthy so geneticProfile is defined, but parseSerotoninField returns {}
    expect(callArgs.geneticProfile).toBeDefined()
    expect(callArgs.geneticProfile.serotonin).toBeUndefined()
    expect(callArgs.geneticProfile.depressionRisk).toBeUndefined()
  })

  it('handles gene_depression_risk with null (no genetic profile)', async () => {
    const createdRecord = {
      id: 'rec-null-gene',
      client_id: 'uuid-ng',
      date: '2024-06-15',
      weight: 75,
      body_fat: null,
      height: null,
      muscle_mass: null,
      visceral_fat: null,
      bmi: null,
    }

    const today = new Date()
    const todayStr = today.toISOString().split('T')[0]
    const sevenDaysAgo = new Date(today)
    sevenDaysAgo.setDate(today.getDate() - 7)
    const bodyData = [
      { date: sevenDaysAgo.toISOString().split('T')[0], weight: 75.5, body_fat: null, height: null },
      { date: todayStr, weight: 75, body_fat: null, height: null },
    ]

    let clientCallCount = 0
    mockFrom.mockImplementation((table: string) => {
      if (table === 'clients') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockImplementation(() => {
                clientCallCount++
                if (clientCallCount === 1) {
                  return { data: { id: 'uuid-ng', expires_at: null }, error: null }
                }
                return {
                  data: {
                    id: 'uuid-ng',
                    goal_type: 'fat_loss',
                    nutrition_enabled: true,
                    gender: '男性',
                    target_weight: null,
                    competition_date: null,
                    target_date: null,
                    competition_enabled: false,
                    calories_target: 2000,
                    protein_target: 150,
                    carbs_target: 200,
                    fat_target: 60,
                    diet_start_date: null,
                    prep_phase: null,
                    activity_profile: null,
                    gene_mthfr: null,
                    gene_apoe: null,
                    gene_depression_risk: null,
                    carbs_training_day: null,
                    carbs_rest_day: null,
                    target_body_fat: null,
                  },
                  error: null,
                }
              }),
            }),
          }),
        }
      }
      if (table === 'body_composition') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockReturnValue({ data: null, error: null }),
              }),
              gte: vi.fn().mockReturnValue({
                not: vi.fn().mockReturnValue({
                  order: vi.fn().mockReturnValue({ data: bodyData, error: null }),
                }),
              }),
            }),
          }),
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockReturnValue({ data: createdRecord, error: null }),
            }),
          }),
        }
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            gte: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({ data: [], error: null }),
              not: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({ data: [], error: null }),
              }),
            }),
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({ data: [], error: null }),
            }),
            eq: vi.fn().mockReturnValue({
              gte: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({ data: [], error: null }),
                }),
              }),
            }),
          }),
        }),
      }
    })

    const req = buildPostRequest({
      clientId: 'valid-code',
      date: '2024-06-15',
      weight: 75,
    })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(mockGenerateNutritionSuggestion).toHaveBeenCalled()
    const callArgs = mockGenerateNutritionSuggestion.mock.calls[0][0]
    // All gene fields are null -> geneticProfile should be undefined
    expect(callArgs.geneticProfile).toBeUndefined()
  })
})
