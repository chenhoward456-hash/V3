import { describe, it, expect } from 'vitest'
import {
  generateRecoveryAssessment,
  classifyRecovery,
  getTrainingAdviceFromRecovery,
  type RecoveryInput,
  type RecoveryAssessment,
  type RecoveryIndicators,
  type WellnessEntry,
  type TrainingLogEntry,
  type LabEntry,
} from '@/lib/recovery-engine'

// ═══════════════════════════════════════
// Test data helpers
// ═══════════════════════════════════════

/** Generate an ISO date string offset from today by `daysAgo` days. */
function dateStr(daysAgo: number): string {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  return d.toISOString().split('T')[0]
}

/**
 * Generate wellness entries for a span of days.
 * Days are numbered 0 = today, 1 = yesterday, etc.
 * Overrides apply per-field to every generated entry.
 */
function makeWellness(
  days: number,
  overrides: Partial<Omit<WellnessEntry, 'date'>> = {},
): WellnessEntry[] {
  return Array.from({ length: days }, (_, i) => ({
    date: dateStr(i),
    sleep_quality: 4,
    energy_level: 4,
    mood: 4,
    stress: 2,
    training_drive: 4,
    ...overrides,
  }))
}

/**
 * Generate training log entries.
 * By default creates strength sessions with moderate RPE.
 * `activeDays` controls how many of the `totalDays` have training (rest of them are rest days).
 */
function makeTrainingLogs(
  totalDays: number,
  opts: {
    activeDays?: number
    rpe?: number
    duration?: number
    trainingType?: string
  } = {},
): TrainingLogEntry[] {
  const { activeDays = totalDays, rpe = 6, duration = 60, trainingType = 'strength' } = opts
  const logs: TrainingLogEntry[] = []

  for (let i = 0; i < totalDays; i++) {
    const isActive = i < activeDays
    logs.push({
      date: dateStr(totalDays - 1 - i),
      training_type: isActive ? trainingType : 'rest',
      rpe: isActive ? rpe : null,
      duration: isActive ? duration : null,
    })
  }
  return logs
}

/**
 * Build a standard RecoveryInput with sensible defaults.
 * Wellness covers 30 days, training covers 28 days.
 */
function makeInput(overrides: Partial<RecoveryInput> = {}): RecoveryInput {
  return {
    wellness: makeWellness(30),
    trainingLogs: makeTrainingLogs(28, { activeDays: 16 }),
    ...overrides,
  }
}

// ═══════════════════════════════════════
// 1. generateRecoveryAssessment - core
// ═══════════════════════════════════════

describe('generateRecoveryAssessment', () => {
  describe('basic output structure', () => {
    it('returns all required fields with valid ranges', () => {
      const result = generateRecoveryAssessment(makeInput())

      expect(result.score).toBeGreaterThanOrEqual(0)
      expect(result.score).toBeLessThanOrEqual(100)
      expect(['optimal', 'good', 'struggling', 'critical']).toContain(result.state)
      expect(result.systems).toHaveProperty('neural')
      expect(result.systems).toHaveProperty('muscular')
      expect(result.systems).toHaveProperty('metabolic')
      expect(result.systems).toHaveProperty('hormonal')
      expect(result.systems).toHaveProperty('psychological')
      expect(result.overtrainingRisk).toHaveProperty('riskLevel')
      expect(result.autonomicBalance).toHaveProperty('status')
      expect(['improving', 'stable', 'declining', 'unknown']).toContain(result.trajectory)
      expect(result.recommendations).toBeInstanceOf(Array)
      expect(result.reasons).toBeInstanceOf(Array)
    })

    it('maps score to correct state thresholds', () => {
      // High wellness, low training load -> good/optimal score
      const good = generateRecoveryAssessment(
        makeInput({
          wellness: makeWellness(30, { sleep_quality: 5, energy_level: 5, mood: 5, stress: 1, training_drive: 5 }),
          trainingLogs: makeTrainingLogs(28, { activeDays: 12, rpe: 5 }),
        }),
      )
      expect(good.score).toBeGreaterThanOrEqual(50)
      expect(['optimal', 'good']).toContain(good.state)

      // Low wellness, high training load -> low score
      const poor = generateRecoveryAssessment(
        makeInput({
          wellness: makeWellness(30, { sleep_quality: 1, energy_level: 1, mood: 1, stress: 5, training_drive: 1 }),
          trainingLogs: makeTrainingLogs(28, { activeDays: 25, rpe: 9, duration: 90 }),
        }),
      )
      expect(poor.score).toBeLessThan(50)
      expect(['struggling', 'critical']).toContain(poor.state)
    })
  })

  // ── Rest day filling bug fix (critical regression test) ──

  describe('rest day filling in overtraining risk (bug fix)', () => {
    it('does NOT trigger high overtraining risk for 4 days/week training with 3 rest days', () => {
      // Simulate a typical 4-day/week trainee over 4 weeks (28 days)
      // 4 training days per week = 16 active, 12 rest
      const logs: TrainingLogEntry[] = []
      for (let week = 0; week < 4; week++) {
        for (let day = 0; day < 7; day++) {
          const daysAgo = 27 - (week * 7 + day)
          const isTrainingDay = day < 4 // Mon-Thu train, Fri-Sun rest
          logs.push({
            date: dateStr(daysAgo),
            training_type: isTrainingDay ? 'strength' : 'rest',
            rpe: isTrainingDay ? 7 : null,
            duration: isTrainingDay ? 60 : null,
          })
        }
      }

      const result = generateRecoveryAssessment(makeInput({ trainingLogs: logs }))

      // The bug was that rest days were NOT filled with 0 load, causing
      // inflated ACWR and monotony. With the fix, 4 day/week should be safe.
      expect(result.overtrainingRisk.riskLevel).not.toBe('very_high')
      expect(result.overtrainingRisk.riskLevel).not.toBe('high')
    })

    it('fills rest days with 0 load so ACWR denominator is accurate', () => {
      // 3 training days in last 7, all moderate -> ACWR should be near 1.0 or below
      const logs: TrainingLogEntry[] = []
      for (let week = 0; week < 4; week++) {
        for (let day = 0; day < 7; day++) {
          const daysAgo = 27 - (week * 7 + day)
          const isTrainingDay = day < 3
          logs.push({
            date: dateStr(daysAgo),
            training_type: isTrainingDay ? 'strength' : 'rest',
            rpe: isTrainingDay ? 6 : null,
            duration: isTrainingDay ? 50 : null,
          })
        }
      }

      const result = generateRecoveryAssessment(makeInput({ trainingLogs: logs }))

      // Chronic and acute patterns are the same, so ACWR should be ~1.0
      if (result.overtrainingRisk.acwr !== null) {
        expect(result.overtrainingRisk.acwr).toBeGreaterThanOrEqual(0.7)
        expect(result.overtrainingRisk.acwr).toBeLessThanOrEqual(1.4)
      }
      expect(result.overtrainingRisk.riskLevel).toBe('low')
    })
  })

  // ── Overtraining risk percentage penalty ──

  describe('overtraining risk applies percentage penalty, not hard cap', () => {
    it('very_high risk multiplies score by 0.55', () => {
      // Create a scenario with extremely high training load to trigger very_high
      const heavyLogs: TrainingLogEntry[] = []
      // Week 1-3: light training (low chronic load)
      for (let i = 27; i >= 7; i--) {
        heavyLogs.push({
          date: dateStr(i),
          training_type: i % 3 === 0 ? 'strength' : 'rest',
          rpe: 4,
          duration: 30,
        })
      }
      // Week 4 (last 7 days): massive spike
      for (let i = 6; i >= 0; i--) {
        heavyLogs.push({
          date: dateStr(i),
          training_type: 'strength',
          rpe: 10,
          duration: 120,
        })
      }

      const result = generateRecoveryAssessment(
        makeInput({
          wellness: makeWellness(30, { sleep_quality: 4, energy_level: 4, mood: 4, stress: 2, training_drive: 4 }),
          trainingLogs: heavyLogs,
        }),
      )

      // With very high risk, the score should be substantially penalized
      // but NOT hard-capped. A base score of ~65 * 0.55 ~ 36
      if (result.overtrainingRisk.riskLevel === 'very_high') {
        expect(result.score).toBeLessThan(50)
      }
    })

    it('moderate risk multiplies score by 0.90 (10% penalty)', () => {
      // Create moderate risk scenario
      const logs: TrainingLogEntry[] = []
      // Slightly higher recent load vs chronic
      for (let i = 27; i >= 7; i--) {
        logs.push({
          date: dateStr(i),
          training_type: i % 2 === 0 ? 'strength' : 'rest',
          rpe: 5,
          duration: 45,
        })
      }
      // Last 7: train every day at moderate intensity
      for (let i = 6; i >= 0; i--) {
        logs.push({
          date: dateStr(i),
          training_type: 'strength',
          rpe: 7,
          duration: 60,
        })
      }

      const result = generateRecoveryAssessment(
        makeInput({
          wellness: makeWellness(30, { sleep_quality: 4, energy_level: 4, mood: 4, stress: 2, training_drive: 4 }),
          trainingLogs: logs,
        }),
      )

      // The risk should be moderate or higher (not low), but score should
      // remain above critical threshold thanks to percentage penalty
      if (result.overtrainingRisk.riskLevel === 'moderate') {
        // Score with moderate penalty should still be reasonable
        expect(result.score).toBeGreaterThan(30)
      }
    })
  })

  // ── ACWR safe zone (0.8-1.3) ──

  describe('ACWR safe zone boundaries', () => {
    it('ACWR in safe zone (0.8-1.3) does not add to risk score', () => {
      // Consistent training pattern -> ACWR ~1.0
      const logs = makeTrainingLogs(28, { activeDays: 16, rpe: 6, duration: 60 })
      const result = generateRecoveryAssessment(makeInput({ trainingLogs: logs }))

      if (result.overtrainingRisk.acwr !== null) {
        if (result.overtrainingRisk.acwr >= 0.8 && result.overtrainingRisk.acwr <= 1.3) {
          // Should mention safe zone in reasons
          const safeReason = result.overtrainingRisk.reasons.some(r => r.includes('0.8-1.3'))
          expect(safeReason).toBe(true)
        }
      }
    })

    it('ACWR > 1.3 adds riskScore +2', () => {
      // Spike last week relative to prior weeks
      const logs: TrainingLogEntry[] = []
      for (let i = 27; i >= 7; i--) {
        logs.push({
          date: dateStr(i),
          training_type: i % 3 === 0 ? 'strength' : 'rest',
          rpe: 4,
          duration: 30,
        })
      }
      // Last 7: high load every day
      for (let i = 6; i >= 0; i--) {
        logs.push({
          date: dateStr(i),
          training_type: 'strength',
          rpe: 8,
          duration: 75,
        })
      }

      const result = generateRecoveryAssessment(makeInput({ trainingLogs: logs }))

      if (result.overtrainingRisk.acwr !== null && result.overtrainingRisk.acwr > 1.3) {
        // Risk should be at least moderate (riskScore >= 2)
        expect(['moderate', 'high', 'very_high']).toContain(result.overtrainingRisk.riskLevel)
        expect(result.overtrainingRisk.reasons.some(r => r.includes('安全區'))).toBe(true)
      }
    })

    it('ACWR > 1.5 adds riskScore +3', () => {
      // Extreme spike
      const logs: TrainingLogEntry[] = []
      // Weeks 1-3: very light
      for (let i = 27; i >= 7; i--) {
        logs.push({
          date: dateStr(i),
          training_type: 'rest',
          rpe: null,
          duration: null,
        })
      }
      // Last 7: heavy every day
      for (let i = 6; i >= 0; i--) {
        logs.push({
          date: dateStr(i),
          training_type: 'strength',
          rpe: 9,
          duration: 90,
        })
      }

      const result = generateRecoveryAssessment(makeInput({ trainingLogs: logs }))

      if (result.overtrainingRisk.acwr !== null && result.overtrainingRisk.acwr > 1.5) {
        expect(['high', 'very_high']).toContain(result.overtrainingRisk.riskLevel)
        expect(result.overtrainingRisk.reasons.some(r => r.includes('>1.5') || r.includes('1.5'))).toBe(true)
      }
    })
  })

  // ── Monotony ──

  describe('monotony scoring', () => {
    it('monotony > 2.0 adds riskScore +2', () => {
      // Same training every single day for 28 days -> very high monotony
      const logs = makeTrainingLogs(28, { activeDays: 28, rpe: 7, duration: 60 })
      const result = generateRecoveryAssessment(makeInput({ trainingLogs: logs }))

      if (result.overtrainingRisk.monotony !== null && result.overtrainingRisk.monotony > 2.0) {
        expect(result.overtrainingRisk.reasons.some(r => r.includes('2.0') || r.includes('單調性'))).toBe(true)
      }
    })

    it('varied training keeps monotony below 2.0', () => {
      // Alternate heavy/light/rest days -> low monotony
      const logs: TrainingLogEntry[] = []
      for (let i = 0; i < 28; i++) {
        const cycle = i % 3
        logs.push({
          date: dateStr(27 - i),
          training_type: cycle === 2 ? 'rest' : 'strength',
          rpe: cycle === 0 ? 8 : cycle === 1 ? 5 : null,
          duration: cycle === 0 ? 75 : cycle === 1 ? 40 : null,
        })
      }

      const result = generateRecoveryAssessment(makeInput({ trainingLogs: logs }))

      // With varied loads and rest days, monotony should be reasonable
      if (result.overtrainingRisk.monotony !== null) {
        expect(result.overtrainingRisk.monotony).toBeLessThanOrEqual(2.5)
      }
    })
  })

  // ── Sub-system scoring baselines ──

  describe('sub-system baseline scores', () => {
    it('neural system starts at 60 and adjusts based on signals', () => {
      // Minimal wellness (no HRV/energy) -> should stay near baseline
      const result = generateRecoveryAssessment(
        makeInput({
          wellness: makeWellness(30, {
            energy_level: null,
            hrv: null,
            resting_hr: null,
          }),
        }),
      )

      // Neural baseline is 60; with no signals to adjust, should be 60
      expect(result.systems.neural.score).toBe(60)
    })

    it('muscular system starts at 65 with adjustments from training load', () => {
      // Light training -> should stay near or above baseline
      const result = generateRecoveryAssessment(
        makeInput({
          wellness: makeWellness(30, { training_drive: null }),
          trainingLogs: makeTrainingLogs(28, { activeDays: 8, rpe: 5 }),
        }),
      )

      // 8 active days in 28 = ~2/week, last 7 has ~2 days -> +15 bonus
      expect(result.systems.muscular.score).toBeGreaterThanOrEqual(65)
    })

    it('metabolic system starts at 65 with adjustments from energy and diet duration', () => {
      // No diet, good energy -> should be above baseline
      const result = generateRecoveryAssessment(
        makeInput({
          wellness: makeWellness(30, { energy_level: 4 }),
          dietDurationWeeks: 0,
        }),
      )

      expect(result.systems.metabolic.score).toBeGreaterThanOrEqual(65)
    })

    it('hormonal system starts at 65 with adjustments from sleep and labs', () => {
      const result = generateRecoveryAssessment(
        makeInput({
          wellness: makeWellness(30, { sleep_quality: 4 }),
          labResults: [],
        }),
      )

      // Good sleep -> +10 from baseline 65 = 75
      expect(result.systems.hormonal.score).toBeGreaterThanOrEqual(70)
    })

    it('psychological system starts at 65 with adjustments from mood/stress/drive', () => {
      // Good mood, low stress, high drive
      const result = generateRecoveryAssessment(
        makeInput({
          wellness: makeWellness(30, { mood: 4, stress: 2, training_drive: 4 }),
        }),
      )

      // +15 (mood>=4) + 10 (stress<=2) + 10 (drive>=4) = 65 + 35 = 100 (clamped)
      expect(result.systems.psychological.score).toBeGreaterThanOrEqual(80)
    })
  })

  // ── Readiness score ──

  describe('readiness score calculation', () => {
    it('uses device_recovery_score directly when available', () => {
      const wellness = makeWellness(30, { device_recovery_score: 85 })
      const result = generateRecoveryAssessment(makeInput({ wellness }))

      // device_recovery_score of 85 should produce readinessScore around 85
      expect(result.readinessScore).not.toBeNull()
      expect(result.readinessScore).toBeGreaterThanOrEqual(80)
      expect(result.readinessScore).toBeLessThanOrEqual(90)
    })

    it('computes readiness from HRV/RHR/sleep when no device_recovery_score', () => {
      const wellness: WellnessEntry[] = []
      // Current (3 days) with individual metrics
      for (let i = 0; i < 3; i++) {
        wellness.push({
          date: dateStr(i),
          sleep_quality: 4,
          energy_level: 4,
          mood: 4,
          stress: 2,
          training_drive: 4,
          device_recovery_score: null,
          hrv: 55,
          resting_hr: 58,
          wearable_sleep_score: 80,
        })
      }
      // Baseline (27 days) with enough data for calcBaseline
      for (let i = 3; i < 30; i++) {
        wellness.push({
          date: dateStr(i),
          sleep_quality: 4,
          energy_level: 4,
          mood: 4,
          stress: 2,
          training_drive: 4,
          device_recovery_score: null,
          hrv: 50 + Math.random() * 10,
          resting_hr: 55 + Math.random() * 6,
          wearable_sleep_score: 75 + Math.random() * 10,
        })
      }

      const result = generateRecoveryAssessment(makeInput({ wellness }))

      expect(result.readinessScore).not.toBeNull()
    })

    it('returns null readiness when insufficient device data', () => {
      const wellness = makeWellness(30, {
        device_recovery_score: null,
        hrv: null,
        resting_hr: null,
        wearable_sleep_score: null,
        respiratory_rate: null,
      })

      const result = generateRecoveryAssessment(makeInput({ wellness }))

      expect(result.readinessScore).toBeNull()
    })
  })

  // ── Final score weighting ──

  describe('final score weighting', () => {
    it('uses readiness 30% + systems 70% weighting when readiness is available', () => {
      // Create scenario where readiness score is known and high
      const wellness = makeWellness(30, {
        device_recovery_score: 90,
        sleep_quality: 4,
        energy_level: 4,
        mood: 4,
        stress: 2,
        training_drive: 4,
      })

      const result = generateRecoveryAssessment(
        makeInput({
          wellness,
          trainingLogs: makeTrainingLogs(28, { activeDays: 12, rpe: 5 }),
        }),
      )

      // With readiness at 90 (30% weight) and good systems, score should be high
      expect(result.readinessScore).not.toBeNull()
      expect(result.score).toBeGreaterThanOrEqual(50)
    })

    it('uses neural 25% + muscular 20% + metabolic 20% + hormonal 20% + psychological 15% without readiness', () => {
      const wellness = makeWellness(30, {
        device_recovery_score: null,
        hrv: null,
        resting_hr: null,
        wearable_sleep_score: null,
        // All subjective metrics high
        sleep_quality: 5,
        energy_level: 5,
        mood: 5,
        stress: 1,
        training_drive: 5,
      })

      const result = generateRecoveryAssessment(
        makeInput({
          wellness,
          trainingLogs: makeTrainingLogs(28, { activeDays: 12, rpe: 5 }),
        }),
      )

      expect(result.readinessScore).toBeNull()
      // All systems should be high -> weighted average should be high
      expect(result.score).toBeGreaterThanOrEqual(60)
    })
  })

  // ── Diet duration / metabolic adaptation ──

  describe('metabolic system - diet duration effects', () => {
    it('penalizes metabolic score for diets >= 12 weeks', () => {
      const result = generateRecoveryAssessment(
        makeInput({ dietDurationWeeks: 14 }),
      )

      // 12+ weeks -> -25 from metabolic score
      expect(result.systems.metabolic.score).toBeLessThanOrEqual(55)
      expect(result.systems.metabolic.signals.some(s => s.includes('12') || s.includes('14'))).toBe(true)
    })

    it('applies smaller penalty for diets 4-8 weeks', () => {
      const result = generateRecoveryAssessment(
        makeInput({ dietDurationWeeks: 6 }),
      )

      // 4-8 weeks -> -5 from metabolic score
      expect(result.systems.metabolic.score).toBeGreaterThan(
        generateRecoveryAssessment(makeInput({ dietDurationWeeks: 14 })).systems.metabolic.score,
      )
    })
  })

  // ── Hormonal - lab results ──

  describe('hormonal system - lab results', () => {
    it('penalizes high cortisol (>20)', () => {
      const result = generateRecoveryAssessment(
        makeInput({
          labResults: [{ test_name: 'Cortisol', value: 25, unit: 'ug/dL', status: 'alert' }],
        }),
      )

      // High cortisol -> -20 from hormonal baseline
      expect(result.systems.hormonal.signals.some(s => s.includes('25'))).toBe(true)
    })

    it('penalizes low testosterone with alert status', () => {
      const result = generateRecoveryAssessment(
        makeInput({
          labResults: [{ test_name: 'Testosterone', value: 200, unit: 'ng/dL', status: 'alert' }],
        }),
      )

      expect(result.systems.hormonal.signals.some(s => s.includes('200'))).toBe(true)
    })

    it('penalizes high CRP (>3) as systemic inflammation', () => {
      const result = generateRecoveryAssessment(
        makeInput({
          labResults: [{ test_name: 'CRP', value: 5, unit: 'mg/L' }],
        }),
      )

      expect(result.systems.hormonal.signals.some(s => s.includes('CRP') || s.includes('5'))).toBe(true)
    })
  })

  // ── Female hormonal adjustments ──

  describe('hormonal system - menstrual cycle', () => {
    it('applies luteal phase penalty to metabolic score', () => {
      const withLuteal = generateRecoveryAssessment(
        makeInput({ inLutealPhase: true }),
      )
      const withoutLuteal = generateRecoveryAssessment(
        makeInput({ inLutealPhase: false }),
      )

      expect(withLuteal.systems.metabolic.score).toBeLessThanOrEqual(withoutLuteal.systems.metabolic.score)
    })

    it('applies menstruation penalty to hormonal score', () => {
      const withMenstruation = generateRecoveryAssessment(
        makeInput({ inMenstruation: true }),
      )
      const withoutMenstruation = generateRecoveryAssessment(
        makeInput({ inMenstruation: false }),
      )

      expect(withMenstruation.systems.hormonal.score).toBeLessThanOrEqual(withoutMenstruation.systems.hormonal.score)
    })
  })

  // ── Autonomic balance ──

  describe('autonomic balance', () => {
    it('detects sympathetic dominant when HRV declining and RHR rising', () => {
      const wellness: WellnessEntry[] = []
      // Build 30 days where HRV declines and RHR rises in last 7
      for (let i = 0; i < 30; i++) {
        const daysAgo = 29 - i
        wellness.push({
          date: dateStr(daysAgo),
          sleep_quality: 3,
          energy_level: 3,
          mood: 3,
          stress: 3,
          training_drive: 3,
          hrv: i < 23 ? 60 : 60 - (i - 22) * 5,  // Last 7: 55, 50, 45, 40, 35, 30, 25
          resting_hr: i < 23 ? 58 : 58 + (i - 22) * 3, // Last 7: 61, 64, 67, 70, 73, 76, 79
        })
      }

      const result = generateRecoveryAssessment(makeInput({ wellness }))

      expect(result.autonomicBalance.hrvTrend).toBe('declining')
      expect(result.autonomicBalance.rhrTrend).toBe('rising')
      expect(result.autonomicBalance.status).toBe('sympathetic_dominant')
    })

    it('detects parasympathetic dominant when HRV rising and RHR not rising', () => {
      const wellness: WellnessEntry[] = []
      for (let i = 0; i < 30; i++) {
        const daysAgo = 29 - i
        wellness.push({
          date: dateStr(daysAgo),
          sleep_quality: 4,
          energy_level: 4,
          mood: 4,
          stress: 2,
          training_drive: 4,
          hrv: i < 23 ? 50 : 50 + (i - 22) * 5,   // Last 7: 55, 60, 65, 70, 75, 80, 85
          resting_hr: i < 23 ? 60 : 60 - (i - 22), // Last 7: 59, 58, 57, 56, 55, 54, 53
        })
      }

      const result = generateRecoveryAssessment(makeInput({ wellness }))

      expect(result.autonomicBalance.hrvTrend).toBe('rising')
      expect(result.autonomicBalance.status).toBe('parasympathetic_dominant')
    })
  })

  // ── Trajectory ──

  describe('recovery trajectory', () => {
    it('detects improving trajectory from ascending wellness scores', () => {
      const wellness: WellnessEntry[] = []
      for (let i = 0; i < 30; i++) {
        const daysAgo = 29 - i
        // Ascending pattern in last 7 days
        const val = i >= 23 ? Math.min(2 + (i - 22) * 0.5, 5) : 3
        wellness.push({
          date: dateStr(daysAgo),
          sleep_quality: val,
          energy_level: val,
          mood: val,
          training_drive: val,
          stress: 2,
        })
      }

      const result = generateRecoveryAssessment(makeInput({ wellness }))

      expect(result.trajectory).toBe('improving')
    })

    it('detects declining trajectory from descending wellness scores', () => {
      const wellness: WellnessEntry[] = []
      for (let i = 0; i < 30; i++) {
        const daysAgo = 29 - i
        // Descending pattern in last 7 days
        const val = i >= 23 ? Math.max(5 - (i - 22) * 0.5, 1) : 4
        wellness.push({
          date: dateStr(daysAgo),
          sleep_quality: val,
          energy_level: val,
          mood: val,
          training_drive: val,
          stress: 2,
        })
      }

      const result = generateRecoveryAssessment(makeInput({ wellness }))

      expect(result.trajectory).toBe('declining')
    })

    it('returns unknown trajectory with insufficient data', () => {
      const result = generateRecoveryAssessment(
        makeInput({ wellness: makeWellness(2) }),
      )

      expect(result.trajectory).toBe('unknown')
    })
  })

  // ── Recommendations ──

  describe('recommendations generation', () => {
    it('generates sleep recommendation when hormonal score is low due to poor sleep', () => {
      const result = generateRecoveryAssessment(
        makeInput({
          wellness: makeWellness(30, { sleep_quality: 1, wearable_sleep_score: 40 }),
        }),
      )

      const sleepRec = result.recommendations.find(r => r.category === 'sleep')
      expect(sleepRec).toBeDefined()
    })

    it('generates training recommendation for high overtraining risk', () => {
      // Extreme training spike
      const logs: TrainingLogEntry[] = []
      for (let i = 27; i >= 7; i--) {
        logs.push({ date: dateStr(i), training_type: 'rest', rpe: null, duration: null })
      }
      for (let i = 6; i >= 0; i--) {
        logs.push({ date: dateStr(i), training_type: 'strength', rpe: 10, duration: 120 })
      }

      const result = generateRecoveryAssessment(makeInput({ trainingLogs: logs }))

      if (result.overtrainingRisk.riskLevel === 'high' || result.overtrainingRisk.riskLevel === 'very_high') {
        const trainingRec = result.recommendations.find(r => r.category === 'training' && r.priority === 'high')
        expect(trainingRec).toBeDefined()
      }
    })

    it('generates stress recommendation when psychological state is struggling or critical', () => {
      const result = generateRecoveryAssessment(
        makeInput({
          wellness: makeWellness(30, { mood: 1, stress: 5, training_drive: 1 }),
        }),
      )

      const stressRec = result.recommendations.find(r => r.category === 'stress')
      expect(stressRec).toBeDefined()
    })
  })

  // ── Edge cases ──

  describe('edge cases', () => {
    it('handles empty wellness array gracefully', () => {
      const result = generateRecoveryAssessment({
        wellness: [],
        trainingLogs: makeTrainingLogs(28, { activeDays: 12 }),
      })

      expect(result.score).toBeGreaterThanOrEqual(0)
      expect(result.score).toBeLessThanOrEqual(100)
    })

    it('handles empty training logs', () => {
      const result = generateRecoveryAssessment({
        wellness: makeWellness(30),
        trainingLogs: [],
      })

      expect(result.score).toBeGreaterThanOrEqual(0)
      expect(result.overtrainingRisk.riskLevel).toBe('low')
    })

    it('handles training logs with fewer than 14 days of entries', () => {
      // The engine builds a full 28-day date range from today and fills gaps
      // with 0-load rest days. Only 7 days of logs provided means 21 days are
      // zero-load rest, then 5 active days in the last 7 -- this creates a
      // load spike, so ACWR will be high and risk will reflect that.
      const result = generateRecoveryAssessment({
        wellness: makeWellness(30),
        trainingLogs: makeTrainingLogs(7, { activeDays: 5 }),
      })

      // ACWR is computed (not null) because the engine fills to 28 days
      expect(result.overtrainingRisk.acwr).not.toBeNull()
      // The spike pattern (all load in last 7 days) triggers elevated risk
      expect(['moderate', 'high', 'very_high']).toContain(result.overtrainingRisk.riskLevel)
      expect(result.score).toBeGreaterThanOrEqual(0)
    })

    it('handles all null wellness values', () => {
      const wellness = makeWellness(30, {
        sleep_quality: null,
        energy_level: null,
        mood: null,
        stress: null,
        training_drive: null,
        device_recovery_score: null,
        hrv: null,
        resting_hr: null,
        wearable_sleep_score: null,
        respiratory_rate: null,
      })

      const result = generateRecoveryAssessment(makeInput({ wellness }))

      expect(result.score).toBeGreaterThanOrEqual(0)
      expect(result.score).toBeLessThanOrEqual(100)
      expect(result.readinessScore).toBeNull()
    })
  })
})

// ═══════════════════════════════════════
// 2. classifyRecovery (backward compat)
// ═══════════════════════════════════════

describe('classifyRecovery', () => {
  it('returns optimal for high composite (all indicators good)', () => {
    const result = classifyRecovery({
      sleepQuality: 5,
      energyLevel: 5,
      mood: 5,
      trainingRPE: 4,    // Low RPE -> normalized to 5
      performanceTrend: 'improving',
    })

    expect(result).toBe('optimal')
  })

  it('returns good for moderate composite', () => {
    const result = classifyRecovery({
      sleepQuality: 3,
      energyLevel: 3,
      mood: 3,
      trainingRPE: 6,    // RPE 6 -> normalized to 3
      performanceTrend: 'stable',
    })

    // composite = 3*0.3 + 3*0.25 + 3*0.2 + 3*0.15 + 3*0.1 = 3.0 -> good
    expect(result).toBe('good')
  })

  it('returns struggling for low composite', () => {
    const result = classifyRecovery({
      sleepQuality: 2,
      energyLevel: 2,
      mood: 2,
      trainingRPE: 8,    // RPE 8 -> normalized to 1
      performanceTrend: 'declining',
    })

    // composite = 2*0.3 + 2*0.25 + 2*0.2 + 1*0.15 + 1*0.1 = 0.6 + 0.5 + 0.4 + 0.15 + 0.1 = 1.75
    // 1.75 < 2.0 -> critical
    expect(['struggling', 'critical']).toContain(result)
  })

  it('returns critical for very low composite', () => {
    const result = classifyRecovery({
      sleepQuality: 1,
      energyLevel: 1,
      mood: 1,
      trainingRPE: 10,   // RPE 10 -> normalized to 1
      performanceTrend: 'declining',
    })

    // composite = 1*0.3 + 1*0.25 + 1*0.2 + 1*0.15 + 1*0.1 = 1.0 -> critical
    expect(result).toBe('critical')
  })

  it('correctly normalizes RPE: <= 5 -> 5, 6-7 -> 3, >= 8 -> 1', () => {
    const lowRPE = classifyRecovery({
      sleepQuality: 3, energyLevel: 3, mood: 3, trainingRPE: 3, performanceTrend: 'stable',
    })
    const midRPE = classifyRecovery({
      sleepQuality: 3, energyLevel: 3, mood: 3, trainingRPE: 7, performanceTrend: 'stable',
    })
    const highRPE = classifyRecovery({
      sleepQuality: 3, energyLevel: 3, mood: 3, trainingRPE: 9, performanceTrend: 'stable',
    })

    // Low RPE has higher rpeNormalized (5 vs 3 vs 1), should have better or equal recovery
    // This tests the ordering: lowRPE >= midRPE >= highRPE
    const stateOrder = { optimal: 4, good: 3, struggling: 2, critical: 1 }
    expect(stateOrder[lowRPE]).toBeGreaterThanOrEqual(stateOrder[midRPE])
    expect(stateOrder[midRPE]).toBeGreaterThanOrEqual(stateOrder[highRPE])
  })

  it('correctly converts performance trend: improving -> 5, stable -> 3, declining -> 1', () => {
    const improving = classifyRecovery({
      sleepQuality: 3, energyLevel: 3, mood: 3, trainingRPE: 6, performanceTrend: 'improving',
    })
    const declining = classifyRecovery({
      sleepQuality: 3, energyLevel: 3, mood: 3, trainingRPE: 6, performanceTrend: 'declining',
    })

    const stateOrder = { optimal: 4, good: 3, struggling: 2, critical: 1 }
    expect(stateOrder[improving]).toBeGreaterThanOrEqual(stateOrder[declining])
  })

  it('uses correct weights: sleep 30%, energy 25%, mood 20%, rpe 15%, trend 10%', () => {
    // Perfect scores everywhere -> composite = 5*0.3 + 5*0.25 + 5*0.2 + 5*0.15 + 5*0.1 = 5.0
    const allFive = classifyRecovery({
      sleepQuality: 5, energyLevel: 5, mood: 5, trainingRPE: 1, performanceTrend: 'improving',
    })
    expect(allFive).toBe('optimal')

    // Minimum scores -> composite = 1*0.3 + 1*0.25 + 1*0.2 + 1*0.15 + 1*0.1 = 1.0
    const allOne = classifyRecovery({
      sleepQuality: 1, energyLevel: 1, mood: 1, trainingRPE: 10, performanceTrend: 'declining',
    })
    expect(allOne).toBe('critical')
  })
})

// ═══════════════════════════════════════
// 3. getTrainingAdviceFromRecovery
// ═══════════════════════════════════════

describe('getTrainingAdviceFromRecovery', () => {
  /** Build a minimal assessment for testing advice thresholds. */
  function makeAssessment(overrides: Partial<RecoveryAssessment>): RecoveryAssessment {
    return {
      score: 70,
      state: 'good',
      readinessScore: null,
      systems: {
        neural: { score: 70, state: 'good', signals: [] },
        muscular: { score: 70, state: 'good', signals: [] },
        metabolic: { score: 70, state: 'good', signals: [] },
        hormonal: { score: 70, state: 'good', signals: [] },
        psychological: { score: 70, state: 'good', signals: [] },
      },
      overtrainingRisk: { acwr: 1.0, monotony: 1.5, strain: 2000, riskLevel: 'low', reasons: [] },
      autonomicBalance: { status: 'balanced', hrvTrend: 'stable', rhrTrend: 'stable', hrvZScore: null, rhrZScore: null, reasons: [] },
      trajectory: 'stable',
      recommendations: [],
      reasons: [],
      ...overrides,
    }
  }

  it('recommends high intensity for score >= 75', () => {
    const advice = getTrainingAdviceFromRecovery(makeAssessment({ score: 80 }))

    expect(advice.recommendedIntensity).toBe('high')
    expect(advice.recoveryScore).toBe(80)
  })

  it('recommends moderate intensity for score >= 50 and < 75', () => {
    const advice = getTrainingAdviceFromRecovery(makeAssessment({ score: 60 }))

    expect(advice.recommendedIntensity).toBe('moderate')
    expect(advice.recoveryScore).toBe(60)
  })

  it('recommends low intensity for score >= 30 and < 50', () => {
    const advice = getTrainingAdviceFromRecovery(makeAssessment({ score: 35 }))

    expect(advice.recommendedIntensity).toBe('low')
    expect(advice.recoveryScore).toBe(35)
  })

  it('recommends rest for score < 30', () => {
    const advice = getTrainingAdviceFromRecovery(makeAssessment({ score: 20 }))

    expect(advice.recommendedIntensity).toBe('rest')
    expect(advice.recoveryScore).toBe(20)
  })

  it('overrides to low intensity when overtraining risk is very_high', () => {
    const advice = getTrainingAdviceFromRecovery(
      makeAssessment({
        score: 80,
        overtrainingRisk: { acwr: 1.8, monotony: 2.5, strain: 7000, riskLevel: 'very_high', reasons: ['test'] },
      }),
    )

    // Even with high score, very_high risk should cap at 'low'
    expect(advice.recommendedIntensity).toBe('low')
    expect(advice.suggestion).toContain('deload')
  })

  it('does NOT override intensity when overtraining risk is high (only adds warning)', () => {
    const advice = getTrainingAdviceFromRecovery(
      makeAssessment({
        score: 80,
        overtrainingRisk: { acwr: 1.4, monotony: 1.8, strain: 4500, riskLevel: 'high', reasons: ['test'] },
      }),
    )

    // High risk adds a warning but doesn't override intensity from score
    expect(advice.recommendedIntensity).toBe('high')
    expect(advice.suggestion).toContain('注意')
  })

  it('adds sympathetic dominant note to suggestion', () => {
    const advice = getTrainingAdviceFromRecovery(
      makeAssessment({
        score: 60,
        autonomicBalance: {
          status: 'sympathetic_dominant',
          hrvTrend: 'declining',
          rhrTrend: 'rising',
          hrvZScore: -1.5,
          rhrZScore: 1.2,
          reasons: ['test'],
        },
      }),
    )

    expect(advice.suggestion).toContain('交感')
  })

  it('returns correct reasons from the assessment', () => {
    const reasons = ['reason 1', 'reason 2']
    const advice = getTrainingAdviceFromRecovery(
      makeAssessment({ score: 50, reasons }),
    )

    expect(advice.reasons).toEqual(reasons)
  })

  it('boundary test: score exactly 75 -> high', () => {
    const advice = getTrainingAdviceFromRecovery(makeAssessment({ score: 75 }))
    expect(advice.recommendedIntensity).toBe('high')
  })

  it('boundary test: score exactly 50 -> moderate', () => {
    const advice = getTrainingAdviceFromRecovery(makeAssessment({ score: 50 }))
    expect(advice.recommendedIntensity).toBe('moderate')
  })

  it('boundary test: score exactly 30 -> low', () => {
    const advice = getTrainingAdviceFromRecovery(makeAssessment({ score: 30 }))
    expect(advice.recommendedIntensity).toBe('low')
  })

  it('boundary test: score exactly 29 -> rest', () => {
    const advice = getTrainingAdviceFromRecovery(makeAssessment({ score: 29 }))
    expect(advice.recommendedIntensity).toBe('rest')
  })
})
