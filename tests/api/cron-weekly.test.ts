import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ── Stub environment ──
vi.stubEnv('CRON_SECRET', 'test-cron-secret')
vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://test.example.com')

// ---------------------------------------------------------------------------
// Hoisted mocks -- vi.mock factories are hoisted above all other code,
// so any variables they reference must be created via vi.hoisted().
// ---------------------------------------------------------------------------
const {
  mockSupabase,
  mockFromResults,
  createMockQueryBuilder,
  mockPushMessage,
  mockGenerateNutritionSuggestion,
  mockGenerateWeeklyAIReport,
  mockVerifyAdminSession,
} = vi.hoisted(() => {
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

  const mockPushMessage = vi.fn().mockResolvedValue(undefined)

  const mockGenerateNutritionSuggestion = vi.fn(() => ({
    status: 'on_track',
    message: 'Test suggestion',
    suggestedCalories: 2000,
    suggestedProtein: 150,
    suggestedCarbs: 200,
    suggestedFat: 70,
    weeklyWeightChangeRate: -0.3,
    refeedSuggested: false,
    warnings: [],
    tdeeAnomalyDetected: false,
  }))

  const mockGenerateWeeklyAIReport = vi.fn().mockResolvedValue('AI report content')

  const mockVerifyAdminSession = vi.fn(() => false)

  return {
    mockSupabase,
    mockFromResults,
    createMockQueryBuilder,
    mockPushMessage,
    mockGenerateNutritionSuggestion,
    mockGenerateWeeklyAIReport,
    mockVerifyAdminSession,
  }
})

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------
vi.mock('@/lib/supabase', () => ({
  createServiceSupabase: vi.fn(() => mockSupabase),
}))

vi.mock('@/lib/line', () => ({
  pushMessage: mockPushMessage,
}))

vi.mock('@/lib/auth-middleware', () => ({
  verifyAdminSession: mockVerifyAdminSession,
}))

vi.mock('@/lib/nutrition-engine', () => ({
  generateNutritionSuggestion: mockGenerateNutritionSuggestion,
}))

vi.mock('@/components/client/types', () => ({
  isWeightTraining: vi.fn((type: string) => ['重訓', '力量訓練', 'weight_training'].includes(type)),
}))

vi.mock('@/lib/ai-insights', () => ({
  generateWeeklyAIReport: mockGenerateWeeklyAIReport,
}))

vi.mock('@/lib/logger', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
}))

// Import route handler AFTER mocks
import { GET } from '@/app/api/cron/weekly/route'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeRequest(options?: { authHeader?: string }): NextRequest {
  const req = new NextRequest('http://localhost/api/cron/weekly', { method: 'GET' })
  if (options?.authHeader) {
    req.headers.set('authorization', options.authHeader)
  }
  return req
}

function daysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().split('T')[0]
}

function makeClient(overrides: Record<string, any> = {}) {
  return {
    id: 'c1',
    name: 'Test Client',
    line_user_id: null,
    is_active: true,
    nutrition_enabled: true,
    body_composition_enabled: true,
    gender: '男性',
    goal_type: 'cut',
    health_mode_enabled: false,
    quarterly_cycle_start: null,
    subscription_tier: 'coached',
    ai_chat_enabled: false,
    diet_start_date: null,
    target_weight: null,
    competition_date: null,
    target_date: null,
    calories_target: null,
    protein_target: null,
    carbs_target: null,
    fat_target: null,
    carbs_training_day: null,
    carbs_rest_day: null,
    prep_phase: null,
    activity_profile: null,
    gene_mthfr: null,
    gene_apoe: null,
    gene_depression_risk: null,
    created_at: null,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('GET /api/cron/weekly', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Restore default implementations after clearAllMocks
    mockPushMessage.mockResolvedValue(undefined)
    mockGenerateNutritionSuggestion.mockImplementation(() => ({
      status: 'on_track',
      message: 'Test suggestion',
      suggestedCalories: 2000,
      suggestedProtein: 150,
      suggestedCarbs: 200,
      suggestedFat: 70,
      weeklyWeightChangeRate: -0.3,
      refeedSuggested: false,
      warnings: [],
      tdeeAnomalyDetected: false,
    }))
    mockGenerateWeeklyAIReport.mockResolvedValue('AI report content')
    mockVerifyAdminSession.mockReturnValue(false)

    // Reset mockSupabase.from to default behaviour
    mockSupabase.from.mockImplementation((table: string) => {
      const result = mockFromResults[table] || { data: null, error: null }
      return createMockQueryBuilder(result.data, result.error)
    })

    // Default empty state
    mockFromResults['clients'] = { data: [], error: null }
    mockFromResults['body_composition'] = { data: [], error: null }
    mockFromResults['nutrition_logs'] = { data: [], error: null }
    mockFromResults['training_logs'] = { data: [], error: null }
    mockFromResults['daily_wellness'] = { data: [], error: null }
    mockFromResults['weekly_summaries'] = { data: null, error: null }
    mockFromResults['coach_notifications'] = { data: null, error: null }
  })

  // ── Authorization Tests ──

  it('should return 401 when no authorization is provided', async () => {
    const req = makeRequest()
    const res = await GET(req)
    const body = await res.json()

    expect(res.status).toBe(401)
    expect(body.error).toBe('未授權')
  })

  it('should return 401 with incorrect CRON_SECRET', async () => {
    const req = makeRequest({ authHeader: 'Bearer wrong-secret' })
    const res = await GET(req)
    const body = await res.json()

    expect(res.status).toBe(401)
    expect(body.error).toBe('未授權')
  })

  it('should authenticate with valid CRON_SECRET', async () => {
    const req = makeRequest({ authHeader: 'Bearer test-cron-secret' })
    const res = await GET(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toHaveProperty('success')
  })

  it('should authenticate via admin session cookie', async () => {
    mockVerifyAdminSession.mockReturnValueOnce(true)
    const req = new NextRequest('http://localhost/api/cron/weekly', {
      method: 'GET',
      headers: { cookie: 'admin_session=valid-token' },
    })
    const res = await GET(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toHaveProperty('success')
  })

  // ── Client Fetch Error ──

  it('should return 500 when clients query fails', async () => {
    mockFromResults['clients'] = { data: null, error: { message: 'Connection refused' } }

    const req = makeRequest({ authHeader: 'Bearer test-cron-secret' })
    const res = await GET(req)
    const body = await res.json()

    expect(res.status).toBe(500)
    expect(body.error).toBe('無法取得學員資料')
    expect(body.detail).toBe('Connection refused')
  })

  // ── Empty Clients ──

  it('should return success with zero counts when no clients exist', async () => {
    const req = makeRequest({ authHeader: 'Bearer test-cron-secret' })
    const res = await GET(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.results.quarterlyResets).toBe(0)
    expect(body.results.analysisGenerated).toBe(0)
    expect(body.results.alertsGenerated).toBe(0)
    expect(body.results.linePushCount).toBe(0)
  })

  // ── Response Structure ──

  it('should return expected response structure on success', async () => {
    const req = makeRequest({ authHeader: 'Bearer test-cron-secret' })
    const res = await GET(req)
    const body = await res.json()

    expect(body).toHaveProperty('success')
    expect(body).toHaveProperty('timestamp')
    expect(body).toHaveProperty('results')
    expect(body).toHaveProperty('alerts')
    expect(body.results).toHaveProperty('quarterlyResets')
    expect(body.results).toHaveProperty('analysisGenerated')
    expect(body.results).toHaveProperty('alertsGenerated')
    expect(body.results).toHaveProperty('linePushCount')
    expect(body.results).toHaveProperty('aiReportCount')
    expect(body.results).toHaveProperty('reviewTriggered')
    expect(body.results).toHaveProperty('errors')
    expect(Array.isArray(body.alerts)).toBe(true)
  })

  // ── Nutrition Analysis Generation ──

  it('should generate nutrition analysis for clients with body data', async () => {
    const today = new Date().toISOString().split('T')[0]
    const clients = [makeClient({ id: 'c1', line_user_id: 'U100' })]
    mockFromResults['clients'] = { data: clients, error: null }
    mockFromResults['body_composition'] = {
      data: [{ client_id: 'c1', date: today, weight: 75.5, height: 175, body_fat: 18 }],
      error: null,
    }

    const req = makeRequest({ authHeader: 'Bearer test-cron-secret' })
    const res = await GET(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.results.analysisGenerated).toBe(1)
    expect(mockGenerateNutritionSuggestion).toHaveBeenCalled()
  })

  // ── carbsCyclingEnabled (line 258) ──

  it('should set carbsCyclingEnabled to true when both carbs_training_day and carbs_rest_day are set', async () => {
    const today = new Date().toISOString().split('T')[0]
    const clients = [makeClient({
      id: 'c1',
      carbs_training_day: 250,
      carbs_rest_day: 150,
    })]
    mockFromResults['clients'] = { data: clients, error: null }
    mockFromResults['body_composition'] = {
      data: [{ client_id: 'c1', date: today, weight: 80, height: 180, body_fat: 15 }],
      error: null,
    }

    const req = makeRequest({ authHeader: 'Bearer test-cron-secret' })
    const res = await GET(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.results.analysisGenerated).toBe(1)
    expect(mockGenerateNutritionSuggestion).toHaveBeenCalledWith(
      expect.objectContaining({
        carbsCyclingEnabled: true,
        currentCarbsTrainingDay: 250,
        currentCarbsRestDay: 150,
      })
    )
  })

  it('should set carbsCyclingEnabled to false when carbs_training_day or carbs_rest_day is missing', async () => {
    const today = new Date().toISOString().split('T')[0]
    const clients = [makeClient({
      id: 'c1',
      carbs_training_day: 250,
      carbs_rest_day: null,
    })]
    mockFromResults['clients'] = { data: clients, error: null }
    mockFromResults['body_composition'] = {
      data: [{ client_id: 'c1', date: today, weight: 80, height: 180, body_fat: 15 }],
      error: null,
    }

    const req = makeRequest({ authHeader: 'Bearer test-cron-secret' })
    await GET(req)

    expect(mockGenerateNutritionSuggestion).toHaveBeenCalledWith(
      expect.objectContaining({ carbsCyclingEnabled: false })
    )
  })

  // ── LINE Push for Weekly Reports ──

  it('should push weekly report via LINE for clients with line_user_id', async () => {
    const today = new Date().toISOString().split('T')[0]
    const dateStr = daysAgo(5)

    const clients = [makeClient({ id: 'c1', name: 'Test User', line_user_id: 'U200' })]
    mockFromResults['clients'] = { data: clients, error: null }
    mockFromResults['body_composition'] = {
      data: [
        { client_id: 'c1', date: dateStr, weight: 76.0, height: 175, body_fat: null },
        { client_id: 'c1', date: today, weight: 75.5, height: 175, body_fat: null },
      ],
      error: null,
    }

    const req = makeRequest({ authHeader: 'Bearer test-cron-secret' })
    const res = await GET(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.results.linePushCount).toBe(1)
    expect(mockPushMessage).toHaveBeenCalledWith('U200', expect.any(Array))
  })

  // ── LINE push failure (line 507) ──

  it('should record error when LINE push fails', async () => {
    const today = new Date().toISOString().split('T')[0]
    const clients = [makeClient({ id: 'c1', name: 'Push Fail Client', line_user_id: 'U-fail' })]
    mockFromResults['clients'] = { data: clients, error: null }
    mockFromResults['body_composition'] = {
      data: [{ client_id: 'c1', date: today, weight: 70, height: 170, body_fat: null }],
      error: null,
    }

    mockPushMessage.mockRejectedValueOnce(new Error('LINE API timeout'))

    const req = makeRequest({ authHeader: 'Bearer test-cron-secret' })
    const res = await GET(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.results.linePushCount).toBe(0)
    expect(body.results.errors).toContainEqual(
      expect.stringContaining('LINE 推播失敗')
    )
    expect(body.results.errors).toContainEqual(
      expect.stringContaining('LINE API timeout')
    )
  })

  // ── AI Weekly Report (lines 465-497) ──

  it('should generate AI report when ANTHROPIC_API_KEY is set and client has ai_chat_enabled', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-api-key')

    const today = new Date().toISOString().split('T')[0]
    const clients = [makeClient({
      id: 'c1',
      name: 'AI Client',
      line_user_id: 'U-ai',
      ai_chat_enabled: true,
    })]
    mockFromResults['clients'] = { data: clients, error: null }
    mockFromResults['body_composition'] = {
      data: [
        { client_id: 'c1', date: daysAgo(3), weight: 76, height: 175, body_fat: 18 },
        { client_id: 'c1', date: today, weight: 75.5, height: 175, body_fat: 17.5 },
      ],
      error: null,
    }
    mockFromResults['nutrition_logs'] = {
      data: [
        { client_id: 'c1', date: daysAgo(1), compliant: true, calories: 2000, protein_grams: 150, carbs_grams: 200, fat_grams: 70 },
      ],
      error: null,
    }
    mockFromResults['training_logs'] = {
      data: [
        { client_id: 'c1', date: daysAgo(1), training_type: 'weight_training', rpe: 7 },
      ],
      error: null,
    }
    mockFromResults['daily_wellness'] = {
      data: [
        { client_id: 'c1', date: daysAgo(1), energy_level: 4, training_drive: 4, period_start: false, device_recovery_score: 70, resting_hr: 60, hrv: 50, wearable_sleep_score: 80, respiratory_rate: 14 },
      ],
      error: null,
    }

    mockGenerateWeeklyAIReport.mockResolvedValueOnce('Your training is progressing well.')

    const req = makeRequest({ authHeader: 'Bearer test-cron-secret' })
    const res = await GET(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.results.aiReportCount).toBe(1)
    expect(mockGenerateWeeklyAIReport).toHaveBeenCalledWith(
      expect.objectContaining({
        client: expect.objectContaining({
          name: 'AI Client',
          goalType: 'cut',
        }),
      })
    )
    // The push message should include AI content
    expect(mockPushMessage).toHaveBeenCalled()
    const pushCall = mockPushMessage.mock.calls[0]
    const messageText = pushCall[1][0].text
    expect(messageText).toContain('AI 分析')

    vi.unstubAllEnvs()
    vi.stubEnv('CRON_SECRET', 'test-cron-secret')
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://test.example.com')
  })

  it('should not generate AI report when ANTHROPIC_API_KEY is not set', async () => {
    delete process.env.ANTHROPIC_API_KEY

    const today = new Date().toISOString().split('T')[0]
    const clients = [makeClient({
      id: 'c1',
      name: 'No AI Client',
      line_user_id: 'U-noai',
      ai_chat_enabled: true,
    })]
    mockFromResults['clients'] = { data: clients, error: null }
    mockFromResults['body_composition'] = {
      data: [{ client_id: 'c1', date: today, weight: 75, height: 175, body_fat: null }],
      error: null,
    }

    const req = makeRequest({ authHeader: 'Bearer test-cron-secret' })
    const res = await GET(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.results.aiReportCount).toBe(0)
    expect(mockGenerateWeeklyAIReport).not.toHaveBeenCalled()
  })

  it('should not generate AI report when client ai_chat_enabled is false', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-api-key')

    const today = new Date().toISOString().split('T')[0]
    const clients = [makeClient({
      id: 'c1',
      name: 'No Chat Client',
      line_user_id: 'U-nochat',
      ai_chat_enabled: false,
    })]
    mockFromResults['clients'] = { data: clients, error: null }
    mockFromResults['body_composition'] = {
      data: [{ client_id: 'c1', date: today, weight: 75, height: 175, body_fat: null }],
      error: null,
    }

    const req = makeRequest({ authHeader: 'Bearer test-cron-secret' })
    const res = await GET(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.results.aiReportCount).toBe(0)
    expect(mockGenerateWeeklyAIReport).not.toHaveBeenCalled()

    vi.unstubAllEnvs()
    vi.stubEnv('CRON_SECRET', 'test-cron-secret')
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://test.example.com')
  })

  it('should handle AI report generation failure gracefully (line 496-497)', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-api-key')

    const today = new Date().toISOString().split('T')[0]
    const clients = [makeClient({
      id: 'c1',
      name: 'AI Fail Client',
      line_user_id: 'U-aifail',
      ai_chat_enabled: true,
    })]
    mockFromResults['clients'] = { data: clients, error: null }
    mockFromResults['body_composition'] = {
      data: [{ client_id: 'c1', date: today, weight: 75, height: 175, body_fat: null }],
      error: null,
    }

    mockGenerateWeeklyAIReport.mockRejectedValueOnce(new Error('AI API rate limit'))

    const req = makeRequest({ authHeader: 'Bearer test-cron-secret' })
    const res = await GET(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.results.aiReportCount).toBe(0)
    expect(body.results.errors).toContainEqual(
      expect.stringContaining('AI 週報失敗')
    )
    expect(body.results.errors).toContainEqual(
      expect.stringContaining('AI API rate limit')
    )
    // LINE push should still happen (without AI section)
    expect(body.results.linePushCount).toBe(1)

    vi.unstubAllEnvs()
    vi.stubEnv('CRON_SECRET', 'test-cron-secret')
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://test.example.com')
  })

  it('should handle AI report returning null', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-api-key')

    const today = new Date().toISOString().split('T')[0]
    const clients = [makeClient({
      id: 'c1',
      name: 'AI Null Client',
      line_user_id: 'U-ainull',
      ai_chat_enabled: true,
    })]
    mockFromResults['clients'] = { data: clients, error: null }
    mockFromResults['body_composition'] = {
      data: [{ client_id: 'c1', date: today, weight: 75, height: 175, body_fat: null }],
      error: null,
    }

    mockGenerateWeeklyAIReport.mockResolvedValueOnce(null)

    const req = makeRequest({ authHeader: 'Bearer test-cron-secret' })
    const res = await GET(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.results.aiReportCount).toBe(0)
    // LINE push should still work
    expect(body.results.linePushCount).toBe(1)
    // Message should NOT contain AI section
    const pushCall = mockPushMessage.mock.calls[0]
    const messageText = pushCall[1][0].text
    expect(messageText).not.toContain('AI 分析')

    vi.unstubAllEnvs()
    vi.stubEnv('CRON_SECRET', 'test-cron-secret')
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://test.example.com')
  })

  // ── Quarterly Reset ──

  it('should reset quarterly cycle when elapsed >= 90 days', async () => {
    const ninetyDaysAgo = new Date()
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 91)

    const clients = [makeClient({
      id: 'c1',
      name: 'Health Mode Client',
      nutrition_enabled: false,
      body_composition_enabled: false,
      health_mode_enabled: true,
      quarterly_cycle_start: ninetyDaysAgo.toISOString().split('T')[0],
    })]
    mockFromResults['clients'] = { data: clients, error: null }

    const req = makeRequest({ authHeader: 'Bearer test-cron-secret' })
    const res = await GET(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.results.quarterlyResets).toBe(1)
    expect(mockSupabase.from).toHaveBeenCalledWith('clients')
  })

  it('should record error when quarterly reset update fails', async () => {
    const ninetyDaysAgo = new Date()
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 91)

    const clients = [makeClient({
      id: 'c1',
      name: 'Reset Fail Client',
      nutrition_enabled: false,
      body_composition_enabled: false,
      health_mode_enabled: true,
      quarterly_cycle_start: ninetyDaysAgo.toISOString().split('T')[0],
    })]

    let fromCallCount = 0
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'clients') {
        fromCallCount++
        if (fromCallCount === 1) {
          return createMockQueryBuilder(clients, null)
        }
        // Second call: update for quarterly reset -- return error
        return createMockQueryBuilder(null, { message: 'Update failed' })
      }
      const result = mockFromResults[table] || { data: null, error: null }
      return createMockQueryBuilder(result.data, result.error)
    })

    const req = makeRequest({ authHeader: 'Bearer test-cron-secret' })
    const res = await GET(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.results.quarterlyResets).toBe(0)
    expect(body.results.errors).toContainEqual(
      expect.stringContaining('季度重置失敗')
    )
  })

  it('should not reset quarterly cycle when elapsed < 90 days', async () => {
    const fiftyDaysAgo = new Date()
    fiftyDaysAgo.setDate(fiftyDaysAgo.getDate() - 50)

    const clients = [makeClient({
      id: 'c1',
      name: 'Not Due Client',
      nutrition_enabled: false,
      body_composition_enabled: false,
      health_mode_enabled: true,
      quarterly_cycle_start: fiftyDaysAgo.toISOString().split('T')[0],
    })]
    mockFromResults['clients'] = { data: clients, error: null }

    const req = makeRequest({ authHeader: 'Bearer test-cron-secret' })
    const res = await GET(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.results.quarterlyResets).toBe(0)
  })

  // ── Skips clients without body data for nutrition analysis ──

  it('should skip nutrition analysis for clients with no weight data', async () => {
    const clients = [makeClient({
      id: 'c1',
      name: 'No Data Client',
      line_user_id: 'U300',
      gender: '女性',
    })]
    mockFromResults['clients'] = { data: clients, error: null }

    const req = makeRequest({ authHeader: 'Bearer test-cron-secret' })
    const res = await GET(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.results.analysisGenerated).toBe(0)
    expect(mockGenerateNutritionSuggestion).not.toHaveBeenCalled()
  })

  it('should skip clients with neither nutrition_enabled nor body_composition_enabled', async () => {
    const today = new Date().toISOString().split('T')[0]
    const clients = [makeClient({
      id: 'c1',
      name: 'No Modules Client',
      nutrition_enabled: false,
      body_composition_enabled: false,
    })]
    mockFromResults['clients'] = { data: clients, error: null }
    mockFromResults['body_composition'] = {
      data: [{ client_id: 'c1', date: today, weight: 75, height: 175, body_fat: null }],
      error: null,
    }

    const req = makeRequest({ authHeader: 'Bearer test-cron-secret' })
    const res = await GET(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.results.analysisGenerated).toBe(0)
  })

  // ── Nutrition engine error handling ──

  it('should record error when nutrition engine throws', async () => {
    const today = new Date().toISOString().split('T')[0]
    const clients = [makeClient({ id: 'c1', name: 'Engine Error Client' })]
    mockFromResults['clients'] = { data: clients, error: null }
    mockFromResults['body_composition'] = {
      data: [{ client_id: 'c1', date: today, weight: 75, height: 175, body_fat: null }],
      error: null,
    }

    mockGenerateNutritionSuggestion.mockImplementationOnce(() => {
      throw new Error('Engine calculation failed')
    })

    const req = makeRequest({ authHeader: 'Bearer test-cron-secret' })
    const res = await GET(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.results.analysisGenerated).toBe(0)
    expect(body.results.errors).toContainEqual(
      expect.stringContaining('分析失敗')
    )
    expect(body.results.errors).toContainEqual(
      expect.stringContaining('Engine calculation failed')
    )
  })

  // ── weekly_summaries upsert error ──

  it('should record error when weekly_summaries upsert fails', async () => {
    const today = new Date().toISOString().split('T')[0]
    const clients = [makeClient({ id: 'c1', name: 'Summary Client' })]
    mockFromResults['clients'] = { data: clients, error: null }
    mockFromResults['body_composition'] = {
      data: [{ client_id: 'c1', date: today, weight: 75, height: 175, body_fat: null }],
      error: null,
    }
    mockFromResults['weekly_summaries'] = {
      data: null,
      error: { message: 'Unique constraint violation' },
    }

    const req = makeRequest({ authHeader: 'Bearer test-cron-secret' })
    const res = await GET(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.results.errors).toContainEqual(
      expect.stringContaining('weekly_summaries 寫入失敗')
    )
  })

  // ── Coach alert generation ──

  it('should generate weight stagnation alert when 14-day weight range < 0.5 kg', async () => {
    const clients = [makeClient({ id: 'c1', name: 'Stagnant Client', nutrition_enabled: false, body_composition_enabled: false })]
    mockFromResults['clients'] = { data: clients, error: null }
    mockFromResults['body_composition'] = {
      data: [
        { client_id: 'c1', date: daysAgo(1), weight: 75.0, height: 175, body_fat: null },
        { client_id: 'c1', date: daysAgo(3), weight: 75.1, height: 175, body_fat: null },
        { client_id: 'c1', date: daysAgo(5), weight: 75.2, height: 175, body_fat: null },
        { client_id: 'c1', date: daysAgo(7), weight: 75.3, height: 175, body_fat: null },
      ],
      error: null,
    }

    const req = makeRequest({ authHeader: 'Bearer test-cron-secret' })
    const res = await GET(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.alerts).toContainEqual(expect.stringContaining('體重近 14 天停滯'))
  })

  it('should generate low compliance alert when nutrition compliance < 60%', async () => {
    const clients = [makeClient({ id: 'c1', name: 'Low Comply Client', nutrition_enabled: false, body_composition_enabled: false })]
    mockFromResults['clients'] = { data: clients, error: null }
    mockFromResults['nutrition_logs'] = {
      data: [
        { client_id: 'c1', date: daysAgo(1), compliant: false, calories: null, protein_grams: null, carbs_grams: null, fat_grams: null },
        { client_id: 'c1', date: daysAgo(2), compliant: false, calories: null, protein_grams: null, carbs_grams: null, fat_grams: null },
        { client_id: 'c1', date: daysAgo(3), compliant: false, calories: null, protein_grams: null, carbs_grams: null, fat_grams: null },
        { client_id: 'c1', date: daysAgo(4), compliant: true, calories: null, protein_grams: null, carbs_grams: null, fat_grams: null },
        { client_id: 'c1', date: daysAgo(5), compliant: false, calories: null, protein_grams: null, carbs_grams: null, fat_grams: null },
        { client_id: 'c1', date: daysAgo(6), compliant: false, calories: null, protein_grams: null, carbs_grams: null, fat_grams: null },
      ],
      error: null,
    }

    const req = makeRequest({ authHeader: 'Bearer test-cron-secret' })
    const res = await GET(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.alerts).toContainEqual(expect.stringContaining('飲食合規率僅'))
  })

  it('should generate low energy alert when 3 consecutive days have energy <= 2', async () => {
    const clients = [makeClient({ id: 'c1', name: 'Low Energy Client', nutrition_enabled: false, body_composition_enabled: false })]
    mockFromResults['clients'] = { data: clients, error: null }
    mockFromResults['daily_wellness'] = {
      data: [
        { client_id: 'c1', date: daysAgo(1), energy_level: 1, training_drive: null, period_start: false, device_recovery_score: null, resting_hr: null, hrv: null, wearable_sleep_score: null, respiratory_rate: null },
        { client_id: 'c1', date: daysAgo(2), energy_level: 2, training_drive: null, period_start: false, device_recovery_score: null, resting_hr: null, hrv: null, wearable_sleep_score: null, respiratory_rate: null },
        { client_id: 'c1', date: daysAgo(3), energy_level: 2, training_drive: null, period_start: false, device_recovery_score: null, resting_hr: null, hrv: null, wearable_sleep_score: null, respiratory_rate: null },
      ],
      error: null,
    }

    const req = makeRequest({ authHeader: 'Bearer test-cron-secret' })
    const res = await GET(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.alerts).toContainEqual(expect.stringContaining('連續 3 天能量指數低'))
  })

  it('should generate refeed suggestion alert', async () => {
    const today = new Date().toISOString().split('T')[0]
    const clients = [makeClient({ id: 'c1', name: 'Refeed Client' })]
    mockFromResults['clients'] = { data: clients, error: null }
    mockFromResults['body_composition'] = {
      data: [{ client_id: 'c1', date: today, weight: 75, height: 175, body_fat: null }],
      error: null,
    }

    mockGenerateNutritionSuggestion.mockReturnValueOnce({
      status: 'on_track',
      message: 'Test',
      suggestedCalories: 2000,
      suggestedProtein: 150,
      suggestedCarbs: 200,
      suggestedFat: 70,
      weeklyWeightChangeRate: -0.3,
      refeedSuggested: true,
      warnings: [],
      tdeeAnomalyDetected: false,
    })

    const req = makeRequest({ authHeader: 'Bearer test-cron-secret' })
    const res = await GET(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.alerts).toContainEqual(expect.stringContaining('建議安排 Refeed'))
  })

  it('should generate TDEE anomaly alert', async () => {
    const today = new Date().toISOString().split('T')[0]
    const clients = [makeClient({ id: 'c1', name: 'TDEE Client' })]
    mockFromResults['clients'] = { data: clients, error: null }
    mockFromResults['body_composition'] = {
      data: [{ client_id: 'c1', date: today, weight: 75, height: 175, body_fat: null }],
      error: null,
    }

    mockGenerateNutritionSuggestion.mockReturnValueOnce({
      status: 'on_track',
      message: 'Test',
      suggestedCalories: 2000,
      suggestedProtein: 150,
      suggestedCarbs: 200,
      suggestedFat: 70,
      weeklyWeightChangeRate: -0.3,
      refeedSuggested: false,
      warnings: [],
      tdeeAnomalyDetected: true,
    })

    const req = makeRequest({ authHeader: 'Bearer test-cron-secret' })
    const res = await GET(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.alerts).toContainEqual(expect.stringContaining('TDEE 校正幅度異常'))
  })

  it('should generate quarterly cycle expiring alert when elapsed 80-89 days', async () => {
    const eightyFiveDaysAgo = new Date()
    eightyFiveDaysAgo.setDate(eightyFiveDaysAgo.getDate() - 85)

    const clients = [makeClient({
      id: 'c1',
      name: 'Cycle Expiring Client',
      nutrition_enabled: false,
      body_composition_enabled: false,
      health_mode_enabled: true,
      quarterly_cycle_start: eightyFiveDaysAgo.toISOString().split('T')[0],
    })]
    mockFromResults['clients'] = { data: clients, error: null }

    const req = makeRequest({ authHeader: 'Bearer test-cron-secret' })
    const res = await GET(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.alerts).toContainEqual(expect.stringContaining('季度週期剩餘'))
    expect(body.alerts).toContainEqual(expect.stringContaining('提醒安排血檢'))
  })

  // ── coach_notifications insert error ──

  it('should record error when coach_notifications insert fails', async () => {
    const clients = [makeClient({ id: 'c1', name: 'Alert Client', nutrition_enabled: false, body_composition_enabled: false })]
    mockFromResults['clients'] = { data: clients, error: null }
    mockFromResults['daily_wellness'] = {
      data: [
        { client_id: 'c1', date: daysAgo(1), energy_level: 1, training_drive: null, period_start: false, device_recovery_score: null, resting_hr: null, hrv: null, wearable_sleep_score: null, respiratory_rate: null },
        { client_id: 'c1', date: daysAgo(2), energy_level: 1, training_drive: null, period_start: false, device_recovery_score: null, resting_hr: null, hrv: null, wearable_sleep_score: null, respiratory_rate: null },
        { client_id: 'c1', date: daysAgo(3), energy_level: 2, training_drive: null, period_start: false, device_recovery_score: null, resting_hr: null, hrv: null, wearable_sleep_score: null, respiratory_rate: null },
      ],
      error: null,
    }
    mockFromResults['coach_notifications'] = {
      data: null,
      error: { message: 'Insert failed' },
    }

    const req = makeRequest({ authHeader: 'Bearer test-cron-secret' })
    const res = await GET(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.results.errors).toContainEqual(
      expect.stringContaining('coach_notifications 寫入失敗')
    )
  })

  // ── 90-day free review trigger ──

  it('should trigger 90-day review for self_managed users at day 88-92', async () => {
    const ninetyDaysAgo = new Date()
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)

    const clients = [makeClient({
      id: 'c1',
      name: 'Self Managed User',
      line_user_id: 'U-self',
      subscription_tier: 'self_managed',
      created_at: ninetyDaysAgo.toISOString(),
      nutrition_enabled: false,
      body_composition_enabled: false,
    })]
    mockFromResults['clients'] = { data: clients, error: null }

    const req = makeRequest({ authHeader: 'Bearer test-cron-secret' })
    const res = await GET(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.results.reviewTriggered).toBe(1)
    expect(mockPushMessage).toHaveBeenCalledWith('U-self', expect.arrayContaining([
      expect.objectContaining({ type: 'text', text: expect.stringContaining('90 天') }),
    ]))
  })

  it('should not trigger 90-day review for non-self_managed users', async () => {
    const ninetyDaysAgo = new Date()
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)

    const clients = [makeClient({
      id: 'c1',
      name: 'Coached User',
      line_user_id: 'U-coached',
      subscription_tier: 'coached',
      created_at: ninetyDaysAgo.toISOString(),
      nutrition_enabled: false,
      body_composition_enabled: false,
    })]
    mockFromResults['clients'] = { data: clients, error: null }

    const req = makeRequest({ authHeader: 'Bearer test-cron-secret' })
    const res = await GET(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.results.reviewTriggered).toBe(0)
  })

  it('should not trigger 90-day review without line_user_id', async () => {
    const ninetyDaysAgo = new Date()
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)

    const clients = [makeClient({
      id: 'c1',
      name: 'No LINE User',
      line_user_id: null,
      subscription_tier: 'self_managed',
      created_at: ninetyDaysAgo.toISOString(),
      nutrition_enabled: false,
      body_composition_enabled: false,
    })]
    mockFromResults['clients'] = { data: clients, error: null }

    const req = makeRequest({ authHeader: 'Bearer test-cron-secret' })
    const res = await GET(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.results.reviewTriggered).toBe(0)
  })

  it('should not trigger 90-day review without created_at', async () => {
    const clients = [makeClient({
      id: 'c1',
      name: 'No Created At',
      line_user_id: 'U-nocreated',
      subscription_tier: 'self_managed',
      created_at: null,
      nutrition_enabled: false,
      body_composition_enabled: false,
    })]
    mockFromResults['clients'] = { data: clients, error: null }

    const req = makeRequest({ authHeader: 'Bearer test-cron-secret' })
    const res = await GET(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.results.reviewTriggered).toBe(0)
  })

  it('should record error when 90-day review push fails', async () => {
    const ninetyDaysAgo = new Date()
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)

    const clients = [makeClient({
      id: 'c1',
      name: 'Review Push Fail',
      line_user_id: 'U-revfail',
      subscription_tier: 'self_managed',
      created_at: ninetyDaysAgo.toISOString(),
      nutrition_enabled: false,
      body_composition_enabled: false,
    })]
    mockFromResults['clients'] = { data: clients, error: null }

    mockPushMessage
      .mockRejectedValueOnce(new Error('Review push failed'))
      .mockResolvedValueOnce(undefined)

    const req = makeRequest({ authHeader: 'Bearer test-cron-secret' })
    const res = await GET(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.results.reviewTriggered).toBe(0)
    expect(body.results.errors).toContainEqual(
      expect.stringContaining('90 天 Review 推播失敗')
    )
  })

  // ── Female period tracking ──

  it('should query period data for female clients', async () => {
    const today = new Date().toISOString().split('T')[0]
    const clients = [makeClient({
      id: 'c1',
      name: 'Female Client',
      gender: '女性',
      line_user_id: 'U-female',
    })]
    mockFromResults['clients'] = { data: clients, error: null }
    mockFromResults['body_composition'] = {
      data: [{ client_id: 'c1', date: today, weight: 58, height: 165, body_fat: 22 }],
      error: null,
    }
    mockFromResults['daily_wellness'] = {
      data: [
        { client_id: 'c1', date: daysAgo(5), energy_level: 3, training_drive: 3, period_start: true, device_recovery_score: null, resting_hr: null, hrv: null, wearable_sleep_score: null, respiratory_rate: null },
      ],
      error: null,
    }

    const req = makeRequest({ authHeader: 'Bearer test-cron-secret' })
    const res = await GET(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.results.analysisGenerated).toBe(1)
    expect(mockGenerateNutritionSuggestion).toHaveBeenCalledWith(
      expect.objectContaining({ gender: '女性' })
    )
  })

  // ── Genetic profile in nutrition engine ──

  it('should pass genetic profile to nutrition engine when gene data exists', async () => {
    const today = new Date().toISOString().split('T')[0]
    const clients = [makeClient({
      id: 'c1',
      name: 'Gene Client',
      gene_mthfr: 'CT',
      gene_apoe: 'E3/E4',
      gene_depression_risk: 'SL',
    })]
    mockFromResults['clients'] = { data: clients, error: null }
    mockFromResults['body_composition'] = {
      data: [{ client_id: 'c1', date: today, weight: 80, height: 180, body_fat: 15 }],
      error: null,
    }

    const req = makeRequest({ authHeader: 'Bearer test-cron-secret' })
    await GET(req)

    expect(mockGenerateNutritionSuggestion).toHaveBeenCalledWith(
      expect.objectContaining({
        geneticProfile: expect.objectContaining({
          mthfr: 'CT',
          apoe: 'E3/E4',
          serotonin: 'SL',
        }),
      })
    )
  })

  it('should map depressionRisk from gene_depression_risk for non-serotonin values', async () => {
    const today = new Date().toISOString().split('T')[0]
    const clients = [makeClient({
      id: 'c1',
      name: 'Depression Risk Client',
      gene_mthfr: null,
      gene_apoe: null,
      gene_depression_risk: 'high',
    })]
    mockFromResults['clients'] = { data: clients, error: null }
    mockFromResults['body_composition'] = {
      data: [{ client_id: 'c1', date: today, weight: 80, height: 180, body_fat: 15 }],
      error: null,
    }

    const req = makeRequest({ authHeader: 'Bearer test-cron-secret' })
    await GET(req)

    expect(mockGenerateNutritionSuggestion).toHaveBeenCalledWith(
      expect.objectContaining({
        geneticProfile: expect.objectContaining({
          depressionRisk: 'high',
        }),
      })
    )
  })

  // ── LINE message content ──

  it('should include nutrition warnings in LINE message', async () => {
    const today = new Date().toISOString().split('T')[0]
    const clients = [makeClient({ id: 'c1', name: 'Warning Client', line_user_id: 'U-warn' })]
    mockFromResults['clients'] = { data: clients, error: null }
    mockFromResults['body_composition'] = {
      data: [{ client_id: 'c1', date: today, weight: 75, height: 175, body_fat: null }],
      error: null,
    }

    mockGenerateNutritionSuggestion.mockReturnValueOnce({
      status: 'on_track',
      message: 'Test',
      suggestedCalories: 2000,
      suggestedProtein: 150,
      suggestedCarbs: 200,
      suggestedFat: 70,
      weeklyWeightChangeRate: -0.3,
      refeedSuggested: false,
      warnings: ['Protein intake too low', 'Consider more fiber'],
      tdeeAnomalyDetected: false,
    })

    const req = makeRequest({ authHeader: 'Bearer test-cron-secret' })
    const res = await GET(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(mockPushMessage).toHaveBeenCalled()
    const msgText = mockPushMessage.mock.calls[0][1][0].text
    expect(msgText).toContain('注意事項')
    expect(msgText).toContain('Protein intake too low')
    expect(msgText).toContain('Consider more fiber')
  })

  it('should include suggested calories and protein in LINE message', async () => {
    const today = new Date().toISOString().split('T')[0]
    const clients = [makeClient({ id: 'c1', name: 'Suggest Client', line_user_id: 'U-suggest' })]
    mockFromResults['clients'] = { data: clients, error: null }
    mockFromResults['body_composition'] = {
      data: [{ client_id: 'c1', date: today, weight: 75, height: 175, body_fat: null }],
      error: null,
    }

    const req = makeRequest({ authHeader: 'Bearer test-cron-secret' })
    await GET(req)

    expect(mockPushMessage).toHaveBeenCalled()
    const msgText = mockPushMessage.mock.calls[0][1][0].text
    expect(msgText).toContain('建議熱量：2000 kcal')
    expect(msgText).toContain('建議蛋白質：150g')
  })

  // ── Catches top-level exceptions ──

  it('should return 500 when an unexpected error occurs', async () => {
    mockSupabase.from.mockImplementationOnce(() => {
      throw new Error('Unexpected failure')
    })

    const req = makeRequest({ authHeader: 'Bearer test-cron-secret' })
    const res = await GET(req)
    const body = await res.json()

    expect(res.status).toBe(500)
    expect(body.error).toBe('執行失敗')
    expect(body.detail).toBe('Unexpected failure')
  })

  // ── Multiple clients comprehensive test ──

  it('should handle multiple clients with different configurations', async () => {
    const today = new Date().toISOString().split('T')[0]
    const clients = [
      makeClient({ id: 'c1', name: 'Client A', line_user_id: 'U-A' }),
      makeClient({ id: 'c2', name: 'Client B', line_user_id: null }),
      makeClient({ id: 'c3', name: 'Client C', line_user_id: 'U-C', nutrition_enabled: false, body_composition_enabled: false }),
    ]
    mockFromResults['clients'] = { data: clients, error: null }
    mockFromResults['body_composition'] = {
      data: [
        { client_id: 'c1', date: today, weight: 75, height: 175, body_fat: 18 },
        { client_id: 'c2', date: today, weight: 80, height: 180, body_fat: 20 },
      ],
      error: null,
    }

    const req = makeRequest({ authHeader: 'Bearer test-cron-secret' })
    const res = await GET(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    // c1 and c2 have body data and are nutrition-enabled
    expect(body.results.analysisGenerated).toBe(2)
    // c1 and c3 have line_user_id
    expect(body.results.linePushCount).toBe(2)
  })
})
