import { describe, it, expect } from 'vitest'
import { generateNutritionSuggestion, type NutritionInput } from '@/lib/nutrition-engine'

/**
 * 2026-10-22 震宣：standard 學員、沒有比賽，target_date（計畫到期日）剩 3 天
 * → 引擎生出 Peak Week，首頁碳水目標顯示 410g（處方訓練日 267g）。
 * target_date 不是比賽日，只有真比賽才進 Peak Week／賽後恢復。
 */
function daysFromNow(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d.toISOString().split('T')[0]
}

function input(overrides: Partial<NutritionInput> = {}): NutritionInput {
  return {
    gender: '男性',
    bodyWeight: 82,
    goalType: 'cut',
    dietStartDate: '2026-08-25',
    weeklyWeights: [
      { week: 0, avgWeight: 82.2 },
      { week: 1, avgWeight: 82.5 },
    ],
    nutritionCompliance: 90,
    avgDailyCalories: 2070,
    trainingDaysPerWeek: 4,
    currentCalories: 2070,
    currentProtein: 150,
    currentCarbs: 244,
    currentFat: 55,
    currentCarbsTrainingDay: 267,
    currentCarbsRestDay: 213,
    carbsCyclingEnabled: true,
    targetWeight: 78.5,
    targetDate: daysFromNow(3),
    prepPhase: 'cut',
    ...overrides,
  }
}

describe('Peak Week 只給真的有比賽的人', () => {
  it('standard 學員 target_date 剩 3 天 → 沒有 Peak Week', () => {
    const r = generateNutritionSuggestion(input({ clientMode: 'standard', isCompetition: false }))
    expect(r.peakWeekPlan).toBeNull()
    expect(r.status).not.toBe('peak_week')
  })

  it('standard 學員 target_date 剩 10 天 → 沒有 Peak Week 預覽', () => {
    const r = generateNutritionSuggestion(input({ clientMode: 'standard', isCompetition: false, targetDate: daysFromNow(10) }))
    expect(r.peakWeekPlan).toBeNull()
  })

  it('standard 學員 target_date 已過 → 不進賽後恢復', () => {
    const r = generateNutritionSuggestion(input({ clientMode: 'standard', isCompetition: false, targetDate: daysFromNow(-20) }))
    expect(r.status).not.toBe('recovery')
  })

  it('cron 沒傳 isCompetition 時，standard 一樣不進 Peak Week', () => {
    const r = generateNutritionSuggestion(input({ clientMode: 'standard' }))
    expect(r.peakWeekPlan).toBeNull()
  })

  it('真比賽（bodybuilding + isCompetition）剩 3 天 → 照常有 Peak Week', () => {
    const r = generateNutritionSuggestion(input({ clientMode: 'bodybuilding', isCompetition: true }))
    expect(r.peakWeekPlan?.length).toBeGreaterThan(0)
  })
})

describe('2026-10-26 沒比賽不做 PW 入場體重拆分', () => {
  it('standard 學員 target_date 還很遠：不出現 prePeakEntryWeight／PW 入場文案', () => {
    const s = generateNutritionSuggestion(input({ clientMode: 'standard', targetDate: daysFromNow(60), targetWeight: 77 }))
    expect(s.deadlineInfo?.prePeakEntryWeight).toBeUndefined()
    expect(JSON.stringify(s)).not.toContain('PW 入場')
  })
  it('bodybuilding 真備賽：照樣拆分', () => {
    const s = generateNutritionSuggestion(input({ clientMode: 'bodybuilding', isCompetition: true, targetDate: daysFromNow(60), targetWeight: 77 }))
    expect(s.deadlineInfo?.prePeakEntryWeight).toBeDefined()
  })
})
