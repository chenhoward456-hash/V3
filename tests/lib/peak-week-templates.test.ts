import { describe, it, expect } from 'vitest'
import { buildBackLoadPlan } from '@/lib/peak-week-templates'

/**
 * 節奏是可複製的（哪天低碳、哪天灌峰值、哪天收），會變的是「量」。
 * → 節奏用模板，量用學員的實測值。這是「不把節奏寫死進引擎」的實作。
 */

// Howard：週一 Push / 週二 Pull / 週四 Legs / 週五 Upper（三六日休息）
const TRAINING_PLAN = {
  days: [
    { dayOfWeek: 1, label: 'Push', exercises: [{ name: '槓鈴臥推' }] },
    { dayOfWeek: 2, label: 'Pull', exercises: [{ name: '引體向上' }] },
    { dayOfWeek: 4, label: 'Legs', exercises: [{ name: '槓鈴硬舉' }] },
    { dayOfWeek: 5, label: 'Upper', exercises: [{ name: '側平舉' }] },
  ],
}

const OPTS = {
  competitionDate: '2026-07-26',   // 週日
  peakCarbs: 440,                  // 他的實測量
  trainingDayCarbs: 236,
  restDayCarbs: 100,
  protein: 186,
  fat: 50,
  trainingPlan: TRAINING_PLAN,
}

describe('Helms Back-Load 節奏模板', () => {
  const plan = buildBackLoadPlan(OPTS)

  it('產生 7 天（Day 7 → 賽日）', () => {
    expect(plan).toHaveLength(8)   // daysOut 7..0
    expect(plan[0].date).toBe('2026-07-19')
    expect(plan[plan.length - 1].date).toBe('2026-07-26')
  })

  it('🔺 峰值放在「賽前 2 天」，不是賽前 1 天（這是整套節奏的關鍵）', () => {
    const peak = plan.find(d => d.label?.includes('峰值'))!
    expect(peak.date).toBe('2026-07-24')     // 賽前 2 天
    expect(peak.carbs).toBe(440)             // 用實測量，不是體重公式
  })

  it('賽前 1 天「收」到 70-90%（給水分一整晚+一個白天平衡）', () => {
    const taper = plan.find(d => d.date === '2026-07-25')!
    expect(taper.label).toContain('收')
    expect(taper.carbs).toBe(330)            // 440 × 0.75
    expect(taper.carbs!).toBeLessThan(440)
    expect(taper.carbs!).toBeGreaterThan(440 * 0.7 - 5)
  })

  it('賽前一晚的教練備註要講「80% 的賽日碳水」+ 三個判讀分支', () => {
    const taper = plan.find(d => d.date === '2026-07-25')!
    expect(taper.coachNote).toContain('80%')
    expect(taper.coachNote).toContain('溢出')
    expect(taper.coachNote).toContain('飽而硬')
    expect(taper.coachNote).toContain('扁')
  })

  it('低碳期照學員的碳循環，訓練日/休息日自動對齊他的課表（不刻意壓低）', () => {
    const d719 = plan.find(d => d.date === '2026-07-19')!  // 週日 = 休息
    const d720 = plan.find(d => d.date === '2026-07-20')!  // 週一 = Push
    const d722 = plan.find(d => d.date === '2026-07-22')!  // 週三 = 休息

    expect(d719.carbs).toBe(100)   // 休息日
    expect(d720.carbs).toBe(236)   // 訓練日
    expect(d722.carbs).toBe(100)   // 休息日
  })

  it('Day 3 是最後一次較重訓練，且明講要避開損傷動作', () => {
    const d723 = plan.find(d => d.date === '2026-07-23')!  // 賽前 3 天
    expect(d723.label).toContain('最後一次較重訓練')
    expect(d723.trainingNote).toContain('硬舉')
    expect(d723.trainingNote).toContain('儲糖')
    expect(d723.coachNote).toContain('基準')   // 拍基準照
  })

  it('賽日：60-100% 區間 + 餐次節奏 + 補鈉 + 不限水', () => {
    const showDay = plan.find(d => d.date === '2026-07-26')!
    expect(showDay.label).toBe('賽日')
    expect(showDay.carbs).toBe(285)   // 440 × 0.65
    expect(showDay.coachNote).toContain('2-3h 一餐')
    expect(showDay.coachNote).toContain('補鈉')
    expect(showDay.coachNote).toContain('不限水')
  })

  it('沒有訓練課表也不炸（全部當訓練日處理）', () => {
    const plan2 = buildBackLoadPlan({ ...OPTS, trainingPlan: null })
    expect(plan2).toHaveLength(8)
    expect(plan2.find(d => d.label?.includes('峰值'))?.carbs).toBe(440)
  })

  it('峰值換成別的實測量 → 收/賽日跟著等比縮放（節奏不變、量會變）', () => {
    const plan3 = buildBackLoadPlan({ ...OPTS, peakCarbs: 600 })
    expect(plan3.find(d => d.date === '2026-07-24')?.carbs).toBe(600)
    expect(plan3.find(d => d.date === '2026-07-25')?.carbs).toBe(450)   // 600 × 0.75
    expect(plan3.find(d => d.date === '2026-07-26')?.carbs).toBe(390)   // 600 × 0.65
  })
})
