import { describe, it, expect } from 'vitest'
import {
  generateNutritionSuggestion,
  calculateInitialTargets,
  calcRecommendedStageWeight,
  generateDemoAnalysis,
  type NutritionInput,
} from '../lib/nutrition-engine'

// ===== Helper: 基礎 NutritionInput =====
function baseNutritionInput(overrides: Partial<NutritionInput> = {}): NutritionInput {
  return {
    gender: '男性',
    bodyWeight: 80,
    goalType: 'cut',
    dietStartDate: null,
    height: 175,
    bodyFatPct: 15,
    targetWeight: 75,
    targetBodyFatPct: null,
    targetDate: null,
    currentCalories: 2000,
    currentProtein: 160,
    currentCarbs: 200,
    currentFat: 60,
    currentCarbsTrainingDay: null,
    currentCarbsRestDay: null,
    carbsCyclingEnabled: false,
    weeklyWeights: [
      { week: 0, avgWeight: 79.5 },
      { week: 1, avgWeight: 80.0 },
    ],
    nutritionCompliance: 85,
    avgDailyCalories: 2000,
    trainingDaysPerWeek: 4,
    ...overrides,
  }
}

// ===== generateNutritionSuggestion =====
describe('generateNutritionSuggestion', () => {
  // ── 資料不足 ──
  it('returns insufficient_data with less than 2 weeks of weights', () => {
    const result = generateNutritionSuggestion(baseNutritionInput({
      weeklyWeights: [{ week: 0, avgWeight: 80 }],
    }))
    expect(result.status).toBe('insufficient_data')
  })

  // ── 正常減脂 (on_track) ──
  it('returns on_track when weight drops at proper rate', () => {
    const result = generateNutritionSuggestion(baseNutritionInput({
      weeklyWeights: [
        { week: 0, avgWeight: 79.5 },
        { week: 1, avgWeight: 80.0 },
      ],
    }))
    // -0.5kg / 80kg = -0.625% → within -0.3% to -1.0% ideal range
    expect(['on_track', 'goal_driven']).toContain(result.status)
  })

  // ── 停滯 (plateau) ──
  it('detects plateau when weight change is minimal during cut', () => {
    const result = generateNutritionSuggestion(baseNutritionInput({
      weeklyWeights: [
        { week: 0, avgWeight: 80.0 },
        { week: 1, avgWeight: 80.05 },
      ],
    }))
    // ~0% change during cut → plateau or wrong_direction
    expect(['plateau', 'wrong_direction']).toContain(result.status)
  })

  // ── 掉太快 (too_fast) ──
  it('detects too_fast when weight drops more than 1% per week', () => {
    const result = generateNutritionSuggestion(baseNutritionInput({
      weeklyWeights: [
        { week: 0, avgWeight: 78.0 },
        { week: 1, avgWeight: 80.0 },
      ],
    }))
    // -2.0kg / 80kg = -2.5% → too fast
    expect(result.status).toBe('too_fast')
  })

  // ── 方向錯誤 (wrong_direction) ──
  it('detects wrong_direction when weight goes up during cut', () => {
    const result = generateNutritionSuggestion(baseNutritionInput({
      weeklyWeights: [
        { week: 0, avgWeight: 81.0 },
        { week: 1, avgWeight: 80.0 },
      ],
    }))
    // +1.0kg during cut → wrong direction
    expect(result.status).toBe('wrong_direction')
  })

  // ── TDEE 估算永不為 null ──
  it('always estimates TDEE when sufficient data is provided', () => {
    const result = generateNutritionSuggestion(baseNutritionInput())
    expect(result.estimatedTDEE).not.toBeNull()
    expect(result.estimatedTDEE).toBeGreaterThan(1000)
  })

  // ── 安全下限：男性不低於 1500kcal ──
  it('never suggests calories below 1500 for males', () => {
    const result = generateNutritionSuggestion(baseNutritionInput({
      bodyWeight: 50, // 很輕的男性
      currentCalories: 1400,
      avgDailyCalories: 1400,
      weeklyWeights: [
        { week: 0, avgWeight: 50.0 },
        { week: 1, avgWeight: 50.05 }, // 停滯 → 要再降
      ],
    }))
    if (result.suggestedCalories !== null) {
      expect(result.suggestedCalories).toBeGreaterThanOrEqual(1500)
    }
  })

  // ── 安全下限：女性不低於 1200kcal ──
  it('never suggests calories below 1200 for females', () => {
    const result = generateNutritionSuggestion(baseNutritionInput({
      gender: '女性',
      bodyWeight: 45,
      currentCalories: 1100,
      avgDailyCalories: 1100,
      weeklyWeights: [
        { week: 0, avgWeight: 45.0 },
        { week: 1, avgWeight: 45.05 },
      ],
    }))
    if (result.suggestedCalories !== null) {
      expect(result.suggestedCalories).toBeGreaterThanOrEqual(1200)
    }
  })

  // ── bodyWeight = 0 不應產生 NaN ──
  it('handles bodyWeight = 0 without producing NaN', () => {
    const result = generateNutritionSuggestion(baseNutritionInput({
      bodyWeight: 0,
      weeklyWeights: [
        { week: 0, avgWeight: 0 },
        { week: 1, avgWeight: 0 },
      ],
    }))
    // 不管結果如何，不應有 NaN
    if (result.suggestedProtein !== null) {
      expect(Number.isNaN(result.suggestedProtein)).toBe(false)
    }
    if (result.suggestedCalories !== null) {
      expect(Number.isNaN(result.suggestedCalories)).toBe(false)
    }
  })

  // ── 無體脂率時 fallback TDEE ──
  it('uses fallback TDEE when bodyFatPct is null', () => {
    const result = generateNutritionSuggestion(baseNutritionInput({
      bodyFatPct: null,
    }))
    expect(result.estimatedTDEE).not.toBeNull()
    // 80kg × 30 (male moderate) = 2400
    expect(result.estimatedTDEE).toBeGreaterThan(2000)
  })

  // ── 飲食 8 週以上提示 diet break ──
  it('suggests diet break after 8+ weeks of continuous dieting', () => {
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - 60) // 60 days ≈ 8.5 weeks

    const result = generateNutritionSuggestion(baseNutritionInput({
      dietStartDate: startDate.toISOString(),
    }))
    expect(result.dietBreakSuggested).toBe(true)
  })

  // ── 月經週期：女性黃體期提示 ──
  it('shows menstrual cycle note for females in luteal phase', () => {
    const periodDate = new Date()
    periodDate.setDate(periodDate.getDate() - 20) // day 20 = luteal phase

    const result = generateNutritionSuggestion(baseNutritionInput({
      gender: '女性',
      lastPeriodDate: periodDate.toISOString(),
      weeklyWeights: [
        { week: 0, avgWeight: 56.0 },
        { week: 1, avgWeight: 55.5 },
      ],
    }))
    expect(result.menstrualCycleNote).not.toBeNull()
    expect(result.menstrualCycleNote).toContain('黃體期')
  })

  // ── 增肌模式 ──
  it('handles bulk mode correctly', () => {
    const result = generateNutritionSuggestion(baseNutritionInput({
      goalType: 'bulk',
      weeklyWeights: [
        { week: 0, avgWeight: 80.3 },
        { week: 1, avgWeight: 80.0 },
      ],
    }))
    // +0.3kg during bulk → should be on_track or similar
    expect(result.status).not.toBe('insufficient_data')
    if (result.suggestedCalories !== null) {
      expect(result.suggestedCalories).toBeGreaterThan(0)
    }
  })

  // ── 低合規率加入警告但不阻擋 ──
  it('adds warning when compliance is below 70% but still analyzes', () => {
    const result = generateNutritionSuggestion(baseNutritionInput({
      nutritionCompliance: 50,
    }))
    expect(result.status).not.toBe('low_compliance')
    expect(result.warnings.some(w => w.includes('合規率'))).toBe(true)
  })
})

// ===== calculateInitialTargets =====
describe('calculateInitialTargets', () => {
  it('calculates initial targets for a male cutting with known body fat', () => {
    const result = calculateInitialTargets({
      gender: '男性',
      bodyWeight: 80,
      goalType: 'cut',
      bodyFatPct: 15,
      trainingDaysPerWeek: 4,
    })

    expect(result.estimatedTDEE).toBeGreaterThan(1800)
    expect(result.calories).toBeGreaterThanOrEqual(1500) // male safety floor
    expect(result.protein).toBeGreaterThan(0)
    expect(result.carbs).toBeGreaterThan(0)
    expect(result.fat).toBeGreaterThan(0)
    expect(result.deficit).toBeGreaterThan(0) // cutting = positive deficit
    expect(result.method).toBe('katch_mcardle')
  })

  it('uses fallback method when bodyFatPct is null', () => {
    const result = calculateInitialTargets({
      gender: '男性',
      bodyWeight: 80,
      goalType: 'cut',
      bodyFatPct: null,
    })
    expect(result.method).toBe('fallback')
  })

  it('applies female safety minimums', () => {
    const result = calculateInitialTargets({
      gender: '女性',
      bodyWeight: 45,
      goalType: 'cut',
      bodyFatPct: null,
    })
    expect(result.calories).toBeGreaterThanOrEqual(1200)
    // Female protein: at least 1.8g/kg cut
    expect(result.protein).toBeGreaterThanOrEqual(Math.round(45 * 1.6))
  })

  it('produces surplus for bulk mode', () => {
    const result = calculateInitialTargets({
      gender: '男性',
      bodyWeight: 75,
      goalType: 'bulk',
      bodyFatPct: 12,
    })
    expect(result.calories).toBeGreaterThan(result.estimatedTDEE - 50) // surplus or near-TDEE
  })

  // ── macro 加總不應遠超 calories ──
  it('macros sum approximately equals suggested calories', () => {
    const result = calculateInitialTargets({
      gender: '男性',
      bodyWeight: 80,
      goalType: 'cut',
      bodyFatPct: 15,
      trainingDaysPerWeek: 4,
    })
    const macroCalories = result.protein * 4 + result.carbs * 4 + result.fat * 9
    // 允許 ±50kcal 誤差（四捨五入）
    expect(Math.abs(macroCalories - result.calories)).toBeLessThan(50)
  })
})

// ===== calcRecommendedStageWeight =====
describe('calcRecommendedStageWeight', () => {
  it('calculates competition stage weight for male', () => {
    const result = calcRecommendedStageWeight(80, 15, '男性')
    expect(result.ffm).toBeCloseTo(68, 0) // 80 * 0.85 = 68
    expect(result.fatMass).toBeCloseTo(12, 0) // 80 * 0.15
    expect(result.recommendedLow).toBeLessThan(80) // should lose weight
    expect(result.recommendedHigh).toBeLessThan(80)
    expect(result.mode).toBe('competition')
  })

  it('calculates health mode for female', () => {
    const result = calcRecommendedStageWeight(60, 25, '女性', 165, false)
    expect(result.ffm).toBeCloseTo(45, 0) // 60 * 0.75
    expect(result.mode).toBe('health')
  })

  it('calculates FFMI when height is provided', () => {
    const result = calcRecommendedStageWeight(80, 15, '男性', 175)
    expect(result.ffmi).not.toBeNull()
    // FFMI = LBM / height_m^2 = 68 / (1.75^2) ≈ 22.2
    expect(result.ffmi).toBeCloseTo(22.2, 0)
  })

  it('returns null FFMI when height is not provided', () => {
    const result = calcRecommendedStageWeight(80, 15, '男性')
    expect(result.ffmi).toBeNull()
  })
})

// ===== generateDemoAnalysis =====
describe('generateDemoAnalysis', () => {
  it('generates demo analysis for male cut', () => {
    const result = generateDemoAnalysis({
      gender: '男性',
      bodyWeight: 80,
      goalType: 'cut',
      trainingDaysPerWeek: 4,
      bodyFatPct: 15,
      targetWeight: 75,
    })

    expect(result.estimatedTDEE).toBeGreaterThan(1800)
    expect(result.suggestedCalories).toBeGreaterThanOrEqual(1500)
    expect(result.suggestedProtein).toBeGreaterThan(100)
    expect(result.dailyDeficit).toBeGreaterThan(0)
    expect(result.weeklyChangeKg).toBeLessThan(0) // cutting = losing weight
  })

  it('generates demo analysis for female bulk', () => {
    const result = generateDemoAnalysis({
      gender: '女性',
      bodyWeight: 55,
      goalType: 'bulk',
      trainingDaysPerWeek: 3,
      bodyFatPct: 22,
      targetWeight: null,
    })

    expect(result.suggestedCalories).toBeGreaterThan(result.estimatedTDEE - 10) // surplus
    expect(result.weeklyChangeKg).toBeGreaterThan(0) // gaining weight
  })

  it('adds safety note when no body fat provided', () => {
    const result = generateDemoAnalysis({
      gender: '男性',
      bodyWeight: 80,
      goalType: 'cut',
      trainingDaysPerWeek: 4,
      bodyFatPct: null,
      targetWeight: null,
    })
    expect(result.tdeeMethod).toBe('weight_formula')
    expect(result.safetyNotes.some(n => n.includes('體脂率'))).toBe(true)
  })

  it('calculates projected weeks when targetWeight is set', () => {
    const result = generateDemoAnalysis({
      gender: '男性',
      bodyWeight: 80,
      goalType: 'cut',
      trainingDaysPerWeek: 4,
      bodyFatPct: 15,
      targetWeight: 75,
    })
    expect(result.projectedWeeks).not.toBeNull()
    expect(result.projectedWeeks!).toBeGreaterThan(0)
  })

  // ── 女性安全下限 ──
  it('enforces female calorie floor at 1200', () => {
    const result = generateDemoAnalysis({
      gender: '女性',
      bodyWeight: 40,
      goalType: 'cut',
      trainingDaysPerWeek: 2,
      bodyFatPct: null,
      targetWeight: 35,
    })
    expect(result.suggestedCalories).toBeGreaterThanOrEqual(1200)
  })
})
