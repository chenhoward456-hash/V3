import { describe, it, expect } from 'vitest'
import { generateNutritionSuggestion, type NutritionInput } from '@/lib/nutrition-engine'

/**
 * Peak Week 不變式測試（守門）
 *
 * 背景：2026-07 把 peak week 從「傳統/用藥圈做法」改成 Helms 天然選手協議時，
 * 出現過兩次「靜悄悄全綠」的嚴重 bug——原有測試只斷言 depletion 天數與單一常數，
 * 從不檢查 phase 之間的碳水落差，所以下列問題全部通過測試：
 *   1. 基因血清素保護值沒跟著基準抬 → 高風險者碳水反而比一般人低（保護變傷害）
 *   2. 防溢 override 用絕對減量 → 重量級「調降」實際變成調升
 *   3. 超補量比例下修後低於低碳日 → 超補期形同不存在
 *
 * 這支測試把上述全部變成硬不變式。改 PEAK_WEEK / GENETIC 任何碳水常數時，
 * 若破壞 phase 順序或基因保護方向，這裡會紅。
 */

function daysFromNow(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d.toISOString().split('T')[0]
}

function peakInput(overrides: Partial<NutritionInput> = {}): NutritionInput {
  const bw = overrides.bodyWeight ?? 80
  return {
    gender: '男性',
    bodyWeight: bw,
    goalType: 'cut',
    dietStartDate: '2025-01-01',
    weeklyWeights: [
      { week: 0, avgWeight: bw },
      { week: 1, avgWeight: bw + 0.3 },
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
    targetWeight: bw - 5,
    targetDate: daysFromNow(7),
    prepPhase: 'peak_week',
    ...overrides,
  }
}

type Carbs = { low: number[]; transition: number[]; load: number[]; taper: number[] }

function carbsByPhase(input: NutritionInput): Carbs {
  const plan = generateNutritionSuggestion(input).peakWeekPlan!
  const g = (p: string) => plan.filter(d => d.phase === p).map(d => d.carbsGPerKg as number)
  // fat_load 同時涵蓋 IMT 日與（基因縮短低碳期後的）過渡日
  return { low: g('depletion'), transition: g('fat_load'), load: g('carb_load'), taper: g('taper') }
}

const GENDERS: NutritionInput['gender'][] = ['男性', '女性']
const WEIGHTS = [60, 80, 95, 105]
const SEROTONINS = [null, 'SL', 'SS'] as const

describe('Peak Week phase 落差不變式（24 組：性別 × 體重 × 血清素基因型）', () => {
  for (const gender of GENDERS) {
    for (const bodyWeight of WEIGHTS) {
      for (const serotonin of SEROTONINS) {
        const label = `${gender} ${bodyWeight}kg ${serotonin ?? 'LL(無風險)'}`

        it(`${label}：超補 > 低碳，且 低碳 ≤ taper ≤ 超補`, () => {
          const c = carbsByPhase(peakInput({
            gender,
            bodyWeight,
            ...(serotonin ? { geneticProfile: { serotonin } as NutritionInput['geneticProfile'] } : {}),
          }))

          expect(c.load.length).toBeGreaterThan(0)
          const maxLow = Math.max(...c.low)
          const minLoad = Math.min(...c.load)

          // 核心：超補日一定要比低碳日高（否則「超補期」形同不存在）
          expect(minLoad).toBeGreaterThan(maxLow)

          // Taper 夾在低碳與超補之間，且必須「嚴格」高於低碳日
          //（用 >= 會放行「taper 塌回整週最低碳」= 上台前一天飽滿度掉光）
          for (const t of c.taper) {
            expect(t).toBeGreaterThan(maxLow)
            expect(t).toBeLessThanOrEqual(minLoad)
          }

          // 過渡/IMT 日不得超過超補日
          for (const t of c.transition) {
            expect(t).toBeLessThanOrEqual(minLoad)
            expect(t).toBeGreaterThanOrEqual(Math.min(...c.low))
          }
        })
      }
    }
  }
})

describe('基因血清素保護方向（不可反轉）', () => {
  it('SS / SL 的低碳日碳水必須「高於」無風險者——保護就是要吃更多碳，不是更少', () => {
    const low = (s: 'SL' | 'SS' | null) => Math.max(...carbsByPhase(peakInput({
      ...(s ? { geneticProfile: { serotonin: s } as NutritionInput['geneticProfile'] } : {}),
    })).low)

    const ll = low(null)
    const sl = low('SL')
    const ss = low('SS')

    expect(sl).toBeGreaterThan(ll)          // 中風險 > 無風險
    expect(ss).toBeGreaterThan(ll)          // 高風險 > 無風險
    expect(ss).toBeGreaterThanOrEqual(sl)   // 高風險 ≥ 中風險（保護更強）
  })

  it('SS / SL 的低碳期天數必須比無風險者短', () => {
    // 注意：引擎把低碳期後段標成 fat_load（IMT 日），碳水值仍等於低碳值。
    // 所以「低碳天數」要用「碳水 == 該情境最低值」來數，不能只數 phase==='depletion'。
    const lowCarbDays = (s: 'SL' | 'SS' | null) => {
      const plan = generateNutritionSuggestion(peakInput({
        ...(s ? { geneticProfile: { serotonin: s } as NutritionInput['geneticProfile'] } : {}),
      })).peakWeekPlan!.filter(d => d.phase !== 'show_day')
      const min = Math.min(...plan.map(d => d.carbsGPerKg as number))
      return plan.filter(d => (d.carbsGPerKg as number) === min).length
    }

    expect(lowCarbDays('SS')).toBeLessThan(lowCarbDays(null))
    expect(lowCarbDays('SL')).toBeLessThan(lowCarbDays(null))
    expect(lowCarbDays('SS')).toBeLessThanOrEqual(lowCarbDays('SL'))
  })
})

describe('防溢 override（Day 2 碳水調降）— 24 組全跑', () => {
  // ⚠️ 這裡一定要跑滿 24 組：只跑「男 80kg 無基因型」會漏掉 bug——
  //    那組 loadingCarb=5.0，就算沒有下限保護，0.7×5.0=3.5 仍高於低碳日 2.5，測試不會紅。
  //    真正會破的是帶血清素基因型者（低碳日被抬到 3.0-3.5）。
  for (const gender of GENDERS) {
    for (const bodyWeight of WEIGHTS) {
      for (const serotonin of SEROTONINS) {
        const label = `${gender} ${bodyWeight}kg ${serotonin ?? 'LL(無風險)'}`

        it(`${label}：調降後 < 超補日，且不得低於低碳日`, () => {
          const day7 = daysFromNow(0)   // 距比賽 7 天 = 今天（targetDate = +7）
          const day2 = daysFromNow(5)   // 距比賽 2 天

          const plan = generateNutritionSuggestion(peakInput({
            gender,
            bodyWeight,
            ...(serotonin ? { geneticProfile: { serotonin } as NutritionInput['geneticProfile'] } : {}),
            peakWeekDailyWeights: [
              { date: day7, weight: bodyWeight },
              { date: day2, weight: bodyWeight + 3.0 },  // 暴增 3kg → 必定觸發防溢
            ],
          } as Partial<NutritionInput>)).peakWeekPlan!

          const d2 = plan.find(d => d.daysOut === 2)!
          const d3 = plan.find(d => d.daysOut === 3)!
          const maxLow = Math.max(...plan.filter(d => d.phase === 'depletion').map(d => d.carbsGPerKg as number))

          // 真的調降了（低於未調降的超補日 Day 3）
          expect(d2.carbsGPerKg as number).toBeLessThan(d3.carbsGPerKg as number)
          // 但沒有降破低碳日（否則「超補期(已調降)」比低碳日還少，還會踩掉基因血清素保護）
          expect(d2.carbsGPerKg as number).toBeGreaterThanOrEqual(maxLow)
        })
      }
    }
  }
})

describe('比賽日鈉：day-level 與時間軸必須一致，且不得低於平日（＝不斷鈉）', () => {
  it('day.sodiumMg === 時間軸各餐鈉總和', () => {
    const plan = generateNutritionSuggestion(peakInput()).peakWeekPlan!
    const showDay = plan.find(d => d.phase === 'show_day')!
    const timelineSodium = (showDay.showDayTimeline ?? []).reduce((sum, m) => sum + (m.sodiumMg ?? 0), 0)

    expect(timelineSodium).toBeGreaterThan(0)
    expect(showDay.sodiumMg).toBe(timelineSodium)
  })

  it('賽日鈉不得低於低碳日鈉（天然協議：全程習慣量，不做賽前斷鈉）', () => {
    const plan = generateNutritionSuggestion(peakInput()).peakWeekPlan!
    const showDay = plan.find(d => d.phase === 'show_day')!
    const lowDay = plan.find(d => d.phase === 'depletion')!

    expect(showDay.sodiumMg).toBeGreaterThanOrEqual(lowDay.sodiumMg)
  })
})

describe('水分：全程不做灌水/切水（天然協議）', () => {
  it('每一天的 waterMlPerKg 都相同——沒有任何一天被拉高或砍掉', () => {
    const plan = generateNutritionSuggestion(peakInput()).peakWeekPlan!
    const perKg = plan.map(d => d.waterMlPerKg)
    const unique = [...new Set(perKg)]

    expect(unique.length).toBe(1)   // 全程同一個值 = 沒有 water loading / water cut
  })
})
