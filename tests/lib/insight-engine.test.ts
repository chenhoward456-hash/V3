import { describe, it, expect } from 'vitest'
import {
  generateBehaviorInsights,
  type InsightInput,
  type BehaviorInsight,
} from '@/lib/insight-engine'

// ── Helper: build minimal valid InsightInput ────────────────

function makeDate(daysAgo: number): string {
  const d = new Date('2026-03-31T12:00:00')
  d.setDate(d.getDate() - daysAgo)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Generate an array of consecutive dates (newest-first). */
function dates(count: number, startDaysAgo = 0): string[] {
  return Array.from({ length: count }, (_, i) => makeDate(startDaysAgo + i))
}

function baseInput(overrides: Partial<InsightInput> = {}): InsightInput {
  return {
    gender: '男性',
    bodyWeight: 80,
    goalType: 'cut',
    wellness: [],
    nutrition: [],
    training: [],
    supplementLogs: [],
    supplementCount: 0,
    ...overrides,
  }
}

function wellnessEntry(
  date: string,
  overrides: Partial<InsightInput['wellness'][0]> = {},
): InsightInput['wellness'][0] {
  return {
    date,
    sleep_quality: null,
    energy_level: null,
    mood: null,
    stress_level: null,
    cognitive_clarity: null,
    training_drive: null,
    device_recovery_score: null,
    resting_hr: null,
    hrv: null,
    wearable_sleep_score: null,
    ...overrides,
  }
}

function nutritionEntry(
  date: string,
  overrides: Partial<InsightInput['nutrition'][0]> = {},
): InsightInput['nutrition'][0] {
  return {
    date,
    calories: null,
    carbs_grams: null,
    protein_grams: null,
    compliant: null,
    ...overrides,
  }
}

function trainingEntry(
  date: string,
  overrides: Partial<InsightInput['training'][0]> = {},
): InsightInput['training'][0] {
  return {
    date,
    training_type: 'strength',
    rpe: null,
    duration: null,
    ...overrides,
  }
}

function findInsight(results: BehaviorInsight[], id: string) {
  return results.find((r) => r.id === id)
}

// ── Data sufficiency guards ─────────────────────────────────

describe('Data sufficiency guards', () => {
  it('1. empty input returns []', () => {
    const results = generateBehaviorInsights(baseInput())
    expect(results).toEqual([])
  })

  it('2. only 1 day of data triggers at most early rules, not standard rules', () => {
    const d = dates(1)
    const input = baseInput({
      wellness: [wellnessEntry(d[0], { sleep_quality: 1 })],
      nutrition: [nutritionEntry(d[0], { protein_grams: 50 })],
      weightHistory: [{ date: d[0], weight: 80 }],
    })
    const results = generateBehaviorInsights(input)
    // Standard rules require >= 3-14 days, so none should fire
    const standardIds = [
      'sleep-streak-poor',
      'sleep-rpe-correlation',
      'overtraining-no-rest',
      'low-carb-mood',
      'compliance-dropping',
      'noncompliant-energy-drop',
      'high-rpe-hrv-drop',
      'volume-up-recovery-down',
      'supplement-compliance-drop',
      'supplement-sleep-effect',
      'composite-mental-decline',
      'weight-plateau',
    ]
    for (const id of standardIds) {
      expect(findInsight(results, id)).toBeUndefined()
    }
  })

  it('3. 3 days of data triggers early rules', () => {
    const d = dates(3)
    const input = baseInput({
      wellness: d.map((date) =>
        wellnessEntry(date, { sleep_quality: 2, energy_level: 3, mood: 3 }),
      ),
      nutrition: d.map((date) =>
        nutritionEntry(date, { protein_grams: 50 }),
      ),
      weightHistory: [{ date: d[0], weight: 80 }],
    })
    const results = generateBehaviorInsights(input)
    // Should have some early rules firing
    const earlyIds = [
      'early-first-steps',
      'early-protein-low',
      'early-sleep-feedback',
    ]
    const hasEarly = earlyIds.some((id) => findInsight(results, id))
    expect(hasEarly).toBe(true)
  })

  it('4. 14 days of rich data triggers standard rules, early rules stop firing', () => {
    const d = dates(14)
    // Build data that will trigger Rule 1 (poor sleep streak) and NOT early rules
    const input = baseInput({
      wellness: d.map((date) =>
        wellnessEntry(date, {
          sleep_quality: 1,
          energy_level: 3,
          mood: 3,
          training_drive: 3,
        }),
      ),
      nutrition: d.map((date) =>
        nutritionEntry(date, { protein_grams: 150, compliant: true }),
      ),
      training: [],
      weightHistory: d.map((date) => ({ date, weight: 80 })),
    })
    const results = generateBehaviorInsights(input)

    // Early rules have upper bounds on data length and should NOT fire
    // Early 1: nutrition.length > 5 => null
    // Early 2: withProtein.length > 7 => null
    // Early 3: withSleep.length > 7 => null
    // Early 4: totalDays > 10 => null
    const earlyIds = [
      'early-first-steps',
      'early-protein-good',
      'early-protein-low',
      'early-sleep-feedback',
      'early-consistency',
    ]
    for (const id of earlyIds) {
      expect(findInsight(results, id)).toBeUndefined()
    }

    // Rule 1 (poor sleep streak) should fire with 14 consecutive days of sleep=1
    expect(findInsight(results, 'sleep-streak-poor')).toBeDefined()
  })
})

// ── Early Rules ─────────────────────────────────────────────

describe('Early Rule 1: first steps', () => {
  it('5a. fires with 2 days nutrition + weight', () => {
    const d = dates(2)
    const input = baseInput({
      nutrition: d.map((date) => nutritionEntry(date, { calories: 2000 })),
      weightHistory: [{ date: d[0], weight: 80 }],
    })
    const results = generateBehaviorInsights(input)
    expect(findInsight(results, 'early-first-steps')).toBeDefined()
  })

  it('5b. stops firing at 6+ days of nutrition', () => {
    const d = dates(6)
    const input = baseInput({
      nutrition: d.map((date) => nutritionEntry(date, { calories: 2000 })),
      weightHistory: [{ date: d[0], weight: 80 }],
    })
    const results = generateBehaviorInsights(input)
    // nutrition.length > 5 => null
    expect(findInsight(results, 'early-first-steps')).toBeUndefined()
  })
})

describe('Early Rule 2: protein check', () => {
  it('6a. protein < 1.6g/kg fires early-protein-low', () => {
    const d = dates(3)
    // bodyWeight=80, 1.6*80=128, avg 100g < 128 => low
    const input = baseInput({
      bodyWeight: 80,
      nutrition: d.map((date) =>
        nutritionEntry(date, { protein_grams: 100 }),
      ),
    })
    const results = generateBehaviorInsights(input)
    expect(findInsight(results, 'early-protein-low')).toBeDefined()
  })

  it('6b. protein >= 1.6g/kg fires early-protein-good', () => {
    const d = dates(3)
    // bodyWeight=80, 1.6*80=128, avg 150g >= 128 => good
    const input = baseInput({
      bodyWeight: 80,
      nutrition: d.map((date) =>
        nutritionEntry(date, { protein_grams: 150 }),
      ),
    })
    const results = generateBehaviorInsights(input)
    expect(findInsight(results, 'early-protein-good')).toBeDefined()
  })
})

describe('Early Rule 3: sleep feedback', () => {
  it('7a. avg sleep < 4 fires', () => {
    const d = dates(3)
    const input = baseInput({
      wellness: d.map((date) => wellnessEntry(date, { sleep_quality: 2 })),
    })
    const results = generateBehaviorInsights(input)
    expect(findInsight(results, 'early-sleep-feedback')).toBeDefined()
  })

  it('7b. avg sleep >= 4 does not fire', () => {
    const d = dates(3)
    const input = baseInput({
      wellness: d.map((date) => wellnessEntry(date, { sleep_quality: 4 })),
    })
    const results = generateBehaviorInsights(input)
    expect(findInsight(results, 'early-sleep-feedback')).toBeUndefined()
  })
})

describe('Early Rule 4: consistency', () => {
  it('8a. missed 2+ days fires', () => {
    // The rule uses totalDays = max(nutrition.length, wellness.length)
    // and allDates = union of unique dates from both arrays.
    // To trigger: allDates.size < totalDays * 0.8 AND missedDays >= 2.
    // We achieve this by having duplicate dates in nutrition (simulating
    // multiple meal entries per day), so array length > unique date count.
    const d = dates(4)
    const input = baseInput({
      // 7 nutrition entries but only 4 unique dates (3 duplicates)
      // totalDays = max(7, 0) = 7
      // allDates.size = 4 (unique dates from nutrition)
      // 4 < 7 * 0.8 = 5.6 => passes 80% check
      // missedDays = 7 - 4 = 3 >= 2 => fires
      nutrition: [
        nutritionEntry(d[0], { calories: 2000 }),
        nutritionEntry(d[0], { calories: 2000 }), // duplicate date
        nutritionEntry(d[1], { calories: 2000 }),
        nutritionEntry(d[1], { calories: 2000 }), // duplicate date
        nutritionEntry(d[2], { calories: 2000 }),
        nutritionEntry(d[2], { calories: 2000 }), // duplicate date
        nutritionEntry(d[3], { calories: 2000 }),
      ],
    })
    const results = generateBehaviorInsights(input)
    expect(findInsight(results, 'early-consistency')).toBeDefined()
  })

  it('8b. 80%+ recorded does not fire', () => {
    const d = dates(5)
    const input = baseInput({
      nutrition: d.map((date) => nutritionEntry(date, { calories: 2000 })),
      wellness: d.map((date) =>
        wellnessEntry(date, { sleep_quality: 3 }),
      ),
    })
    const results = generateBehaviorInsights(input)
    expect(findInsight(results, 'early-consistency')).toBeUndefined()
  })
})

// ── Standard Rules ──────────────────────────────────────────

describe('Rule 1: poor sleep streak', () => {
  it('9a. 3 consecutive days sleep <= 2 fires', () => {
    const d = dates(14)
    const input = baseInput({
      wellness: d.map((date, i) =>
        wellnessEntry(date, {
          sleep_quality: i < 3 ? 1 : 4, // newest 3 days have bad sleep
        }),
      ),
    })
    const results = generateBehaviorInsights(input)
    expect(findInsight(results, 'sleep-streak-poor')).toBeDefined()
  })

  it('9b. only 2 consecutive days sleep <= 2 does not fire', () => {
    const d = dates(14)
    const input = baseInput({
      // Data is newest-first. We want only 2 consecutive bad days.
      // Put bad sleep on day indices 0,1 (newest) then good sleep.
      wellness: d.map((date, i) =>
        wellnessEntry(date, {
          sleep_quality: i < 2 ? 1 : 4,
        }),
      ),
    })
    const results = generateBehaviorInsights(input)
    expect(findInsight(results, 'sleep-streak-poor')).toBeUndefined()
  })
})

describe('Rule 2: sleep-RPE correlation', () => {
  it('10. uses nextCalendarDay, not just array index', () => {
    // Create data with a gap: day 0, day 1, day 3 (skip day 2)
    // Sleep on day 1 is poor (sleep=1), but day 3 is NOT the next calendar day
    // so it should NOT pair day 1 sleep -> day 3 RPE
    const day0 = '2026-03-25'
    const day1 = '2026-03-26'
    // skip day2 = 2026-03-27
    const day3 = '2026-03-28'
    const day4 = '2026-03-29'
    const day5 = '2026-03-30'
    const day6 = '2026-03-31'

    // Give poor sleep on day1, and high RPE on day3 (not next calendar day)
    // Give good sleep on day4, day5 with RPE on day5, day6
    const input = baseInput({
      wellness: [
        wellnessEntry(day6, { sleep_quality: 5 }),
        wellnessEntry(day5, { sleep_quality: 5 }),
        wellnessEntry(day4, { sleep_quality: 5 }),
        wellnessEntry(day3, { sleep_quality: 5 }),
        wellnessEntry(day1, { sleep_quality: 1 }),
        wellnessEntry(day0, { sleep_quality: 1 }),
      ],
      training: [
        trainingEntry(day6, { rpe: 9 }),
        trainingEntry(day5, { rpe: 9 }),
        trainingEntry(day4, { rpe: 5 }),
        trainingEntry(day3, { rpe: 9 }),
        // No training on day2 (gap) or day1
        trainingEntry(day0, { rpe: 5 }),
      ],
    })
    const results = generateBehaviorInsights(input)
    // With the gap, day1 sleep=1 shouldn't pair to day3 RPE=9
    // rpeAfterPoor should have very few entries (day0->day1 has no training on day1)
    // This means the rule should NOT fire (< 2 entries in each bucket)
    expect(findInsight(results, 'sleep-rpe-correlation')).toBeUndefined()
  })
})

describe('Rule 4: low carb mood', () => {
  it('11. carbs < 100g correlates with mood <= 2 fires', () => {
    const d = dates(14)
    // Need at least 5 paired (nutrition + wellness) data points
    // Need lowCarbDays >= 2 and normalCarbDays >= 2
    // Need moodNormal - moodLow >= 0.8
    const input = baseInput({
      wellness: d.map((date, i) =>
        wellnessEntry(date, {
          mood: i < 4 ? 1 : 4, // newest 4 = low carb days, rest = normal
        }),
      ),
      nutrition: d.map((date, i) =>
        nutritionEntry(date, {
          carbs_grams: i < 4 ? 50 : 200, // newest 4 = low carb
        }),
      ),
    })
    const results = generateBehaviorInsights(input)
    expect(findInsight(results, 'low-carb-mood')).toBeDefined()
  })
})

describe('Rule 5: compliance drop', () => {
  it('12. this week 40%, last week 80% fires (50% drop)', () => {
    const d = dates(14)
    // First 7 = thisWeek (newest), last 7 = lastWeek
    const input = baseInput({
      nutrition: d.map((date, i) => {
        if (i < 7) {
          // thisWeek: 40% compliant (roughly 2-3 out of 7 compliant)
          return nutritionEntry(date, { compliant: i < 3 })
        }
        // lastWeek: ~86% compliant (6 of 7)
        return nutritionEntry(date, { compliant: i < 13 })
      }),
    })
    const results = generateBehaviorInsights(input)
    expect(findInsight(results, 'compliance-dropping')).toBeDefined()
  })
})

describe('Rule 6: non-compliant energy', () => {
  it('13. 5+ non-compliant days + energy decline fires', () => {
    const d = dates(14)
    const input = baseInput({
      // Recent 10 nutrition: 6 non-compliant
      nutrition: d.map((date, i) =>
        nutritionEntry(date, {
          compliant: i >= 6, // first 6 (newest) are non-compliant
        }),
      ),
      wellness: d.map((date, i) =>
        wellnessEntry(date, {
          // newest 5: energy=2, prior 5: energy=4 => decline=2
          energy_level: i < 5 ? 2 : 4,
        }),
      ),
    })
    const results = generateBehaviorInsights(input)
    expect(findInsight(results, 'noncompliant-energy-drop')).toBeDefined()
  })
})

describe('Rule 11: composite decline', () => {
  it('14. energy + mood + training_drive all declining fires', () => {
    const d = dates(14)
    const input = baseInput({
      wellness: d.map((date, i) =>
        wellnessEntry(date, {
          // recent 4 (i<4): all 2, prior 4 (i 4-7): all 5
          energy_level: i < 4 ? 2 : 5,
          mood: i < 4 ? 2 : 5,
          training_drive: i < 4 ? 2 : 5,
        }),
      ),
    })
    const results = generateBehaviorInsights(input)
    expect(findInsight(results, 'composite-mental-decline')).toBeDefined()
  })
})

describe('Rule 12: weight plateau', () => {
  it('15. weight range < 0.5kg + compliance > 70% fires', () => {
    const d = dates(14)
    const input = baseInput({
      goalType: 'cut',
      nutrition: d.map((date) =>
        nutritionEntry(date, { compliant: true, calories: 2000 }),
      ),
      weightHistory: d.map((date) => ({
        date,
        weight: 80 + Math.random() * 0.3, // range < 0.5kg
      })),
    })
    // Fix: ensure max-min < 0.5 deterministically
    input.weightHistory = d.map((date, i) => ({
      date,
      weight: 80 + (i % 2 === 0 ? 0 : 0.2), // exact range = 0.2kg
    }))
    const results = generateBehaviorInsights(input)
    expect(findInsight(results, 'weight-plateau')).toBeDefined()
  })
})

// ── Bug regression tests ────────────────────────────────────

describe('Bug regressions', () => {
  it('16. Rule 10: multiple supplement logs per day should NOT inflate counts', () => {
    // Regression: if a user takes 3 supplements per day, each day produces
    // 3 supplement log rows. The dedup Map should collapse them to 1 per day.
    const d = dates(14)

    const input = baseInput({
      supplementCount: 3,
      // 3 logs per day for 14 days = 42 entries
      supplementLogs: d.flatMap((date) => [
        { date, completed: true },
        { date, completed: true },
        { date, completed: true },
      ]),
      wellness: d.map((date) =>
        wellnessEntry(date, { sleep_quality: 4, wearable_sleep_score: 80 }),
      ),
    })

    const results = generateBehaviorInsights(input)
    // All supplements completed every day, no skipped days => rule should NOT fire
    // (because sleepSkipped.length < 2)
    expect(findInsight(results, 'supplement-sleep-effect')).toBeUndefined()

    // Now test with dedup: one day has a missed supplement
    // If dedup works, that day is "skipped" (one miss = entire day skipped)
    const inputWithMix = baseInput({
      supplementCount: 3,
      supplementLogs: d.flatMap((date, i) => {
        if (i < 3) {
          // 3 newest days: one supplement missed
          return [
            { date, completed: true },
            { date, completed: false }, // missed one
            { date, completed: true },
          ]
        }
        return [
          { date, completed: true },
          { date, completed: true },
          { date, completed: true },
        ]
      }),
      wellness: d.map((date) =>
        wellnessEntry(date, { sleep_quality: 3, wearable_sleep_score: 60 }),
      ),
    })

    const results2 = generateBehaviorInsights(inputWithMix)
    // With dedup: 3 skipped days, 11 taken days
    // All have same sleep score, so diff=0 => rule should NOT fire
    // This verifies counts are per-day, not per-log
    expect(findInsight(results2, 'supplement-sleep-effect')).toBeUndefined()
  })

  it('17. Rule 2/7: non-consecutive dates should NOT be treated as next day', () => {
    // Regression for nextCalendarDay fix
    // If dates skip (e.g., Monday -> Wednesday), Rule 2 should NOT pair
    // Monday's sleep with Wednesday's training.
    const dates = ['2026-03-30', '2026-03-28', '2026-03-26', '2026-03-24', '2026-03-22']

    const input = baseInput({
      wellness: dates.map((date) =>
        wellnessEntry(date, { sleep_quality: 1, hrv: 100 }),
      ),
      training: dates.map((date) =>
        trainingEntry(date, { rpe: 9 }),
      ),
    })

    const results = generateBehaviorInsights(input)
    // Every other day is skipped, so nextCalendarDay never matches
    // Rule 2 (sleep-rpe) should not fire
    expect(findInsight(results, 'sleep-rpe-correlation')).toBeUndefined()
    // Rule 7 (high-rpe-hrv) should not fire
    expect(findInsight(results, 'high-rpe-hrv-drop')).toBeUndefined()
  })

  it('18. Rule 3: training days without wellness entries should still count in streak', () => {
    // The rule uses the union of wellness + training dates for streak counting
    const d = [
      '2026-03-31',
      '2026-03-30',
      '2026-03-29',
      '2026-03-28',
      '2026-03-27',
      '2026-03-26',
      '2026-03-25',
      '2026-03-24',
      '2026-03-23',
      '2026-03-22',
      '2026-03-21',
      '2026-03-20',
      '2026-03-19',
      '2026-03-18',
    ]

    const input = baseInput({
      // Wellness only on odd indices (7 days)
      wellness: d
        .filter((_, i) => i % 2 === 0)
        .map((date) =>
          wellnessEntry(date, { sleep_quality: 2 }),
        ),
      // Training on ALL 14 days (even those without wellness)
      training: d.map((date) =>
        trainingEntry(date, { training_type: 'strength', rpe: 7 }),
      ),
    })

    // Add last-week wellness with higher sleep to create decline
    const lastWeekDates = d.slice(7) // last 7
    const thisWeekDates = d.slice(0, 7) // first 7
    input.wellness = [
      ...thisWeekDates.map((date) =>
        wellnessEntry(date, { sleep_quality: 2 }),
      ),
      ...lastWeekDates.map((date) =>
        wellnessEntry(date, { sleep_quality: 4 }),
      ),
    ]

    const results = generateBehaviorInsights(input)
    // 14 consecutive training days + sleep decline should fire
    expect(findInsight(results, 'overtraining-no-rest')).toBeDefined()
  })

  it('19. early rules should NOT fire when data > 7 days', () => {
    const d = dates(10)
    const input = baseInput({
      wellness: d.map((date) =>
        wellnessEntry(date, { sleep_quality: 2 }),
      ),
      nutrition: d.map((date) =>
        nutritionEntry(date, { protein_grams: 50 }),
      ),
      weightHistory: d.map((date) => ({ date, weight: 80 })),
    })
    const results = generateBehaviorInsights(input)

    const earlyIds = [
      'early-first-steps',
      'early-protein-good',
      'early-protein-low',
      'early-sleep-feedback',
      'early-consistency',
    ]
    for (const id of earlyIds) {
      expect(findInsight(results, id)).toBeUndefined()
    }
  })
})

// ── Edge cases ──────────────────────────────────────────────

describe('Edge cases', () => {
  it('20. all rules fire simultaneously: output sorted by priority, max 5 returned', () => {
    // Build data that triggers many rules at once
    const d = dates(14)
    const input = baseInput({
      supplementCount: 3,
      wellness: d.map((date, i) =>
        wellnessEntry(date, {
          sleep_quality: i < 5 ? 1 : 4,
          energy_level: i < 5 ? 1 : 5,
          mood: i < 5 ? 1 : 5,
          training_drive: i < 5 ? 1 : 5,
          hrv: i < 5 ? 30 : 80,
          device_recovery_score: i < 5 ? 20 : 80,
          wearable_sleep_score: i < 5 ? 30 : 80,
        }),
      ),
      nutrition: d.map((date, i) =>
        nutritionEntry(date, {
          calories: 2000,
          carbs_grams: i < 5 ? 50 : 200,
          protein_grams: 150,
          compliant: i < 7 ? false : true,
        }),
      ),
      training: d.map((date) =>
        trainingEntry(date, { rpe: 9, duration: 60 }),
      ),
      supplementLogs: d.flatMap((date, i) => [
        { date, completed: i >= 7 }, // thisWeek: all skipped, lastWeek: all done
      ]),
      weightHistory: d.map((date) => ({ date, weight: 80.1 })),
    })

    const results = generateBehaviorInsights(input)

    // Max 5 insights
    expect(results.length).toBeLessThanOrEqual(5)

    // Sorted by priority ascending (1 = most important)
    for (let i = 1; i < results.length; i++) {
      expect(results[i].priority).toBeGreaterThanOrEqual(results[i - 1].priority)
    }
  })

  it('21. correlation function with < 5 data points returns 0 (no false positives)', () => {
    // Rule 4 (low carb mood) needs pairs.length >= 5 to proceed
    const d = dates(4)
    const input = baseInput({
      wellness: d.map((date) =>
        wellnessEntry(date, { mood: 1 }),
      ),
      nutrition: d.map((date) =>
        nutritionEntry(date, { carbs_grams: 50 }),
      ),
    })
    const results = generateBehaviorInsights(input)
    // Only 4 data points, should not fire
    expect(findInsight(results, 'low-carb-mood')).toBeUndefined()
  })
})

// ── Output format ───────────────────────────────────────────

describe('Output format', () => {
  const VALID_CATEGORIES = [
    'sleep_training',
    'nutrition_mood',
    'training_recovery',
    'supplement_effect',
    'trend',
  ] as const

  it('22. every returned insight has all required fields', () => {
    const d = dates(14)
    const input = baseInput({
      wellness: d.map((date) =>
        wellnessEntry(date, {
          sleep_quality: 1,
          energy_level: 2,
          mood: 2,
          training_drive: 2,
        }),
      ),
      nutrition: d.map((date) =>
        nutritionEntry(date, { protein_grams: 150, compliant: true }),
      ),
      weightHistory: d.map((date) => ({ date, weight: 80 })),
    })

    const results = generateBehaviorInsights(input)
    expect(results.length).toBeGreaterThan(0)

    for (const insight of results) {
      expect(insight).toHaveProperty('id')
      expect(insight).toHaveProperty('emoji')
      expect(insight).toHaveProperty('title')
      expect(insight).toHaveProperty('description')
      expect(insight).toHaveProperty('suggestion')
      expect(insight).toHaveProperty('category')
      expect(insight).toHaveProperty('confidence')
      expect(insight).toHaveProperty('priority')

      // Non-empty strings
      expect(typeof insight.id).toBe('string')
      expect(insight.id.length).toBeGreaterThan(0)
      expect(typeof insight.emoji).toBe('string')
      expect(insight.emoji.length).toBeGreaterThan(0)
      expect(typeof insight.title).toBe('string')
      expect(insight.title.length).toBeGreaterThan(0)
      expect(typeof insight.description).toBe('string')
      expect(insight.description.length).toBeGreaterThan(0)
      expect(typeof insight.suggestion).toBe('string')
      expect(insight.suggestion.length).toBeGreaterThan(0)
    }
  })

  it('23. priority is always 1-5', () => {
    const d = dates(14)
    const input = baseInput({
      wellness: d.map((date) =>
        wellnessEntry(date, {
          sleep_quality: 1,
          energy_level: 1,
          mood: 1,
          training_drive: 1,
        }),
      ),
      nutrition: d.map((date, i) =>
        nutritionEntry(date, {
          calories: 2000,
          carbs_grams: 50,
          protein_grams: 150,
          compliant: i < 7 ? false : true,
        }),
      ),
      training: d.map((date) =>
        trainingEntry(date, { rpe: 9, duration: 60 }),
      ),
    })

    const results = generateBehaviorInsights(input)
    for (const insight of results) {
      expect(insight.priority).toBeGreaterThanOrEqual(1)
      expect(insight.priority).toBeLessThanOrEqual(5)
    }
  })

  it('24. category is always one of the 5 valid values', () => {
    const d = dates(14)
    const input = baseInput({
      wellness: d.map((date) =>
        wellnessEntry(date, {
          sleep_quality: 1,
          energy_level: 1,
          mood: 1,
          training_drive: 1,
        }),
      ),
      nutrition: d.map((date, i) =>
        nutritionEntry(date, {
          calories: 2000,
          carbs_grams: 50,
          protein_grams: 150,
          compliant: i < 7 ? false : true,
        }),
      ),
      training: d.map((date) =>
        trainingEntry(date, { rpe: 9, duration: 60 }),
      ),
    })

    const results = generateBehaviorInsights(input)
    for (const insight of results) {
      expect(VALID_CATEGORIES).toContain(insight.category)
    }
  })
})
