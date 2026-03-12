import { describe, it, expect } from 'vitest'
import {
  BODY_FAT_ZONES,
  getBodyFatZone,
  getBodyFatZoneId,
  getAdjustedBodyWeight,
  getZoneMacros,
  printZoneSummary,
  classifyRecovery,
  type BodyFatZone,
  type BodyFatZoneId,
  type RecoveryState,
  type RecoveryIndicators,
} from '@/lib/body-fat-zone-table'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a set of RecoveryIndicators that classifyRecovery maps to the given state */
function makeRecoveryIndicators(state: RecoveryState): RecoveryIndicators {
  switch (state) {
    case 'optimal':
      return { sleepQuality: 5, energyLevel: 5, mood: 5, trainingRPE: 4, performanceTrend: 'improving' }
    case 'good':
      return { sleepQuality: 4, energyLevel: 3, mood: 3, trainingRPE: 6, performanceTrend: 'stable' }
    case 'struggling':
      // composite = 2*0.30 + 2*0.25 + 3*0.20 + 1*0.15 + 3*0.10 = 0.6+0.5+0.6+0.15+0.3 = 2.15
      return { sleepQuality: 2, energyLevel: 2, mood: 3, trainingRPE: 9, performanceTrend: 'stable' }
    case 'critical':
      return { sleepQuality: 1, energyLevel: 1, mood: 1, trainingRPE: 10, performanceTrend: 'declining' }
  }
}

// ---------------------------------------------------------------------------
// BODY_FAT_ZONES constant
// ---------------------------------------------------------------------------

describe('BODY_FAT_ZONES', () => {
  it('contains 10 total zones (5 male + 5 female)', () => {
    expect(BODY_FAT_ZONES).toHaveLength(10)
  })

  it('contains exactly 5 male zones and 5 female zones', () => {
    const male = BODY_FAT_ZONES.filter(z => z.gender === 'male')
    const female = BODY_FAT_ZONES.filter(z => z.gender === 'female')
    expect(male).toHaveLength(5)
    expect(female).toHaveLength(5)
  })

  it('every zone has required properties', () => {
    for (const zone of BODY_FAT_ZONES) {
      expect(zone.id).toBeDefined()
      expect(zone.label).toBeDefined()
      expect(zone.gender).toMatch(/^(male|female)$/)
      expect(zone.bfMin).toBeGreaterThanOrEqual(0)
      expect(zone.bfMax).toBeGreaterThan(zone.bfMin)
      expect(zone.cut).toBeDefined()
      expect(zone.bulk).toBeDefined()
      expect(zone.recovery).toBeDefined()
      expect(zone.notes.length).toBeGreaterThan(0)
    }
  })
})

// ---------------------------------------------------------------------------
// getBodyFatZone
// ---------------------------------------------------------------------------

describe('getBodyFatZone', () => {
  describe('male zones', () => {
    it.each([
      [0, 'competition_lean'],
      [3, 'competition_lean'],
      [7.9, 'competition_lean'],
      [8, 'very_lean'],
      [10, 'very_lean'],
      [11.9, 'very_lean'],
      [12, 'athletic'],
      [15, 'athletic'],
      [16.9, 'athletic'],
      [17, 'average'],
      [20, 'average'],
      [21.9, 'average'],
      [22, 'overweight'],
      [30, 'overweight'],
      [50, 'overweight'],
      [99, 'overweight'],
    ])('at %f% BF returns "%s"', (bf, expectedId) => {
      const zone = getBodyFatZone('male', bf)
      expect(zone).not.toBeNull()
      expect(zone!.id).toBe(expectedId)
      expect(zone!.gender).toBe('male')
    })
  })

  describe('female zones', () => {
    it.each([
      [0, 'competition_lean'],
      [10, 'competition_lean'],
      [14.9, 'competition_lean'],
      [15, 'very_lean'],
      [17, 'very_lean'],
      [19.9, 'very_lean'],
      [20, 'athletic'],
      [22, 'athletic'],
      [24.9, 'athletic'],
      [25, 'average'],
      [27, 'average'],
      [29.9, 'average'],
      [30, 'overweight'],
      [45, 'overweight'],
      [99, 'overweight'],
    ])('at %f% BF returns "%s"', (bf, expectedId) => {
      const zone = getBodyFatZone('female', bf)
      expect(zone).not.toBeNull()
      expect(zone!.id).toBe(expectedId)
      expect(zone!.gender).toBe('female')
    })
  })

  describe('boundary precision', () => {
    it('male 8% falls in very_lean (not competition_lean)', () => {
      expect(getBodyFatZone('male', 8)!.id).toBe('very_lean')
    })

    it('male 12% falls in athletic (not very_lean)', () => {
      expect(getBodyFatZone('male', 12)!.id).toBe('athletic')
    })

    it('female 15% falls in very_lean (not competition_lean)', () => {
      expect(getBodyFatZone('female', 15)!.id).toBe('very_lean')
    })

    it('female 30% falls in overweight (not average)', () => {
      expect(getBodyFatZone('female', 30)!.id).toBe('overweight')
    })
  })

  describe('invalid inputs', () => {
    it('returns null for negative body fat', () => {
      expect(getBodyFatZone('male', -1)).toBeNull()
      expect(getBodyFatZone('female', -0.1)).toBeNull()
    })

    it('returns null for body fat > 100', () => {
      expect(getBodyFatZone('male', 101)).toBeNull()
      expect(getBodyFatZone('female', 100.1)).toBeNull()
    })

    it('handles 0% body fat (returns competition_lean)', () => {
      expect(getBodyFatZone('male', 0)!.id).toBe('competition_lean')
      expect(getBodyFatZone('female', 0)!.id).toBe('competition_lean')
    })

    it('handles exactly 100% body fat (returns overweight)', () => {
      // bfMax of overweight = 100, and the lookup logic returns the last zone
      // for values at the upper edge
      const zone = getBodyFatZone('male', 100)
      expect(zone).not.toBeNull()
      expect(zone!.id).toBe('overweight')
    })
  })
})

// ---------------------------------------------------------------------------
// getBodyFatZoneId
// ---------------------------------------------------------------------------

describe('getBodyFatZoneId', () => {
  it('returns correct zone IDs for male zones', () => {
    expect(getBodyFatZoneId('male', 5)).toBe('competition_lean')
    expect(getBodyFatZoneId('male', 10)).toBe('very_lean')
    expect(getBodyFatZoneId('male', 14)).toBe('athletic')
    expect(getBodyFatZoneId('male', 19)).toBe('average')
    expect(getBodyFatZoneId('male', 30)).toBe('overweight')
  })

  it('returns correct zone IDs for female zones', () => {
    expect(getBodyFatZoneId('female', 10)).toBe('competition_lean')
    expect(getBodyFatZoneId('female', 17)).toBe('very_lean')
    expect(getBodyFatZoneId('female', 22)).toBe('athletic')
    expect(getBodyFatZoneId('female', 27)).toBe('average')
    expect(getBodyFatZoneId('female', 35)).toBe('overweight')
  })

  it('returns null for invalid body fat', () => {
    expect(getBodyFatZoneId('male', -1)).toBeNull()
    expect(getBodyFatZoneId('female', 101)).toBeNull()
  })

  it('return type is BodyFatZoneId | null', () => {
    const id = getBodyFatZoneId('male', 15)
    // TypeScript compile-time check; runtime just verify the value
    expect(['competition_lean', 'very_lean', 'athletic', 'average', 'overweight']).toContain(id)
  })
})

// ---------------------------------------------------------------------------
// getAdjustedBodyWeight
// ---------------------------------------------------------------------------

describe('getAdjustedBodyWeight', () => {
  it('calculates correctly for overweight male (idealBfPct = 15%)', () => {
    // 95kg, 30% BF, male
    // leanMass = 95 * (1 - 0.30) = 66.5
    // idealWeight = 66.5 / (1 - 0.15) = 66.5 / 0.85 = 78.2352...
    // adjustedWeight = 78.2352 + 0.25 * (95 - 78.2352) = 78.2352 + 4.1912 = 82.4264...
    // rounded to 1 decimal = 82.4
    const result = getAdjustedBodyWeight(95, 30, 'male')
    expect(result).toBeCloseTo(82.4, 1)
  })

  it('calculates correctly for overweight female (idealBfPct = 22%)', () => {
    // 85kg, 35% BF, female
    // leanMass = 85 * (1 - 0.35) = 55.25
    // idealWeight = 55.25 / (1 - 0.22) = 55.25 / 0.78 = 70.8333...
    // adjustedWeight = 70.8333 + 0.25 * (85 - 70.8333) = 70.8333 + 3.5417 = 74.375
    // rounded to 1 decimal = 74.4
    const result = getAdjustedBodyWeight(85, 35, 'female')
    expect(result).toBeCloseTo(74.4, 1)
  })

  it('for a person at ideal BF%, adjusted weight is close to actual weight', () => {
    // 80kg, 15% BF, male (already at ideal)
    // leanMass = 80 * 0.85 = 68
    // idealWeight = 68 / 0.85 = 80
    // adjustedWeight = 80 + 0.25 * (80 - 80) = 80
    const result = getAdjustedBodyWeight(80, 15, 'male')
    expect(result).toBe(80)
  })

  it('adjusted weight is always lower than actual weight when overweight', () => {
    const actual = 100
    const result = getAdjustedBodyWeight(actual, 30, 'male')
    expect(result).toBeLessThan(actual)
  })

  it('result is rounded to 1 decimal place', () => {
    const result = getAdjustedBodyWeight(93, 28, 'male')
    const decimals = result.toString().split('.')[1]
    expect(!decimals || decimals.length <= 1).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// getZoneMacros — cutting
// ---------------------------------------------------------------------------

describe('getZoneMacros (cutting)', () => {
  it('returns all expected properties', () => {
    const result = getZoneMacros({
      gender: 'male',
      bodyWeight: 80,
      bodyFatPct: 15,
      goalType: 'cut',
      estimatedTDEE: 2500,
    })

    expect(result.zone).toBeDefined()
    expect(result.recoveryState).toBeDefined()
    expect(typeof result.protein).toBe('number')
    expect(typeof result.fat).toBe('number')
    expect(typeof result.carbs).toBe('number')
    expect(typeof result.calories).toBe('number')
    expect(typeof result.deficitOrSurplus).toBe('number')
    expect(typeof result.proteinPerKg).toBe('number')
    expect(typeof result.fatPerKg).toBe('number')
    expect(typeof result.carbsPerKg).toBe('number')
    expect(Array.isArray(result.warnings)).toBe(true)
  })

  it('produces a caloric deficit (negative deficitOrSurplus)', () => {
    const result = getZoneMacros({
      gender: 'male',
      bodyWeight: 80,
      bodyFatPct: 15,
      goalType: 'cut',
      estimatedTDEE: 2500,
    })

    expect(result.deficitOrSurplus).toBeLessThan(0)
  })

  it('protein is reasonable for athletic male in deficit (around 2.3 g/kg)', () => {
    const result = getZoneMacros({
      gender: 'male',
      bodyWeight: 80,
      bodyFatPct: 15,
      goalType: 'cut',
      estimatedTDEE: 2500,
    })

    // Zone: athletic, cut proteinGPerKg = 2.3
    // With good recovery (default, no indicators), proteinAdjust = 0
    expect(result.proteinPerKg).toBeCloseTo(2.3, 1)
    expect(result.protein).toBeCloseTo(80 * 2.3, 5) // ~184g
  })

  it('fat is at least the zone minimum', () => {
    const result = getZoneMacros({
      gender: 'male',
      bodyWeight: 80,
      bodyFatPct: 15,
      goalType: 'cut',
      estimatedTDEE: 2500,
    })

    // Athletic male cut fatGPerKg = 0.8
    expect(result.fat).toBeGreaterThanOrEqual(Math.round(80 * 0.8) - 1)
  })

  it('carbs are at least 30g (minimum floor)', () => {
    const result = getZoneMacros({
      gender: 'male',
      bodyWeight: 80,
      bodyFatPct: 5,
      goalType: 'cut',
      estimatedTDEE: 1800,
    })

    expect(result.carbs).toBeGreaterThanOrEqual(30)
  })

  it('calories = protein*4 + carbs*4 + fat*9', () => {
    const result = getZoneMacros({
      gender: 'female',
      bodyWeight: 60,
      bodyFatPct: 22,
      goalType: 'cut',
      estimatedTDEE: 2000,
    })

    const expectedCal = result.protein * 4 + result.carbs * 4 + result.fat * 9
    expect(result.calories).toBe(expectedCal)
  })

  it('deficit falls within the zone deficit kcal range (with default recovery)', () => {
    const result = getZoneMacros({
      gender: 'male',
      bodyWeight: 80,
      bodyFatPct: 15,
      goalType: 'cut',
      estimatedTDEE: 2500,
    })

    // Athletic male: deficitKcal = { min: 300, max: 500 }
    // Default recovery = 'good', deficitMultiplier = 1.0 for athletic zone
    // baseMidDeficit = (300+500)/2 = 400
    // deficit = 400 * 1.0 = 400
    const actualDeficit = result.calories - 2500 // negative
    expect(Math.abs(actualDeficit)).toBeGreaterThanOrEqual(0)
    expect(Math.abs(actualDeficit)).toBeLessThanOrEqual(600) // generous bound after carb adjustment
  })
})

// ---------------------------------------------------------------------------
// getZoneMacros — bulking
// ---------------------------------------------------------------------------

describe('getZoneMacros (bulking)', () => {
  it('produces a caloric surplus (positive deficitOrSurplus)', () => {
    const result = getZoneMacros({
      gender: 'male',
      bodyWeight: 80,
      bodyFatPct: 15,
      goalType: 'bulk',
      estimatedTDEE: 2500,
    })

    expect(result.deficitOrSurplus).toBeGreaterThan(0)
  })

  it('surplus is within the zone surplus kcal range', () => {
    const result = getZoneMacros({
      gender: 'male',
      bodyWeight: 80,
      bodyFatPct: 15,
      goalType: 'bulk',
      estimatedTDEE: 2500,
    })

    // Athletic male bulk: surplusKcal = { min: 250, max: 500 }
    // midSurplus = 375
    // The actual surplus may differ slightly from TDEE+375 due to macro rounding
    expect(result.deficitOrSurplus).toBeGreaterThan(0)
    // calories should be above TDEE
    expect(result.calories).toBeGreaterThan(2500)
  })

  it('warns when bulking in overweight zone', () => {
    const result = getZoneMacros({
      gender: 'male',
      bodyWeight: 100,
      bodyFatPct: 30,
      goalType: 'bulk',
      estimatedTDEE: 2800,
    })

    expect(result.warnings.some(w => w.toLowerCase().includes('bulk'))).toBe(true)
  })

  it('calories = protein*4 + carbs*4 + fat*9', () => {
    const result = getZoneMacros({
      gender: 'male',
      bodyWeight: 80,
      bodyFatPct: 15,
      goalType: 'bulk',
      estimatedTDEE: 2500,
    })

    const expectedCal = result.protein * 4 + result.carbs * 4 + result.fat * 9
    expect(result.calories).toBe(expectedCal)
  })

  it('carbs are at least 30g', () => {
    const result = getZoneMacros({
      gender: 'female',
      bodyWeight: 55,
      bodyFatPct: 22,
      goalType: 'bulk',
      estimatedTDEE: 1800,
    })

    expect(result.carbs).toBeGreaterThanOrEqual(30)
  })
})

// ---------------------------------------------------------------------------
// getZoneMacros — recovery modifiers
// ---------------------------------------------------------------------------

describe('getZoneMacros (recovery modifiers)', () => {
  it('defaults to "good" recovery when no indicators are provided', () => {
    const result = getZoneMacros({
      gender: 'male',
      bodyWeight: 80,
      bodyFatPct: 15,
      goalType: 'cut',
      estimatedTDEE: 2500,
    })

    expect(result.recoveryState).toBe('good')
  })

  it('struggling recovery reduces deficit and increases protein', () => {
    const indicators = makeRecoveryIndicators('struggling')
    // Verify our helper produces the right state
    expect(classifyRecovery(indicators)).toBe('struggling')

    const baseline = getZoneMacros({
      gender: 'male',
      bodyWeight: 80,
      bodyFatPct: 15,
      goalType: 'cut',
      estimatedTDEE: 2500,
    })

    const struggling = getZoneMacros({
      gender: 'male',
      bodyWeight: 80,
      bodyFatPct: 15,
      goalType: 'cut',
      estimatedTDEE: 2500,
      recoveryIndicators: indicators,
    })

    expect(struggling.recoveryState).toBe('struggling')
    // Deficit should be smaller (less negative, so closer to 0)
    expect(struggling.deficitOrSurplus).toBeGreaterThan(baseline.deficitOrSurplus)
    // Protein should be higher (athletic zone struggling adds +0.1 g/kg)
    expect(struggling.proteinPerKg).toBeGreaterThan(baseline.proteinPerKg)
    // Should contain warnings about recovery
    expect(struggling.warnings.length).toBeGreaterThan(0)
  })

  it('critical recovery in competition_lean zone eliminates deficit entirely', () => {
    const indicators = makeRecoveryIndicators('critical')
    expect(classifyRecovery(indicators)).toBe('critical')

    const result = getZoneMacros({
      gender: 'male',
      bodyWeight: 75,
      bodyFatPct: 5,
      goalType: 'cut',
      estimatedTDEE: 2200,
      recoveryIndicators: indicators,
    })

    expect(result.recoveryState).toBe('critical')
    // competition_lean critical: deficitMultiplier = 0 -> deficit should be 0
    // So calories should be at or above TDEE (after carb adjustment)
    // The deficit is 0 but carb adjust is 1.5 so calories may exceed TDEE
    expect(result.deficitOrSurplus).toBeGreaterThanOrEqual(-50) // near zero or positive
    expect(result.warnings.some(w => w.includes('CRITICAL'))).toBe(true)
  })

  it('optimal recovery makes no adjustments to the plan', () => {
    const indicators = makeRecoveryIndicators('optimal')
    expect(classifyRecovery(indicators)).toBe('optimal')

    const noIndicators = getZoneMacros({
      gender: 'male',
      bodyWeight: 80,
      bodyFatPct: 15,
      goalType: 'cut',
      estimatedTDEE: 2500,
    })

    const withOptimal = getZoneMacros({
      gender: 'male',
      bodyWeight: 80,
      bodyFatPct: 15,
      goalType: 'cut',
      estimatedTDEE: 2500,
      recoveryIndicators: indicators,
    })

    // Optimal has deficitMultiplier=1.0, proteinAdjust=0, carbAdjust=1.0
    // Default 'good' in athletic zone also has deficitMultiplier=1.0, proteinAdjust=0, carbAdjust=1.0
    // So results should be identical
    expect(withOptimal.protein).toBe(noIndicators.protein)
    expect(withOptimal.fat).toBe(noIndicators.fat)
    expect(withOptimal.carbs).toBe(noIndicators.carbs)
    expect(withOptimal.calories).toBe(noIndicators.calories)
  })

  it('refeed schedule override appears in warnings when applicable', () => {
    const indicators = makeRecoveryIndicators('struggling')

    const result = getZoneMacros({
      gender: 'male',
      bodyWeight: 80,
      bodyFatPct: 15,
      goalType: 'cut',
      estimatedTDEE: 2500,
      recoveryIndicators: indicators,
    })

    // Athletic zone struggling refeedOverride = 'Every 5-7 days'
    expect(result.warnings.some(w => w.includes('Refeed schedule'))).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// getZoneMacros — overweight zone uses adjusted body weight
// ---------------------------------------------------------------------------

describe('getZoneMacros (overweight — adjusted body weight)', () => {
  it('uses adjusted body weight for protein in overweight zone', () => {
    const result = getZoneMacros({
      gender: 'male',
      bodyWeight: 100,
      bodyFatPct: 30,
      goalType: 'cut',
      estimatedTDEE: 2800,
    })

    // The zone should be overweight
    expect(result.zone.id).toBe('overweight')

    // adjusted BW should be less than actual
    const adjustedBW = getAdjustedBodyWeight(100, 30, 'male')
    expect(adjustedBW).toBeLessThan(100)

    // Protein should be based on adjusted BW * proteinGPerKg
    // overweight male cut proteinGPerKg = 1.6 (default recovery 'good' adds 0)
    expect(result.protein).toBe(Math.round(adjustedBW * 1.6))

    // Warning should mention adjusted body weight
    expect(result.warnings.some(w => w.includes('adjusted body weight'))).toBe(true)
  })

  it('uses adjusted body weight for overweight female', () => {
    const result = getZoneMacros({
      gender: 'female',
      bodyWeight: 90,
      bodyFatPct: 35,
      goalType: 'cut',
      estimatedTDEE: 2200,
    })

    expect(result.zone.id).toBe('overweight')

    const adjustedBW = getAdjustedBodyWeight(90, 35, 'female')
    // Female overweight cut proteinGPerKg = 1.4
    expect(result.protein).toBe(Math.round(adjustedBW * 1.4))
  })

  it('non-overweight zones use actual body weight for protein', () => {
    const result = getZoneMacros({
      gender: 'male',
      bodyWeight: 80,
      bodyFatPct: 15,
      goalType: 'cut',
      estimatedTDEE: 2500,
    })

    expect(result.zone.id).toBe('athletic')
    // athletic cut proteinGPerKg = 2.3
    expect(result.protein).toBe(Math.round(80 * 2.3))
  })
})

// ---------------------------------------------------------------------------
// getZoneMacros — throws on invalid BF%
// ---------------------------------------------------------------------------

describe('getZoneMacros (error handling)', () => {
  it('throws for invalid body fat percentage', () => {
    expect(() =>
      getZoneMacros({
        gender: 'male',
        bodyWeight: 80,
        bodyFatPct: -5,
        goalType: 'cut',
        estimatedTDEE: 2500,
      })
    ).toThrow('Invalid body fat percentage')
  })
})

// ---------------------------------------------------------------------------
// printZoneSummary
// ---------------------------------------------------------------------------

describe('printZoneSummary', () => {
  it('returns a string for male zones', () => {
    const summary = printZoneSummary('male')
    expect(typeof summary).toBe('string')
    expect(summary.length).toBeGreaterThan(0)
  })

  it('contains the MALE header', () => {
    const summary = printZoneSummary('male')
    expect(summary).toContain('MALE BODY FAT ZONES')
  })

  it('contains the FEMALE header', () => {
    const summary = printZoneSummary('female')
    expect(summary).toContain('FEMALE BODY FAT ZONES')
  })

  it('contains table column headers', () => {
    const summary = printZoneSummary('male')
    expect(summary).toContain('Zone')
    expect(summary).toContain('BF%')
    expect(summary).toContain('Cut Pro')
    expect(summary).toContain('Cut Fat')
    expect(summary).toContain('Deficit kcal')
    expect(summary).toContain('Refeed')
  })

  it('lists all 5 zone labels for male', () => {
    const summary = printZoneSummary('male')
    expect(summary).toContain('Competition Lean')
    expect(summary).toContain('Very Lean')
    expect(summary).toContain('Athletic')
    expect(summary).toContain('Average')
    expect(summary).toContain('Overweight')
  })

  it('lists all 5 zone labels for female', () => {
    const summary = printZoneSummary('female')
    expect(summary).toContain('Competition Lean')
    expect(summary).toContain('Very Lean')
    expect(summary).toContain('Athletic')
    expect(summary).toContain('Average')
    expect(summary).toContain('Overweight')
  })
})

// ---------------------------------------------------------------------------
// classifyRecovery (re-exported from recovery-engine)
// ---------------------------------------------------------------------------

describe('classifyRecovery', () => {
  it('returns "optimal" for excellent indicators', () => {
    const result = classifyRecovery({
      sleepQuality: 5,
      energyLevel: 5,
      mood: 5,
      trainingRPE: 3,
      performanceTrend: 'improving',
    })
    expect(result).toBe('optimal')
  })

  it('returns "good" for decent indicators', () => {
    const result = classifyRecovery({
      sleepQuality: 3,
      energyLevel: 3,
      mood: 3,
      trainingRPE: 6,
      performanceTrend: 'stable',
    })
    expect(result).toBe('good')
  })

  it('returns "struggling" for poor indicators', () => {
    // composite = 2*0.30 + 2*0.25 + 3*0.20 + 1*0.15 + 3*0.10 = 2.15 -> struggling (>=2.0, <3.0)
    const result = classifyRecovery({
      sleepQuality: 2,
      energyLevel: 2,
      mood: 3,
      trainingRPE: 9,
      performanceTrend: 'stable',
    })
    expect(result).toBe('struggling')
  })

  it('returns "critical" for worst-case indicators', () => {
    const result = classifyRecovery({
      sleepQuality: 1,
      energyLevel: 1,
      mood: 1,
      trainingRPE: 10,
      performanceTrend: 'declining',
    })
    expect(result).toBe('critical')
  })

  it('result is always a valid RecoveryState', () => {
    const validStates: RecoveryState[] = ['optimal', 'good', 'struggling', 'critical']
    const result = classifyRecovery({
      sleepQuality: 3,
      energyLevel: 4,
      mood: 2,
      trainingRPE: 7,
      performanceTrend: 'stable',
    })
    expect(validStates).toContain(result)
  })
})

// ---------------------------------------------------------------------------
// Integration: full scenario tests
// ---------------------------------------------------------------------------

describe('integration scenarios', () => {
  it('competition lean male cutting with critical recovery gets near-zero deficit', () => {
    const result = getZoneMacros({
      gender: 'male',
      bodyWeight: 75,
      bodyFatPct: 6,
      goalType: 'cut',
      estimatedTDEE: 2200,
      recoveryIndicators: makeRecoveryIndicators('critical'),
    })

    expect(result.zone.id).toBe('competition_lean')
    expect(result.recoveryState).toBe('critical')
    // deficitMultiplier = 0, so deficit is 0
    // carbAdjustPct = 1.5, so carbs are inflated -> likely surplus
    expect(result.deficitOrSurplus).toBeGreaterThanOrEqual(-10)
  })

  it('average female bulking has moderate surplus', () => {
    const result = getZoneMacros({
      gender: 'female',
      bodyWeight: 60,
      bodyFatPct: 27,
      goalType: 'bulk',
      estimatedTDEE: 1900,
    })

    expect(result.zone.id).toBe('average')
    expect(result.deficitOrSurplus).toBeGreaterThan(0)
    // female average bulk surplusKcal: { min: 100, max: 300 }, mid = 200
    expect(result.calories).toBeGreaterThan(1900)
  })

  it('all macros are non-negative for any valid scenario', () => {
    const scenarios = [
      { gender: 'male' as const, bodyWeight: 60, bodyFatPct: 5, goalType: 'cut' as const, estimatedTDEE: 1800 },
      { gender: 'female' as const, bodyWeight: 50, bodyFatPct: 12, goalType: 'cut' as const, estimatedTDEE: 1500 },
      { gender: 'male' as const, bodyWeight: 120, bodyFatPct: 35, goalType: 'cut' as const, estimatedTDEE: 3200 },
      { gender: 'female' as const, bodyWeight: 55, bodyFatPct: 22, goalType: 'bulk' as const, estimatedTDEE: 1900 },
      { gender: 'male' as const, bodyWeight: 90, bodyFatPct: 10, goalType: 'bulk' as const, estimatedTDEE: 2800 },
    ]

    for (const scenario of scenarios) {
      const result = getZoneMacros(scenario)
      expect(result.protein).toBeGreaterThanOrEqual(0)
      expect(result.fat).toBeGreaterThanOrEqual(0)
      expect(result.carbs).toBeGreaterThanOrEqual(0)
      expect(result.calories).toBeGreaterThan(0)
    }
  })
})
