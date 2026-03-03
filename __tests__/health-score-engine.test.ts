import { describe, it, expect } from 'vitest'
import { calculateHealthScore, type HealthScoreInput } from '../lib/health-score-engine'

// ── Helper: 建立完整輸入 ──
function makeInput(overrides: Partial<HealthScoreInput> = {}): HealthScoreInput {
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

describe('Health Score Engine', () => {
  // ============================================================
  //  1. 無數據 → insufficientData
  // ============================================================
  describe('Insufficient Data', () => {
    it('所有支柱無數據時返回 insufficientData', () => {
      const result = calculateHealthScore(makeInput())
      expect(result.insufficientData).toBe(true)
      expect(result.total).toBeNull()
      expect(result.grade).toBeNull()
      expect(result.scoredPillarCount).toBe(0)
    })

    it('所有支柱的 score 應為 null', () => {
      const result = calculateHealthScore(makeInput())
      for (const pillar of result.pillars) {
        expect(pillar.score).toBeNull()
        expect(pillar.hasData).toBe(false)
      }
    })
  })

  // ============================================================
  //  2. 部分數據 → 動態加權（只計有數據的支柱）
  // ============================================================
  describe('Partial Data — Dynamic Weighting', () => {
    it('只有睡眠數據時，睡眠權重重新正規化為 100%', () => {
      const result = calculateHealthScore(makeInput({
        wellnessLast7: [
          { sleep_quality: 4, energy_level: null, mood: null },
        ],
      }))
      expect(result.insufficientData).toBe(false)
      expect(result.scoredPillarCount).toBe(1)
      // 4/5 × 100 = 80
      expect(result.total).toBe(80)
      expect(result.grade).toBe('A')
    })

    it('只有訓練和飲食數據時，兩者各佔 50%', () => {
      const result = calculateHealthScore(makeInput({
        nutritionLast7: [
          { compliant: true }, { compliant: true }, { compliant: true },
          { compliant: true }, { compliant: true }, { compliant: true },
          { compliant: true },
        ], // 100%
        trainingLast7: [
          { training_type: 'push' }, { training_type: 'pull' }, { training_type: 'legs' },
          { training_type: 'rest' }, { training_type: 'rest' }, { training_type: 'rest' },
          { training_type: 'rest' },
        ], // 3 days = 100%
      }))
      expect(result.insufficientData).toBe(false)
      expect(result.scoredPillarCount).toBe(2)
      // (100 × 0.20 + 100 × 0.20) / 0.40 = 100
      expect(result.total).toBe(100)
    })
  })

  // ============================================================
  //  3. 完整數據 → 正確加權計算
  // ============================================================
  describe('Full Data — Weighted Score', () => {
    it('全部滿分 → 100 分 A 等', () => {
      const result = calculateHealthScore(makeInput({
        wellnessLast7: [
          { sleep_quality: 5, energy_level: 5, mood: 5, cognitive_clarity: 5, stress_level: 1 },
          { sleep_quality: 5, energy_level: 5, mood: 5, cognitive_clarity: 5, stress_level: 1 },
        ],
        nutritionLast7: Array(7).fill({ compliant: true }),
        trainingLast7: [
          { training_type: 'push' }, { training_type: 'pull' }, { training_type: 'legs' },
          { training_type: 'rest' }, { training_type: 'rest' }, { training_type: 'rest' },
          { training_type: 'rest' },
        ],
        supplementComplianceRate: 1.0,
        labResults: [],
      }))
      expect(result.total).toBe(100)
      expect(result.grade).toBe('A')
    })

    it('全部最低分 → D 等', () => {
      const result = calculateHealthScore(makeInput({
        wellnessLast7: [
          { sleep_quality: 1, energy_level: 1, mood: 1, cognitive_clarity: 1, stress_level: 5 },
        ],
        nutritionLast7: Array(7).fill({ compliant: false }),
        trainingLast7: Array(7).fill({ training_type: 'rest' }),
        supplementComplianceRate: 0.1,
      }))
      expect(result.total).toBeLessThan(50)
      expect(result.grade).toBe('D')
    })
  })

  // ============================================================
  //  4. 血檢懲罰
  // ============================================================
  describe('Lab Penalty', () => {
    it('alert 扣 10 分', () => {
      const result = calculateHealthScore(makeInput({
        wellnessLast7: [{ sleep_quality: 5, energy_level: 5, mood: 5 }],
        labResults: [{ status: 'alert' }],
      }))
      expect(result.labPenalty).toBe(-10)
    })

    it('attention 扣 5 分', () => {
      const result = calculateHealthScore(makeInput({
        wellnessLast7: [{ sleep_quality: 5, energy_level: 5, mood: 5 }],
        labResults: [{ status: 'attention' }],
      }))
      expect(result.labPenalty).toBe(-5)
    })

    it('懲罰上限為 -30 分', () => {
      const result = calculateHealthScore(makeInput({
        wellnessLast7: [{ sleep_quality: 5, energy_level: 5, mood: 5 }],
        labResults: [
          { status: 'alert' }, { status: 'alert' }, { status: 'alert' },
          { status: 'alert' }, { status: 'alert' },
        ], // 5 × -10 = -50, capped at -30
      }))
      expect(result.labPenalty).toBe(-30)
    })

    it('normal 不扣分', () => {
      const result = calculateHealthScore(makeInput({
        wellnessLast7: [{ sleep_quality: 5, energy_level: 5, mood: 5 }],
        labResults: [{ status: 'normal' }, { status: 'normal' }],
      }))
      expect(result.labPenalty).toBe(0)
    })
  })

  // ============================================================
  //  5. 血檢時效衰減
  // ============================================================
  describe('Lab Freshness Decay', () => {
    it('超過 180 天的血檢不計入', () => {
      const oldDate = new Date()
      oldDate.setDate(oldDate.getDate() - 200)
      const result = calculateHealthScore(makeInput({
        wellnessLast7: [{ sleep_quality: 5, energy_level: 5, mood: 5 }],
        labResults: [{ status: 'alert', date: oldDate.toISOString() }],
      }))
      expect(result.labPenalty).toBe(0)
    })

    it('90-180 天的血檢懲罰減半', () => {
      const mediumDate = new Date()
      mediumDate.setDate(mediumDate.getDate() - 120)
      const result = calculateHealthScore(makeInput({
        wellnessLast7: [{ sleep_quality: 5, energy_level: 5, mood: 5 }],
        labResults: [{ status: 'alert', date: mediumDate.toISOString() }],
      }))
      expect(result.labPenalty).toBe(-5) // -10 × 0.5 = -5
    })

    it('90 天以內的血檢正常扣分', () => {
      const recentDate = new Date()
      recentDate.setDate(recentDate.getDate() - 30)
      const result = calculateHealthScore(makeInput({
        wellnessLast7: [{ sleep_quality: 5, energy_level: 5, mood: 5 }],
        labResults: [{ status: 'alert', date: recentDate.toISOString() }],
      }))
      expect(result.labPenalty).toBe(-10)
    })

    it('無日期的血檢以全權重計算（向後相容）', () => {
      const result = calculateHealthScore(makeInput({
        wellnessLast7: [{ sleep_quality: 5, energy_level: 5, mood: 5 }],
        labResults: [{ status: 'alert' }], // no date
      }))
      expect(result.labPenalty).toBe(-10)
    })
  })

  // ============================================================
  //  6. 個別支柱計分正確性
  // ============================================================
  describe('Individual Pillar Scores', () => {
    it('睡眠 3/5 → 60 分', () => {
      const result = calculateHealthScore(makeInput({
        wellnessLast7: [
          { sleep_quality: 3, energy_level: null, mood: null },
        ],
      }))
      const sleep = result.pillars.find(p => p.pillar === 'sleep')!
      expect(sleep.score).toBe(60)
      expect(sleep.hasData).toBe(true)
    })

    it('壓力反轉：stress 5 → 貢獻 1 分', () => {
      const result = calculateHealthScore(makeInput({
        wellnessLast7: [
          { sleep_quality: null, energy_level: null, mood: null, stress_level: 5 },
        ],
      }))
      const wellness = result.pillars.find(p => p.pillar === 'wellness')!
      // stress 5 → inverted to 1 → 1/5 × 100 = 20
      expect(wellness.score).toBe(20)
    })

    it('訓練 4 天 → 超過 3 天滿分上限 100', () => {
      const result = calculateHealthScore(makeInput({
        trainingLast7: [
          { training_type: 'push' }, { training_type: 'pull' },
          { training_type: 'legs' }, { training_type: 'cardio' },
          { training_type: 'rest' }, { training_type: 'rest' },
          { training_type: 'rest' },
        ],
      }))
      const training = result.pillars.find(p => p.pillar === 'training')!
      expect(training.score).toBe(100)
    })

    it('補品依從率 0.5 → 50 分', () => {
      const result = calculateHealthScore(makeInput({
        supplementComplianceRate: 0.5,
      }))
      const supplement = result.pillars.find(p => p.pillar === 'supplement')!
      expect(supplement.score).toBe(50)
    })
  })

  // ============================================================
  //  7. 等級邊界
  // ============================================================
  describe('Grade Boundaries', () => {
    it('80 → A', () => {
      // sleep = 4/5 = 80 → total = 80
      const result = calculateHealthScore(makeInput({
        wellnessLast7: [{ sleep_quality: 4, energy_level: null, mood: null }],
      }))
      expect(result.total).toBe(80)
      expect(result.grade).toBe('A')
    })

    it('65 → B', () => {
      // Need a score that rounds to 65
      // sleep = 3.25/5 = 65%
      // Avg of [3, 3, 3, 4] = 3.25 → 65%
      const result = calculateHealthScore(makeInput({
        wellnessLast7: [
          { sleep_quality: 3, energy_level: null, mood: null },
          { sleep_quality: 3, energy_level: null, mood: null },
          { sleep_quality: 3, energy_level: null, mood: null },
          { sleep_quality: 4, energy_level: null, mood: null },
        ],
      }))
      expect(result.total).toBe(65)
      expect(result.grade).toBe('B')
    })
  })

  // ============================================================
  //  8. 季度週期
  // ============================================================
  describe('Quarterly Cycle', () => {
    it('無 quarterlyStart → null', () => {
      const result = calculateHealthScore(makeInput())
      expect(result.daysInCycle).toBeNull()
      expect(result.daysUntilBloodTest).toBeNull()
    })

    it('第 1 天 → daysInCycle=1, daysUntilBloodTest=89', () => {
      const today = new Date().toISOString()
      const result = calculateHealthScore(makeInput({ quarterlyStart: today }))
      expect(result.daysInCycle).toBe(1)
      expect(result.daysUntilBloodTest).toBe(89)
    })
  })

  // ============================================================
  //  9. 總分不超出 0-100
  // ============================================================
  describe('Score Bounds', () => {
    it('大量血檢扣分不會讓總分低於 0', () => {
      const result = calculateHealthScore(makeInput({
        wellnessLast7: [{ sleep_quality: 1, energy_level: 1, mood: 1, stress_level: 5 }],
        nutritionLast7: Array(7).fill({ compliant: false }),
        trainingLast7: Array(7).fill({ training_type: 'rest' }),
        supplementComplianceRate: 0.01,
        labResults: [
          { status: 'alert' }, { status: 'alert' }, { status: 'alert' },
          { status: 'alert' }, { status: 'alert' },
        ],
      }))
      expect(result.total).toBeGreaterThanOrEqual(0)
    })
  })
})
