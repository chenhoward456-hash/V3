import { GET } from '@/app/api/recovery-assessment/route'
import { NextRequest } from 'next/server'

// ---------------------------------------------------------------------------
// Mock: @/lib/supabase
// ---------------------------------------------------------------------------
const mockSingle = vi.fn()
const mockLimit = vi.fn().mockReturnValue({ data: [], error: null })
const mockOrder = vi.fn().mockImplementation(() => ({ data: [], error: null, limit: mockLimit }))
const mockGte = vi.fn().mockReturnValue({ order: mockOrder, data: [], error: null })
const mockIn = vi.fn().mockReturnValue({ order: mockOrder, data: [], error: null })
const mockNot = vi.fn().mockReturnValue({ order: mockOrder, data: [], error: null })
const mockEq = vi.fn().mockImplementation(() => ({
  single: mockSingle,
  gte: mockGte,
  order: mockOrder,
  in: mockIn,
  not: mockNot,
}))
const mockSelect = vi.fn().mockReturnValue({ eq: mockEq })
const mockFrom = vi.fn().mockReturnValue({ select: mockSelect })

const mockSupabase = { from: mockFrom }

vi.mock('@/lib/supabase', () => ({
  createServiceSupabase: () => mockSupabase,
}))

// ---------------------------------------------------------------------------
// Mock: @/lib/recovery-engine
// ---------------------------------------------------------------------------
const mockAssessment = {
  score: 72,
  state: 'good' as const,
  readinessScore: 68,
  systems: {
    neural: { score: 70, state: 'good' as const, signals: [] },
    muscular: { score: 65, state: 'good' as const, signals: [] },
    metabolic: { score: 75, state: 'optimal' as const, signals: [] },
    hormonal: { score: 72, state: 'good' as const, signals: [] },
    psychological: { score: 78, state: 'optimal' as const, signals: [] },
  },
  overtrainingRisk: { acwr: 1.1, monotony: 1.5, strain: 3000, riskLevel: 'low' as const, reasons: [] },
  autonomicBalance: { status: 'balanced' as const, hrvTrend: 'stable' as const, rhrTrend: 'stable' as const, hrvZScore: 0.2, rhrZScore: -0.1, reasons: [] },
  trajectory: 'stable' as const,
  recommendations: [],
  reasons: [],
}

const mockGenerateRecoveryAssessment = vi.fn().mockReturnValue(mockAssessment)

vi.mock('@/lib/recovery-engine', () => ({
  generateRecoveryAssessment: (...args: unknown[]) => mockGenerateRecoveryAssessment(...args),
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function buildRequest(url: string): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost'))
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('GET /api/recovery-assessment', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset default chain behavior
    mockEq.mockImplementation(() => ({
      single: mockSingle,
      gte: mockGte,
      order: mockOrder,
      in: mockIn,
      not: mockNot,
    }))
    mockOrder.mockImplementation(() => ({ data: [], error: null, limit: mockLimit }))
    mockLimit.mockReturnValue({ data: [], error: null })
    mockGte.mockReturnValue({ order: mockOrder, data: [], error: null })
  })

  it('returns 400 if clientId is missing', async () => {
    const req = buildRequest('http://localhost/api/recovery-assessment')
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toBeDefined()
  })

  it('returns 404 if client is not found', async () => {
    mockSingle.mockResolvedValue({ data: null, error: null })

    const req = buildRequest('http://localhost/api/recovery-assessment?clientId=nonexistent')
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(404)
    expect(json.error).toBeDefined()
  })

  it('returns valid assessment JSON for a valid client', async () => {
    // First call: clients query returns a valid client
    mockSingle.mockResolvedValueOnce({
      data: { id: 'uuid-123', gender: '男性', diet_start_date: null },
      error: null,
    })

    // Promise.all: wellness, training, lab queries all return empty arrays
    mockOrder.mockImplementation(() => ({ data: [], error: null, limit: mockLimit }))
    mockGte.mockReturnValue({ order: mockOrder, data: [], error: null })
    mockLimit.mockReturnValue({ data: [], error: null })

    const req = buildRequest('http://localhost/api/recovery-assessment?clientId=valid-code')
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.score).toBe(72)
    expect(json.state).toBe('good')
    expect(json.systems).toBeDefined()
    expect(json.overtrainingRisk).toBeDefined()
    expect(json.autonomicBalance).toBeDefined()
  })

  it('passes correct RecoveryInput structure to generateRecoveryAssessment', async () => {
    mockSingle.mockResolvedValueOnce({
      data: { id: 'uuid-456', gender: '女性', diet_start_date: '2024-01-01' },
      error: null,
    })

    const mockWellness = [
      { date: '2024-06-01', sleep_quality: 4, energy_level: 3, mood: 4, stress_level: 2, training_drive: 4, device_recovery_score: 75, hrv: 55, resting_hr: 60, wearable_sleep_score: 80, respiratory_rate: 15 },
    ]
    const mockTraining = [
      { date: '2024-06-01', training_type: 'weight', rpe: 7, duration: 60, sets: 20 },
    ]
    const mockLab = [
      { test_name: 'cortisol', value: 15, unit: 'ug/dL', status: 'normal' },
    ]

    // wellness res
    let orderCallCount = 0
    mockOrder.mockImplementation(() => {
      orderCallCount++
      if (orderCallCount === 1) return { data: mockWellness, error: null, limit: mockLimit }
      if (orderCallCount === 2) return { data: mockTraining, error: null, limit: mockLimit }
      return { data: mockLab, error: null, limit: mockLimit }
    })
    mockGte.mockReturnValue({ order: mockOrder, data: [], error: null })
    mockLimit.mockReturnValue({ data: mockLab, error: null })

    const req = buildRequest('http://localhost/api/recovery-assessment?clientId=valid-code')
    await GET(req)

    expect(mockGenerateRecoveryAssessment).toHaveBeenCalledTimes(1)
    const input = mockGenerateRecoveryAssessment.mock.calls[0][0]

    // Verify the input shape matches RecoveryInput
    expect(input).toHaveProperty('wellness')
    expect(input).toHaveProperty('trainingLogs')
    expect(input).toHaveProperty('labResults')
    expect(input).toHaveProperty('dietDurationWeeks')
    expect(Array.isArray(input.wellness)).toBe(true)
    expect(Array.isArray(input.trainingLogs)).toBe(true)
    expect(Array.isArray(input.labResults)).toBe(true)

    // dietDurationWeeks should be calculated from diet_start_date
    expect(typeof input.dietDurationWeeks).toBe('number')
  })

  it('handles errors gracefully and returns 500', async () => {
    mockSingle.mockRejectedValueOnce(new Error('Database connection lost'))

    // Also make mockFrom throw to simulate a full failure in the try block
    mockFrom.mockImplementationOnce(() => {
      throw new Error('Database connection lost')
    })

    const req = buildRequest('http://localhost/api/recovery-assessment?clientId=crash')
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.error).toBeDefined()
  })
})
