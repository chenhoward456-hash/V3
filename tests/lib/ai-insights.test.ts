/**
 * Tests for @/lib/ai-insights
 *
 * Covers:
 *   - analyzeDietaryPatterns (pure function)
 *   - predictTrend (pure function)
 *   - getTrainingAdvice (delegates to recovery-engine)
 *   - compareLabResults (pure function)
 *   - generateSmartAlerts (pure function, date-sensitive)
 *   - generateWeeklyAIReport (async, calls askClaude)
 *   - generateMealSuggestion (async, calls askClaude)
 *   - generateLabComparisonSummary (async, calls askClaude)
 */

import {
  analyzeDietaryPatterns,
  predictTrend,
  getTrainingAdvice,
  compareLabResults,
  generateSmartAlerts,
  generateWeeklyAIReport,
  generateMealSuggestion,
  generateLabComparisonSummary,
  type InsightData,
  type NutritionLogEntry,
  type WellnessEntry,
  type TrainingEntry,
  type BodyEntry,
  type LabEntry,
  type WearableEntry,
  type ClientProfile,
  type LabComparison,
} from '@/lib/ai-insights'

// ── Mocks ──

vi.mock('@/lib/claude', () => ({
  askClaude: vi.fn().mockResolvedValue('AI mock response'),
}))

vi.mock('@/lib/recovery-engine', () => ({
  generateRecoveryAssessment: vi.fn().mockReturnValue({
    score: 75,
    state: 'good',
    readinessScore: 80,
    systems: {},
    overtraining: { riskLevel: 'low', reasons: [] },
    autonomic: { status: 'balanced', reasons: [] },
    trend: 'stable',
  }),
  getTrainingAdviceFromRecovery: vi.fn().mockReturnValue({
    recommendedIntensity: 'moderate',
    recoveryScore: 75,
    reasons: ['Recovery is adequate'],
    suggestion: 'Moderate intensity training recommended',
  }),
}))

vi.mock('@/utils/labStatus', () => ({
  isInOptimalRange: vi.fn().mockReturnValue(false),
}))

vi.mock('@/utils/labMatch', () => ({
  matchLabName: vi.fn((name: string) => name),
}))

// ── Helpers ──

function makeNutritionLog(overrides: Partial<NutritionLogEntry> & { date: string }): NutritionLogEntry {
  return { calories: 2000, protein_grams: 150, carbs_grams: 200, fat_grams: 70, water_ml: 2500, compliant: true, ...overrides }
}

function makeBodyLog(date: string, weight: number): BodyEntry {
  return { date, weight, body_fat: null }
}

function makeClient(overrides?: Partial<ClientProfile>): ClientProfile {
  return {
    name: 'Test User',
    gender: '男性',
    goalType: 'cut',
    currentWeight: 80,
    currentBodyFat: 20,
    targetWeight: 75,
    caloriesTarget: 2000,
    proteinTarget: 160,
    carbsTarget: 200,
    fatTarget: 60,
    ...overrides,
  }
}

// ════════════════════════════════════════════
// analyzeDietaryPatterns
// ════════════════════════════════════════════

describe('analyzeDietaryPatterns', () => {
  it('should detect weekend overeating when weekend calories > weekday + 200', () => {
    // Monday 2024-01-08 to Sunday 2024-01-21 (14 days)
    const logs: NutritionLogEntry[] = [
      // Weekdays (Mon-Fri) with 1800 cal
      ...['2024-01-08','2024-01-09','2024-01-10','2024-01-11','2024-01-12'].map(d => makeNutritionLog({ date: d, calories: 1800 })),
      // Weekend (Sat-Sun) with 2500 cal
      makeNutritionLog({ date: '2024-01-13', calories: 2500 }),
      makeNutritionLog({ date: '2024-01-14', calories: 2500 }),
      // Second week
      ...['2024-01-15','2024-01-16','2024-01-17','2024-01-18','2024-01-19'].map(d => makeNutritionLog({ date: d, calories: 1800 })),
      makeNutritionLog({ date: '2024-01-20', calories: 2500 }),
      makeNutritionLog({ date: '2024-01-21', calories: 2500 }),
    ]
    const result = analyzeDietaryPatterns(logs, { calories: 2000 })
    expect(result.weekendOvereat.detected).toBe(true)
    expect(result.weekendOvereat.diff).toBeGreaterThan(200)
  })

  it('should not detect weekend overeating when calories are similar', () => {
    const logs = Array.from({ length: 14 }, (_, i) => {
      const d = new Date(2024, 0, 8 + i) // starts Mon
      return makeNutritionLog({ date: d.toISOString().split('T')[0], calories: 2000 })
    })
    const result = analyzeDietaryPatterns(logs, { calories: 2000 })
    expect(result.weekendOvereat.detected).toBe(false)
  })

  it('should detect protein deficiency when >= 3 days below 80% of target', () => {
    const logs = Array.from({ length: 14 }, (_, i) => {
      const d = new Date(2024, 0, 8 + i)
      return makeNutritionLog({ date: d.toISOString().split('T')[0], protein_grams: 90 }) // 90 < 160*0.8=128
    })
    const result = analyzeDietaryPatterns(logs, { protein: 160 })
    expect(result.proteinDeficiency.detected).toBe(true)
    expect(result.proteinDeficiency.deficientDays).toBe(14)
  })

  it('should not detect protein deficiency when protein is adequate', () => {
    const logs = Array.from({ length: 14 }, (_, i) => {
      const d = new Date(2024, 0, 8 + i)
      return makeNutritionLog({ date: d.toISOString().split('T')[0], protein_grams: 160 })
    })
    const result = analyzeDietaryPatterns(logs, { protein: 160 })
    expect(result.proteinDeficiency.detected).toBe(false)
    expect(result.proteinDeficiency.deficientDays).toBe(0)
  })

  it('should detect carbs imbalance when std/avg > 0.4', () => {
    // High variance: alternating 50g and 350g => avg 200, std ~150 => ratio 0.75
    const logs = Array.from({ length: 14 }, (_, i) => {
      const d = new Date(2024, 0, 8 + i)
      return makeNutritionLog({ date: d.toISOString().split('T')[0], carbs_grams: i % 2 === 0 ? 50 : 350 })
    })
    const result = analyzeDietaryPatterns(logs, { carbs: 200 })
    expect(result.carbsImbalance.detected).toBe(true)
    expect(result.carbsImbalance.detail).toContain('波動大')
  })

  it('should detect water deficiency when avg < 70% of target', () => {
    const logs = Array.from({ length: 14 }, (_, i) => {
      const d = new Date(2024, 0, 8 + i)
      return makeNutritionLog({ date: d.toISOString().split('T')[0], water_ml: 1000 })
    })
    const result = analyzeDietaryPatterns(logs, { water: 2500 })
    expect(result.waterDeficiency.detected).toBe(true)
    expect(result.waterDeficiency.avgWater).toBe(1000)
  })

  it('should return all false for empty logs', () => {
    const result = analyzeDietaryPatterns([], {})
    expect(result.weekendOvereat.detected).toBe(false)
    expect(result.proteinDeficiency.detected).toBe(false)
    expect(result.carbsImbalance.detected).toBe(false)
    expect(result.waterDeficiency.detected).toBe(false)
    expect(result.mealTiming).toBeNull()
  })
})

// ════════════════════════════════════════════
// predictTrend
// ════════════════════════════════════════════

describe('predictTrend', () => {
  it('should return low confidence when fewer than 4 body logs', () => {
    const logs = [makeBodyLog('2024-01-01', 80), makeBodyLog('2024-01-02', 79.5)]
    const result = predictTrend(logs, 75, 'cut')
    expect(result.confidence).toBe('low')
    expect(result.weeklyRate).toBeNull()
    expect(result.message).toContain('數據不足')
  })

  it('should calculate weekly rate for decreasing weight (cut goal)', () => {
    // 8 days of decreasing weight
    const logs = Array.from({ length: 8 }, (_, i) =>
      makeBodyLog(`2024-01-0${i + 1}`, 80 - i * 0.15)
    )
    const result = predictTrend(logs, 75, 'cut')
    expect(result.currentWeight).toBeCloseTo(80 - 7 * 0.15, 1)
    expect(result.weeklyRate).toBeLessThan(0) // losing weight
    expect(result.estimatedWeeksToGoal).toBeGreaterThan(0)
    expect(result.estimatedDate).not.toBeNull()
  })

  it('should detect wrong direction for cut goal with gaining weight', () => {
    const logs = Array.from({ length: 8 }, (_, i) =>
      makeBodyLog(`2024-01-0${i + 1}`, 80 + i * 0.2)
    )
    const result = predictTrend(logs, 75, 'cut')
    expect(result.weeklyRate).toBeGreaterThan(0)
    expect(result.message).toContain('上升趨勢')
    expect(result.confidence).toBe('high')
  })

  it('should detect wrong direction for bulk goal with losing weight', () => {
    const logs = Array.from({ length: 8 }, (_, i) =>
      makeBodyLog(`2024-01-0${i + 1}`, 70 - i * 0.2)
    )
    const result = predictTrend(logs, 80, 'bulk')
    expect(result.weeklyRate).toBeLessThan(0)
    expect(result.message).toContain('下降趨勢')
  })

  it('should handle no target weight', () => {
    const logs = Array.from({ length: 8 }, (_, i) =>
      makeBodyLog(`2024-01-0${i + 1}`, 80 - i * 0.1)
    )
    const result = predictTrend(logs, null, null)
    expect(result.targetWeight).toBeNull()
    expect(result.estimatedWeeksToGoal).toBeNull()
    expect(result.message).toContain('尚未設定目標體重')
  })

  it('should return currentWeight as 0 when no valid weights at all', () => {
    const result = predictTrend([], 75, 'cut')
    expect(result.currentWeight).toBe(0)
    expect(result.confidence).toBe('low')
  })

  it('should sort body logs by date before processing', () => {
    const logs = [
      makeBodyLog('2024-01-08', 79),
      makeBodyLog('2024-01-01', 80),
      makeBodyLog('2024-01-04', 79.8),
      makeBodyLog('2024-01-06', 79.5),
    ]
    const result = predictTrend(logs, 75, 'cut')
    expect(result.currentWeight).toBe(79) // latest by date
  })
})

// ════════════════════════════════════════════
// getTrainingAdvice
// ════════════════════════════════════════════

describe('getTrainingAdvice', () => {
  const wellnessLogs: WellnessEntry[] = [
    { date: '2024-01-01', mood: 4, energy_level: 4, sleep_quality: 4, stress: 2, hunger: 3, digestion: 4 },
  ]
  const trainingLogs: TrainingEntry[] = [
    { date: '2024-01-01', training_type: 'strength', duration: 60, rpe: 7 },
  ]

  it('should return training advice with recovery assessment', () => {
    const result = getTrainingAdvice(wellnessLogs, trainingLogs)
    expect(result.recommendedIntensity).toBe('moderate')
    expect(result.recoveryScore).toBe(75)
    expect(result.recoveryAssessment).toBeDefined()
    expect(result.reasons).toContain('Recovery is adequate')
  })

  it('should merge wearable data with wellness data by date', () => {
    const wearable: WearableEntry[] = [
      { date: '2024-01-01', hrv: 55, resting_hr: 58, device_recovery_score: 80, wearable_sleep_score: 85 },
    ]
    const result = getTrainingAdvice(wellnessLogs, trainingLogs, wearable)
    expect(result.recoveryAssessment).toBeDefined()
  })

  it('should include wearable data that has no matching wellness date', async () => {
    const wearable: WearableEntry[] = [
      { date: '2024-01-02', hrv: 60, resting_hr: 55, device_recovery_score: 85, wearable_sleep_score: 90 },
    ]
    const { generateRecoveryAssessment } = await import('@/lib/recovery-engine')
    getTrainingAdvice(wellnessLogs, trainingLogs, wearable)
    expect(generateRecoveryAssessment).toHaveBeenCalled()
  })

  it('should handle empty inputs', () => {
    const result = getTrainingAdvice([], [])
    expect(result).toBeDefined()
    expect(result.recommendedIntensity).toBeDefined()
  })

  it('should pass lab data to recovery assessment', () => {
    const labData = [{ test_name: 'CRP', value: 2.5, status: 'attention' as const }]
    const result = getTrainingAdvice(wellnessLogs, trainingLogs, undefined, labData)
    expect(result).toBeDefined()
  })
})

// ════════════════════════════════════════════
// compareLabResults
// ════════════════════════════════════════════

describe('compareLabResults', () => {
  it('should compare two entries for the same test', () => {
    const labs: LabEntry[] = [
      { date: '2024-01-01', test_name: 'CRP', value: 3.0, unit: 'mg/L', status: 'attention' },
      { date: '2024-06-01', test_name: 'CRP', value: 1.0, unit: 'mg/L', status: 'normal' },
    ]
    const results = compareLabResults(labs)
    expect(results).toHaveLength(1)
    expect(results[0].testName).toBe('CRP')
    expect(results[0].change).toBe(-2)
    expect(results[0].improved).toBe(true) // attention -> normal
  })

  it('should handle single entry for a test (no comparison)', () => {
    const labs: LabEntry[] = [
      { date: '2024-01-01', test_name: 'CRP', value: 1.5, unit: 'mg/L', status: 'normal' },
    ]
    const results = compareLabResults(labs)
    expect(results).toHaveLength(1)
    expect(results[0].previous).toBeNull()
    expect(results[0].change).toBeNull()
    expect(results[0].improved).toBeNull()
  })

  it('should detect worsening lab values', () => {
    const labs: LabEntry[] = [
      { date: '2024-01-01', test_name: 'HbA1c', value: 5.2, unit: '%', status: 'normal' },
      { date: '2024-06-01', test_name: 'HbA1c', value: 6.0, unit: '%', status: 'attention' },
    ]
    const results = compareLabResults(labs)
    expect(results[0].improved).toBe(false) // normal -> attention is worse
  })

  it('should return null improved when status unchanged', () => {
    const labs: LabEntry[] = [
      { date: '2024-01-01', test_name: 'CRP', value: 0.5, unit: 'mg/L', status: 'normal' },
      { date: '2024-06-01', test_name: 'CRP', value: 0.8, unit: 'mg/L', status: 'normal' },
    ]
    const results = compareLabResults(labs)
    expect(results[0].improved).toBeNull()
  })

  it('should handle multiple test names independently', () => {
    const labs: LabEntry[] = [
      { date: '2024-01-01', test_name: 'CRP', value: 2.0, unit: 'mg/L', status: 'attention' },
      { date: '2024-06-01', test_name: 'CRP', value: 0.5, unit: 'mg/L', status: 'normal' },
      { date: '2024-01-01', test_name: 'HbA1c', value: 5.0, unit: '%', status: 'normal' },
      { date: '2024-06-01', test_name: 'HbA1c', value: 5.8, unit: '%', status: 'attention' },
    ]
    const results = compareLabResults(labs)
    expect(results).toHaveLength(2)
    const crp = results.find(r => r.testName === 'CRP')
    const hba1c = results.find(r => r.testName === 'HbA1c')
    expect(crp?.improved).toBe(true)
    expect(hba1c?.improved).toBe(false)
  })

  it('should skip entries with null values', () => {
    const labs: LabEntry[] = [
      { date: '2024-01-01', test_name: 'CRP', value: null, unit: 'mg/L', status: 'normal' },
      { date: '2024-06-01', test_name: 'CRP', value: 1.0, unit: 'mg/L', status: 'normal' },
    ]
    const results = compareLabResults(labs)
    // Only one valid value => single entry, no comparison
    expect(results).toHaveLength(1)
    expect(results[0].previous).toBeNull()
  })

  it('should calculate changePercent correctly', () => {
    const labs: LabEntry[] = [
      { date: '2024-01-01', test_name: 'CRP', value: 2.0, unit: 'mg/L', status: 'attention' },
      { date: '2024-06-01', test_name: 'CRP', value: 1.0, unit: 'mg/L', status: 'normal' },
    ]
    const results = compareLabResults(labs)
    expect(results[0].changePercent).toBe(-50) // (1-2)/2 * 100 = -50%
  })

  it('should return empty array for empty input', () => {
    expect(compareLabResults([])).toEqual([])
  })
})

// ════════════════════════════════════════════
// generateSmartAlerts
// ════════════════════════════════════════════

describe('generateSmartAlerts', () => {
  function makeInsightData(overrides?: Partial<InsightData>): InsightData {
    return {
      client: makeClient(),
      nutritionLogs: [],
      wellnessLogs: [],
      trainingLogs: [],
      bodyLogs: [],
      ...overrides,
    }
  }

  it('should generate weight anomaly alert when fluctuation > 2kg', () => {
    const bodyLogs = [
      makeBodyLog('2024-01-01', 80),
      makeBodyLog('2024-01-02', 78),
      makeBodyLog('2024-01-03', 80.5),
    ]
    const data = makeInsightData({ bodyLogs })
    const alerts = generateSmartAlerts(data)
    const weightAlert = alerts.find(a => a.type === 'weight_anomaly')
    expect(weightAlert).toBeDefined()
    expect(weightAlert!.severity).toBe('warning')
    expect(weightAlert!.message).toContain('波動')
  })

  it('should not generate weight anomaly when fluctuation <= 2kg', () => {
    const bodyLogs = [
      makeBodyLog('2024-01-01', 80),
      makeBodyLog('2024-01-02', 79.5),
      makeBodyLog('2024-01-03', 80.2),
    ]
    const data = makeInsightData({ bodyLogs })
    const alerts = generateSmartAlerts(data)
    expect(alerts.find(a => a.type === 'weight_anomaly')).toBeUndefined()
  })

  it('should generate sleep decline alert when 3 consecutive days with score <= 2', () => {
    const wellnessLogs: WellnessEntry[] = [
      { date: '2024-01-01', sleep_quality: 1, mood: 3, energy_level: 3, stress: 3, hunger: 3, digestion: 3 },
      { date: '2024-01-02', sleep_quality: 2, mood: 3, energy_level: 3, stress: 3, hunger: 3, digestion: 3 },
      { date: '2024-01-03', sleep_quality: 1, mood: 3, energy_level: 3, stress: 3, hunger: 3, digestion: 3 },
    ]
    const data = makeInsightData({ wellnessLogs })
    const alerts = generateSmartAlerts(data)
    expect(alerts.find(a => a.type === 'sleep_decline')).toBeDefined()
  })

  it('should generate energy low alert when 3 consecutive days with energy <= 2', () => {
    const wellnessLogs: WellnessEntry[] = [
      { date: '2024-01-01', energy_level: 1, sleep_quality: 4, mood: 3, stress: 3, hunger: 3, digestion: 3 },
      { date: '2024-01-02', energy_level: 2, sleep_quality: 4, mood: 3, stress: 3, hunger: 3, digestion: 3 },
      { date: '2024-01-03', energy_level: 2, sleep_quality: 4, mood: 3, stress: 3, hunger: 3, digestion: 3 },
    ]
    const data = makeInsightData({ wellnessLogs })
    const alerts = generateSmartAlerts(data)
    expect(alerts.find(a => a.type === 'energy_low')).toBeDefined()
  })

  it('should generate overtraining alert when >= 6 training days in last 7', () => {
    const trainingLogs: TrainingEntry[] = Array.from({ length: 7 }, (_, i) => ({
      date: `2024-01-0${i + 1}`,
      training_type: i < 6 ? 'strength' : 'rest',
      duration: 60,
      rpe: 7,
      note: null,
    }))
    const data = makeInsightData({ trainingLogs })
    const alerts = generateSmartAlerts(data)
    expect(alerts.find(a => a.type === 'overtraining')).toBeDefined()
  })

  it('should generate nutrition drift alert when avg calories off by > 15%', () => {
    const today = new Date()
    const logs: NutritionLogEntry[] = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today)
      d.setDate(d.getDate() - i)
      return makeNutritionLog({ date: d.toISOString().split('T')[0], calories: 2500 })
    })
    const data = makeInsightData({
      nutritionLogs: logs,
      client: makeClient({ caloriesTarget: 2000 }),
    })
    const alerts = generateSmartAlerts(data)
    const drift = alerts.find(a => a.type === 'nutrition_drift')
    expect(drift).toBeDefined()
    expect(drift!.message).toContain('超過')
  })

  it('should return empty array when all data is healthy', () => {
    const data = makeInsightData({
      bodyLogs: [makeBodyLog('2024-01-01', 80), makeBodyLog('2024-01-02', 80.1), makeBodyLog('2024-01-03', 79.9)],
      wellnessLogs: [
        { date: '2024-01-01', sleep_quality: 4, energy_level: 4, mood: 4, stress: 2, hunger: 3, digestion: 4 },
        { date: '2024-01-02', sleep_quality: 4, energy_level: 4, mood: 4, stress: 2, hunger: 3, digestion: 4 },
        { date: '2024-01-03', sleep_quality: 4, energy_level: 4, mood: 4, stress: 2, hunger: 3, digestion: 4 },
      ],
      trainingLogs: [
        { date: '2024-01-01', training_type: 'strength', duration: 60, rpe: 7, note: null },
        { date: '2024-01-02', training_type: 'rest', duration: null, rpe: null, note: null },
        { date: '2024-01-03', training_type: 'strength', duration: 60, rpe: 7, note: null },
      ],
    })
    // These logs are old so no_record might trigger, but body/sleep/energy/overtraining won't
    const alerts = generateSmartAlerts(data)
    expect(alerts.find(a => a.type === 'weight_anomaly')).toBeUndefined()
    expect(alerts.find(a => a.type === 'sleep_decline')).toBeUndefined()
    expect(alerts.find(a => a.type === 'energy_low')).toBeUndefined()
    expect(alerts.find(a => a.type === 'overtraining')).toBeUndefined()
  })
})

// ════════════════════════════════════════════
// Async AI functions (mock askClaude)
// ════════════════════════════════════════════

describe('generateWeeklyAIReport', () => {
  it('should call askClaude and return a string', async () => {
    const data: InsightData = {
      client: makeClient(),
      nutritionLogs: Array.from({ length: 7 }, (_, i) =>
        makeNutritionLog({ date: `2024-01-0${i + 1}` })
      ),
      wellnessLogs: Array.from({ length: 7 }, (_, i) => ({
        date: `2024-01-0${i + 1}`,
        mood: 4,
        energy_level: 4,
        sleep_quality: 4,
        stress: 2,
        hunger: 3,
        digestion: 4,
      })),
      trainingLogs: Array.from({ length: 7 }, (_, i) => ({
        date: `2024-01-0${i + 1}`,
        training_type: i % 2 === 0 ? 'strength' : 'rest',
        duration: 60,
        rpe: 7,
        note: null,
      })),
      bodyLogs: Array.from({ length: 7 }, (_, i) =>
        makeBodyLog(`2024-01-0${i + 1}`, 80 - i * 0.1)
      ),
    }
    const result = await generateWeeklyAIReport(data)
    expect(typeof result).toBe('string')
    expect(result).toBe('AI mock response')
  })
})

describe('generateMealSuggestion', () => {
  it('should call askClaude with remaining macros and return a string', async () => {
    const result = await generateMealSuggestion(
      { calories: 500, protein: 40, carbs: 60, fat: 15 },
      { isTrainingDay: true, mealType: 'lunch' }
    )
    expect(typeof result).toBe('string')
    expect(result).toBe('AI mock response')
  })

  it('should handle missing mealType', async () => {
    const result = await generateMealSuggestion(
      { calories: 300, protein: 25, carbs: 30, fat: 10 },
      { isTrainingDay: false }
    )
    expect(result).toBe('AI mock response')
  })
})

describe('generateLabComparisonSummary', () => {
  it('should return message for empty comparisons', async () => {
    const result = await generateLabComparisonSummary([])
    expect(result).toContain('沒有血檢數據')
  })

  it('should return message when only one record exists', async () => {
    const comparisons: LabComparison[] = [
      {
        testName: 'CRP',
        current: { value: 1.0, status: 'normal', date: '2024-06-01' },
        previous: null,
        change: null,
        changePercent: null,
        improved: null,
        unit: 'mg/L',
      },
    ]
    const result = await generateLabComparisonSummary(comparisons)
    expect(result).toContain('一次血檢記錄')
  })

  it('should call askClaude when comparisons with changes exist', async () => {
    const comparisons: LabComparison[] = [
      {
        testName: 'CRP',
        current: { value: 0.5, status: 'normal', date: '2024-06-01' },
        previous: { value: 2.0, status: 'attention', date: '2024-01-01' },
        change: -1.5,
        changePercent: -75,
        improved: true,
        unit: 'mg/L',
      },
    ]
    const result = await generateLabComparisonSummary(comparisons)
    expect(result).toBe('AI mock response')
  })
})
