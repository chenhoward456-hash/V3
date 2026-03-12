import { NextRequest } from 'next/server'

// ---------------------------------------------------------------------------
// Hoisted mocks -- required because the route module calls
// createServiceSupabase() at module-level (top-level const).
// vi.hoisted() ensures variables exist before vi.mock() factories execute.
// ALL variables referenced inside vi.mock() factories must be hoisted.
// ---------------------------------------------------------------------------
const {
  mockSingle,
  mockLimit,
  mockOrder,
  mockIn,
  mockNot,
  mockEq,
  mockSelect,
  mockFrom,
  mockSupabase,
  mockTrainingAdvice,
  mockModeRecommendation,
  mockGetTrainingAdvice,
  mockGetTrainingModeRecommendation,
  mockAnalyzeTrainingPattern,
  mockExtractHormoneLabs,
  mockCalculateMetabolicStressScore,
} = vi.hoisted(() => {
  const mockSingle = vi.fn()
  const mockLimit = vi.fn()
  const mockOrder = vi.fn()
  const mockIn = vi.fn()
  const mockNot = vi.fn()
  const mockEq = vi.fn()
  const mockSelect = vi.fn()
  const mockFrom = vi.fn()
  const mockSupabase = { from: mockFrom }

  const mockTrainingAdvice = {
    recommendedIntensity: 'moderate' as const,
    recoveryScore: 65,
    reasons: ['Recovery is adequate'],
    suggestion: 'Maintain normal training intensity.',
    recoveryAssessment: undefined,
  }

  const mockModeRecommendation = {
    mode: 'strength' as const,
    confidence: 0.8,
    reasons: ['Good recovery state'],
  }

  const mockGetTrainingAdvice = vi.fn().mockReturnValue(mockTrainingAdvice)
  const mockGetTrainingModeRecommendation = vi.fn().mockReturnValue(mockModeRecommendation)
  const mockAnalyzeTrainingPattern = vi.fn().mockReturnValue({
    weeklyFrequency: 4,
    avgRPE: 7,
    dominantType: 'weight',
    varietyScore: 0.6,
  })
  const mockExtractHormoneLabs = vi.fn().mockReturnValue({})
  const mockCalculateMetabolicStressScore = vi.fn().mockReturnValue({
    score: 30,
    level: 'low',
  })

  return {
    mockSingle,
    mockLimit,
    mockOrder,
    mockIn,
    mockNot,
    mockEq,
    mockSelect,
    mockFrom,
    mockSupabase,
    mockTrainingAdvice,
    mockModeRecommendation,
    mockGetTrainingAdvice,
    mockGetTrainingModeRecommendation,
    mockAnalyzeTrainingPattern,
    mockExtractHormoneLabs,
    mockCalculateMetabolicStressScore,
  }
})

// Track which table is being queried so we can return different data per table
let fromCallIndex = 0
const fromCallResults: Array<{
  singleResult?: { data: any; error: any }
  limitResult?: { data: any; error: any }
  orderResult?: { data: any; error: any }
}> = []

function resetChainMocks() {
  fromCallIndex = 0
  fromCallResults.length = 0

  mockLimit.mockImplementation(() => {
    // Find the result for the current call based on order
    const idx = fromCallIndex - 1
    const result = fromCallResults[idx]
    return result?.limitResult ?? { data: [], error: null }
  })
  mockOrder.mockImplementation(() => ({
    data: [],
    error: null,
    limit: mockLimit,
    not: mockNot,
  }))
  mockIn.mockImplementation(() => ({
    order: mockOrder,
    data: [],
    error: null,
  }))
  mockNot.mockImplementation(() => ({
    order: mockOrder,
    data: [],
    error: null,
  }))
  mockEq.mockImplementation(() => ({
    single: mockSingle,
    order: mockOrder,
    in: mockIn,
    not: mockNot,
    eq: mockEq,
  }))
  mockSelect.mockReturnValue({ eq: mockEq })
  mockFrom.mockImplementation(() => {
    fromCallIndex++
    return { select: mockSelect }
  })
  mockSingle.mockReturnValue({ data: null, error: null })
}

/**
 * Set up mock chain so that calls to supabase return different data per table.
 * Call order in the route:
 *   1. clients (single)
 *   2. daily_wellness (limit)
 *   3. training_logs (limit)
 *   4. lab_results with .in('status', [...]) (limit)
 *   5. lab_results all (limit)
 *   --- if shouldRecommendMode ---
 *   6. body_composition (limit) via .not().order().limit()
 *   --- if goal_type === 'cut' ---
 *   7. nutrition_logs (limit)
 */
function setupTableMocks(opts: {
  client?: any
  wellness?: any[]
  training?: any[]
  labResults?: any[]
  allLabs?: any[]
  weightHistory?: any[]
  nutritionLogs?: any[]
}) {
  const clientData = opts.client ?? null

  // We need to track from() calls to differentiate tables.
  // The route makes these calls in order:
  // 1. from('clients').select(...).eq(...).single()
  // 2. from('daily_wellness').select(...).eq(...).order(...).limit(7)
  // 3. from('training_logs').select(...).eq(...).order(...).limit(56)
  // 4. from('lab_results').select(...).eq(...).in(...).order(...).limit(20)
  // 5. from('lab_results').select(...).eq(...).order(...).limit(50)
  // 6. from('body_composition').select(...).eq(...).not(...).order(...).limit(28) [if shouldRecommendMode]
  // 7. from('nutrition_logs').select(...).eq(...).order(...).limit(14) [if goal_type === 'cut']

  let callIdx = 0

  mockSingle.mockImplementation(() => {
    return { data: clientData, error: null }
  })

  // Override mockLimit to return different data based on call index
  const limitResults = [
    opts.wellness ?? [],     // call 2
    opts.training ?? [],     // call 3
    opts.labResults ?? [],   // call 4
    opts.allLabs ?? [],      // call 5
    opts.weightHistory ?? [],// call 6
    opts.nutritionLogs ?? [],// call 7
  ]
  let limitCallIdx = 0

  mockLimit.mockImplementation(() => {
    const data = limitResults[limitCallIdx] ?? []
    limitCallIdx++
    return { data, error: null }
  })

  mockOrder.mockImplementation(() => ({
    data: [],
    error: null,
    limit: mockLimit,
    not: mockNot,
  }))

  mockIn.mockImplementation(() => ({
    order: mockOrder,
    data: [],
    error: null,
  }))

  mockNot.mockImplementation(() => ({
    order: mockOrder,
    data: [],
    error: null,
  }))

  mockEq.mockImplementation(() => ({
    single: mockSingle,
    order: mockOrder,
    in: mockIn,
    not: mockNot,
    eq: mockEq,
  }))

  mockSelect.mockReturnValue({ eq: mockEq })
  mockFrom.mockImplementation(() => {
    callIdx++
    return { select: mockSelect }
  })
}

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------
vi.mock('@/lib/supabase', () => ({
  createServiceSupabase: () => mockSupabase,
}))

vi.mock('@/lib/ai-insights', () => ({
  getTrainingAdvice: mockGetTrainingAdvice,
}))

vi.mock('@/lib/training-mode-engine', () => ({
  getTrainingModeRecommendation: mockGetTrainingModeRecommendation,
  analyzeTrainingPattern: mockAnalyzeTrainingPattern,
  extractHormoneLabs: mockExtractHormoneLabs,
}))

vi.mock('@/lib/nutrition-engine', () => ({
  calculateMetabolicStressScore: mockCalculateMetabolicStressScore,
}))

vi.mock('@/lib/supplement-engine', () => ({}))

// Import route handler AFTER mocks are set up
import { GET } from '@/app/api/training-readiness/route'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function buildRequest(url: string): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost'))
}

/** Generate a date string N days ago */
function daysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().split('T')[0]
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('GET /api/training-readiness', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetChainMocks()
    // Restore default return values for engine mocks after clearAllMocks
    mockGetTrainingAdvice.mockReturnValue(mockTrainingAdvice)
    mockGetTrainingModeRecommendation.mockReturnValue(mockModeRecommendation)
    mockAnalyzeTrainingPattern.mockReturnValue({
      weeklyFrequency: 4,
      avgRPE: 7,
      dominantType: 'weight',
      varietyScore: 0.6,
    })
    mockExtractHormoneLabs.mockReturnValue({})
    mockCalculateMetabolicStressScore.mockReturnValue({
      score: 30,
      level: 'low',
    })
  })

  // ── Basic validation ──

  it('returns 400 when clientId query parameter is missing', async () => {
    const req = buildRequest('http://localhost/api/training-readiness')
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toBeDefined()
  })

  it('returns 404 when client is not found', async () => {
    mockSingle.mockReturnValue({ data: null, error: null })

    const req = buildRequest('http://localhost/api/training-readiness?clientId=nonexistent')
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(404)
    expect(json.error).toBeDefined()
  })

  // ── shouldRecommendMode = false (no goal, no competition) ──

  it('returns training readiness advice for a valid client without goal/competition', async () => {
    setupTableMocks({
      client: {
        id: 'uuid-1',
        gene_mthfr: null,
        gene_apoe: null,
        gene_depression_risk: null,
        goal_type: null,
        prep_phase: null,
        competition_enabled: false,
        diet_start_date: null,
        gender: '男性',
      },
      wellness: [
        { date: daysAgo(0), sleep_quality: 4, energy_level: 4, mood: 4, stress_level: 2, device_recovery_score: null, hrv: null, resting_hr: null, wearable_sleep_score: null },
      ],
      training: [
        { date: daysAgo(0), training_type: 'weight', rpe: 7, sets: 20, duration: 60 },
      ],
    })

    const req = buildRequest('http://localhost/api/training-readiness?clientId=valid-code')
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.recommendedIntensity).toBe('moderate')
    expect(json.recoveryScore).toBe(65)
    expect(json.reasons).toBeDefined()
    expect(json.suggestion).toBeDefined()
    // Should NOT have modeRecommendation when shouldRecommendMode is false
    expect(json.modeRecommendation).toBeUndefined()
    // Should have called getTrainingAdvice
    expect(mockGetTrainingAdvice).toHaveBeenCalledTimes(1)
    // Should NOT have called mode recommendation engine
    expect(mockGetTrainingModeRecommendation).not.toHaveBeenCalled()
  })

  // ── shouldRecommendMode = true with goal_type ──

  it('returns training readiness with mode recommendation for client with goal_type (non-cut)', async () => {
    setupTableMocks({
      client: {
        id: 'uuid-2',
        gene_mthfr: null,
        gene_apoe: null,
        gene_depression_risk: null,
        goal_type: 'bulk',
        prep_phase: null,
        competition_enabled: false,
        diet_start_date: null,
        gender: '男性',
      },
      wellness: [],
      training: [],
      labResults: [],
      allLabs: [],
      weightHistory: [],
    })

    const req = buildRequest('http://localhost/api/training-readiness?clientId=bulk-client')
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.modeRecommendation).toBeDefined()
    expect(mockGetTrainingModeRecommendation).toHaveBeenCalledTimes(1)
    expect(mockAnalyzeTrainingPattern).toHaveBeenCalled()
    expect(mockExtractHormoneLabs).toHaveBeenCalled()
    // metabolicStress should be null since goal_type is 'bulk', not 'cut'
    expect(mockCalculateMetabolicStressScore).not.toHaveBeenCalled()
  })

  // ── shouldRecommendMode = true with competition_enabled ──

  it('handles client with competition_enabled returning mode recommendation', async () => {
    setupTableMocks({
      client: {
        id: 'uuid-3',
        gene_mthfr: 'CT',
        gene_apoe: 'E3/E4',
        gene_depression_risk: 'SL',
        goal_type: 'cut',
        prep_phase: 'peak_week',
        competition_enabled: true,
        diet_start_date: '2024-03-01',
        gender: '女性',
      },
      wellness: [
        { date: daysAgo(0), sleep_quality: 3, energy_level: 3, mood: 3, stress_level: 3, device_recovery_score: 60, hrv: 45, resting_hr: 65, wearable_sleep_score: 70 },
      ],
      training: [
        { date: daysAgo(0), training_type: 'weight', rpe: 8, sets: 25, duration: 75 },
      ],
      labResults: [
        { test_name: 'Cortisol', value: 25, unit: 'ug/dL', status: 'attention' },
      ],
      allLabs: [
        { test_name: 'Testosterone', value: 40, unit: 'ng/dL', status: 'normal' },
      ],
      weightHistory: [],
      nutritionLogs: [],
    })

    const req = buildRequest('http://localhost/api/training-readiness?clientId=comp-client')
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.modeRecommendation).toBeDefined()
    // Verify genetic profile construction with serotonin from 'SL'
    expect(mockGetTrainingModeRecommendation).toHaveBeenCalledWith(
      expect.objectContaining({
        geneticProfile: expect.objectContaining({
          mthfr: 'CT',
          apoe: 'E3/E4',
          serotonin: 'SL',
          depressionRisk: null,
        }),
      })
    )
  })

  // ── Genetic profile with depressionRisk (non-serotonin value) ──

  it('correctly maps gene_depression_risk to depressionRisk when not a serotonin allele', async () => {
    setupTableMocks({
      client: {
        id: 'uuid-gene',
        gene_mthfr: null,
        gene_apoe: null,
        gene_depression_risk: 'high',
        goal_type: 'recomp',
        prep_phase: null,
        competition_enabled: false,
        diet_start_date: null,
        gender: '男性',
      },
      wellness: [],
      training: [],
      labResults: [],
      allLabs: [],
      weightHistory: [],
    })

    const req = buildRequest('http://localhost/api/training-readiness?clientId=gene-client')
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(mockGetTrainingModeRecommendation).toHaveBeenCalledWith(
      expect.objectContaining({
        geneticProfile: expect.objectContaining({
          serotonin: null,
          depressionRisk: 'high',
        }),
      })
    )
  })

  // ── Wearable data filtering ──

  it('passes wearable data to getTrainingAdvice when device data is present', async () => {
    setupTableMocks({
      client: {
        id: 'uuid-wear',
        gene_mthfr: null,
        gene_apoe: null,
        gene_depression_risk: null,
        goal_type: null,
        prep_phase: null,
        competition_enabled: false,
        diet_start_date: null,
        gender: '男性',
      },
      wellness: [
        { date: daysAgo(0), sleep_quality: 4, energy_level: 4, mood: 4, stress_level: 2, device_recovery_score: 80, hrv: 55, resting_hr: 58, wearable_sleep_score: 85 },
        { date: daysAgo(1), sleep_quality: 3, energy_level: 3, mood: 3, stress_level: 3, device_recovery_score: null, hrv: null, resting_hr: null, wearable_sleep_score: null },
      ],
    })

    const req = buildRequest('http://localhost/api/training-readiness?clientId=wearable-client')
    const res = await GET(req)

    expect(res.status).toBe(200)
    // getTrainingAdvice should be called with wearable data (only the entry that has device data)
    expect(mockGetTrainingAdvice).toHaveBeenCalledWith(
      expect.any(Array), // wellnessLogs
      expect.any(Array), // trainingLogs
      expect.arrayContaining([
        expect.objectContaining({ device_recovery_score: 80, hrv: 55 }),
      ]),
      undefined, // no lab data
    )
  })

  it('passes undefined for wearable data when no device data exists', async () => {
    setupTableMocks({
      client: {
        id: 'uuid-nowear',
        gene_mthfr: null,
        gene_apoe: null,
        gene_depression_risk: null,
        goal_type: null,
        prep_phase: null,
        competition_enabled: false,
        diet_start_date: null,
        gender: '男性',
      },
      wellness: [
        { date: daysAgo(0), sleep_quality: 4, energy_level: 4, mood: 4, stress_level: 2, device_recovery_score: null, hrv: null, resting_hr: null, wearable_sleep_score: null },
      ],
    })

    const req = buildRequest('http://localhost/api/training-readiness?clientId=no-wear-client')
    const res = await GET(req)

    expect(res.status).toBe(200)
    expect(mockGetTrainingAdvice).toHaveBeenCalledWith(
      expect.any(Array),
      expect.any(Array),
      undefined, // no wearable data
      undefined,
    )
  })

  // ── Lab data for training advice ──

  it('passes lab data to getTrainingAdvice when abnormal lab results exist', async () => {
    setupTableMocks({
      client: {
        id: 'uuid-lab',
        gene_mthfr: null,
        gene_apoe: null,
        gene_depression_risk: null,
        goal_type: null,
        prep_phase: null,
        competition_enabled: false,
        diet_start_date: null,
        gender: '女性',
      },
      wellness: [],
      training: [],
      labResults: [
        { test_name: 'Iron', value: 8, unit: 'ug/dL', status: 'alert' },
        { test_name: 'Vitamin D', value: 18, unit: 'ng/mL', status: 'attention' },
      ],
    })

    const req = buildRequest('http://localhost/api/training-readiness?clientId=lab-client')
    const res = await GET(req)

    expect(res.status).toBe(200)
    expect(mockGetTrainingAdvice).toHaveBeenCalledWith(
      expect.any(Array),
      expect.any(Array),
      undefined, // no wearable data
      expect.arrayContaining([
        expect.objectContaining({ test_name: 'Iron', status: 'alert' }),
      ]),
    )
  })

  // ── Weight history analysis: weeklyWeightChangePercent and plateau detection ──

  it('calculates weeklyWeightChangePercent when weight history has >= 7 entries', async () => {
    // Generate 14 weight entries over 14 days
    // Week 1 (recent): avg ~75 kg
    // Week 2 (previous): avg ~76 kg
    // Change = ((75-76)/76) * 100 = ~-1.3%
    const weightHistory = []
    for (let i = 0; i < 7; i++) {
      weightHistory.push({ date: daysAgo(i), weight: 75 })
    }
    for (let i = 7; i < 14; i++) {
      weightHistory.push({ date: daysAgo(i), weight: 76 })
    }

    setupTableMocks({
      client: {
        id: 'uuid-weight',
        gene_mthfr: null,
        gene_apoe: null,
        gene_depression_risk: null,
        goal_type: 'cut',
        prep_phase: null,
        competition_enabled: false,
        diet_start_date: '2024-01-01',
        gender: '男性',
      },
      wellness: [],
      training: [],
      labResults: [],
      allLabs: [],
      weightHistory,
      nutritionLogs: [],
    })

    const req = buildRequest('http://localhost/api/training-readiness?clientId=weight-client')
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    // Should have called getTrainingModeRecommendation with non-null weeklyWeightChangePercent
    expect(mockGetTrainingModeRecommendation).toHaveBeenCalledWith(
      expect.objectContaining({
        weeklyWeightChangePercent: expect.any(Number),
      })
    )
    const call = mockGetTrainingModeRecommendation.mock.calls[0][0]
    expect(call.weeklyWeightChangePercent).toBeCloseTo(-1.32, 1)
  })

  it('detects 1 week plateau when weight change < 0.3%', async () => {
    // All weights are ~75 kg (virtually no change)
    const weightHistory = []
    for (let i = 0; i < 7; i++) {
      weightHistory.push({ date: daysAgo(i), weight: 75.0 })
    }
    for (let i = 7; i < 14; i++) {
      weightHistory.push({ date: daysAgo(i), weight: 75.1 })
    }

    setupTableMocks({
      client: {
        id: 'uuid-plateau1',
        gene_mthfr: null,
        gene_apoe: null,
        gene_depression_risk: null,
        goal_type: 'cut',
        prep_phase: null,
        competition_enabled: false,
        diet_start_date: '2024-01-01',
        gender: '男性',
      },
      wellness: [],
      training: [],
      labResults: [],
      allLabs: [],
      weightHistory,
      nutritionLogs: [],
    })

    const req = buildRequest('http://localhost/api/training-readiness?clientId=plateau1-client')
    const res = await GET(req)

    expect(res.status).toBe(200)
    // metabolicStress should be called since goal_type === 'cut'
    expect(mockCalculateMetabolicStressScore).toHaveBeenCalledWith(
      expect.objectContaining({
        consecutivePlateauWeeks: expect.any(Number),
      })
    )
    const stressCall = mockCalculateMetabolicStressScore.mock.calls[0][0]
    // With only 14 entries and no older weeks, consecutivePlateauWeeks should be 1
    expect(stressCall.consecutivePlateauWeeks).toBeGreaterThanOrEqual(1)
  })

  it('detects 2 consecutive plateau weeks when 3 weeks of stable weight', async () => {
    // 21 entries all around 75 kg (minimal variation)
    const weightHistory = []
    for (let i = 0; i < 7; i++) {
      weightHistory.push({ date: daysAgo(i), weight: 75.0 })
    }
    for (let i = 7; i < 14; i++) {
      weightHistory.push({ date: daysAgo(i), weight: 75.05 })
    }
    for (let i = 14; i < 21; i++) {
      weightHistory.push({ date: daysAgo(i), weight: 75.1 })
    }

    setupTableMocks({
      client: {
        id: 'uuid-plateau2',
        gene_mthfr: null,
        gene_apoe: null,
        gene_depression_risk: null,
        goal_type: 'cut',
        prep_phase: null,
        competition_enabled: false,
        diet_start_date: '2024-01-01',
        gender: '男性',
      },
      wellness: [],
      training: [],
      labResults: [],
      allLabs: [],
      weightHistory,
      nutritionLogs: [],
    })

    const req = buildRequest('http://localhost/api/training-readiness?clientId=plateau2-client')
    const res = await GET(req)

    expect(res.status).toBe(200)
    expect(mockCalculateMetabolicStressScore).toHaveBeenCalled()
    const stressCall = mockCalculateMetabolicStressScore.mock.calls[0][0]
    expect(stressCall.consecutivePlateauWeeks).toBeGreaterThanOrEqual(2)
  })

  it('detects 3 consecutive plateau weeks when 4 weeks of stable weight', async () => {
    // 28 entries all around 75 kg (minimal variation)
    const weightHistory = []
    for (let i = 0; i < 7; i++) {
      weightHistory.push({ date: daysAgo(i), weight: 75.0 })
    }
    for (let i = 7; i < 14; i++) {
      weightHistory.push({ date: daysAgo(i), weight: 75.05 })
    }
    for (let i = 14; i < 21; i++) {
      weightHistory.push({ date: daysAgo(i), weight: 75.08 })
    }
    for (let i = 21; i < 28; i++) {
      weightHistory.push({ date: daysAgo(i), weight: 75.1 })
    }

    setupTableMocks({
      client: {
        id: 'uuid-plateau3',
        gene_mthfr: null,
        gene_apoe: null,
        gene_depression_risk: null,
        goal_type: 'cut',
        prep_phase: null,
        competition_enabled: false,
        diet_start_date: '2024-01-01',
        gender: '男性',
      },
      wellness: [],
      training: [],
      labResults: [],
      allLabs: [],
      weightHistory,
      nutritionLogs: [],
    })

    const req = buildRequest('http://localhost/api/training-readiness?clientId=plateau3-client')
    const res = await GET(req)

    expect(res.status).toBe(200)
    expect(mockCalculateMetabolicStressScore).toHaveBeenCalled()
    const stressCall = mockCalculateMetabolicStressScore.mock.calls[0][0]
    expect(stressCall.consecutivePlateauWeeks).toBe(3)
  })

  it('does not detect plateau when weight is actively changing', async () => {
    // Clear downtrend: recent week much lighter than previous
    const weightHistory = []
    for (let i = 0; i < 7; i++) {
      weightHistory.push({ date: daysAgo(i), weight: 72 })
    }
    for (let i = 7; i < 14; i++) {
      weightHistory.push({ date: daysAgo(i), weight: 76 })
    }

    setupTableMocks({
      client: {
        id: 'uuid-noplateau',
        gene_mthfr: null,
        gene_apoe: null,
        gene_depression_risk: null,
        goal_type: 'cut',
        prep_phase: null,
        competition_enabled: false,
        diet_start_date: '2024-01-01',
        gender: '男性',
      },
      wellness: [],
      training: [],
      labResults: [],
      allLabs: [],
      weightHistory,
      nutritionLogs: [],
    })

    const req = buildRequest('http://localhost/api/training-readiness?clientId=noplateau-client')
    const res = await GET(req)

    expect(res.status).toBe(200)
    expect(mockCalculateMetabolicStressScore).toHaveBeenCalledWith(
      expect.objectContaining({
        consecutivePlateauWeeks: 0,
      })
    )
  })

  // ── Metabolic stress for cut clients ──

  it('calculates metabolic stress for cut goal_type clients with diet_start_date', async () => {
    setupTableMocks({
      client: {
        id: 'uuid-cut',
        gene_mthfr: null,
        gene_apoe: null,
        gene_depression_risk: null,
        goal_type: 'cut',
        prep_phase: null,
        competition_enabled: false,
        diet_start_date: '2024-01-01',
        gender: '男性',
      },
      wellness: [
        { date: daysAgo(0), sleep_quality: 3, energy_level: 3, mood: 3, stress_level: 3, device_recovery_score: null, hrv: null, resting_hr: null, wearable_sleep_score: null },
      ],
      training: [],
      labResults: [],
      allLabs: [],
      weightHistory: [{ date: daysAgo(0), weight: 80 }],
      nutritionLogs: [
        { date: daysAgo(0), carbs_grams: 100 },
        { date: daysAgo(1), carbs_grams: 120 },
        { date: daysAgo(2), carbs_grams: 200 }, // >= 150, should break
      ],
    })

    const req = buildRequest('http://localhost/api/training-readiness?clientId=cut-client')
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(mockCalculateMetabolicStressScore).toHaveBeenCalledTimes(1)
    const call = mockCalculateMetabolicStressScore.mock.calls[0][0]
    // lowCarbDays should be 2 (first two are < 150, third >= 150 breaks)
    expect(call.lowCarbDays).toBe(2)
    expect(call.dietDurationWeeks).toBeGreaterThan(0)
    expect(call.bodyWeight).toBe(80)
  })

  it('counts all low carb days when all entries are below 150', async () => {
    setupTableMocks({
      client: {
        id: 'uuid-alllow',
        gene_mthfr: null,
        gene_apoe: null,
        gene_depression_risk: null,
        goal_type: 'cut',
        prep_phase: null,
        competition_enabled: false,
        diet_start_date: '2024-06-01',
        gender: '女性',
      },
      wellness: [],
      training: [],
      labResults: [],
      allLabs: [],
      weightHistory: [{ date: daysAgo(0), weight: 60 }],
      nutritionLogs: [
        { date: daysAgo(0), carbs_grams: 80 },
        { date: daysAgo(1), carbs_grams: 90 },
        { date: daysAgo(2), carbs_grams: 100 },
      ],
    })

    const req = buildRequest('http://localhost/api/training-readiness?clientId=alllow-client')
    const res = await GET(req)

    expect(res.status).toBe(200)
    expect(mockCalculateMetabolicStressScore).toHaveBeenCalled()
    const call = mockCalculateMetabolicStressScore.mock.calls[0][0]
    expect(call.lowCarbDays).toBe(3)
  })

  it('handles null carbs_grams by breaking the low carb streak', async () => {
    setupTableMocks({
      client: {
        id: 'uuid-nullcarb',
        gene_mthfr: null,
        gene_apoe: null,
        gene_depression_risk: null,
        goal_type: 'cut',
        prep_phase: null,
        competition_enabled: false,
        diet_start_date: '2024-06-01',
        gender: '男性',
      },
      wellness: [],
      training: [],
      labResults: [],
      allLabs: [],
      weightHistory: [{ date: daysAgo(0), weight: 70 }],
      nutritionLogs: [
        { date: daysAgo(0), carbs_grams: null }, // null => break
        { date: daysAgo(1), carbs_grams: 80 },
      ],
    })

    const req = buildRequest('http://localhost/api/training-readiness?clientId=nullcarb-client')
    const res = await GET(req)

    expect(res.status).toBe(200)
    expect(mockCalculateMetabolicStressScore).toHaveBeenCalled()
    const call = mockCalculateMetabolicStressScore.mock.calls[0][0]
    // null carbs_grams fails the `log.carbs_grams != null && log.carbs_grams < 150` check => break
    expect(call.lowCarbDays).toBe(0)
  })

  it('handles cut client without diet_start_date (dietDurationWeeks = null)', async () => {
    setupTableMocks({
      client: {
        id: 'uuid-nostart',
        gene_mthfr: null,
        gene_apoe: null,
        gene_depression_risk: null,
        goal_type: 'cut',
        prep_phase: null,
        competition_enabled: false,
        diet_start_date: null,
        gender: '男性',
      },
      wellness: [],
      training: [],
      labResults: [],
      allLabs: [],
      weightHistory: [{ date: daysAgo(0), weight: 85 }],
      nutritionLogs: [],
    })

    const req = buildRequest('http://localhost/api/training-readiness?clientId=nostart-client')
    const res = await GET(req)

    expect(res.status).toBe(200)
    expect(mockCalculateMetabolicStressScore).toHaveBeenCalledWith(
      expect.objectContaining({
        dietDurationWeeks: null,
      })
    )
  })

  // ── Recovery state mapping ──

  it('maps recoveryScore >= 75 to optimal recovery state', async () => {
    mockGetTrainingAdvice.mockReturnValue({
      ...mockTrainingAdvice,
      recoveryScore: 80,
    })

    setupTableMocks({
      client: {
        id: 'uuid-optimal',
        gene_mthfr: null,
        gene_apoe: null,
        gene_depression_risk: null,
        goal_type: 'cut',
        prep_phase: null,
        competition_enabled: false,
        diet_start_date: null,
        gender: '男性',
      },
      wellness: [],
      training: [],
      labResults: [],
      allLabs: [],
      weightHistory: [{ date: daysAgo(0), weight: 75 }],
      nutritionLogs: [],
    })

    const req = buildRequest('http://localhost/api/training-readiness?clientId=optimal-client')
    const res = await GET(req)

    expect(res.status).toBe(200)
    expect(mockCalculateMetabolicStressScore).toHaveBeenCalledWith(
      expect.objectContaining({ recoveryState: 'optimal' })
    )
  })

  it('maps recoveryScore 50-74 to good recovery state', async () => {
    mockGetTrainingAdvice.mockReturnValue({
      ...mockTrainingAdvice,
      recoveryScore: 60,
    })

    setupTableMocks({
      client: {
        id: 'uuid-good',
        gene_mthfr: null,
        gene_apoe: null,
        gene_depression_risk: null,
        goal_type: 'cut',
        prep_phase: null,
        competition_enabled: false,
        diet_start_date: null,
        gender: '男性',
      },
      wellness: [],
      training: [],
      labResults: [],
      allLabs: [],
      weightHistory: [{ date: daysAgo(0), weight: 75 }],
      nutritionLogs: [],
    })

    const req = buildRequest('http://localhost/api/training-readiness?clientId=good-client')
    const res = await GET(req)

    expect(res.status).toBe(200)
    expect(mockCalculateMetabolicStressScore).toHaveBeenCalledWith(
      expect.objectContaining({ recoveryState: 'good' })
    )
  })

  it('maps recoveryScore 30-49 to struggling recovery state', async () => {
    mockGetTrainingAdvice.mockReturnValue({
      ...mockTrainingAdvice,
      recoveryScore: 40,
    })

    setupTableMocks({
      client: {
        id: 'uuid-struggling',
        gene_mthfr: null,
        gene_apoe: null,
        gene_depression_risk: null,
        goal_type: 'cut',
        prep_phase: null,
        competition_enabled: false,
        diet_start_date: null,
        gender: '男性',
      },
      wellness: [],
      training: [],
      labResults: [],
      allLabs: [],
      weightHistory: [{ date: daysAgo(0), weight: 75 }],
      nutritionLogs: [],
    })

    const req = buildRequest('http://localhost/api/training-readiness?clientId=struggling-client')
    const res = await GET(req)

    expect(res.status).toBe(200)
    expect(mockCalculateMetabolicStressScore).toHaveBeenCalledWith(
      expect.objectContaining({ recoveryState: 'struggling' })
    )
  })

  it('maps recoveryScore < 30 to critical recovery state', async () => {
    mockGetTrainingAdvice.mockReturnValue({
      ...mockTrainingAdvice,
      recoveryScore: 20,
    })

    setupTableMocks({
      client: {
        id: 'uuid-critical',
        gene_mthfr: null,
        gene_apoe: null,
        gene_depression_risk: null,
        goal_type: 'cut',
        prep_phase: null,
        competition_enabled: false,
        diet_start_date: null,
        gender: '男性',
      },
      wellness: [],
      training: [],
      labResults: [],
      allLabs: [],
      weightHistory: [{ date: daysAgo(0), weight: 75 }],
      nutritionLogs: [],
    })

    const req = buildRequest('http://localhost/api/training-readiness?clientId=critical-client')
    const res = await GET(req)

    expect(res.status).toBe(200)
    expect(mockCalculateMetabolicStressScore).toHaveBeenCalledWith(
      expect.objectContaining({ recoveryState: 'critical' })
    )
  })

  // ── Weight history with less than required data ──

  it('does not calculate weight change when less than 7 weight entries', async () => {
    setupTableMocks({
      client: {
        id: 'uuid-fewwt',
        gene_mthfr: null,
        gene_apoe: null,
        gene_depression_risk: null,
        goal_type: 'cut',
        prep_phase: null,
        competition_enabled: false,
        diet_start_date: null,
        gender: '男性',
      },
      wellness: [],
      training: [],
      labResults: [],
      allLabs: [],
      weightHistory: [
        { date: daysAgo(0), weight: 75 },
        { date: daysAgo(1), weight: 75 },
        { date: daysAgo(2), weight: 75 },
      ],
      nutritionLogs: [],
    })

    const req = buildRequest('http://localhost/api/training-readiness?clientId=fewwt-client')
    const res = await GET(req)

    expect(res.status).toBe(200)
    // weeklyWeightChangePercent should be null when < 7 entries
    expect(mockGetTrainingModeRecommendation).toHaveBeenCalledWith(
      expect.objectContaining({
        weeklyWeightChangePercent: null,
      })
    )
  })

  it('handles weight history with 7+ entries but prevWeek < 3 entries', async () => {
    // 8 entries but all in the first 7 days
    const weightHistory = []
    for (let i = 0; i < 8; i++) {
      weightHistory.push({ date: daysAgo(i), weight: 75 })
    }
    // Only 1 entry in the "prevWeek" range (index 7)
    // The route slices [7, 14) so only index 7 entry is in prevWeek

    setupTableMocks({
      client: {
        id: 'uuid-fewprev',
        gene_mthfr: null,
        gene_apoe: null,
        gene_depression_risk: null,
        goal_type: 'cut',
        prep_phase: null,
        competition_enabled: false,
        diet_start_date: null,
        gender: '男性',
      },
      wellness: [],
      training: [],
      labResults: [],
      allLabs: [],
      weightHistory,
      nutritionLogs: [],
    })

    const req = buildRequest('http://localhost/api/training-readiness?clientId=fewprev-client')
    const res = await GET(req)

    expect(res.status).toBe(200)
    // prevWeek has only 1 entry (< 3) so weeklyWeightChangePercent should remain null
    // Actually the route checks `if (prevWeek.length >= 3)` so with 1 entry it stays null
  })

  // ── prevAvg is 0 edge case ──

  it('handles prevAvg of 0 gracefully (returns 0 change)', async () => {
    // This is an edge case where all prev-week weights are 0
    const weightHistory = []
    for (let i = 0; i < 7; i++) {
      weightHistory.push({ date: daysAgo(i), weight: 75 })
    }
    for (let i = 7; i < 14; i++) {
      weightHistory.push({ date: daysAgo(i), weight: 0 })
    }

    setupTableMocks({
      client: {
        id: 'uuid-zerowt',
        gene_mthfr: null,
        gene_apoe: null,
        gene_depression_risk: null,
        goal_type: 'cut',
        prep_phase: null,
        competition_enabled: false,
        diet_start_date: null,
        gender: '男性',
      },
      wellness: [],
      training: [],
      labResults: [],
      allLabs: [],
      weightHistory,
      nutritionLogs: [],
    })

    const req = buildRequest('http://localhost/api/training-readiness?clientId=zerowt-client')
    const res = await GET(req)

    expect(res.status).toBe(200)
    // When prevAvg === 0, the route returns 0 for weeklyWeightChangePercent
    expect(mockGetTrainingModeRecommendation).toHaveBeenCalledWith(
      expect.objectContaining({
        weeklyWeightChangePercent: 0,
      })
    )
  })

  // ── Empty nutrition logs for cut client ──

  it('handles empty nutrition logs for cut client (lowCarbDays = 0)', async () => {
    setupTableMocks({
      client: {
        id: 'uuid-emptynut',
        gene_mthfr: null,
        gene_apoe: null,
        gene_depression_risk: null,
        goal_type: 'cut',
        prep_phase: null,
        competition_enabled: false,
        diet_start_date: null,
        gender: '男性',
      },
      wellness: [],
      training: [],
      labResults: [],
      allLabs: [],
      weightHistory: [{ date: daysAgo(0), weight: 75 }],
      nutritionLogs: [],
    })

    const req = buildRequest('http://localhost/api/training-readiness?clientId=emptynut-client')
    const res = await GET(req)

    expect(res.status).toBe(200)
    expect(mockCalculateMetabolicStressScore).toHaveBeenCalledWith(
      expect.objectContaining({
        lowCarbDays: 0,
      })
    )
  })

  // ── No weight history for bodyWeight fallback ──

  it('passes undefined bodyWeight when no weight history exists', async () => {
    setupTableMocks({
      client: {
        id: 'uuid-nobw',
        gene_mthfr: null,
        gene_apoe: null,
        gene_depression_risk: null,
        goal_type: 'cut',
        prep_phase: null,
        competition_enabled: false,
        diet_start_date: null,
        gender: '男性',
      },
      wellness: [],
      training: [],
      labResults: [],
      allLabs: [],
      weightHistory: [],
      nutritionLogs: [],
    })

    const req = buildRequest('http://localhost/api/training-readiness?clientId=nobw-client')
    const res = await GET(req)

    expect(res.status).toBe(200)
    expect(mockCalculateMetabolicStressScore).toHaveBeenCalledWith(
      expect.objectContaining({
        bodyWeight: undefined,
      })
    )
  })

  // ── Wellness data is passed to metabolic stress ──

  it('passes recentWellness with energy_level to metabolic stress calculator', async () => {
    setupTableMocks({
      client: {
        id: 'uuid-wellstress',
        gene_mthfr: null,
        gene_apoe: null,
        gene_depression_risk: null,
        goal_type: 'cut',
        prep_phase: null,
        competition_enabled: false,
        diet_start_date: null,
        gender: '男性',
      },
      wellness: [
        { date: daysAgo(0), sleep_quality: 3, energy_level: 2, mood: 3, stress_level: 4, device_recovery_score: null, hrv: null, resting_hr: null, wearable_sleep_score: null },
        { date: daysAgo(1), sleep_quality: 4, energy_level: 4, mood: 4, stress_level: 2, device_recovery_score: null, hrv: null, resting_hr: null, wearable_sleep_score: null },
      ],
      training: [],
      labResults: [],
      allLabs: [],
      weightHistory: [{ date: daysAgo(0), weight: 80 }],
      nutritionLogs: [],
    })

    const req = buildRequest('http://localhost/api/training-readiness?clientId=wellstress-client')
    const res = await GET(req)

    expect(res.status).toBe(200)
    expect(mockCalculateMetabolicStressScore).toHaveBeenCalledWith(
      expect.objectContaining({
        recentWellness: expect.arrayContaining([
          expect.objectContaining({ energy_level: 2, training_drive: null }),
        ]),
      })
    )
  })

  // ── Error handling ──

  it('returns 500 when an unexpected error occurs', async () => {
    mockFrom.mockImplementation(() => {
      throw new Error('Database connection failed')
    })

    const req = buildRequest('http://localhost/api/training-readiness?clientId=error-client')
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.error).toBeDefined()
  })

  // ── Full integration-like test with all data present ──

  it('handles full flow with all data: wellness, training, labs, weights, nutrition for cut client', async () => {
    mockGetTrainingAdvice.mockReturnValue({
      ...mockTrainingAdvice,
      recoveryScore: 55,
      recoveryAssessment: { status: 'good', details: [] },
    })

    setupTableMocks({
      client: {
        id: 'uuid-full',
        gene_mthfr: 'TT',
        gene_apoe: 'E4/E4',
        gene_depression_risk: 'LL',
        goal_type: 'cut',
        prep_phase: 'mid_prep',
        competition_enabled: true,
        diet_start_date: '2024-01-15',
        gender: '女性',
      },
      wellness: [
        { date: daysAgo(0), sleep_quality: 4, energy_level: 3, mood: 4, stress_level: 2, device_recovery_score: 70, hrv: 50, resting_hr: 60, wearable_sleep_score: 80 },
        { date: daysAgo(1), sleep_quality: 3, energy_level: 3, mood: 3, stress_level: 3, device_recovery_score: 65, hrv: 48, resting_hr: 62, wearable_sleep_score: 75 },
      ],
      training: [
        { date: daysAgo(0), training_type: 'weight', rpe: 8, sets: 22, duration: 70 },
        { date: daysAgo(1), training_type: 'cardio', rpe: 6, sets: 0, duration: 30 },
        { date: daysAgo(3), training_type: 'weight', rpe: 7, sets: 20, duration: 65 },
      ],
      labResults: [
        { test_name: 'Cortisol', value: 22, unit: 'ug/dL', status: 'attention' },
      ],
      allLabs: [
        { test_name: 'Cortisol', value: 22, unit: 'ug/dL', status: 'attention' },
        { test_name: 'Free T4', value: 1.1, unit: 'ng/dL', status: 'normal' },
      ],
      weightHistory: [
        { date: daysAgo(0), weight: 58 },
        { date: daysAgo(1), weight: 58.2 },
        { date: daysAgo(2), weight: 58.1 },
        { date: daysAgo(3), weight: 58.3 },
        { date: daysAgo(4), weight: 58.0 },
        { date: daysAgo(5), weight: 58.4 },
        { date: daysAgo(6), weight: 58.2 },
        { date: daysAgo(7), weight: 59.0 },
        { date: daysAgo(8), weight: 59.1 },
        { date: daysAgo(9), weight: 59.0 },
      ],
      nutritionLogs: [
        { date: daysAgo(0), carbs_grams: 100 },
        { date: daysAgo(1), carbs_grams: 130 },
        { date: daysAgo(2), carbs_grams: 110 },
        { date: daysAgo(3), carbs_grams: 160 }, // >= 150, breaks
      ],
    })

    const req = buildRequest('http://localhost/api/training-readiness?clientId=full-client')
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.modeRecommendation).toBeDefined()

    // Verify all engines were called
    expect(mockGetTrainingAdvice).toHaveBeenCalledTimes(1)
    expect(mockAnalyzeTrainingPattern).toHaveBeenCalledTimes(1)
    expect(mockExtractHormoneLabs).toHaveBeenCalledTimes(1)
    expect(mockCalculateMetabolicStressScore).toHaveBeenCalledTimes(1)
    expect(mockGetTrainingModeRecommendation).toHaveBeenCalledTimes(1)

    // Verify metabolic stress params
    const stressCall = mockCalculateMetabolicStressScore.mock.calls[0][0]
    expect(stressCall.recoveryState).toBe('good') // 55 is in 50-74 range
    expect(stressCall.lowCarbDays).toBe(3) // first 3 are < 150
    expect(stressCall.bodyWeight).toBe(58) // first entry in weightHistory

    // Verify mode recommendation was called with metabolicStress
    const modeCall = mockGetTrainingModeRecommendation.mock.calls[0][0]
    expect(modeCall.metabolicStress).toEqual({ score: 30, level: 'low' })
    expect(modeCall.goalType).toBe('cut')
    expect(modeCall.prepPhase).toBe('mid_prep')
    expect(modeCall.geneticProfile).toEqual({
      mthfr: 'TT',
      apoe: 'E4/E4',
      serotonin: 'LL',
      depressionRisk: null,
    })
  })
})
