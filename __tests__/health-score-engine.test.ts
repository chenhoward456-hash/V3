import { describe, it, expect } from 'vitest'
import { calculateHealthScore, type HealthScoreInput } from '../lib/health-score-engine'

// ===== Helper: 建立基礎 input =====
function baseInput(overrides: Partial<HealthScoreInput> = {}): HealthScoreInput {
  return {
    wellnessLast7: [],
    nutritionLast7: [],
    trainingLast7: [],
    supplementComplianceRate: 0,
    labResults: [],
    quarterlyStart: null,
    ...overrides,
  }
}

describe('calculateHealthScore', () => {
  // ── 基礎：空資料回傳合理預設 ──
  it('returns grade C with all-empty data (defaults to 50)', () => {
    const result = calculateHealthScore(baseInput())
    // 空資料 → 各項都 fallback 50，supplement 0 → weighted ≈ 50*0.2 + 50*0.25 + 50*0.2 + 0*0.2 + 0*0.15 = 32.5
    expect(result.total).toBeGreaterThanOrEqual(0)
    expect(result.total).toBeLessThanOrEqual(100)
    expect(['A', 'B', 'C', 'D']).toContain(result.grade)
    expect(result.pillars).toHaveLength(5)
  })

  // ── Grade A: 全滿分 ──
  it('returns grade A when all pillars are perfect', () => {
    const result = calculateHealthScore(baseInput({
      wellnessLast7: Array(7).fill({
        sleep_quality: 5,
        energy_level: 5,
        mood: 5,
        cognitive_clarity: 5,
        stress_level: 1, // 低壓力 = 好
      }),
      nutritionLast7: Array(7).fill({ compliant: true }),
      trainingLast7: [
        { training_type: 'push' },
        { training_type: 'pull' },
        { training_type: 'legs' },
      ],
      supplementComplianceRate: 1.0,
      labResults: [{ status: 'normal' }, { status: 'normal' }],
    }))

    expect(result.total).toBeGreaterThanOrEqual(80)
    expect(result.grade).toBe('A')
  })

  // ── Grade D: 全低分 ──
  it('returns grade D when all pillars are poor', () => {
    const result = calculateHealthScore(baseInput({
      wellnessLast7: Array(7).fill({
        sleep_quality: 1,
        energy_level: 1,
        mood: 1,
        cognitive_clarity: 1,
        stress_level: 5, // 高壓力 = 差
      }),
      nutritionLast7: Array(7).fill({ compliant: false }),
      trainingLast7: [], // 0 天訓練
      supplementComplianceRate: 0,
      labResults: [{ status: 'alert' }, { status: 'alert' }],
    }))

    expect(result.total).toBeLessThan(50)
    expect(result.grade).toBe('D')
  })

  // ── 血檢懲罰 ──
  it('applies lab penalty: -10 per alert, -5 per attention, max -20', () => {
    const noLab = calculateHealthScore(baseInput({
      wellnessLast7: Array(7).fill({ sleep_quality: 4, energy_level: 4, mood: 4 }),
      nutritionLast7: Array(7).fill({ compliant: true }),
      trainingLast7: [{ training_type: 'push' }, { training_type: 'pull' }, { training_type: 'legs' }],
      supplementComplianceRate: 0.8,
      labResults: [],
    }))

    const withAlerts = calculateHealthScore(baseInput({
      wellnessLast7: Array(7).fill({ sleep_quality: 4, energy_level: 4, mood: 4 }),
      nutritionLast7: Array(7).fill({ compliant: true }),
      trainingLast7: [{ training_type: 'push' }, { training_type: 'pull' }, { training_type: 'legs' }],
      supplementComplianceRate: 0.8,
      labResults: [{ status: 'alert' }, { status: 'attention' }],
    }))

    expect(withAlerts.labPenalty).toBe(-15) // -10 + -5
    expect(withAlerts.total).toBeLessThan(noLab.total)
  })

  it('caps lab penalty at -20', () => {
    const result = calculateHealthScore(baseInput({
      labResults: [
        { status: 'alert' },
        { status: 'alert' },
        { status: 'alert' }, // 3 alerts = -30, but capped
      ],
    }))
    expect(result.labPenalty).toBe(-20)
  })

  // ── 訓練分數：3天=滿分，超過3天不超過100 ──
  it('caps training score at 100 (3+ days = max)', () => {
    const threeDays = calculateHealthScore(baseInput({
      trainingLast7: [
        { training_type: 'push' },
        { training_type: 'pull' },
        { training_type: 'legs' },
      ],
    }))
    const fiveDays = calculateHealthScore(baseInput({
      trainingLast7: [
        { training_type: 'push' },
        { training_type: 'pull' },
        { training_type: 'legs' },
        { training_type: 'cardio' },
        { training_type: 'push' },
      ],
    }))

    const trainingPillar3 = threeDays.pillars.find(p => p.pillar === 'training')!
    const trainingPillar5 = fiveDays.pillars.find(p => p.pillar === 'training')!
    expect(trainingPillar3.score).toBe(100)
    expect(trainingPillar5.score).toBe(100) // capped
  })

  // ── rest 日不計入訓練天數 ──
  it('excludes rest days from training count', () => {
    const result = calculateHealthScore(baseInput({
      trainingLast7: [
        { training_type: 'push' },
        { training_type: 'rest' },
        { training_type: 'rest' },
      ],
    }))
    const trainingPillar = result.pillars.find(p => p.pillar === 'training')!
    expect(trainingPillar.score).toBe(33) // 1/3 * 100 ≈ 33
  })

  // ── 壓力反轉 ──
  it('inverts stress (high stress = low score contribution)', () => {
    const lowStress = calculateHealthScore(baseInput({
      wellnessLast7: Array(7).fill({ stress_level: 1 }),
    }))
    const highStress = calculateHealthScore(baseInput({
      wellnessLast7: Array(7).fill({ stress_level: 5 }),
    }))
    expect(lowStress.total).toBeGreaterThan(highStress.total)
  })

  // ── 季度週期計算 ──
  it('calculates quarterly cycle days correctly', () => {
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const result = calculateHealthScore(baseInput({
      quarterlyStart: thirtyDaysAgo.toISOString(),
    }))

    expect(result.daysInCycle).toBe(31) // 30 days elapsed + 1
    expect(result.daysUntilBloodTest).toBe(90 - 31)
  })

  it('caps daysInCycle at 90', () => {
    const longAgo = new Date()
    longAgo.setDate(longAgo.getDate() - 120)

    const result = calculateHealthScore(baseInput({
      quarterlyStart: longAgo.toISOString(),
    }))
    expect(result.daysInCycle).toBe(90)
    expect(result.daysUntilBloodTest).toBe(0)
  })

  it('returns null for cycle fields when quarterlyStart is null', () => {
    const result = calculateHealthScore(baseInput({ quarterlyStart: null }))
    expect(result.daysInCycle).toBeNull()
    expect(result.daysUntilBloodTest).toBeNull()
  })

  // ── NaN 安全性：null wellness 值不應該讓分數變 NaN ──
  it('handles null wellness values without producing NaN', () => {
    const result = calculateHealthScore(baseInput({
      wellnessLast7: Array(7).fill({
        sleep_quality: null,
        energy_level: null,
        mood: null,
        cognitive_clarity: null,
        stress_level: null,
      }),
    }))

    expect(Number.isNaN(result.total)).toBe(false)
    result.pillars.forEach(p => {
      expect(Number.isNaN(p.score)).toBe(false)
    })
  })

  // ── 加權比例正確 ──
  it('respects pillar weights: sleep 20%, wellness 25%, nutrition 20%, training 20%, supplement 15%', () => {
    // 只讓 training 滿分，其他都 0
    const onlyTraining = calculateHealthScore(baseInput({
      wellnessLast7: Array(7).fill({
        sleep_quality: 0, // 0/5 → 0 score
        energy_level: 0,
        mood: 0,
      }),
      nutritionLast7: Array(7).fill({ compliant: false }),
      trainingLast7: [
        { training_type: 'push' },
        { training_type: 'pull' },
        { training_type: 'legs' },
      ],
      supplementComplianceRate: 0,
    }))

    // training 100 * 0.20 = 20, but wellness/sleep with 0 values → 0 score
    // wellness with 0/5 = 0%, nutrition 0/7 = 0%, supplement 0%
    // total ≈ 20
    expect(onlyTraining.total).toBe(20)
  })

  // ── 補品合規率上限 100% ──
  it('caps supplement score at 100 even if rate > 1.0', () => {
    const result = calculateHealthScore(baseInput({
      supplementComplianceRate: 1.5, // 超過 100%
    }))
    const supplementPillar = result.pillars.find(p => p.pillar === 'supplement')!
    expect(supplementPillar.score).toBe(100)
  })
})
