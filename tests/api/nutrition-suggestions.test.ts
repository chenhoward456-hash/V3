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

  describe('coach_macro_override 到期', () => {
    it('到期時把 previous_values 還原回 clients，而不是只解鎖（否則 coached tier 會永遠卡在覆寫值）', async () => {
      const updates: Record<string, unknown>[] = []
      const logs: Record<string, unknown>[] = []

      const expiredClient = {
        id: 'c1', name: '測試', unique_code: 'client001', gender: '男性', goal_type: 'cut',
        diet_start_date: '2025-01-01', target_weight: 70, target_body_fat: 12,
        competition_date: null, target_date: '2025-06-01',
        calories_target: 1594, protein_target: 186, carbs_target: 100, fat_target: 50,
        carbs_training_day: 100, carbs_rest_day: 100, prep_phase: 'peak_week',
        activity_profile: null, subscription_tier: 'coached', competition_enabled: false,
        client_mode: 'bodybuilding', nutrition_enabled: true,
        gene_mthfr: null, gene_apoe: null, gene_depression_risk: null,
        coach_macro_override: {
          locked_at: '2026-07-10T00:00:00+08:00',
          expires_at: '2020-01-01T00:00:00+08:00', // 已過期
          locked_fields: ['calories_target', 'carbs_target'],
          override_values: { calories_target: 1594, carbs_target: 100 },
          previous_values: { calories_target: 1900, carbs_target: 177 },
          reason: 'Peak Week 掏空日',
        },
      }

      mockSupabase.from = vi.fn((table: string) => {
        const chain: any = {}
        for (const m of ['select', 'eq', 'gte', 'lte', 'lt', 'not', 'order', 'limit']) chain[m] = vi.fn(() => chain)
        chain.single = vi.fn(() => Promise.resolve({ data: table === 'clients' ? expiredClient : null, error: null }))
        chain.update = vi.fn((patch: Record<string, unknown>) => { if (table === 'clients') updates.push(patch); return chain })
        chain.insert = vi.fn((row: Record<string, unknown>) => { if (table === 'macro_adjustment_log') logs.push(row); return Promise.resolve({ data: null, error: null }) })
        chain.upsert = vi.fn(() => chain)
        chain.then = (resolve: any) => {
          if (table === 'body_composition') {
            return Promise.resolve({ data: [
              { date: '2026-06-20', weight: 82.0, height: 175, body_fat: 9 },
              { date: '2026-06-27', weight: 81.4, height: 175, body_fat: 8.5 },
              { date: '2026-07-04', weight: 80.9, height: 175, body_fat: 8 },
              { date: '2026-07-09', weight: 80.3, height: 175, body_fat: 7.5 },
            ], error: null }).then(resolve)
          }
          if (table === 'nutrition_logs') {
            return Promise.resolve({ data: [{ date: '2026-07-09', compliant: true, calories: 1900, protein_grams: 186, carbs_grams: 236, fat_grams: 50 }], error: null }).then(resolve)
          }
          return Promise.resolve({ data: [], error: null }).then(resolve)
        }
        return chain
      })

      const req = makeGetRequest({ clientId: 'client001' })
      await GET(req)
      await new Promise(r => setTimeout(r, 0)) // fire-and-forget 的 update/insert

      const restore = updates.find(u => 'coach_macro_override' in u)
      expect(restore, '到期時應該 update clients 還原並解鎖').toBeDefined()
      expect(restore!.coach_macro_override).toBeNull()
      expect(restore!.calories_target, '應還原覆寫前的熱量').toBe(1900)
      expect(restore!.carbs_target, '應還原覆寫前的碳水').toBe(177)

      expect(logs.length, '還原也是 macro 變更，必須寫 macro_adjustment_log').toBeGreaterThan(0)
      expect(logs[0].applied_by).toBe('system')
      expect(logs[0].trigger_source).toBe('manual')
    })
  })
})
