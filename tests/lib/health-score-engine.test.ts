import { describe, it, expect } from 'vitest'
import { calculateHealthScore, type HealthScoreInput } from '@/lib/health-score-engine'

describe('calculateHealthScore', () => {
  it('should return a score between 0-100', () => {
    const input: HealthScoreInput = {
      wellnessLast7: [
        { sleep_quality: 4, energy_level: 4, mood: 4 },
        { sleep_quality: 3, energy_level: 3, mood: 3 },
        { sleep_quality: 4, energy_level: 4, mood: 4 },
      ],
      nutritionLast7: [
        { compliant: true },
        { compliant: true },
        { compliant: false },
      ],
      trainingLast7: [
        { training_type: 'strength' },
        { training_type: 'strength' },
        { training_type: 'rest' },
      ],
      supplementComplianceRate: 0.8,
      labResults: [
        { status: 'normal' },
        { status: 'normal' },
        { status: 'attention' },
      ],
    }

    const result = calculateHealthScore(input)

    expect(result.total).toBeGreaterThanOrEqual(0)
    expect(result.total).toBeLessThanOrEqual(100)
    expect(result.grade).toMatch(/^[ABCD]$/)
    expect(result.pillars.length).toBeGreaterThan(0)
  })

  it('should give higher score for better wellness', () => {
    const goodInput: HealthScoreInput = {
      wellnessLast7: Array(7).fill({ sleep_quality: 5, energy_level: 5, mood: 5 }),
      nutritionLast7: Array(7).fill({ compliant: true }),
      trainingLast7: Array(5).fill({ training_type: 'strength' }),
      supplementComplianceRate: 1.0,
      labResults: Array(5).fill({ status: 'normal' }),
    }

    const badInput: HealthScoreInput = {
      wellnessLast7: Array(7).fill({ sleep_quality: 1, energy_level: 1, mood: 1 }),
      nutritionLast7: Array(7).fill({ compliant: false }),
      trainingLast7: [{ training_type: 'rest' }],
      supplementComplianceRate: 0.1,
      labResults: Array(5).fill({ status: 'alert' }),
    }

    const goodResult = calculateHealthScore(goodInput)
    const badResult = calculateHealthScore(badInput)

    expect(goodResult.total).toBeGreaterThan(badResult.total)
  })

  it('should apply lab penalty for alert status', () => {
    const withAlerts: HealthScoreInput = {
      wellnessLast7: [{ sleep_quality: 4, energy_level: 4, mood: 4 }],
      nutritionLast7: [{ compliant: true }],
      trainingLast7: [{ training_type: 'strength' }],
      supplementComplianceRate: 0.8,
      labResults: Array(5).fill({ status: 'alert' }),
    }

    const result = calculateHealthScore(withAlerts)
    expect(result.labPenalty).toBeLessThan(0)
  })

  it('should grade correctly: A >= 80', () => {
    const input: HealthScoreInput = {
      wellnessLast7: Array(7).fill({ sleep_quality: 5, energy_level: 5, mood: 5 }),
      nutritionLast7: Array(7).fill({ compliant: true }),
      trainingLast7: Array(5).fill({ training_type: 'strength' }),
      supplementComplianceRate: 1.0,
      labResults: Array(5).fill({ status: 'normal' }),
    }

    const result = calculateHealthScore(input)
    if (result.total >= 80) {
      expect(result.grade).toBe('A')
    }
  })

  it('should integrate wearable sleep score into sleep pillar', () => {
    // 只有穿戴裝置睡眠分數，沒有主觀睡眠
    const wearableOnly: HealthScoreInput = {
      wellnessLast7: Array(7).fill({
        sleep_quality: null,
        energy_level: 4,
        mood: 4,
        wearable_sleep_score: 85,
        device_recovery_score: 75,
      }),
      nutritionLast7: Array(7).fill({ compliant: true }),
      trainingLast7: Array(3).fill({ training_type: 'strength' }),
      supplementComplianceRate: 0.8,
      labResults: [{ status: 'normal' }],
    }

    const result = calculateHealthScore(wearableOnly)
    const sleepPillar = result.pillars.find(p => p.pillar === 'sleep')!
    expect(sleepPillar.score).toBe(85) // 直接用裝置分數
    expect(sleepPillar.detail).toContain('裝置')
  })

  it('should blend wearable and subjective sleep when both exist', () => {
    const both: HealthScoreInput = {
      wellnessLast7: Array(7).fill({
        sleep_quality: 5, // = 100/100
        energy_level: 4,
        mood: 4,
        wearable_sleep_score: 60, // 60/100
      }),
      nutritionLast7: Array(7).fill({ compliant: true }),
      trainingLast7: Array(3).fill({ training_type: 'strength' }),
      supplementComplianceRate: 0.8,
      labResults: [],
    }

    const result = calculateHealthScore(both)
    const sleepPillar = result.pillars.find(p => p.pillar === 'sleep')!
    // 60 * 0.6 + 100 * 0.4 = 36 + 40 = 76
    expect(sleepPillar.score).toBe(76)
  })

  it('should integrate device recovery score into wellness pillar', () => {
    const withRecovery: HealthScoreInput = {
      wellnessLast7: Array(7).fill({
        sleep_quality: 4,
        energy_level: 4,
        mood: 4,
        device_recovery_score: 30, // 差
      }),
      nutritionLast7: Array(7).fill({ compliant: true }),
      trainingLast7: Array(3).fill({ training_type: 'strength' }),
      supplementComplianceRate: 0.8,
      labResults: [],
    }

    const withoutRecovery: HealthScoreInput = {
      ...withRecovery,
      wellnessLast7: Array(7).fill({
        sleep_quality: 4,
        energy_level: 4,
        mood: 4,
      }),
    }

    const withResult = calculateHealthScore(withRecovery)
    const withoutResult = calculateHealthScore(withoutRecovery)
    // 裝置恢復分數 30 會拉低 wellness pillar
    expect(withResult.pillars.find(p => p.pillar === 'wellness')!.score)
      .toBeLessThan(withoutResult.pillars.find(p => p.pillar === 'wellness')!.score)
  })

  it('should handle empty inputs gracefully', () => {
    const input: HealthScoreInput = {
      wellnessLast7: [],
      nutritionLast7: [],
      trainingLast7: [],
      supplementComplianceRate: 0,
      labResults: [],
    }

    const result = calculateHealthScore(input)
    expect(result.total).toBeGreaterThanOrEqual(0)
    expect(result.pillars).toBeInstanceOf(Array)
  })
})
