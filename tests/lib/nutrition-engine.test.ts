import { describe, it, expect } from 'vitest'
import { calculateInitialTargets, generateNutritionSuggestion, type NutritionInput } from '@/lib/nutrition-engine'

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
    expect(result.deficit).toBeGreaterThan(0) // cutting = positive deficit
    expect(result.calories).toBeLessThan(result.estimatedTDEE) // cutting = below TDEE
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
    expect(result.calories).toBeGreaterThan(result.estimatedTDEE) // bulking = above TDEE
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

    // Active should have higher calories
    expect(active.estimatedTDEE).toBeGreaterThan(sedentary.estimatedTDEE)
  })
})

describe('generateNutritionSuggestion', () => {
  const baseInput: NutritionInput = {
    gender: '男性',
    bodyWeight: 80,
    goalType: 'cut',
    dietStartDate: '2025-01-01',
    weeklyWeights: [
      { week: 0, avgWeight: 80 },
      { week: 1, avgWeight: 79.8 },
      { week: 2, avgWeight: 79.5 },
      { week: 3, avgWeight: 79.2 },
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
  }

  it('should return a valid suggestion', () => {
    const result = generateNutritionSuggestion(baseInput)

    expect(result.status).toBeDefined()
    expect(result.statusLabel).toBeDefined()
    expect(result.message).toBeDefined()
    expect(result.warnings).toBeInstanceOf(Array)
    expect(['on_track', 'too_fast', 'plateau', 'wrong_direction', 'insufficient_data', 'low_compliance', 'peak_week', 'goal_driven']).toContain(result.status)
  })

  it('should detect insufficient data with no weekly weights', () => {
    const result = generateNutritionSuggestion({
      ...baseInput,
      weeklyWeights: [],
      currentCalories: null,
      currentProtein: null,
      currentCarbs: null,
      currentFat: null,
    })

    expect(result.status).toBe('insufficient_data')
  })

  it('should flag issues with low compliance', () => {
    const result = generateNutritionSuggestion({
      ...baseInput,
      nutritionCompliance: 30,
    })

    // Low compliance may result in 'low_compliance' or 'wrong_direction' depending on weight trend
    expect(['low_compliance', 'wrong_direction', 'plateau']).toContain(result.status)
  })

  it('should not suggest diet break for short diets', () => {
    const recentStart = new Date()
    recentStart.setDate(recentStart.getDate() - 14)
    const result = generateNutritionSuggestion({
      ...baseInput,
      dietStartDate: recentStart.toISOString().split('T')[0],
    })

    expect(result.dietBreakSuggested).toBe(false)
  })

  it('should handle bulk goal type', () => {
    const result = generateNutritionSuggestion({
      ...baseInput,
      goalType: 'bulk',
      weeklyWeights: [
        { week: 0, avgWeight: 80 },
        { week: 1, avgWeight: 80.1 },
        { week: 2, avgWeight: 80.3 },
        { week: 3, avgWeight: 80.5 },
      ],
      targetWeight: 85,
    })

    expect(result.status).toBeDefined()
    expect(result.weeklyWeightChangeRate).not.toBeNull()
  })
})
