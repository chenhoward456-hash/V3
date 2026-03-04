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
