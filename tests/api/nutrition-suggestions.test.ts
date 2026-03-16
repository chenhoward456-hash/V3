import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ── Mocks ──

const mockGenerateNutritionSuggestion = vi.fn()
vi.mock('@/lib/nutrition-engine', () => ({
  generateNutritionSuggestion: (...args: any[]) => mockGenerateNutritionSuggestion(...args),
}))

vi.mock('@/components/client/types', () => ({
  isWeightTraining: (type: string | null | undefined) => {
    const wt = ['push', 'pull', 'legs', 'chest', 'shoulder', 'arms', 'full_body', 'upper', 'lower']
    return wt.includes(type as string)
  },
}))

vi.mock('@/lib/auth-middleware', () => ({
  verifyAdminSession: vi.fn(() => true),
}))

// Chainable Supabase mock
type QueryResult = { data: any; error: any; count?: number }

function makeChain(results: Record<string, QueryResult>): any {
  let currentTable = ''
  const chain: any = new Proxy({}, {
    get(_target, prop: string) {
      if (prop === 'from') {
        return (table: string) => {
          currentTable = table
          return chain
        }
      }
      if (prop === 'then') {
        // Support Promise.all resolution
        const r = results[currentTable] ?? { data: null, error: null }
        return (resolve: any) => Promise.resolve(r).then(resolve)
      }
      // All chaining methods return the chain
      return (..._args: any[]) => chain
    },
  })
  return chain
}

let mockSupabase: any

vi.mock('@/lib/supabase', () => ({
  createServiceSupabase: () => mockSupabase,
}))

// ── Helpers ──

function makeGetRequest(params: Record<string, string>): NextRequest {
  const url = new URL('http://localhost:3000/api/nutrition-suggestions')
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const req = new NextRequest(url, { method: 'GET' })
  // Add admin cookie
  Object.defineProperty(req, 'cookies', {
    get: () => ({
      get: (name: string) => name === 'admin_session' ? { value: 'valid-token' } : undefined,
    }),
  })
  return req
}

// ── Tests ──

describe('GET /api/nutrition-suggestions', () => {
  let GET: (request: NextRequest) => Promise<Response>

  beforeEach(async () => {
    vi.resetModules()
    mockGenerateNutritionSuggestion.mockReset()

    // Default supabase that returns a valid client
    const defaultClient = {
      id: 'uuid-1',
      unique_code: 'client001',
      gender: '男性',
      goal_type: 'cut',
      diet_start_date: '2025-01-01',
      target_weight: 70,
      target_body_fat: 12,
      competition_date: null,
      target_date: '2025-06-01',
      calories_target: 2000,
      protein_target: 160,
      carbs_target: 200,
      fat_target: 60,
      carbs_training_day: null,
      carbs_rest_day: null,
      prep_phase: null,
      activity_profile: null,
      subscription_tier: 'coached',
      competition_enabled: false,
      client_mode: 'standard',
      nutrition_enabled: true,
      coach_macro_override: null,
      gene_mthfr: null,
      gene_apoe: null,
      gene_depression_risk: null,
    }

    // Set up supabase mock with chainable builder that returns correct data per table
    mockSupabase = {
      from: vi.fn((table: string) => {
        const chain: any = {}
        const chainMethods = ['select', 'eq', 'gte', 'lte', 'lt', 'not', 'order', 'limit']
        for (const m of chainMethods) {
          chain[m] = vi.fn(() => chain)
        }
        chain.single = vi.fn(() => {
          if (table === 'clients') return Promise.resolve({ data: defaultClient, error: null })
          return Promise.resolve({ data: null, error: null })
        })
        chain.update = vi.fn(() => chain)
        chain.upsert = vi.fn(() => chain)
        // Make chain thenable for Promise.all
        chain.then = (resolve: any) => {
          if (table === 'body_composition') {
            return Promise.resolve({ data: [{ date: '2025-03-01', weight: 75, height: 175, body_fat: 18 }], error: null }).then(resolve)
          }
          if (table === 'nutrition_logs') {
            return Promise.resolve({ data: [{ date: '2025-03-01', compliant: true, calories: 2000, protein_grams: 160, carbs_grams: 200, fat_grams: 60 }], error: null }).then(resolve)
          }
          if (table === 'training_logs') {
            return Promise.resolve({ data: [{ date: '2025-03-01', training_type: 'push', rpe: 7, duration: 60 }], error: null }).then(resolve)
          }
          if (table === 'daily_wellness') {
            return Promise.resolve({ data: [{ date: '2025-03-01', sleep_quality: 4, energy_level: 4, mood: 4, training_drive: 4 }], error: null }).then(resolve)
          }
          return Promise.resolve({ data: [], error: null }).then(resolve)
        }
        return chain
      }),
    }

    // Default engine output
    mockGenerateNutritionSuggestion.mockReturnValue({
      status: 'on_track',
      statusLabel: '進度正常',
      statusEmoji: '✅',
      message: 'Your progress is on track.',
      warnings: [],
      suggestedCalories: 1950,
      suggestedProtein: 155,
      suggestedCarbs: 190,
      suggestedFat: 58,
      suggestedCarbsTrainingDay: null,
      suggestedCarbsRestDay: null,
      autoApply: false,
    })

    const mod = await import('@/app/api/nutrition-suggestions/route')
    GET = mod.GET
  })

  it('returns 400 when clientId is missing', async () => {
    const req = makeGetRequest({})
    const res = await GET(req)
    const json = await res.json()
    expect(res.status).toBe(400)
    expect(json.error).toContain('clientId')
  })

  it('returns 404 when client is not found', async () => {
    // Override supabase to return null client
    mockSupabase.from = vi.fn((table: string) => {
      const chain: any = {}
      const chainMethods = ['select', 'eq', 'gte', 'lte', 'lt', 'not', 'order', 'limit', 'update', 'upsert']
      for (const m of chainMethods) {
        chain[m] = vi.fn(() => chain)
      }
      chain.single = vi.fn(() => Promise.resolve({ data: null, error: { message: 'not found' } }))
      chain.then = (resolve: any) => Promise.resolve({ data: [], error: null }).then(resolve)
      return chain
    })

    vi.resetModules()
    const mod = await import('@/app/api/nutrition-suggestions/route')

    const req = makeGetRequest({ clientId: 'nonexistent' })
    const res = await mod.GET(req)
    const json = await res.json()
    expect(res.status).toBe(404)
    expect(json.error).toContain('學員')
  })

  it('returns nutrition suggestions for a valid client', async () => {
    const req = makeGetRequest({ clientId: 'client001' })
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.suggestion).toBeDefined()
    expect(json.suggestion.status).toBe('on_track')
    expect(json.suggestion.suggestedCalories).toBe(1950)
    expect(json.meta).toBeDefined()
    expect(json.meta.goalType).toBe('cut')
  })

  it('returns insufficient_data when no weight data exists', async () => {
    // Override to return empty body composition
    mockSupabase.from = vi.fn((table: string) => {
      const chain: any = {}
      const chainMethods = ['select', 'eq', 'gte', 'lte', 'lt', 'not', 'order', 'limit', 'update', 'upsert']
      for (const m of chainMethods) {
        chain[m] = vi.fn(() => chain)
      }
      chain.single = vi.fn(() => {
        if (table === 'clients') {
          return Promise.resolve({
            data: {
              id: 'uuid-1', unique_code: 'client001', gender: '男性', goal_type: 'cut',
              diet_start_date: null, target_weight: null, target_body_fat: null,
              competition_date: null, target_date: null, calories_target: null,
              protein_target: null, carbs_target: null, fat_target: null,
              carbs_training_day: null, carbs_rest_day: null, prep_phase: null,
              activity_profile: null, subscription_tier: 'free', competition_enabled: false, client_mode: 'standard',
              nutrition_enabled: false, coach_macro_override: null,
              gene_mthfr: null, gene_apoe: null, gene_depression_risk: null,
            },
            error: null,
          })
        }
        return Promise.resolve({ data: null, error: null })
      })
      chain.then = (resolve: any) => Promise.resolve({ data: [], error: null }).then(resolve)
      return chain
    })

    vi.resetModules()
    const mod = await import('@/app/api/nutrition-suggestions/route')

    const req = makeGetRequest({ clientId: 'client001' })
    const res = await mod.GET(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.suggestion.status).toBe('insufficient_data')
  })

  it('calls generateNutritionSuggestion with correct engine input', async () => {
    const req = makeGetRequest({ clientId: 'client001' })
    await GET(req)

    expect(mockGenerateNutritionSuggestion).toHaveBeenCalledTimes(1)
    const input = mockGenerateNutritionSuggestion.mock.calls[0][0]
    expect(input.gender).toBe('男性')
    expect(input.goalType).toBe('cut')
    expect(input.bodyWeight).toBe(75)
  })

  it('includes meta data in response', async () => {
    const req = makeGetRequest({ clientId: 'client001' })
    const res = await GET(req)
    const json = await res.json()

    expect(json.meta).toBeDefined()
    expect(json.meta.latestWeight).toBe(75)
    expect(json.meta.goalType).toBe('cut')
    expect(typeof json.meta.nutritionCompliance).toBe('number')
    expect(typeof json.meta.trainingDaysPerWeek).toBe('number')
  })

  it('returns 401 when neither admin nor code is provided', async () => {
    // Override verifyAdminSession to return false
    vi.resetModules()

    vi.doMock('@/lib/auth-middleware', () => ({
      verifyAdminSession: vi.fn(() => false),
    }))

    const mod = await import('@/app/api/nutrition-suggestions/route')

    // Request without admin cookie and without code param
    const url = new URL('http://localhost:3000/api/nutrition-suggestions')
    url.searchParams.set('clientId', 'client001')
    const req = new NextRequest(url, { method: 'GET' })
    Object.defineProperty(req, 'cookies', {
      get: () => ({
        get: () => undefined,
      }),
    })

    const res = await mod.GET(req)
    const json = await res.json()
    expect(res.status).toBe(401)
    expect(json.error).toContain('未授權')
  })

  it('handles internal errors with 500', async () => {
    // Restore the auth mock since the previous test may have used vi.doMock
    vi.resetModules()
    vi.doMock('@/lib/auth-middleware', () => ({
      verifyAdminSession: vi.fn(() => true),
    }))
    mockGenerateNutritionSuggestion.mockImplementation(() => {
      throw new Error('engine crash')
    })

    const mod = await import('@/app/api/nutrition-suggestions/route')
    const req = makeGetRequest({ clientId: 'client001' })
    const res = await mod.GET(req)
    const json = await res.json()
    expect(res.status).toBe(500)
    expect(json.error).toContain('分析失敗')
  })
})
