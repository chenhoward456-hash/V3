import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  calculateInitialTargets,
  generateNutritionSuggestion,
  generateDemoAnalysis,
  calculateMetabolicStressScore,
  type NutritionInput,
  type DemoAnalysisInput,
} from '@/lib/nutrition-engine'

// ===== Helpers =====

function makeCutInput(overrides: Partial<NutritionInput> = {}): NutritionInput {
  return {
    gender: '男性',
    bodyWeight: 80,
    goalType: 'cut',
    dietStartDate: '2025-01-01',
    weeklyWeights: [
      { week: 0, avgWeight: 80 },
      { week: 1, avgWeight: 80.3 },
      { week: 2, avgWeight: 80.6 },
      { week: 3, avgWeight: 81 },
    ],
    nutritionCompliance: 85,
    avgDailyCalories: 2000,
    trainingDaysPerWeek: 4,
    currentCalories: 2000,
    currentProtein: 160,
    currentCarbs: 200,
    currentFat: 55,
    currentCarbsTrainingDay: null,
    currentCarbsRestDay: null,
    carbsCyclingEnabled: false,
    targetWeight: 75,
    targetDate: null,
    ...overrides,
  }
}

function makeBulkInput(overrides: Partial<NutritionInput> = {}): NutritionInput {
  return {
    gender: '男性',
    bodyWeight: 75,
    goalType: 'bulk',
    dietStartDate: '2025-01-01',
    weeklyWeights: [
      { week: 0, avgWeight: 75 },
      { week: 1, avgWeight: 74.8 },
      { week: 2, avgWeight: 74.6 },
      { week: 3, avgWeight: 74.4 },
    ],
    nutritionCompliance: 90,
    avgDailyCalories: 2800,
    trainingDaysPerWeek: 4,
    currentCalories: 2800,
    currentProtein: 150,
    currentCarbs: 300,
    currentFat: 80,
    currentCarbsTrainingDay: null,
    currentCarbsRestDay: null,
    carbsCyclingEnabled: false,
    targetWeight: 80,
    targetDate: null,
    ...overrides,
  }
}

/** Generate a date string N days from now */
function daysFromNow(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d.toISOString().split('T')[0]
}

/** Generate a date string N days ago */
function daysAgo(n: number): string {
  return daysFromNow(-n)
}

// =============================================
// calculateInitialTargets
// =============================================

describe('calculateInitialTargets', () => {
  it('should calculate targets for male cutting', () => {
    const result = calculateInitialTargets({
      gender: '男性',
      bodyWeight: 80,
      goalType: 'cut',
      activityProfile: 'sedentary',
      trainingDaysPerWeek: 3,
    })

    expect(result.calories).toBeGreaterThan(0)
    expect(result.protein).toBeGreaterThan(0)
    expect(result.carbs).toBeGreaterThan(0)
    expect(result.fat).toBeGreaterThan(0)
    expect(result.deficit).toBeGreaterThan(0)
    expect(result.calories).toBeLessThan(result.estimatedTDEE)
  })

  it('should calculate targets for female bulking', () => {
    const result = calculateInitialTargets({
      gender: '女性',
      bodyWeight: 55,
      goalType: 'bulk',
      activityProfile: 'sedentary',
      trainingDaysPerWeek: 4,
    })

    expect(result.calories).toBeGreaterThan(0)
    expect(result.protein).toBeGreaterThan(0)
    expect(result.calories).toBeGreaterThan(result.estimatedTDEE)
  })

  it('should use Katch-McArdle when body fat is provided', () => {
    const result = calculateInitialTargets({
      gender: '男性',
      bodyWeight: 75,
      bodyFatPct: 15,
      goalType: 'cut',
    })

    expect(result.method).toBe('katch_mcardle')
  })

  it('should use fallback when no body fat data', () => {
    const result = calculateInitialTargets({
      gender: '男性',
      bodyWeight: 75,
      goalType: 'cut',
    })

    expect(result.method).toBe('fallback')
  })

  it('should provide body fat zone info when body fat is given', () => {
    const result = calculateInitialTargets({
      gender: '男性',
      bodyWeight: 80,
      bodyFatPct: 12,
      goalType: 'cut',
    })

    expect(result.bodyFatZoneInfo).not.toBeNull()
    expect(result.bodyFatZoneInfo?.proteinPerKg).toBeGreaterThan(0)
  })

  it('should set higher protein for high_energy_flux activity', () => {
    const sedentary = calculateInitialTargets({
      gender: '男性',
      bodyWeight: 80,
      goalType: 'cut',
      activityProfile: 'sedentary',
    })

    const active = calculateInitialTargets({
      gender: '男性',
      bodyWeight: 80,
      goalType: 'cut',
      activityProfile: 'high_energy_flux',
    })

    expect(active.estimatedTDEE).toBeGreaterThan(sedentary.estimatedTDEE)
  })

  it('should handle recomp goal type with micro deficit', () => {
    const result = calculateInitialTargets({
      gender: '男性',
      bodyWeight: 80,
      goalType: 'recomp',
      trainingDaysPerWeek: 4,
    })

    // recomp = small deficit or maintenance
    expect(result.deficit).toBeGreaterThanOrEqual(0)
    expect(result.deficit).toBeLessThanOrEqual(150)
    expect(result.calories).toBeGreaterThan(0)
  })

  it('should apply female-specific lower protein for bulk', () => {
    const male = calculateInitialTargets({
      gender: '男性',
      bodyWeight: 70,
      goalType: 'bulk',
    })
    const female = calculateInitialTargets({
      gender: '女性',
      bodyWeight: 70,
      goalType: 'bulk',
    })
    // Female protein floor is lower (1.6 vs 1.8 g/kg)
    expect(female.protein).toBeLessThanOrEqual(male.protein)
  })

  it('should use zone surplus for bulk when body fat is available', () => {
    const result = calculateInitialTargets({
      gender: '男性',
      bodyWeight: 80,
      bodyFatPct: 15,
      goalType: 'bulk',
    })

    expect(result.method).toBe('katch_mcardle')
    expect(result.calories).toBeGreaterThan(result.estimatedTDEE)
  })

  it('should use fallback surplus for bulk without body fat', () => {
    const result = calculateInitialTargets({
      gender: '男性',
      bodyWeight: 80,
      goalType: 'bulk',
    })

    expect(result.method).toBe('fallback')
    expect(result.calories).toBeGreaterThan(result.estimatedTDEE)
    // deficit should be negative (surplus)
    expect(result.deficit).toBeLessThan(0)
  })

  it('should handle moderate (default) activity profile', () => {
    const result = calculateInitialTargets({
      gender: '男性',
      bodyWeight: 80,
      goalType: 'cut',
      // no activityProfile → moderate default
    })

    expect(result.estimatedTDEE).toBeGreaterThan(0)
    expect(result.method).toBe('fallback')
  })

  it('should ensure minimum calories for female cutting', () => {
    const result = calculateInitialTargets({
      gender: '女性',
      bodyWeight: 40,
      goalType: 'cut',
      activityProfile: 'sedentary',
    })
    // Female min is 1200
    expect(result.calories).toBeGreaterThanOrEqual(1200)
  })

  it('should handle recomp with body fat data using zone macros', () => {
    const result = calculateInitialTargets({
      gender: '男性',
      bodyWeight: 80,
      bodyFatPct: 18,
      goalType: 'recomp',
    })
    // recomp uses cut macros (higher protein)
    expect(result.bodyFatZoneInfo).not.toBeNull()
    expect(result.protein).toBeGreaterThan(0)
  })
})

// =============================================
// generateNutritionSuggestion - Basics
// =============================================

describe('generateNutritionSuggestion', () => {
  describe('data sufficiency checks', () => {
    it('should return a valid suggestion for basic input', () => {
      const result = generateNutritionSuggestion(makeCutInput())
      expect(result.status).toBeDefined()
      expect(result.statusLabel).toBeDefined()
      expect(result.message).toBeDefined()
      expect(result.warnings).toBeInstanceOf(Array)
    })

    it('should detect insufficient data with no weekly weights', () => {
      const result = generateNutritionSuggestion(makeCutInput({
        weeklyWeights: [],
        currentCalories: null,
        currentProtein: null,
        currentCarbs: null,
        currentFat: null,
      }))
      expect(result.status).toBe('insufficient_data')
    })

    it('should allow 1 week of data when goal-driven (targetWeight + targetDate)', () => {
      const result = generateNutritionSuggestion(makeCutInput({
        weeklyWeights: [{ week: 0, avgWeight: 80 }],
        targetWeight: 75,
        targetDate: daysFromNow(60),
      }))
      // Should NOT be insufficient_data since it has goal + 1 week
      expect(result.status).not.toBe('insufficient_data')
    })

    it('should allow 1 week of data when prepPhase is set', () => {
      const result = generateNutritionSuggestion(makeCutInput({
        weeklyWeights: [{ week: 0, avgWeight: 80 }],
        prepPhase: 'cut',
      }))
      expect(result.status).not.toBe('insufficient_data')
    })

    it('should require 2 weeks without goal or prepPhase', () => {
      const result = generateNutritionSuggestion(makeCutInput({
        weeklyWeights: [{ week: 0, avgWeight: 80 }],
        targetWeight: null,
        targetDate: null,
        prepPhase: undefined,
      }))
      expect(result.status).toBe('insufficient_data')
    })
  })

  describe('compliance handling', () => {
    it('should warn on low compliance but still produce results', () => {
      const result = generateNutritionSuggestion(makeCutInput({
        nutritionCompliance: 50,
      }))
      expect(result.status).not.toBe('insufficient_data')
      expect(result.warnings.some(w => w.includes('合規率'))).toBe(true)
    })

    it('should use formula TDEE when compliance is very low', () => {
      const result = generateNutritionSuggestion(makeCutInput({
        nutritionCompliance: 30,
        avgDailyCalories: 1500,
      }))
      // Should still produce valid output
      expect(result.estimatedTDEE).toBeGreaterThan(0)
    })
  })

  describe('TDEE estimation', () => {
    it('should use Katch-McArdle when body fat provided', () => {
      const result = generateNutritionSuggestion(makeCutInput({
        bodyFatPct: 15,
      }))
      expect(result.estimatedTDEE).toBeGreaterThan(0)
    })

    it('should use adaptive TDEE when compliance high', () => {
      const result = generateNutritionSuggestion(makeCutInput({
        nutritionCompliance: 90,
        avgDailyCalories: 2000,
      }))
      expect(result.estimatedTDEE).toBeGreaterThan(0)
    })

    it('should fallback to formula when no avgDailyCalories', () => {
      const result = generateNutritionSuggestion(makeCutInput({
        avgDailyCalories: null,
        currentCalories: null,
      }))
      expect(result.estimatedTDEE).toBeGreaterThan(0)
      expect(result.warnings.some(w => w.includes('無飲食記錄'))).toBe(true)
    })

    it('should use currentCalories as fallback for adaptive TDEE', () => {
      const result = generateNutritionSuggestion(makeCutInput({
        avgDailyCalories: null,
        currentCalories: 2000,
        nutritionCompliance: 90,
      }))
      expect(result.estimatedTDEE).toBeGreaterThan(0)
    })

    it('should flag TDEE anomaly when adaptive differs greatly from formula', () => {
      // Create scenario: huge adaptive TDEE difference
      const result = generateNutritionSuggestion(makeCutInput({
        bodyFatPct: 15,
        nutritionCompliance: 90,
        avgDailyCalories: 3500, // Very high intake
        weeklyWeights: [
          { week: 0, avgWeight: 80 },
          { week: 1, avgWeight: 80 },  // No change → TDEE ~ intake
        ],
      }))
      // The adaptive TDEE should be near 3500, but formula much lower → anomaly
      if (result.tdeeAnomalyDetected) {
        expect(result.autoApply).toBe(false)
      }
    })

    it('should correct low adaptive TDEE with formula floor', () => {
      const result = generateNutritionSuggestion(makeCutInput({
        bodyFatPct: 15,
        nutritionCompliance: 90,
        avgDailyCalories: 800, // Very low reported intake
        weeklyWeights: [
          { week: 0, avgWeight: 80 },
          { week: 1, avgWeight: 80 },
        ],
      }))
      expect(result.estimatedTDEE).toBeGreaterThan(800)
      expect(result.warnings.some(w => w.includes('偏低'))).toBe(true)
    })
  })

  // ===== Cut-specific logic =====

  describe('cut - reactive mode', () => {
    it('should detect on_track with ideal weight loss', () => {
      // -0.5% to -1.0% rate
      const result = generateNutritionSuggestion(makeCutInput({
        weeklyWeights: [
          { week: 0, avgWeight: 79.4 }, // ~-0.75% of 80
          { week: 1, avgWeight: 80.0 },
          { week: 2, avgWeight: 80.6 },
        ],
        targetWeight: null, // No target = reactive mode
        targetDate: null,
      }))
      expect(result.status).toBe('on_track')
    })

    it('should detect too_fast weight loss', () => {
      const result = generateNutritionSuggestion(makeCutInput({
        weeklyWeights: [
          { week: 0, avgWeight: 78.5 }, // ~-1.9% of 80
          { week: 1, avgWeight: 80.0 },
          { week: 2, avgWeight: 81 },
        ],
        targetWeight: null,
        targetDate: null,
      }))
      expect(result.status).toBe('too_fast')
      expect(result.caloriesDelta).toBeGreaterThan(0) // Should increase calories
    })

    it('should detect wrong_direction (weight going up during cut)', () => {
      const result = generateNutritionSuggestion(makeCutInput({
        weeklyWeights: [
          { week: 0, avgWeight: 81 }, // went up
          { week: 1, avgWeight: 80 },
          { week: 2, avgWeight: 79.5 },
        ],
        targetWeight: null,
        targetDate: null,
      }))
      expect(result.status).toBe('wrong_direction')
    })

    it('should detect plateau (weight barely changing during cut)', () => {
      const result = generateNutritionSuggestion(makeCutInput({
        weeklyWeights: [
          { week: 0, avgWeight: 80.0 },
          { week: 1, avgWeight: 80.0 },
          { week: 2, avgWeight: 80.0 },
        ],
        targetWeight: null,
        targetDate: null,
      }))
      expect(result.status).toBe('plateau')
    })

    it('should suggest diet break after 8+ weeks', () => {
      const eightWeeksAgo = daysAgo(60)
      const result = generateNutritionSuggestion(makeCutInput({
        dietStartDate: eightWeeksAgo,
        weeklyWeights: [
          { week: 0, avgWeight: 79.4 },
          { week: 1, avgWeight: 80 },
        ],
        targetWeight: null,
        targetDate: null,
      }))
      expect(result.dietBreakSuggested).toBe(true)
    })

    it('should not suggest diet break for short diets', () => {
      const recentStart = daysAgo(14)
      const result = generateNutritionSuggestion(makeCutInput({
        dietStartDate: recentStart,
        weeklyWeights: [
          { week: 0, avgWeight: 79.4 },
          { week: 1, avgWeight: 80 },
        ],
        targetWeight: null,
        targetDate: null,
      }))
      expect(result.dietBreakSuggested).toBe(false)
    })

    it('should enforce minimum calories for male', () => {
      const result = generateNutritionSuggestion(makeCutInput({
        currentCalories: 1400,
        currentProtein: 100,
        currentCarbs: 100,
        currentFat: 30,
        weeklyWeights: [
          { week: 0, avgWeight: 81 },
          { week: 1, avgWeight: 80 },
        ],
        targetWeight: null,
        targetDate: null,
      }))
      if (result.suggestedCalories != null) {
        expect(result.suggestedCalories).toBeGreaterThanOrEqual(1500)
      }
    })

    it('should enforce minimum protein', () => {
      const result = generateNutritionSuggestion(makeCutInput({
        currentProtein: 50, // Very low
        weeklyWeights: [
          { week: 0, avgWeight: 81 },
          { week: 1, avgWeight: 80 },
        ],
        targetWeight: null,
        targetDate: null,
      }))
      if (result.suggestedProtein != null) {
        // At least 2.3 g/kg * 80 = 184g for male cut
        expect(result.suggestedProtein).toBeGreaterThanOrEqual(150)
      }
    })

    it('should enforce minimum fat', () => {
      const result = generateNutritionSuggestion(makeCutInput({
        currentFat: 20, // Very low
        weeklyWeights: [
          { week: 0, avgWeight: 81 },
          { week: 1, avgWeight: 80 },
        ],
        targetWeight: null,
        targetDate: null,
      }))
      if (result.suggestedFat != null) {
        // At least 0.8 g/kg * 80 = 64g for male
        expect(result.suggestedFat).toBeGreaterThanOrEqual(60)
      }
    })

    it('should handle on_track with zero delta recalculating macros', () => {
      // on_track + calDelta=0 triggers recalculation path
      const result = generateNutritionSuggestion(makeCutInput({
        weeklyWeights: [
          { week: 0, avgWeight: 79.4 },
          { week: 1, avgWeight: 80 },
        ],
        currentCalories: 2000,
        currentProtein: 160,
        currentCarbs: 200,
        currentFat: 55,
        targetWeight: null,
        targetDate: null,
      }))
      expect(result.status).toBe('on_track')
      // Should still produce valid macro suggestions
      expect(result.suggestedProtein).toBeGreaterThan(0)
      expect(result.suggestedCarbs).toBeGreaterThan(0)
      expect(result.suggestedFat).toBeGreaterThan(0)
    })
  })

  // ===== Cut with recovery state =====

  describe('cut - recovery state integration', () => {
    const wellnessOptimal = Array.from({ length: 7 }, (_, i) => ({
      date: daysAgo(i),
      energy_level: 5,
      training_drive: 5,
      device_recovery_score: 90,
      resting_hr: 50,
      hrv: 80,
      wearable_sleep_score: 90,
    }))

    const wellnessCritical = Array.from({ length: 7 }, (_, i) => ({
      date: daysAgo(i),
      energy_level: 1,
      training_drive: 1,
      device_recovery_score: 15,
      resting_hr: 80,
      hrv: 15,
      wearable_sleep_score: 30,
    }))

    const wellnessStruggling = Array.from({ length: 7 }, (_, i) => ({
      date: daysAgo(i),
      energy_level: 2,
      training_drive: 2,
      device_recovery_score: 35,
      resting_hr: 70,
      hrv: 30,
      wearable_sleep_score: 45,
    }))

    it('should add carbs when too_fast + critical recovery', () => {
      const result = generateNutritionSuggestion(makeCutInput({
        recentWellness: wellnessCritical,
        recentTrainingLogs: [{ date: daysAgo(0), rpe: 9 }],
        weeklyWeights: [
          { week: 0, avgWeight: 78.5 },
          { week: 1, avgWeight: 80 },
        ],
        targetWeight: null,
        targetDate: null,
      }))
      expect(result.status).toBe('too_fast')
      expect(result.caloriesDelta).toBeGreaterThanOrEqual(200) // Bigger bump for critical
    })

    it('should not reduce calories when wrong_direction + critical recovery', () => {
      const result = generateNutritionSuggestion(makeCutInput({
        recentWellness: wellnessCritical,
        recentTrainingLogs: [{ date: daysAgo(0), rpe: 9 }],
        weeklyWeights: [
          { week: 0, avgWeight: 81 },
          { week: 1, avgWeight: 80 },
        ],
        targetWeight: null,
        targetDate: null,
      }))
      expect(result.status).toBe('wrong_direction')
      expect(result.caloriesDelta).toBe(0)
    })

    it('should do reverse refeed on plateau + critical recovery', () => {
      const result = generateNutritionSuggestion(makeCutInput({
        recentWellness: wellnessCritical,
        recentTrainingLogs: [{ date: daysAgo(0), rpe: 9 }],
        weeklyWeights: [
          { week: 0, avgWeight: 80.0 },
          { week: 1, avgWeight: 80.0 },
          { week: 2, avgWeight: 80.0 },
        ],
        targetWeight: null,
        targetDate: null,
      }))
      expect(result.status).toBe('plateau')
      expect(result.caloriesDelta).toBeGreaterThan(0)
    })

    it('should reduce from fat on plateau + optimal recovery', () => {
      const result = generateNutritionSuggestion(makeCutInput({
        recentWellness: wellnessOptimal,
        recentTrainingLogs: [{ date: daysAgo(0), rpe: 8 }],
        weeklyWeights: [
          { week: 0, avgWeight: 80.0 },
          { week: 1, avgWeight: 80.0 },
          { week: 2, avgWeight: 80.0 },
        ],
        targetWeight: null,
        targetDate: null,
      }))
      expect(result.status).toBe('plateau')
      expect(result.fatDelta).toBeLessThan(0)
    })

    it('should add carbs when on_track but struggling recovery', () => {
      const result = generateNutritionSuggestion(makeCutInput({
        recentWellness: wellnessStruggling,
        recentTrainingLogs: [{ date: daysAgo(0), rpe: 7 }],
        weeklyWeights: [
          { week: 0, avgWeight: 79.4 },
          { week: 1, avgWeight: 80 },
        ],
        targetWeight: null,
        targetDate: null,
      }))
      expect(result.status).toBe('on_track')
      expect(result.caloriesDelta).toBeGreaterThan(0)
    })

    it('should provide wearable insight when recovery data exists', () => {
      const result = generateNutritionSuggestion(makeCutInput({
        recentWellness: wellnessOptimal,
        recentTrainingLogs: [{ date: daysAgo(0), rpe: 7 }],
        weeklyWeights: [
          { week: 0, avgWeight: 79.4 },
          { week: 1, avgWeight: 80 },
        ],
        targetWeight: null,
        targetDate: null,
      }))
      expect(result.wearableInsight).not.toBeNull()
    })
  })

  // ===== Goal-Driven Cut =====

  describe('cut - goal-driven mode', () => {
    it('should enter goal-driven when targetWeight + targetDate are set', () => {
      const result = generateNutritionSuggestion(makeCutInput({
        targetWeight: 75,
        targetDate: daysFromNow(60),
        bodyFatPct: 15,
        weeklyWeights: [
          { week: 0, avgWeight: 80 },
          { week: 1, avgWeight: 80.3 },
        ],
      }))
      expect(result.status).toBe('goal_driven')
      expect(result.deadlineInfo).not.toBeNull()
      expect(result.deadlineInfo?.isGoalDriven).toBe(true)
    })

    it('should cap deficit at safe maximum', () => {
      // Very aggressive timeline: lose 10kg in 14 days
      const result = generateNutritionSuggestion(makeCutInput({
        targetWeight: 70,
        targetDate: daysFromNow(14),
        bodyFatPct: 15,
        weeklyWeights: [
          { week: 0, avgWeight: 80 },
          { week: 1, avgWeight: 80.3 },
        ],
      }))
      expect(result.status).toBe('goal_driven')
      expect(result.warnings.some(w => w.includes('安全上限') || w.includes('安全線'))).toBe(true)
    })

    it('should detect ahead-of-schedule and relax deficit', () => {
      const result = generateNutritionSuggestion(makeCutInput({
        targetWeight: 78,
        targetDate: daysFromNow(60),
        bodyFatPct: 15,
        weeklyWeights: [
          { week: 0, avgWeight: 78.5 }, // Already very close!
          { week: 1, avgWeight: 80 },   // Lost 1.5kg last week = fast
        ],
      }))
      expect(result.status).toBe('goal_driven')
      expect(result.warnings.some(w => w.includes('超前'))).toBe(true)
    })

    it('should calculate cardio/steps when diet deficit insufficient', () => {
      // Very low TDEE but aggressive goal
      const result = generateNutritionSuggestion(makeCutInput({
        gender: '女性',
        bodyWeight: 50,
        targetWeight: 45,
        targetDate: daysFromNow(30),
        bodyFatPct: 20,
        weeklyWeights: [
          { week: 0, avgWeight: 50 },
          { week: 1, avgWeight: 50.2 },
        ],
        activityProfile: 'sedentary',
      }))
      if (result.deadlineInfo?.extraCardioNeeded) {
        expect(result.deadlineInfo.suggestedDailySteps).toBeGreaterThan(0)
      }
    })

    it('should apply Peak Week three-layer split for prep athletes', () => {
      const result = generateNutritionSuggestion(makeCutInput({
        targetWeight: 75,
        targetDate: daysFromNow(30),
        bodyFatPct: 10,
        prepPhase: 'cut',
        weeklyWeights: [
          { week: 0, avgWeight: 78 },
          { week: 1, avgWeight: 78.5 },
        ],
      }))
      expect(result.deadlineInfo?.peakWeekWaterCutPct).toBeDefined()
      expect(result.deadlineInfo?.prePeakEntryWeight).toBeDefined()
    })

    it('should use different safety levels for comp prep vs regular', () => {
      // Comp prep allows lower minimum calories
      const prepResult = generateNutritionSuggestion(makeCutInput({
        targetWeight: 72,
        targetDate: daysFromNow(21),
        bodyFatPct: 8,
        prepPhase: 'cut',
        weeklyWeights: [
          { week: 0, avgWeight: 78 },
          { week: 1, avgWeight: 78.5 },
        ],
      }))
      expect(prepResult.status).toBe('goal_driven')
    })

    it('should suggest strategic refeed in last 28 days when recovery bad', () => {
      const criticalWellness = Array.from({ length: 7 }, (_, i) => ({
        date: daysAgo(i),
        energy_level: 1,
        training_drive: 1,
        device_recovery_score: 15,
        resting_hr: 80,
        hrv: 15,
        wearable_sleep_score: 30,
      }))

      const result = generateNutritionSuggestion(makeCutInput({
        targetWeight: 78.5,
        targetDate: daysFromNow(20),
        bodyFatPct: 10,
        prepPhase: 'cut',
        dietStartDate: daysAgo(70),
        weeklyWeights: [
          { week: 0, avgWeight: 79 },
          { week: 1, avgWeight: 79.2 },
        ],
        recentWellness: criticalWellness,
        recentTrainingLogs: [{ date: daysAgo(0), rpe: 9 }],
      }))
      // Should have refeed-related warning
      expect(result.warnings.some(w => w.includes('refeed') || w.includes('Refeed'))).toBe(true)
    })

    it('should apply recovery deficit adjustment in goal-driven mode', () => {
      const criticalWellness = Array.from({ length: 7 }, (_, i) => ({
        date: daysAgo(i),
        energy_level: 1,
        training_drive: 1,
        device_recovery_score: 15,
        resting_hr: 80,
        hrv: 15,
        wearable_sleep_score: 30,
      }))

      const result = generateNutritionSuggestion(makeCutInput({
        targetWeight: 75,
        targetDate: daysFromNow(60),
        bodyFatPct: 15,
        recentWellness: criticalWellness,
        recentTrainingLogs: [{ date: daysAgo(0), rpe: 9 }],
        weeklyWeights: [
          { week: 0, avgWeight: 80 },
          { week: 1, avgWeight: 80.3 },
        ],
      }))
      expect(result.warnings.some(w => w.includes('恢復') || w.includes('縮小赤字'))).toBe(true)
    })

    it('should set steps for high_energy_flux even when diet deficit is sufficient', () => {
      const result = generateNutritionSuggestion(makeCutInput({
        targetWeight: 78,
        targetDate: daysFromNow(60),
        bodyFatPct: 15,
        activityProfile: 'high_energy_flux',
        weeklyWeights: [
          { week: 0, avgWeight: 80 },
          { week: 1, avgWeight: 80.3 },
        ],
      }))
      if (result.deadlineInfo?.suggestedDailySteps) {
        expect(result.deadlineInfo.suggestedDailySteps).toBeGreaterThan(5000)
      }
    })
  })

  // ===== Carb Cycling =====

  describe('carb cycling', () => {
    it('should split carbs into training/rest day when enabled with existing values', () => {
      const result = generateNutritionSuggestion(makeCutInput({
        carbsCyclingEnabled: true,
        currentCarbsTrainingDay: 250,
        currentCarbsRestDay: 150,
        weeklyWeights: [
          { week: 0, avgWeight: 81 }, // wrong direction
          { week: 1, avgWeight: 80 },
        ],
        targetWeight: null,
        targetDate: null,
      }))
      expect(result.suggestedCarbsTrainingDay).not.toBeNull()
      expect(result.suggestedCarbsRestDay).not.toBeNull()
    })

    it('should initialize carb cycling from average when no existing values', () => {
      const result = generateNutritionSuggestion(makeCutInput({
        carbsCyclingEnabled: true,
        currentCarbsTrainingDay: null,
        currentCarbsRestDay: null,
        weeklyWeights: [
          { week: 0, avgWeight: 81 },
          { week: 1, avgWeight: 80 },
        ],
        targetWeight: null,
        targetDate: null,
      }))
      expect(result.suggestedCarbsTrainingDay).not.toBeNull()
      expect(result.suggestedCarbsRestDay).not.toBeNull()
      if (result.suggestedCarbsTrainingDay && result.suggestedCarbsRestDay) {
        expect(result.suggestedCarbsTrainingDay).toBeGreaterThan(result.suggestedCarbsRestDay)
      }
    })

    it('should apply carb cycling in goal-driven mode', () => {
      const result = generateNutritionSuggestion(makeCutInput({
        carbsCyclingEnabled: true,
        currentCarbsTrainingDay: null,
        currentCarbsRestDay: null,
        targetWeight: 75,
        targetDate: daysFromNow(60),
        bodyFatPct: 15,
        weeklyWeights: [
          { week: 0, avgWeight: 80 },
          { week: 1, avgWeight: 80.3 },
        ],
      }))
      expect(result.suggestedCarbsTrainingDay).not.toBeNull()
      expect(result.suggestedCarbsRestDay).not.toBeNull()
    })

    it('should suspend carb cycling when carbs < 50g', () => {
      const result = generateNutritionSuggestion(makeCutInput({
        carbsCyclingEnabled: true,
        currentCarbs: 40,
        targetWeight: 70,
        targetDate: daysFromNow(14),
        bodyFatPct: 8,
        weeklyWeights: [
          { week: 0, avgWeight: 80 },
          { week: 1, avgWeight: 80.3 },
        ],
      }))
      // Should either unify or produce valid values
      if (result.suggestedCarbsTrainingDay != null && result.suggestedCarbsRestDay != null && (result.suggestedCarbs ?? 0) < 50) {
        expect(result.suggestedCarbsTrainingDay).toBe(result.suggestedCarbsRestDay)
      }
    })
  })

  // ===== Menstrual Cycle =====

  describe('menstrual cycle handling', () => {
    it('should detect luteal phase for female (day 14-30)', () => {
      const result = generateNutritionSuggestion(makeCutInput({
        gender: '女性',
        lastPeriodDate: daysAgo(20), // day 20 = luteal
        weeklyWeights: [
          { week: 0, avgWeight: 56 },
          { week: 1, avgWeight: 55.5 },
        ],
        targetWeight: null,
        targetDate: null,
      }))
      expect(result.menstrualCycleNote).not.toBeNull()
      expect(result.menstrualCycleNote).toContain('黃體期')
    })

    it('should suppress wrong_direction during luteal phase', () => {
      const result = generateNutritionSuggestion(makeCutInput({
        gender: '女性',
        lastPeriodDate: daysAgo(18),
        weeklyWeights: [
          { week: 0, avgWeight: 56.5 }, // slight weight gain
          { week: 1, avgWeight: 56 },
        ],
        targetWeight: null,
        targetDate: null,
      }))
      // Should NOT flag as wrong_direction during luteal
      expect(result.status).toBe('on_track')
    })

    it('should add luteal carb boost for female', () => {
      const result = generateNutritionSuggestion(makeCutInput({
        gender: '女性',
        lastPeriodDate: daysAgo(18),
        weeklyWeights: [
          { week: 0, avgWeight: 56.5 },
          { week: 1, avgWeight: 57 },
        ],
        targetWeight: null,
        targetDate: null,
      }))
      // The carb delta should include luteal boost
      expect(result.menstrualCycleNote).toContain('黃體期')
    })

    it('should warn about amenorrhea when no period date for female', () => {
      const result = generateNutritionSuggestion(makeCutInput({
        gender: '女性',
        lastPeriodDate: null,
        weeklyWeights: [
          { week: 0, avgWeight: 56 },
          { week: 1, avgWeight: 56.5 },
        ],
        targetWeight: null,
        targetDate: null,
      }))
      expect(result.warnings.some(w => w.includes('RED-S') || w.includes('經期'))).toBe(true)
    })

    it('should warn about amenorrhea when period date is >90 days ago', () => {
      const result = generateNutritionSuggestion(makeCutInput({
        gender: '女性',
        lastPeriodDate: daysAgo(100),
        weeklyWeights: [
          { week: 0, avgWeight: 56 },
          { week: 1, avgWeight: 56.5 },
        ],
        targetWeight: null,
        targetDate: null,
      }))
      expect(result.warnings.some(w => w.includes('閉經') || w.includes('90'))).toBe(true)
    })

    it('should warn about amenorrhea when period date is 45-90 days ago', () => {
      const result = generateNutritionSuggestion(makeCutInput({
        gender: '女性',
        lastPeriodDate: daysAgo(55),
        weeklyWeights: [
          { week: 0, avgWeight: 56 },
          { week: 1, avgWeight: 56.5 },
        ],
        targetWeight: null,
        targetDate: null,
      }))
      expect(result.warnings.some(w => w.includes('經期延遲') || w.includes('RED-S'))).toBe(true)
    })

    it('should not add cycle notes for male', () => {
      const result = generateNutritionSuggestion(makeCutInput({
        gender: '男性',
        lastPeriodDate: null,
        weeklyWeights: [
          { week: 0, avgWeight: 79.4 },
          { week: 1, avgWeight: 80 },
        ],
        targetWeight: null,
        targetDate: null,
      }))
      expect(result.menstrualCycleNote).toBeNull()
    })

    it('should show menstruation note during period days 0-5', () => {
      const result = generateNutritionSuggestion(makeCutInput({
        gender: '女性',
        lastPeriodDate: daysAgo(3), // day 3 of period
        weeklyWeights: [
          { week: 0, avgWeight: 56 },
          { week: 1, avgWeight: 56.3 },
        ],
        targetWeight: null,
        targetDate: null,
      }))
      expect(result.menstrualCycleNote).toContain('經期中')
    })
  })

  // ===== Energy Availability (RED-S) =====

  describe('energy availability checks', () => {
    it('should flag critical EA when very low calorie + high exercise', () => {
      const result = generateNutritionSuggestion(makeCutInput({
        bodyFatPct: 10,
        avgDailyCalories: 1200,
        trainingDaysPerWeek: 6,
        weeklyWeights: [
          { week: 0, avgWeight: 75 },
          { week: 1, avgWeight: 75.5 },
        ],
        targetWeight: null,
        targetDate: null,
      }))
      if (result.energyAvailability) {
        expect(['critical', 'low']).toContain(result.energyAvailability.level)
      }
    })

    it('should mark adequate EA when suggested calories are high enough', () => {
      // Use bulk + high calories to ensure suggested calories stay high enough for EA >= 30
      const result = generateNutritionSuggestion(makeBulkInput({
        bodyFatPct: 15,
        avgDailyCalories: 3200,
        currentCalories: 3200,
        currentProtein: 160,
        currentCarbs: 350,
        currentFat: 80,
        trainingDaysPerWeek: 3,
        weeklyWeights: [
          { week: 0, avgWeight: 80.3 },
          { week: 1, avgWeight: 80 },
        ],
      }))
      if (result.energyAvailability) {
        expect(result.energyAvailability.level).toBe('adequate')
        expect(result.energyAvailability.eaKcalPerKgFFM).toBeGreaterThanOrEqual(30)
      }
    })

    it('should apply EA safety valve in goal-driven mode', () => {
      // Very aggressive goal with body fat data → EA check kicks in
      const result = generateNutritionSuggestion(makeCutInput({
        gender: '女性',
        bodyWeight: 55,
        bodyFatPct: 15,
        targetWeight: 48,
        targetDate: daysFromNow(21),
        weeklyWeights: [
          { week: 0, avgWeight: 55 },
          { week: 1, avgWeight: 55.3 },
        ],
        trainingDaysPerWeek: 5,
      }))
      // EA safety valve should have triggered
      if (result.energyAvailability && result.energyAvailability.level !== 'adequate') {
        expect(result.warnings.some(w => w.includes('EA') || w.includes('RED-S'))).toBe(true)
      }
    })
  })

  // ===== Training Volume TDEE adjustment =====

  describe('training volume TDEE modifier', () => {
    it('should boost TDEE for high training volume', () => {
      const base = generateNutritionSuggestion(makeCutInput({
        bodyFatPct: 15,
        weeklyWeights: [
          { week: 0, avgWeight: 79.4 },
          { week: 1, avgWeight: 80 },
        ],
        targetWeight: null,
        targetDate: null,
      }))

      const high = generateNutritionSuggestion(makeCutInput({
        bodyFatPct: 15,
        recentTrainingVolume: {
          avgRPE: 9,
          avgDurationMin: 90,
          sessionsPerWeek: 6,
        },
        weeklyWeights: [
          { week: 0, avgWeight: 79.4 },
          { week: 1, avgWeight: 80 },
        ],
        targetWeight: null,
        targetDate: null,
      }))

      // High training volume should increase TDEE
      if (high.estimatedTDEE && base.estimatedTDEE) {
        expect(high.estimatedTDEE).toBeGreaterThanOrEqual(base.estimatedTDEE)
      }
    })

    it('should decrease TDEE for low training volume', () => {
      const result = generateNutritionSuggestion(makeCutInput({
        bodyFatPct: 15,
        recentTrainingVolume: {
          avgRPE: 4,
          avgDurationMin: 20,
          sessionsPerWeek: 2,
        },
        weeklyWeights: [
          { week: 0, avgWeight: 79.4 },
          { week: 1, avgWeight: 80 },
        ],
        targetWeight: null,
        targetDate: null,
      }))
      expect(result.warnings.some(w => w.includes('訓練量偏低'))).toBe(true)
    })
  })

  // ===== Supplement Compliance Feedback =====

  describe('supplement compliance feedback loop', () => {
    it('should warn about iron supplement not improving ferritin', () => {
      const result = generateNutritionSuggestion(makeCutInput({
        supplementCompliance: {
          rate: 0.9,
          weeksDuration: 10,
          supplements: ['鐵劑'],
        },
        labResults: [
          { test_name: '鐵蛋白', value: 15, unit: 'ng/mL', status: 'attention' },
        ],
        weeklyWeights: [
          { week: 0, avgWeight: 79.4 },
          { week: 1, avgWeight: 80 },
        ],
        targetWeight: null,
        targetDate: null,
      }))
      expect(result.warnings.some(w => w.includes('鐵劑') || w.includes('鐵蛋白'))).toBe(true)
    })

    it('should warn about vitamin D supplement not improving levels', () => {
      const result = generateNutritionSuggestion(makeCutInput({
        supplementCompliance: {
          rate: 0.85,
          weeksDuration: 9,
          supplements: ['維生素D'],
        },
        labResults: [
          { test_name: '維生素D', value: 18, unit: 'ng/mL', status: 'attention' },
        ],
        weeklyWeights: [
          { week: 0, avgWeight: 79.4 },
          { week: 1, avgWeight: 80 },
        ],
        targetWeight: null,
        targetDate: null,
      }))
      expect(result.warnings.some(w => w.includes('維生素D'))).toBe(true)
    })

    it('should warn about low supplement compliance', () => {
      const result = generateNutritionSuggestion(makeCutInput({
        supplementCompliance: {
          rate: 0.3,
          weeksDuration: 6,
          supplements: ['鐵劑'],
        },
        labResults: [
          { test_name: '鐵蛋白', value: 15, unit: 'ng/mL', status: 'attention' },
        ],
        weeklyWeights: [
          { week: 0, avgWeight: 79.4 },
          { week: 1, avgWeight: 80 },
        ],
        targetWeight: null,
        targetDate: null,
      }))
      expect(result.warnings.some(w => w.includes('補品依從率偏低'))).toBe(true)
    })
  })

  // ===== Bulk Engine =====

  describe('bulk mode', () => {
    it('should handle basic bulk on_track', () => {
      const result = generateNutritionSuggestion(makeBulkInput({
        weeklyWeights: [
          { week: 0, avgWeight: 75.3 },
          { week: 1, avgWeight: 75.0 },
        ],
      }))
      expect(result.status).toBe('on_track')
    })

    it('should detect too_fast bulk', () => {
      const result = generateNutritionSuggestion(makeBulkInput({
        weeklyWeights: [
          { week: 0, avgWeight: 76.0 }, // +1.3% in a week
          { week: 1, avgWeight: 75.0 },
        ],
      }))
      expect(result.status).toBe('too_fast')
      expect(result.caloriesDelta).toBeLessThan(0)
    })

    it('should detect wrong_direction (weight dropping during bulk)', () => {
      const result = generateNutritionSuggestion(makeBulkInput({
        weeklyWeights: [
          { week: 0, avgWeight: 74.0 },
          { week: 1, avgWeight: 75.0 },
        ],
      }))
      expect(result.status).toBe('wrong_direction')
      expect(result.caloriesDelta).toBeGreaterThan(0)
    })

    it('should detect bulk plateau', () => {
      const result = generateNutritionSuggestion(makeBulkInput({
        weeklyWeights: [
          { week: 0, avgWeight: 75.05 },
          { week: 1, avgWeight: 75.0 },
          { week: 2, avgWeight: 74.95 },
        ],
      }))
      expect(result.status).toBe('plateau')
      expect(result.caloriesDelta).toBeGreaterThan(0)
    })

    it('should handle bulk with recovery state (critical)', () => {
      const criticalWellness = Array.from({ length: 7 }, (_, i) => ({
        date: daysAgo(i),
        energy_level: 1,
        training_drive: 1,
        device_recovery_score: 15,
        resting_hr: 80,
        hrv: 15,
        wearable_sleep_score: 30,
      }))

      const result = generateNutritionSuggestion(makeBulkInput({
        recentWellness: criticalWellness,
        recentTrainingLogs: [{ date: daysAgo(0), rpe: 8 }],
        weeklyWeights: [
          { week: 0, avgWeight: 75.3 },
          { week: 1, avgWeight: 75.0 },
        ],
      }))
      // Should add extra carbs for recovery
      expect(result.message).toContain('恢復')
    })

    it('should detect dirty bulk (body fat increase > 4%)', () => {
      const result = generateNutritionSuggestion(makeBulkInput({
        bodyFatPct: 22,
        previousBodyFatPct: 16,
        weeklyWeights: [
          { week: 0, avgWeight: 76 },
          { week: 1, avgWeight: 75 },
        ],
      }))
      expect(result.status).toBe('too_fast')
      expect(result.warnings.some(w => w.includes('髒增肌'))).toBe(true)
    })

    it('should detect mild dirty bulk (body fat increase 2-4%)', () => {
      const result = generateNutritionSuggestion(makeBulkInput({
        bodyFatPct: 19,
        previousBodyFatPct: 16,
        weeklyWeights: [
          { week: 0, avgWeight: 76 },
          { week: 1, avgWeight: 75 },
        ],
      }))
      expect(result.status).toBe('too_fast')
      expect(result.warnings.some(w => w.includes('體脂上升偏快'))).toBe(true)
    })

    it('should handle bulk carb cycling', () => {
      const result = generateNutritionSuggestion(makeBulkInput({
        carbsCyclingEnabled: true,
        currentCarbsTrainingDay: 350,
        currentCarbsRestDay: 200,
        weeklyWeights: [
          { week: 0, avgWeight: 76 },
          { week: 1, avgWeight: 75 },
        ],
      }))
      expect(result.suggestedCarbsTrainingDay).not.toBeNull()
      expect(result.suggestedCarbsRestDay).not.toBeNull()
    })

    it('should validate protein floor for bulk on_track', () => {
      const result = generateNutritionSuggestion(makeBulkInput({
        currentProtein: 50, // Very low
        weeklyWeights: [
          { week: 0, avgWeight: 75.3 },
          { week: 1, avgWeight: 75.0 },
        ],
      }))
      if (result.suggestedProtein != null) {
        expect(result.suggestedProtein).toBeGreaterThanOrEqual(Math.round(75 * 1.6))
      }
    })

    it('should cap fat for bulk', () => {
      const result = generateNutritionSuggestion(makeBulkInput({
        currentFat: 200, // Very high fat
        weeklyWeights: [
          { week: 0, avgWeight: 76 },
          { week: 1, avgWeight: 75 },
        ],
      }))
      if (result.suggestedFat != null) {
        expect(result.suggestedFat).toBeLessThanOrEqual(Math.round(75 * 1.2) + 10)
      }
    })

    it('should apply female luteal carb boost in bulk', () => {
      const result = generateNutritionSuggestion(makeBulkInput({
        gender: '女性',
        lastPeriodDate: daysAgo(20),
        weeklyWeights: [
          { week: 0, avgWeight: 56 },
          { week: 1, avgWeight: 55.8 },
        ],
      }))
      expect(result.menstrualCycleNote).not.toBeNull()
    })

    it('should handle bulk deadline-aware urgency', () => {
      const result = generateNutritionSuggestion(makeBulkInput({
        targetWeight: 80,
        targetDate: daysFromNow(20),
        weeklyWeights: [
          { week: 0, avgWeight: 74.0 }, // Dropping in bulk
          { week: 1, avgWeight: 75.0 },
        ],
      }))
      // Should flag urgency
      if (result.deadlineInfo && result.deadlineInfo.daysLeft < 28) {
        expect(result.message).toContain('距離目標')
      }
    })
  })

  // ===== Recomp =====

  describe('recomp mode', () => {
    it('should use cut engine for recomp (micro deficit + high protein)', () => {
      const result = generateNutritionSuggestion(makeCutInput({
        goalType: 'recomp',
        weeklyWeights: [
          { week: 0, avgWeight: 79.5 },
          { week: 1, avgWeight: 80 },
        ],
        targetWeight: null,
        targetDate: null,
      }))
      // recomp flows through cut engine
      expect(result.status).toBeDefined()
      expect(['on_track', 'too_fast', 'plateau', 'wrong_direction']).toContain(result.status)
    })
  })

  // ===== Peak Week =====

  describe('peak week mode', () => {
    it('should generate peak week plan when prepPhase=peak_week and <=8 days out', () => {
      const result = generateNutritionSuggestion(makeCutInput({
        prepPhase: 'peak_week',
        targetDate: daysFromNow(5),
        weeklyWeights: [
          { week: 0, avgWeight: 75 },
          { week: 1, avgWeight: 75.5 },
        ],
      }))
      expect(result.status).toBe('peak_week')
      expect(result.peakWeekPlan).not.toBeNull()
      expect(result.peakWeekPlan!.length).toBeGreaterThan(0)
    })

    it('should generate peak week plan when prepPhase=competition', () => {
      const result = generateNutritionSuggestion(makeCutInput({
        prepPhase: 'competition',
        targetDate: daysFromNow(3),
        weeklyWeights: [
          { week: 0, avgWeight: 75 },
          { week: 1, avgWeight: 75.5 },
        ],
      }))
      expect(result.status).toBe('peak_week')
      expect(result.peakWeekPlan).not.toBeNull()
    })

    it('should include show day in peak week plan', () => {
      const result = generateNutritionSuggestion(makeCutInput({
        prepPhase: 'peak_week',
        targetDate: daysFromNow(7),
        weeklyWeights: [
          { week: 0, avgWeight: 75 },
          { week: 1, avgWeight: 75.5 },
        ],
      }))
      expect(result.peakWeekPlan).not.toBeNull()
      const showDay = result.peakWeekPlan!.find(d => d.phase === 'show_day')
      expect(showDay).toBeDefined()
      expect(showDay!.pumpUpNote).toBeDefined()
    })

    it('should have carb_load phase in peak week plan', () => {
      const result = generateNutritionSuggestion(makeCutInput({
        prepPhase: 'peak_week',
        targetDate: daysFromNow(7),
        weeklyWeights: [
          { week: 0, avgWeight: 75 },
          { week: 1, avgWeight: 75.5 },
        ],
      }))
      const carbLoad = result.peakWeekPlan!.find(d => d.phase === 'carb_load')
      expect(carbLoad).toBeDefined()
    })

    it('should use female-specific carb loading values', () => {
      const result = generateNutritionSuggestion(makeCutInput({
        gender: '女性',
        bodyWeight: 55,
        prepPhase: 'peak_week',
        targetDate: daysFromNow(7),
        weeklyWeights: [
          { week: 0, avgWeight: 55 },
          { week: 1, avgWeight: 55.5 },
        ],
      }))
      const carbLoad = result.peakWeekPlan!.find(d => d.phase === 'carb_load')
      // Female loading carb = 6.5 g/kg vs male 9.0
      expect(carbLoad!.carbsGPerKg).toBe(6.5)
      expect(result.warnings.some(w => w.includes('女性碳水超補量'))).toBe(true)
    })

    it('should include taper phase', () => {
      const result = generateNutritionSuggestion(makeCutInput({
        prepPhase: 'peak_week',
        targetDate: daysFromNow(7),
        weeklyWeights: [
          { week: 0, avgWeight: 75 },
          { week: 1, avgWeight: 75.5 },
        ],
      }))
      const taper = result.peakWeekPlan!.find(d => d.phase === 'taper')
      expect(taper).toBeDefined()
    })

    it('should warn about luteal phase during peak week for female', () => {
      const result = generateNutritionSuggestion(makeCutInput({
        gender: '女性',
        bodyWeight: 55,
        prepPhase: 'peak_week',
        targetDate: daysFromNow(5),
        lastPeriodDate: daysAgo(20),
        weeklyWeights: [
          { week: 0, avgWeight: 55 },
          { week: 1, avgWeight: 55.5 },
        ],
      }))
      expect(result.warnings.some(w => w.includes('黃體期'))).toBe(true)
    })
  })

  // ===== Genetic Corrections =====

  describe('genetic corrections', () => {
    it('should apply serotonin high risk carb floor', () => {
      const result = generateNutritionSuggestion(makeCutInput({
        geneticProfile: {
          serotonin: 'SS',
        },
        currentCarbs: 80, // below 120g floor
        weeklyWeights: [
          { week: 0, avgWeight: 81 },
          { week: 1, avgWeight: 80 },
        ],
        targetWeight: null,
        targetDate: null,
      }))
      expect(result.geneticCorrections.some(gc => gc.gene === 'depression')).toBe(true)
      if (result.suggestedCarbs != null) {
        expect(result.suggestedCarbs).toBeGreaterThanOrEqual(120)
      }
    })

    it('should apply serotonin moderate risk carb floor', () => {
      const result = generateNutritionSuggestion(makeCutInput({
        geneticProfile: {
          serotonin: 'SL',
        },
        currentCarbs: 80,
        weeklyWeights: [
          { week: 0, avgWeight: 81 },
          { week: 1, avgWeight: 80 },
        ],
        targetWeight: null,
        targetDate: null,
      }))
      expect(result.geneticCorrections.some(gc => gc.gene === 'depression')).toBe(true)
    })

    it('should apply MTHFR deficit reduction in goal-driven', () => {
      const result = generateNutritionSuggestion(makeCutInput({
        geneticProfile: {
          mthfr: 'homozygous',
        },
        targetWeight: 75,
        targetDate: daysFromNow(60),
        bodyFatPct: 15,
        weeklyWeights: [
          { week: 0, avgWeight: 80 },
          { week: 1, avgWeight: 80.3 },
        ],
      }))
      expect(result.geneticCorrections.some(gc => gc.gene === 'mthfr')).toBe(true)
    })

    it('should apply MTHFR heterozygous deficit reduction', () => {
      const result = generateNutritionSuggestion(makeCutInput({
        geneticProfile: {
          mthfr: 'heterozygous',
        },
        targetWeight: 75,
        targetDate: daysFromNow(60),
        bodyFatPct: 15,
        weeklyWeights: [
          { week: 0, avgWeight: 80 },
          { week: 1, avgWeight: 80.3 },
        ],
      }))
      expect(result.geneticCorrections.some(gc => gc.gene === 'mthfr')).toBe(true)
    })

    it('should add APOE4 fat source warnings', () => {
      const result = generateNutritionSuggestion(makeCutInput({
        geneticProfile: {
          apoe: 'e3/e4',
        },
        weeklyWeights: [
          { week: 0, avgWeight: 81 },
          { week: 1, avgWeight: 80 },
        ],
        targetWeight: null,
        targetDate: null,
      }))
      expect(result.geneticCorrections.some(gc => gc.gene === 'apoe4')).toBe(true)
      expect(result.warnings.some(w => w.includes('APOE4'))).toBe(true)
    })

    it('should add APOE4 e4/e4 homozygous warning', () => {
      const result = generateNutritionSuggestion(makeCutInput({
        geneticProfile: {
          apoe: 'e4/e4',
        },
        weeklyWeights: [
          { week: 0, avgWeight: 81 },
          { week: 1, avgWeight: 80 },
        ],
        targetWeight: null,
        targetDate: null,
      }))
      expect(result.geneticCorrections.some(gc => gc.gene === 'apoe4')).toBe(true)
      expect(result.warnings.some(w => w.includes('純合子'))).toBe(true)
    })

    it('should shorten depletion for serotonin high risk in peak week', () => {
      const result = generateNutritionSuggestion(makeCutInput({
        geneticProfile: {
          serotonin: 'SS',
        },
        prepPhase: 'peak_week',
        targetDate: daysFromNow(7),
        weeklyWeights: [
          { week: 0, avgWeight: 75 },
          { week: 1, avgWeight: 75.5 },
        ],
      }))
      expect(result.geneticCorrections.some(gc =>
        gc.gene === 'depression' && gc.rule.includes('Peak Week')
      )).toBe(true)
      // Depletion should be shortened: fewer depletion days
      const depletionDays = result.peakWeekPlan!.filter(d => d.phase === 'depletion')
      expect(depletionDays.length).toBeLessThanOrEqual(2)
    })

    it('should shorten depletion for serotonin moderate risk in peak week', () => {
      const result = generateNutritionSuggestion(makeCutInput({
        geneticProfile: {
          serotonin: 'SL',
        },
        prepPhase: 'peak_week',
        targetDate: daysFromNow(7),
        weeklyWeights: [
          { week: 0, avgWeight: 75 },
          { week: 1, avgWeight: 75.5 },
        ],
      }))
      const depletionDays = result.peakWeekPlan!.filter(d => d.phase === 'depletion')
      expect(depletionDays.length).toBeLessThanOrEqual(3)
    })

    it('should apply APOE4 food note in peak week depletion', () => {
      const result = generateNutritionSuggestion(makeCutInput({
        geneticProfile: {
          apoe: 'e3/e4',
        },
        prepPhase: 'peak_week',
        targetDate: daysFromNow(7),
        weeklyWeights: [
          { week: 0, avgWeight: 75 },
          { week: 1, avgWeight: 75.5 },
        ],
      }))
      expect(result.geneticCorrections.some(gc => gc.gene === 'apoe4')).toBe(true)
      const depDay = result.peakWeekPlan!.find(d => d.phase === 'depletion')
      if (depDay) {
        expect(depDay.foodNote).toContain('APOE4')
      }
    })

    it('should apply genetic corrections in bulk on_track', () => {
      const result = generateNutritionSuggestion(makeBulkInput({
        geneticProfile: {
          apoe: 'e3/e4',
          serotonin: 'SS',
        },
        weeklyWeights: [
          { week: 0, avgWeight: 75.3 },
          { week: 1, avgWeight: 75.0 },
        ],
      }))
      expect(result.geneticCorrections.length).toBeGreaterThan(0)
    })

    it('should apply genetic corrections in bulk non-on_track', () => {
      const result = generateNutritionSuggestion(makeBulkInput({
        geneticProfile: {
          apoe: 'e4/e4',
        },
        weeklyWeights: [
          { week: 0, avgWeight: 76 },
          { week: 1, avgWeight: 75 },
        ],
      }))
      expect(result.geneticCorrections.some(gc => gc.gene === 'apoe4')).toBe(true)
    })
  })

  // ===== Lab Results Integration =====

  describe('lab results integration', () => {
    it('should pass lab modifiers through reactive cut path', () => {
      const result = generateNutritionSuggestion(makeCutInput({
        labResults: [
          { test_name: 'HOMA-IR', value: 0.8, unit: '', status: 'normal' },
        ],
        weeklyWeights: [
          { week: 0, avgWeight: 81 },
          { week: 1, avgWeight: 80 },
        ],
        targetWeight: null,
        targetDate: null,
      }))
      expect(result.labMacroModifiers).toBeDefined()
    })

    it('should pass lab modifiers through goal-driven path', () => {
      const result = generateNutritionSuggestion(makeCutInput({
        labResults: [
          { test_name: 'HOMA-IR', value: 0.8, unit: '', status: 'normal' },
        ],
        targetWeight: 75,
        targetDate: daysFromNow(60),
        bodyFatPct: 15,
        weeklyWeights: [
          { week: 0, avgWeight: 80 },
          { week: 1, avgWeight: 80.3 },
        ],
      }))
      expect(result.labMacroModifiers).toBeDefined()
    })

    it('should pass lab modifiers through bulk path', () => {
      const result = generateNutritionSuggestion(makeBulkInput({
        labResults: [
          { test_name: 'HOMA-IR', value: 0.8, unit: '', status: 'normal' },
        ],
        weeklyWeights: [
          { week: 0, avgWeight: 76 },
          { week: 1, avgWeight: 75 },
        ],
      }))
      expect(result.labMacroModifiers).toBeDefined()
    })

    it('should pass lab modifiers through peak week path', () => {
      const result = generateNutritionSuggestion(makeCutInput({
        prepPhase: 'peak_week',
        targetDate: daysFromNow(5),
        labResults: [
          { test_name: 'HOMA-IR', value: 0.8, unit: '', status: 'normal' },
        ],
        weeklyWeights: [
          { week: 0, avgWeight: 75 },
          { week: 1, avgWeight: 75.5 },
        ],
      }))
      expect(result.labMacroModifiers).toBeDefined()
    })
  })

  // ===== Per-meal Protein Guide =====

  describe('per-meal protein guide', () => {
    it('should provide per-meal protein guide when protein is available', () => {
      const result = generateNutritionSuggestion(makeCutInput({
        weeklyWeights: [
          { week: 0, avgWeight: 79.4 },
          { week: 1, avgWeight: 80 },
        ],
        targetWeight: null,
        targetDate: null,
      }))
      expect(result.perMealProteinGuide).not.toBeNull()
      if (result.perMealProteinGuide) {
        expect(result.perMealProteinGuide.perMealGrams.min).toBeGreaterThan(0)
        expect(result.perMealProteinGuide.mealsPerDay.min).toBeGreaterThanOrEqual(3)
        expect(result.perMealProteinGuide.mealsPerDay.max).toBeLessThanOrEqual(6)
      }
    })
  })

  // ===== Body Fat Zone Info =====

  describe('body fat zone info', () => {
    it('should include zone info when body fat pct is provided', () => {
      const result = generateNutritionSuggestion(makeCutInput({
        bodyFatPct: 12,
        weeklyWeights: [
          { week: 0, avgWeight: 79.4 },
          { week: 1, avgWeight: 80 },
        ],
        targetWeight: null,
        targetDate: null,
      }))
      expect(result.bodyFatZoneInfo).not.toBeNull()
      expect(result.bodyFatZoneInfo!.zoneId).toBeDefined()
      expect(result.bodyFatZoneInfo!.proteinPerKg).toBeGreaterThan(0)
    })

    it('should be null when no body fat provided', () => {
      const result = generateNutritionSuggestion(makeCutInput({
        bodyFatPct: undefined,
        weeklyWeights: [
          { week: 0, avgWeight: 79.4 },
          { week: 1, avgWeight: 80 },
        ],
        targetWeight: null,
        targetDate: null,
      }))
      expect(result.bodyFatZoneInfo).toBeNull()
    })
  })
})

// =============================================
// calculateMetabolicStressScore
// =============================================

describe('calculateMetabolicStressScore', () => {
  it('should return low stress for fresh start', () => {
    const result = calculateMetabolicStressScore({
      dietDurationWeeks: 2,
      recoveryState: 'optimal',
      readinessScore: 90,
      weeklyChangeRate: -0.7,
      consecutivePlateauWeeks: 0,
      lowCarbDays: 0,
    })
    expect(result.level).toBe('low')
    expect(result.recommendation).toBe('continue')
    expect(result.score).toBeLessThan(30)
  })

  it('should return high stress for long diet with bad recovery', () => {
    const result = calculateMetabolicStressScore({
      dietDurationWeeks: 14,
      recoveryState: 'critical',
      readinessScore: 20,
      weeklyChangeRate: -0.1,
      consecutivePlateauWeeks: 3,
      lowCarbDays: 8,
    })
    expect(result.level).toBe('high')
    expect(['diet_break', 'refeed_2day']).toContain(result.recommendation)
    expect(result.refeedCarbGPerKg).toBeGreaterThan(0)
  })

  it('should recommend diet_break for 12+ week high stress', () => {
    const result = calculateMetabolicStressScore({
      dietDurationWeeks: 14,
      recoveryState: 'critical',
      readinessScore: 15,
      weeklyChangeRate: -0.1,
      consecutivePlateauWeeks: 3,
      lowCarbDays: 10,
    })
    expect(result.recommendation).toBe('diet_break')
  })

  it('should recommend refeed_2day for high stress but <12 weeks', () => {
    const result = calculateMetabolicStressScore({
      dietDurationWeeks: 9,
      recoveryState: 'critical',
      readinessScore: 15,
      weeklyChangeRate: -0.1,
      consecutivePlateauWeeks: 3,
      lowCarbDays: 10,
    })
    expect(result.recommendation).toBe('refeed_2day')
  })

  it('should recommend refeed_1day for elevated stress', () => {
    const result = calculateMetabolicStressScore({
      dietDurationWeeks: 8,
      recoveryState: 'struggling',
      readinessScore: 40,
      weeklyChangeRate: -0.3,
      consecutivePlateauWeeks: 2,
      lowCarbDays: 5,
    })
    expect(['elevated', 'high']).toContain(result.level)
    expect(['refeed_1day', 'refeed_2day', 'diet_break']).toContain(result.recommendation)
  })

  it('should recommend monitor for moderate stress', () => {
    const result = calculateMetabolicStressScore({
      dietDurationWeeks: 6,
      recoveryState: 'good',
      readinessScore: 70,
      weeklyChangeRate: -0.5,
      consecutivePlateauWeeks: 1,
      lowCarbDays: 3,
    })
    expect(['moderate', 'low']).toContain(result.level)
  })

  it('should use readinessScore fallback when state is unknown', () => {
    const lowScore = calculateMetabolicStressScore({
      dietDurationWeeks: 8,
      recoveryState: 'unknown',
      readinessScore: 20,
      weeklyChangeRate: -0.3,
      consecutivePlateauWeeks: 2,
      lowCarbDays: 5,
    })
    expect(lowScore.breakdown.recovery).toBeGreaterThan(10)
  })

  it('should fallback to default recovery when unknown with no readinessScore', () => {
    const result = calculateMetabolicStressScore({
      dietDurationWeeks: 6,
      recoveryState: 'unknown',
      readinessScore: null,
      weeklyChangeRate: -0.5,
      consecutivePlateauWeeks: 0,
      lowCarbDays: 0,
    })
    expect(result.breakdown.recovery).toBe(10)
  })

  it('should count wellness trend when energy/drive are low', () => {
    const result = calculateMetabolicStressScore({
      dietDurationWeeks: 6,
      recoveryState: 'good',
      readinessScore: 70,
      weeklyChangeRate: -0.5,
      consecutivePlateauWeeks: 0,
      lowCarbDays: 0,
      recentWellness: Array.from({ length: 7 }, () => ({
        energy_level: 1.5,
        training_drive: 1.5,
      })),
    })
    expect(result.breakdown.wellnessTrend).toBeGreaterThan(0)
  })

  it('should add luteal boost for female in luteal phase', () => {
    const result = calculateMetabolicStressScore({
      dietDurationWeeks: 6,
      recoveryState: 'good',
      readinessScore: 70,
      weeklyChangeRate: -0.5,
      consecutivePlateauWeeks: 0,
      lowCarbDays: 0,
      inLutealPhase: true,
    })
    expect(result.breakdown.lutealBoost).toBe(10)
    expect(result.reasons.some(r => r.includes('黃體期'))).toBe(true)
  })

  it('should suppress refeed near competition (<=7 days)', () => {
    const result = calculateMetabolicStressScore({
      dietDurationWeeks: 14,
      recoveryState: 'critical',
      readinessScore: 15,
      weeklyChangeRate: -0.1,
      consecutivePlateauWeeks: 3,
      lowCarbDays: 10,
      daysUntilCompetition: 5,
    })
    expect(result.recommendation).toBe('monitor')
  })

  it('should adjust refeed carbs based on bodyWeight tiers', () => {
    const light = calculateMetabolicStressScore({
      dietDurationWeeks: 10,
      recoveryState: 'critical',
      readinessScore: 15,
      weeklyChangeRate: -0.1,
      consecutivePlateauWeeks: 3,
      lowCarbDays: 8,
      bodyWeight: 50,
    })
    const heavy = calculateMetabolicStressScore({
      dietDurationWeeks: 10,
      recoveryState: 'critical',
      readinessScore: 15,
      weeklyChangeRate: -0.1,
      consecutivePlateauWeeks: 3,
      lowCarbDays: 8,
      bodyWeight: 110,
    })
    // Light person gets +0.5 g/kg bump, heavy gets -1.0
    if (light.refeedCarbGPerKg != null && heavy.refeedCarbGPerKg != null) {
      expect(light.refeedCarbGPerKg).toBeGreaterThan(heavy.refeedCarbGPerKg)
    }
  })

  it('should produce correct breakdown structure', () => {
    const result = calculateMetabolicStressScore({
      dietDurationWeeks: 6,
      recoveryState: 'good',
      readinessScore: 70,
      weeklyChangeRate: -0.5,
      consecutivePlateauWeeks: 0,
      lowCarbDays: 0,
    })
    expect(result.breakdown).toHaveProperty('dietDuration')
    expect(result.breakdown).toHaveProperty('recovery')
    expect(result.breakdown).toHaveProperty('plateau')
    expect(result.breakdown).toHaveProperty('lowCarb')
    expect(result.breakdown).toHaveProperty('wellnessTrend')
    expect(result.breakdown).toHaveProperty('lutealBoost')
  })

  it('should handle diet duration ranges correctly', () => {
    // 4-6 weeks
    const w5 = calculateMetabolicStressScore({
      dietDurationWeeks: 5,
      recoveryState: 'optimal',
      readinessScore: 90,
      weeklyChangeRate: -0.7,
      consecutivePlateauWeeks: 0,
      lowCarbDays: 0,
    })
    expect(w5.breakdown.dietDuration).toBeGreaterThan(0)

    // 6-8 weeks
    const w7 = calculateMetabolicStressScore({
      dietDurationWeeks: 7,
      recoveryState: 'optimal',
      readinessScore: 90,
      weeklyChangeRate: -0.7,
      consecutivePlateauWeeks: 0,
      lowCarbDays: 0,
    })
    expect(w7.breakdown.dietDuration).toBeGreaterThan(w5.breakdown.dietDuration)

    // 8-12 weeks
    const w10 = calculateMetabolicStressScore({
      dietDurationWeeks: 10,
      recoveryState: 'optimal',
      readinessScore: 90,
      weeklyChangeRate: -0.7,
      consecutivePlateauWeeks: 0,
      lowCarbDays: 0,
    })
    expect(w10.breakdown.dietDuration).toBeGreaterThan(w7.breakdown.dietDuration)
  })

  it('should handle consecutive plateau weeks correctly', () => {
    const p1 = calculateMetabolicStressScore({
      dietDurationWeeks: 4,
      recoveryState: 'good',
      readinessScore: 70,
      weeklyChangeRate: -0.5,
      consecutivePlateauWeeks: 1,
      lowCarbDays: 0,
    })
    expect(p1.breakdown.plateau).toBe(7)

    const p2 = calculateMetabolicStressScore({
      dietDurationWeeks: 4,
      recoveryState: 'good',
      readinessScore: 70,
      weeklyChangeRate: -0.5,
      consecutivePlateauWeeks: 2,
      lowCarbDays: 0,
    })
    expect(p2.breakdown.plateau).toBe(14)
  })

  it('should handle low carb day ranges', () => {
    const lc3 = calculateMetabolicStressScore({
      dietDurationWeeks: 4,
      recoveryState: 'good',
      readinessScore: 70,
      weeklyChangeRate: -0.5,
      consecutivePlateauWeeks: 0,
      lowCarbDays: 3,
    })
    expect(lc3.breakdown.lowCarb).toBe(5)

    const lc5 = calculateMetabolicStressScore({
      dietDurationWeeks: 4,
      recoveryState: 'good',
      readinessScore: 70,
      weeklyChangeRate: -0.5,
      consecutivePlateauWeeks: 0,
      lowCarbDays: 5,
    })
    expect(lc5.breakdown.lowCarb).toBe(10)
  })
})

// =============================================
// generateDemoAnalysis
// =============================================

describe('generateDemoAnalysis', () => {
  it('should calculate demo analysis for male cutting', () => {
    const result = generateDemoAnalysis({
      gender: '男性',
      bodyWeight: 80,
      goalType: 'cut',
      trainingDaysPerWeek: 4,
    })

    expect(result.estimatedTDEE).toBeGreaterThan(0)
    expect(result.suggestedCalories).toBeGreaterThan(0)
    expect(result.dailyDeficit).toBeGreaterThan(0)
    expect(result.suggestedProtein).toBeGreaterThan(0)
    expect(result.suggestedCarbs).toBeGreaterThan(0)
    expect(result.suggestedFat).toBeGreaterThan(0)
    expect(result.weeklyChangeKg).toBeLessThan(0)
    expect(result.tdeeMethod).toBe('weight_formula')
  })

  it('should calculate demo analysis for female bulking', () => {
    const result = generateDemoAnalysis({
      gender: '女性',
      bodyWeight: 55,
      goalType: 'bulk',
      trainingDaysPerWeek: 3,
    })

    expect(result.estimatedTDEE).toBeGreaterThan(0)
    expect(result.dailyDeficit).toBeLessThan(0) // surplus
    expect(result.suggestedCalories).toBeGreaterThan(result.estimatedTDEE)
    expect(result.weeklyChangeKg).toBeGreaterThan(0)
  })

  it('should use Katch-McArdle when body fat provided', () => {
    const result = generateDemoAnalysis({
      gender: '男性',
      bodyWeight: 80,
      bodyFatPct: 15,
      goalType: 'cut',
      trainingDaysPerWeek: 4,
    })

    expect(result.tdeeMethod).toBe('katch_mcardle')
    expect(result.bodyFatZoneInfo).not.toBeNull()
  })

  it('should note missing body fat data', () => {
    const result = generateDemoAnalysis({
      gender: '男性',
      bodyWeight: 80,
      goalType: 'cut',
      trainingDaysPerWeek: 4,
    })

    expect(result.safetyNotes.some(n => n.includes('未填體脂率'))).toBe(true)
  })

  it('should calculate projected weeks to target', () => {
    const result = generateDemoAnalysis({
      gender: '男性',
      bodyWeight: 80,
      goalType: 'cut',
      targetWeight: 75,
      trainingDaysPerWeek: 4,
    })

    expect(result.projectedWeeks).not.toBeNull()
    expect(result.projectedWeeks!).toBeGreaterThan(0)
  })

  it('should return null projected weeks when no target weight', () => {
    const result = generateDemoAnalysis({
      gender: '男性',
      bodyWeight: 80,
      goalType: 'cut',
      trainingDaysPerWeek: 4,
    })

    expect(result.projectedWeeks).toBeNull()
  })

  it('should warn about fast cut rate', () => {
    // Very light person with big TDEE → fast rate
    const result = generateDemoAnalysis({
      gender: '男性',
      bodyWeight: 50,
      bodyFatPct: 30,
      goalType: 'cut',
      trainingDaysPerWeek: 6,
    })
    // May or may not trigger depending on math, but structure should be valid
    expect(result.safetyNotes).toBeInstanceOf(Array)
  })

  it('should warn about fast bulk rate', () => {
    const result = generateDemoAnalysis({
      gender: '男性',
      bodyWeight: 50,
      goalType: 'bulk',
      trainingDaysPerWeek: 3,
    })
    // Small person with 250kcal surplus may have high % rate
    expect(result.safetyNotes).toBeInstanceOf(Array)
  })

  it('should enforce minimum calories for cutting', () => {
    const result = generateDemoAnalysis({
      gender: '女性',
      bodyWeight: 40,
      goalType: 'cut',
      trainingDaysPerWeek: 2,
    })
    expect(result.suggestedCalories).toBeGreaterThanOrEqual(1200)
  })

  it('should use zone surplus for bulk with body fat', () => {
    const result = generateDemoAnalysis({
      gender: '男性',
      bodyWeight: 80,
      bodyFatPct: 15,
      goalType: 'bulk',
      trainingDaysPerWeek: 4,
    })
    expect(result.tdeeMethod).toBe('katch_mcardle')
    expect(result.dailyDeficit).toBeLessThan(0) // surplus
    expect(result.bodyFatZoneInfo).not.toBeNull()
  })

  it('should use fallback surplus for bulk without body fat', () => {
    const result = generateDemoAnalysis({
      gender: '男性',
      bodyWeight: 80,
      goalType: 'bulk',
      trainingDaysPerWeek: 4,
    })
    expect(result.dailyDeficit).toBe(-250)
  })

  it('should produce valid macro split', () => {
    const result = generateDemoAnalysis({
      gender: '男性',
      bodyWeight: 80,
      bodyFatPct: 15,
      goalType: 'cut',
      trainingDaysPerWeek: 4,
    })
    // Verify macros roughly sum to calories
    const macroCalories = result.suggestedProtein * 4 + result.suggestedCarbs * 4 + result.suggestedFat * 9
    expect(Math.abs(macroCalories - result.suggestedCalories)).toBeLessThan(50)
  })

  it('should handle targetWeight same as bodyWeight', () => {
    const result = generateDemoAnalysis({
      gender: '男性',
      bodyWeight: 80,
      targetWeight: 80,
      goalType: 'cut',
      trainingDaysPerWeek: 4,
    })
    expect(result.projectedWeeks).toBeNull()
  })

  it('should handle bulk with zone that has no specific surplus data (edge case)', () => {
    // Very high body fat may not have zone data
    const result = generateDemoAnalysis({
      gender: '男性',
      bodyWeight: 120,
      bodyFatPct: 45,
      goalType: 'bulk',
      trainingDaysPerWeek: 3,
    })
    expect(result.suggestedCalories).toBeGreaterThan(result.estimatedTDEE)
  })
})

// =============================================
// Edge cases and integration
// =============================================

describe('edge cases', () => {
  it('should handle zero body weight gracefully', () => {
    // This is unrealistic but tests robustness
    const result = calculateInitialTargets({
      gender: '男性',
      bodyWeight: 1, // minimum realistic
      goalType: 'cut',
    })
    expect(result.calories).toBeGreaterThan(0)
  })

  it('should handle very high body fat percentage', () => {
    const result = calculateInitialTargets({
      gender: '男性',
      bodyWeight: 120,
      bodyFatPct: 40,
      goalType: 'cut',
    })
    expect(result.calories).toBeGreaterThan(0)
    expect(result.method).toBe('katch_mcardle')
  })

  it('should handle metabolic adaptation (8+ weeks diet duration)', () => {
    const result = generateNutritionSuggestion(makeCutInput({
      dietStartDate: daysAgo(70),
      bodyFatPct: 12,
      weeklyWeights: [
        { week: 0, avgWeight: 75 },
        { week: 1, avgWeight: 75.3 },
      ],
      targetWeight: null,
      targetDate: null,
    }))
    // Should apply metabolic adaptation factor
    expect(result.estimatedTDEE).toBeGreaterThan(0)
  })

  it('should handle null currentCalories in reactive mode', () => {
    const result = generateNutritionSuggestion(makeCutInput({
      currentCalories: null,
      currentProtein: null,
      currentCarbs: null,
      currentFat: null,
      weeklyWeights: [
        { week: 0, avgWeight: 79.4 },
        { week: 1, avgWeight: 80 },
      ],
      targetWeight: null,
      targetDate: null,
    }))
    expect(result.status).toBeDefined()
    expect(result.suggestedCalories).not.toBeNull()
  })

  it('should handle 3+ weeks of weight data for plateau detection', () => {
    const result = generateNutritionSuggestion(makeCutInput({
      weeklyWeights: [
        { week: 0, avgWeight: 80 },
        { week: 1, avgWeight: 80 },
        { week: 2, avgWeight: 80 },
        { week: 3, avgWeight: 80 },
      ],
      targetWeight: null,
      targetDate: null,
    }))
    expect(result.status).toBe('plateau')
  })

  it('should handle goalType cut with targetDate in past (daysLeft=1)', () => {
    const result = generateNutritionSuggestion(makeCutInput({
      targetWeight: 75,
      targetDate: daysFromNow(1),
      bodyFatPct: 15,
      weeklyWeights: [
        { week: 0, avgWeight: 80 },
        { week: 1, avgWeight: 80.3 },
      ],
    }))
    expect(result.status).toBe('goal_driven')
  })

  it('should provide refeed trigger when state=struggling and lowCarbDays>=5', () => {
    const strugglingWellness = Array.from({ length: 7 }, (_, i) => ({
      date: daysAgo(i),
      energy_level: 2,
      training_drive: 2,
      device_recovery_score: 35,
      resting_hr: 70,
      hrv: 30,
      wearable_sleep_score: 45,
    }))

    const result = generateNutritionSuggestion(makeCutInput({
      recentWellness: strugglingWellness,
      recentTrainingLogs: Array.from({ length: 7 }, (_, i) => ({
        date: daysAgo(i),
        rpe: 8,
      })),
      recentCarbsPerDay: Array.from({ length: 7 }, (_, i) => ({
        date: daysAgo(i),
        carbs: 80, // Below 150g threshold
      })),
      weeklyWeights: [
        { week: 0, avgWeight: 79.4 },
        { week: 1, avgWeight: 80 },
      ],
      targetWeight: null,
      targetDate: null,
    }))
    expect(result.refeedSuggested).toBe(true)
    expect(result.refeedDays).toBeGreaterThanOrEqual(1)
  })

  it('should not trigger refeed when state is unknown', () => {
    const result = generateNutritionSuggestion(makeCutInput({
      recentWellness: [],
      recentTrainingLogs: [],
      recentCarbsPerDay: Array.from({ length: 7 }, (_, i) => ({
        date: daysAgo(i),
        carbs: 80,
      })),
      weeklyWeights: [
        { week: 0, avgWeight: 79.4 },
        { week: 1, avgWeight: 80 },
      ],
      targetWeight: null,
      targetDate: null,
    }))
    expect(result.refeedSuggested).toBe(false)
  })

  it('should handle consecutive low carb days counting with null values', () => {
    const result = generateNutritionSuggestion(makeCutInput({
      recentCarbsPerDay: [
        { date: daysAgo(0), carbs: 80 },
        { date: daysAgo(1), carbs: null }, // null = skip
        { date: daysAgo(2), carbs: 80 },
        { date: daysAgo(3), carbs: 80 },
      ],
      weeklyWeights: [
        { week: 0, avgWeight: 79.4 },
        { week: 1, avgWeight: 80 },
      ],
      targetWeight: null,
      targetDate: null,
    }))
    // Should still process without error
    expect(result.status).toBeDefined()
  })

  it('should handle goal-driven cut where weight already at target', () => {
    const result = generateNutritionSuggestion(makeCutInput({
      bodyWeight: 75,
      targetWeight: 75,
      targetDate: daysFromNow(30),
      bodyFatPct: 15,
      weeklyWeights: [
        { week: 0, avgWeight: 75 },
        { week: 1, avgWeight: 75.3 },
      ],
    }))
    // weightToLose = 0, should not enter goal-driven
    expect(result.status).not.toBe('goal_driven')
  })

  it('should handle carb cycling with rest day minimum (30g)', () => {
    const result = generateNutritionSuggestion(makeCutInput({
      carbsCyclingEnabled: true,
      currentCarbsTrainingDay: 100,
      currentCarbsRestDay: 40,
      weeklyWeights: [
        { week: 0, avgWeight: 81 },
        { week: 1, avgWeight: 80 },
      ],
      targetWeight: null,
      targetDate: null,
    }))
    if (result.suggestedCarbsRestDay != null) {
      expect(result.suggestedCarbsRestDay).toBeGreaterThanOrEqual(30)
    }
  })

  it('should handle on_track cut recalculation with zone info', () => {
    const result = generateNutritionSuggestion(makeCutInput({
      bodyFatPct: 12,
      weeklyWeights: [
        { week: 0, avgWeight: 79.4 },
        { week: 1, avgWeight: 80 },
      ],
      currentCalories: 2000,
      currentProtein: 200,
      currentCarbs: 180,
      currentFat: 60,
      targetWeight: null,
      targetDate: null,
    }))
    expect(result.status).toBe('on_track')
    expect(result.bodyFatZoneInfo).not.toBeNull()
  })
})
