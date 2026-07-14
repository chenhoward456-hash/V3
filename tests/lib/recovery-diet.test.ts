import { describe, it, expect } from 'vitest'
import {
  generateRecoveryDiet,
  estimateRecoveryMaintenance,
  calcRegainRate,
  EA_FLOOR_MALE,
  EA_FLOOR_FEMALE,
  RECOVERY_PROTEIN_PER_KG,
  RECOVERY_FAT_FLOOR_PER_KG,
  ATHLETIC_ZONE_BF_CEILING_MALE,
  type RecoveryDietInput,
} from '@/lib/recovery-diet'

/**
 * 這些測試守的是「Recovery Diet 不是 reverse diet」這個核心決策。
 * 如果有人把慢速爬升的邏輯加回來，這裡要炸。
 * 證據來源見 lib/recovery-diet.ts 檔頭。
 */

/** Howard 本人的近似值：7/26 WNBF 賽後 */
function howard(overrides: Partial<RecoveryDietInput> = {}): RecoveryDietInput {
  return {
    bodyWeight: 75,
    gender: '男性',
    bodyFatPct: 6,
    baselineBodyFatPct: null,
    daysSinceCompetition: 3,
    trainingDaysPerWeek: 5,
    activityProfile: 'high_energy_flux',
    weeklyWeights: [{ week: 0, avgWeight: 75 }],
    currentCalories: 1900,
    cardioMinutesPerDay: 30,
    ...overrides,
  }
}

describe('Recovery Diet — 核心決策：第 1 週直接回維持，不做慢速 reverse', () => {
  it('賽後第 1 週熱量直接跳到維持量，不是「當前 + 100」', () => {
    const input = howard({ daysSinceCompetition: 2, currentCalories: 1900 })
    const r = generateRecoveryDiet(input)

    expect(r.phase).toBe('return_to_maintenance')
    // 關鍵：熱量必須遠高於備賽期的 1900，而且落在維持量附近，不是 1900 + 100
    expect(r.calories).toBeGreaterThan(input.currentCalories! + 300)
    expect(r.calories).toBeGreaterThanOrEqual(r.maintenanceCalories * 0.95)
  })

  it('賽後第 30 天的熱量不會比第 3 天低（沒有「爬升中」的半吊子狀態）', () => {
    const day3 = generateRecoveryDiet(howard({ daysSinceCompetition: 3 }))
    const day30 = generateRecoveryDiet(
      howard({
        daysSinceCompetition: 30,
        weeklyWeights: [
          { week: 0, avgWeight: 78 },
          { week: 4, avgWeight: 75 },
        ],
      })
    )
    expect(day30.calories).toBeGreaterThanOrEqual(day3.calories * 0.9)
  })

  it('維持熱量不套減脂期的代謝適應折扣（照壓低的 TDEE 餵會把壓低狀態固定住）', () => {
    const input = howard({ bodyWeight: 75, bodyFatPct: 6 })
    const maintenance = estimateRecoveryMaintenance(input)
    // Katch-McArdle: LBM 70.5 → BMR 1893；high_energy_flux + 5 天訓練 → ×1.75
    expect(maintenance).toBeGreaterThan(3000)
  })
})

describe('煞車 1（最高優先）：能量可用性 EA 底線', () => {
  it('EA 低於男性底線時強制把熱量拉上去', () => {
    // 大量有氧 + 低體脂 → EA 會被壓破底線
    const input = howard({
      bodyWeight: 70,
      bodyFatPct: 5,
      cardioMinutesPerDay: 90,
      trainingDaysPerWeek: 6,
      activityProfile: 'sedentary', // 壓低維持量估計，逼 EA 破底
    })
    const r = generateRecoveryDiet(input)

    expect(r.energyAvailability).not.toBeNull()
    // 強制拉高後，EA 必須越過底線
    expect(r.energyAvailability!.eaKcalPerKgFFM).toBeGreaterThanOrEqual(EA_FLOOR_MALE - 0.5)
    expect(r.energyAvailability!.floor).toBe(EA_FLOOR_MALE)
  })

  it('女性用 30 kcal/kg FFM 的底線（比男性嚴格）', () => {
    const r = generateRecoveryDiet(howard({ gender: '女性', bodyFatPct: 14, bodyWeight: 55 }))
    expect(r.energyAvailability!.floor).toBe(EA_FLOOR_FEMALE)
  })
})

describe('方向盤：體重回增速率', () => {
  it('4 週回增不足 2% → 判定失速，而且是「加熱量」不是「撐住」', () => {
    // 4 週只從 75 → 75.3（+0.4%），遠低於 2% 門檻
    const r = generateRecoveryDiet(
      howard({
        daysSinceCompetition: 30,
        weeklyWeights: [
          { week: 0, avgWeight: 75.3 },
          { week: 4, avgWeight: 75.0 },
        ],
      })
    )
    expect(r.phase).toBe('stalled')
    // 失速的處置必須是「往上加」——回增最少的人恢復最差（Lima 2022）
    expect(r.calories).toBeGreaterThan(r.maintenanceCalories)
    expect(r.warnings.some((w) => w.includes('恢復失速'))).toBe(true)
  })

  it('回增過快 → 收熱量，但不會掉回節食（仍在維持量附近）', () => {
    const r = generateRecoveryDiet(
      howard({
        daysSinceCompetition: 21,
        bodyFatPct: 9,
        weeklyWeights: [
          { week: 0, avgWeight: 79 },
          { week: 3, avgWeight: 75 },
        ],
      })
    )
    expect(r.regainRatePctPerWeek).toBeGreaterThan(1.0)
    // 收了，但不能收到維持量的 90% 以下
    expect(r.calories).toBeGreaterThanOrEqual(r.maintenanceCalories * 0.88)
  })

  it('體重資料不足時回增速率為 null，不會亂猜', () => {
    const r = generateRecoveryDiet(howard({ weeklyWeights: [{ week: 0, avgWeight: 75 }] }))
    expect(r.regainRatePctPerWeek).toBeNull()
  })

  it('calcRegainRate 算的是每週百分比', () => {
    // 4 週 75 → 78 = +4%，每週 1%
    const rate = calcRegainRate([
      { week: 0, avgWeight: 78 },
      { week: 4, avgWeight: 75 },
    ])
    expect(rate).toBeCloseTo(1.0, 1)
  })
})

describe('煞車 2：體脂過衝', () => {
  it('沒有記錄賽前基線時，用 athletic 區間上緣（男 17%）判定', () => {
    const r = generateRecoveryDiet(
      howard({ bodyFatPct: ATHLETIC_ZONE_BF_CEILING_MALE + 2, baselineBodyFatPct: null, daysSinceCompetition: 60 })
    )
    expect(r.fatOvershoot).toBe(true)
    expect(r.phase).toBe('complete')
    // 過衝後熱量停在維持量（±15 kcal 是 P/C/F 四捨五入回填的誤差，不是加碼）
    expect(r.calories).toBeLessThanOrEqual(r.maintenanceCalories + 15)
  })

  it('有記錄基線時，用「基線 + 5 個百分點」判定', () => {
    const notYet = generateRecoveryDiet(
      howard({ bodyFatPct: 13, baselineBodyFatPct: 10, daysSinceCompetition: 45 })
    )
    expect(notYet.fatOvershoot).toBe(false)

    const over = generateRecoveryDiet(
      howard({ bodyFatPct: 16, baselineBodyFatPct: 10, daysSinceCompetition: 45 })
    )
    expect(over.fatOvershoot).toBe(true)
  })
})

describe('巨量營養素：蛋白不降、脂肪有底線、碳水吃餘數', () => {
  it('蛋白質全程 ≥ 2.0 g/kg（恢復期保瘦體重）', () => {
    const r = generateRecoveryDiet(howard())
    expect(r.protein).toBeGreaterThanOrEqual(Math.round(75 * RECOVERY_PROTEIN_PER_KG))
  })

  it('脂肪不低於 0.5 g/kg 底線（極低脂壓睪固酮）', () => {
    const r = generateRecoveryDiet(howard())
    expect(r.fat).toBeGreaterThanOrEqual(Math.round(75 * RECOVERY_FAT_FLOOR_PER_KG))
  })

  it('巨量營養素加總回得到熱量（不會有算術漂移）', () => {
    const r = generateRecoveryDiet(howard())
    const computed = r.protein * 4 + r.carbs * 4 + r.fat * 9
    expect(Math.abs(computed - r.calories)).toBeLessThanOrEqual(10)
  })

  it('碳水在恢復期是主力（≥ 2 g/kg）', () => {
    const r = generateRecoveryDiet(howard())
    expect(r.carbs).toBeGreaterThanOrEqual(75 * 1.5)
  })

  it('脂肪走「佔總熱量比例」不是「固定 g/kg」——維持熱量高時脂肪要跟著長', () => {
    // 迴歸測試：90kg / 高維持量的人，舊版把脂肪釘死在 0.8 g/kg (=72g)，
    // 導致所有餘數全被倒進碳水。真正該守的是「比例」不是「g/kg 上限」。
    const big = generateRecoveryDiet(
      howard({ bodyWeight: 90, bodyFatPct: 15, trainingDaysPerWeek: 5, activityProfile: 'high_energy_flux' })
    )
    // 脂肪必須跟著熱量長，不能還卡在 0.8 g/kg
    expect(big.fat).toBeGreaterThan(Math.round(90 * 0.8))

    // 三大營養素的比例要是正常的分配（這才是真正的不變式）
    const fatPct = (big.fat * 9) / big.calories
    const proteinPct = (big.protein * 4) / big.calories
    const carbPct = (big.carbs * 4) / big.calories
    expect(fatPct).toBeGreaterThanOrEqual(0.15) // Helms 2014: 脂肪 15-30% kcal
    expect(fatPct).toBeLessThanOrEqual(0.30)
    expect(proteinPct).toBeGreaterThanOrEqual(0.15)
    expect(carbPct).toBeLessThanOrEqual(0.65) // 碳水是主力但不該吃掉整盤
  })

  it('脂肪不超過 1.2 g/kg 上限（碳水優先）', () => {
    const r = generateRecoveryDiet(howard({ bodyWeight: 90, bodyFatPct: 15 }))
    expect(r.fat).toBeLessThanOrEqual(Math.round(90 * 1.2))
  })
})

describe('訓練指引：阻力訓練不准停（這條最常被寫反）', () => {
  it('永遠包含「阻力訓練不要停」的指引', () => {
    const r = generateRecoveryDiet(howard())
    const joined = r.trainingGuidance.join('')
    expect(joined).toContain('阻力訓練')
    // 絕不能出現「不做重訓 / 停練」這種與證據相反的話
    expect(joined).not.toContain('不做重訓')
  })

  it('有氧是階梯式下調，不是一次砍光', () => {
    const r = generateRecoveryDiet(howard())
    expect(r.trainingGuidance.join('')).toContain('階梯式下調')
  })
})

describe('反迴歸守門：不准把 reverse diet 加回來', () => {
  it('任何 warning / action 都不得叫學員「每週小幅增加熱量」', () => {
    const cases = [3, 10, 30, 60].map((d) =>
      generateRecoveryDiet(
        howard({
          daysSinceCompetition: d,
          weeklyWeights: [
            { week: 0, avgWeight: 76 },
            { week: 2, avgWeight: 75 },
          ],
        })
      )
    )
    for (const r of cases) {
      const text = [...r.warnings, ...r.actions, ...r.trainingGuidance].join('')
      expect(text).not.toMatch(/每週增加 \d+-\d+ ?kcal/)
      expect(text).not.toMatch(/每天增加 100-200/)
    }
  })
})
