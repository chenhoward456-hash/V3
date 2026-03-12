import { describe, it, expect } from 'vitest'
import {
  calcRecommendedStageWeight,
  type RecommendedStageWeightResult,
} from '@/lib/stage-weight'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Shorthand for rounding to 1 decimal, matching the source's rounding logic */
function r1(n: number): number {
  return Math.round(n * 10) / 10
}

// ---------------------------------------------------------------------------
// Male competition mode
// ---------------------------------------------------------------------------

describe('calcRecommendedStageWeight — male competition', () => {
  it('80kg male at 15% BF: correct FFM, targets, and recommendations', () => {
    const result = calcRecommendedStageWeight(80, 15, '男性', undefined, true)

    // FFM = 80 * (1 - 0.15) = 68.0
    expect(result.ffm).toBe(68)
    expect(result.fatMass).toBe(12)

    // Male competition targets: 4-6%
    expect(result.targetBFLow).toBe(4)
    expect(result.targetBFHigh).toBe(6)

    // recommendedLow = 68 / (1 - 0.06) = 68 / 0.94 = 72.3404... -> 72.3
    expect(result.recommendedLow).toBe(r1(68 / 0.94))

    // recommendedHigh = 68 / (1 - 0.04) = 68 / 0.96 = 70.8333... -> 70.8
    expect(result.recommendedHigh).toBe(r1(68 / 0.96))

    // mid = (72.3 + 70.8) / 2 = 71.55 (using actual rounded values)
    // Actually: mid = (recommendedLow + recommendedHigh) / 2
    const mid = (result.recommendedLow + result.recommendedHigh) / 2
    // fatToLose = 80 - mid
    expect(result.fatToLose).toBe(r1(80 - mid))

    expect(result.currentBF).toBe(15)
    expect(result.currentWeight).toBe(80)
    expect(result.mode).toBe('competition')
  })

  it('competition mode is the default when isCompetition is not specified', () => {
    const result = calcRecommendedStageWeight(80, 15, '男性')
    expect(result.mode).toBe('competition')
    expect(result.targetBFLow).toBe(4)
    expect(result.targetBFHigh).toBe(6)
  })
})

// ---------------------------------------------------------------------------
// Female competition mode
// ---------------------------------------------------------------------------

describe('calcRecommendedStageWeight — female competition', () => {
  it('55kg female at 22% BF: correct FFM and female competition targets', () => {
    const result = calcRecommendedStageWeight(55, 22, '女性', undefined, true)

    // FFM = 55 * (1 - 0.22) = 55 * 0.78 = 42.9
    expect(result.ffm).toBe(42.9)

    // fatMass = 55 - 42.9 = 12.1
    expect(result.fatMass).toBe(12.1)

    // Female competition targets: 10-14%
    expect(result.targetBFLow).toBe(10)
    expect(result.targetBFHigh).toBe(14)

    // recommendedLow = 42.9 / (1 - 0.14) = 42.9 / 0.86 = 49.8837... -> 49.9
    expect(result.recommendedLow).toBe(r1(42.9 / 0.86))

    // recommendedHigh = 42.9 / (1 - 0.10) = 42.9 / 0.90 = 47.6666... -> 47.7
    expect(result.recommendedHigh).toBe(r1(42.9 / 0.90))

    // Weight is above midpoint, so fatToLose should be a positive number
    expect(result.fatToLose).not.toBeNull()
    expect(result.fatToLose!).toBeGreaterThan(0)

    expect(result.mode).toBe('competition')
  })
})

// ---------------------------------------------------------------------------
// Male health mode
// ---------------------------------------------------------------------------

describe('calcRecommendedStageWeight — male health', () => {
  it('85kg male at 20% BF in health mode: correct targets 10-18%', () => {
    const result = calcRecommendedStageWeight(85, 20, '男性', undefined, false)

    // FFM = 85 * (1 - 0.20) = 68.0
    expect(result.ffm).toBe(68)
    expect(result.fatMass).toBe(17)

    // Male health targets: 10-18%
    expect(result.targetBFLow).toBe(10)
    expect(result.targetBFHigh).toBe(18)

    // recommendedLow = 68 / (1 - 0.18) = 68 / 0.82 = 82.9268... -> 82.9
    expect(result.recommendedLow).toBe(r1(68 / 0.82))

    // recommendedHigh = 68 / (1 - 0.10) = 68 / 0.90 = 75.5555... -> 75.6
    expect(result.recommendedHigh).toBe(r1(68 / 0.90))

    expect(result.mode).toBe('health')
  })

  it('male health mode fatToLose is positive when above midpoint', () => {
    const result = calcRecommendedStageWeight(85, 20, '男性', undefined, false)
    const mid = (result.recommendedLow + result.recommendedHigh) / 2

    if (85 > mid) {
      expect(result.fatToLose).not.toBeNull()
      expect(result.fatToLose!).toBeCloseTo(r1(85 - mid), 1)
    } else {
      expect(result.fatToLose).toBeNull()
    }
  })
})

// ---------------------------------------------------------------------------
// Female health mode
// ---------------------------------------------------------------------------

describe('calcRecommendedStageWeight — female health', () => {
  it('65kg female at 28% BF in health mode: targets 18-25%', () => {
    const result = calcRecommendedStageWeight(65, 28, '女性', undefined, false)

    // FFM = 65 * (1 - 0.28) = 65 * 0.72 = 46.8
    expect(result.ffm).toBe(46.8)

    // Female health targets: 18-25%
    expect(result.targetBFLow).toBe(18)
    expect(result.targetBFHigh).toBe(25)

    // recommendedLow = 46.8 / 0.75 = 62.4
    expect(result.recommendedLow).toBe(r1(46.8 / 0.75))

    // recommendedHigh = 46.8 / 0.82 = 57.0731... -> 57.1
    expect(result.recommendedHigh).toBe(r1(46.8 / 0.82))

    expect(result.mode).toBe('health')
  })
})

// ---------------------------------------------------------------------------
// FFMI calculation
// ---------------------------------------------------------------------------

describe('FFMI calculation', () => {
  it('calculates FFMI correctly when height is provided', () => {
    // 80kg, 15% BF, male, 180cm
    const result = calcRecommendedStageWeight(80, 15, '男性', 180, true)

    // FFM = 68
    // FFMI = 68 / (1.80^2) = 68 / 3.24 = 20.9876... -> 21.0
    expect(result.ffmi).not.toBeNull()
    expect(result.ffmi).toBe(r1(68 / (1.80 * 1.80)))
  })

  it('FFMI is null when height is not provided', () => {
    const result = calcRecommendedStageWeight(80, 15, '男性', undefined, true)
    expect(result.ffmi).toBeNull()
  })

  it('FFMI is null when height is null', () => {
    const result = calcRecommendedStageWeight(80, 15, '男性', null, true)
    expect(result.ffmi).toBeNull()
  })

  it('FFMI is null when height is 0', () => {
    const result = calcRecommendedStageWeight(80, 15, '男性', 0, true)
    expect(result.ffmi).toBeNull()
  })

  it('FFMI for female with height', () => {
    // 55kg, 22% BF, female, 165cm
    const result = calcRecommendedStageWeight(55, 22, '女性', 165, true)

    // FFM = 42.9
    // FFMI = 42.9 / (1.65^2) = 42.9 / 2.7225 = 15.755... -> 15.8
    expect(result.ffmi).not.toBeNull()
    expect(result.ffmi).toBe(r1(42.9 / (1.65 * 1.65)))
  })
})

// ---------------------------------------------------------------------------
// fatToLose edge cases
// ---------------------------------------------------------------------------

describe('fatToLose', () => {
  it('is null if current weight is at or below the recommended midpoint', () => {
    // Use a scenario where the person is already very lean
    // Male, 70kg, 5% BF, competition
    // FFM = 70 * 0.95 = 66.5
    // recommendedLow = 66.5 / 0.94 = 70.7446... -> 70.7
    // recommendedHigh = 66.5 / 0.96 = 69.2708... -> 69.3
    // mid = (70.7 + 69.3) / 2 = 70.0
    // 70 <= 70.0, so fatToLose should be null
    const result = calcRecommendedStageWeight(70, 5, '男性', undefined, true)
    expect(result.fatToLose).toBeNull()
  })

  it('is a positive number when weight exceeds midpoint', () => {
    const result = calcRecommendedStageWeight(90, 25, '男性', undefined, true)
    // FFM = 90 * 0.75 = 67.5
    // recommendedLow = 67.5 / 0.94 = 71.8085... -> 71.8
    // recommendedHigh = 67.5 / 0.96 = 70.3125 -> 70.3
    // mid = ~71.05
    // fatToLose = 90 - 71.05 = 18.95 -> r1 = 19.0 (approx)
    expect(result.fatToLose).not.toBeNull()
    expect(result.fatToLose!).toBeGreaterThan(15)
  })

  it('is correctly rounded to 1 decimal place', () => {
    const result = calcRecommendedStageWeight(85, 20, '男性', 175, true)
    if (result.fatToLose !== null) {
      const str = result.fatToLose.toString()
      const parts = str.split('.')
      if (parts.length === 2) {
        expect(parts[1].length).toBeLessThanOrEqual(1)
      }
    }
  })
})

// ---------------------------------------------------------------------------
// Mode label
// ---------------------------------------------------------------------------

describe('mode label', () => {
  it('is "competition" when isCompetition is true', () => {
    const result = calcRecommendedStageWeight(80, 15, '男性', 180, true)
    expect(result.mode).toBe('competition')
  })

  it('is "health" when isCompetition is false', () => {
    const result = calcRecommendedStageWeight(80, 15, '男性', 180, false)
    expect(result.mode).toBe('health')
  })

  it('defaults to "competition" when isCompetition is omitted', () => {
    const result = calcRecommendedStageWeight(80, 15, '男性', 180)
    expect(result.mode).toBe('competition')
  })
})

// ---------------------------------------------------------------------------
// Result shape
// ---------------------------------------------------------------------------

describe('result object shape', () => {
  it('contains all expected properties', () => {
    const result = calcRecommendedStageWeight(80, 15, '男性', 180, true)

    expect(result).toHaveProperty('ffm')
    expect(result).toHaveProperty('ffmi')
    expect(result).toHaveProperty('recommendedLow')
    expect(result).toHaveProperty('recommendedHigh')
    expect(result).toHaveProperty('targetBFLow')
    expect(result).toHaveProperty('targetBFHigh')
    expect(result).toHaveProperty('currentBF')
    expect(result).toHaveProperty('currentWeight')
    expect(result).toHaveProperty('fatMass')
    expect(result).toHaveProperty('fatToLose')
    expect(result).toHaveProperty('mode')
  })

  it('preserves input currentBF and currentWeight', () => {
    const result = calcRecommendedStageWeight(82.5, 18.3, '男性', 175, true)
    expect(result.currentBF).toBe(18.3)
    expect(result.currentWeight).toBe(82.5)
  })
})

// ---------------------------------------------------------------------------
// FFM and fatMass consistency
// ---------------------------------------------------------------------------

describe('FFM and fatMass consistency', () => {
  it('FFM + fatMass equals currentWeight (within rounding)', () => {
    const result = calcRecommendedStageWeight(80, 15, '男性', 180, true)
    expect(result.ffm + result.fatMass).toBeCloseTo(80, 0)
  })

  it('fatMass is weight * bodyFatPct/100 (within rounding)', () => {
    const result = calcRecommendedStageWeight(75, 22, '女性', 160, true)
    expect(result.fatMass).toBeCloseTo(75 * 0.22, 0)
  })
})

// ---------------------------------------------------------------------------
// recommendedLow >= recommendedHigh (counter-intuitive but correct)
// ---------------------------------------------------------------------------

describe('recommended range ordering', () => {
  it('recommendedLow >= recommendedHigh (higher BF target = more total weight)', () => {
    // This is expected because:
    //   recommendedLow = FFM / (1 - targetBFHigh/100)  → higher target BF → more total weight
    //   recommendedHigh = FFM / (1 - targetBFLow/100) → lower target BF → less total weight
    // So "Low" in the naming means the lower-weight recommendation (the leaner one)
    // Actually, targetBFHigh is numerically larger → (1 - targetBFHigh/100) is smaller → FFM / smaller = larger
    // So recommendedLow (using targetBFHigh) > recommendedHigh (using targetBFLow)
    const result = calcRecommendedStageWeight(80, 15, '男性', 180, true)
    expect(result.recommendedLow).toBeGreaterThanOrEqual(result.recommendedHigh)
  })
})

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('edge cases', () => {
  it('handles very low body fat (1%)', () => {
    const result = calcRecommendedStageWeight(70, 1, '男性', 175, true)
    expect(result.ffm).toBe(r1(70 * 0.99))
    expect(result.fatMass).toBe(r1(70 * 0.01))
    // Already very lean, fatToLose should be null
    expect(result.fatToLose).toBeNull()
  })

  it('handles very high body fat (50%)', () => {
    const result = calcRecommendedStageWeight(120, 50, '男性', 175, false)
    expect(result.ffm).toBe(60)
    expect(result.fatMass).toBe(60)
    expect(result.fatToLose).not.toBeNull()
    expect(result.fatToLose!).toBeGreaterThan(40) // needs to lose a lot
  })

  it('handles 0% body fat', () => {
    const result = calcRecommendedStageWeight(70, 0, '男性', 175, true)
    expect(result.ffm).toBe(70)
    expect(result.fatMass).toBe(0)
  })
})
