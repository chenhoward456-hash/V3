import { describe, it, expect } from 'vitest'
import { computeWeeklyCoachingDraft, weeklyWeightSlope } from '@/lib/weekly-coaching'

/**
 * `lib/weekly-coaching.ts` 到 2026-07-10 為止一支測試都沒有——
 * 而它的輸出是「要發給學員的訊息」。這支補上核心契約。
 *
 * 最重要的契約：**引擎不能對增肌學員講減脂的話。**
 */

const days = (n: number) => {
  const out: string[] = []
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.parse('2026-07-10T00:00:00Z') - i * 86_400_000)
    out.push(d.toISOString().slice(0, 10))
  }
  return out
}

/** 造一組每天等速變化的體重（沒有雜訊），方便精準測速率分支 */
function linearWeights(startKg: number, kgPerWeek: number, n = 14) {
  return days(n).map((date, i) => ({ date, weight: +(startKg + (kgPerWeek / 7) * i).toFixed(3) }))
}

function baseInput(overrides: Partial<Parameters<typeof computeWeeklyCoachingDraft>[0]> = {}) {
  const weights = linearWeights(72, 0)
  return {
    client: {
      name: 'Test', goal_type: 'bulk', prep_phase: 'off_season',
      competition_date: null, competition_enabled: false,
      target_weight: 77, calories_target: 3000, protein_target: 180,
    },
    weights,
    nutrition: weights.map(w => ({ date: w.date, compliant: true, calories: 3000, protein_grams: 160 })),
    training: days(14).slice(0, 9).map(d => ({ date: d, training_type: 'push' })),
    wellness: weights.map(w => ({ date: w.date, energy_level: 4 })),
    labs: [],
    now: '2026-07-10',
    ...overrides,
  }
}

describe('weeklyWeightSlope（回歸斜率取代頭尾兩點）', () => {
  it('對震盪的真實體重，頭尾兩點會把正負號算反', () => {
    // William 2026-06-26~07-10 的真實體重
    const pts = [
      ['2026-06-26', 71.90], ['2026-06-30', 71.60], ['2026-07-01', 71.65], ['2026-07-02', 71.65],
      ['2026-07-03', 71.85], ['2026-07-06', 71.70], ['2026-07-07', 71.95], ['2026-07-08', 72.10],
      ['2026-07-09', 71.90], ['2026-07-10', 71.75],
    ].map(([d, v]) => ({ d: d as string, v: v as number }))

    const endpoint = ((pts[pts.length - 1].v - pts[0].v) / 14) * 7 // 舊做法
    const slope = weeklyWeightSlope(pts)!

    expect(endpoint).toBeLessThan(0)   // 舊做法：「在掉」
    expect(slope).toBeGreaterThan(0)   // 回歸：「在漲」——同一組數字，相反結論
    expect(slope).toBeCloseTo(0.089, 2)
  })

  it('點數不足回 null，不硬算', () => {
    expect(weeklyWeightSlope([{ d: '2026-07-09', v: 72 }, { d: '2026-07-10', v: 72.2 }])).toBeNull()
  })
})

describe('增肌學員：引擎必須講增肌的話', () => {
  it('停滯（體重不動）→ 叫他加熱量，絕不說「維持現況」', () => {
    const d = computeWeeklyCoachingDraft(baseInput())
    const all = d.adjustments.join(' ')
    expect(all).toMatch(/加|往上/)
    expect(all).not.toMatch(/赤字|降熱量|止跌/)
    expect(all).not.toContain('數據都在合理區')
    expect(d.bullets.join(' ')).toMatch(/停滯|慢於理想/)
  })

  it('停滯 + 有吃到設定 → 給具體 kcal（用實測維持熱量 +10% 算，不是拿設定值瞎猜）', () => {
    const d = computeWeeklyCoachingDraft(baseInput())
    // 吃 3000 kcal 體重不動 → 維持熱量 ≈ 3000 → +10% = +300
    expect(d.adjustments.join(' ')).toContain('+300 kcal')
  })

  it('增太快（>0.5%/週）→ 收盈餘，並標記教練覆核', () => {
    const weights = linearWeights(72, 0.6) // ~0.83%/週
    const d = computeWeeklyCoachingDraft(baseInput({ weights, nutrition: weights.map(w => ({ date: w.date, compliant: true, calories: 3600, protein_grams: 160 })) }))
    expect(d.adjustments.join(' ')).toMatch(/收.*盈餘/)
    expect(d.needsCoachReview).toBe(true)
  })

  it('速率理想（0.25–0.5%/週）→ 不亂調，且報 ETA', () => {
    const weights = linearWeights(72, 0.25) // ~0.35%/週
    const d = computeWeeklyCoachingDraft(baseInput({ weights, nutrition: weights.map(w => ({ date: w.date, compliant: true, calories: 3300, protein_grams: 160 })) }))
    expect(d.bullets.join(' ')).toMatch(/速率理想/)
    expect(d.bullets.join(' ')).toMatch(/照目前速率.*週到 77kg/)
  })

  it('速率不理想時不報 ETA（我們正要加熱量，那個數字下週就作廢，只會打擊他）', () => {
    const d = computeWeeklyCoachingDraft(baseInput()) // 停滯
    expect(d.bullets.join(' ')).not.toMatch(/照目前速率/)
  })

  it('缺飲食記錄也要給方向，不能因為算不出 kcal 就沉默', () => {
    const d = computeWeeklyCoachingDraft(baseInput({ nutrition: [] }))
    expect(d.adjustments.join(' ')).toMatch(/加熱量/)
    expect(d.adjustments.join(' ')).toMatch(/補記錄/)
  })
})

describe('蛋白判定：用絕對 g/kg 下限，不用「打到目標的幾成」', () => {
  it('高於 1.6 g/kg 下限但沒吃滿目標 → 據實說「夠用」，不叫他改，也不謊稱達標', () => {
    // 72kg × 1.6 = 115.2g 下限；吃 160g = 2.2 g/kg，目標 180g
    const d = computeWeeklyCoachingDraft(baseInput())
    const b = d.bullets.join(' ')
    expect(b).toMatch(/夠用/)
    expect(b).toMatch(/高於 1\.6 g\/kg 體重/)
    expect(d.adjustments.join(' ')).not.toMatch(/蛋白/)
  })

  it('低於 1.6 g/kg 下限 → 這才叫他補蛋白', () => {
    const input = baseInput()
    input.nutrition = input.nutrition.map(n => ({ ...n, protein_grams: 100 })) // 1.39 g/kg
    const d = computeWeeklyCoachingDraft(input)
    expect(d.adjustments.join(' ')).toMatch(/蛋白拉到至少/)
    expect(d.bullets.join(' ')).toMatch(/低於 1\.6 g\/kg 體重下限/)
  })

  // ⚠️ 這組測試 2026-08-23 改過。舊版把減脂下限 2.3 套在總體重上，等於假設每個人 0% 體脂，
  // 門檻高了約 25%，把健康的攝取量誤報成掉肌風險（Sean 85.7kg 吃 185g 被誤標）。
  // Helms 2014 / ISSN position stand 的 2.3-3.1 講的是**淨體重**。
  it('減脂 + 有體脂 → 門檻算在淨體重上，不是總體重', () => {
    const input = baseInput()
    input.client = { ...input.client, goal_type: 'cut', prep_phase: 'cut' }
    // 72kg × 20% 體脂 → 淨體重 57.6kg，門檻 = 2.3 × 57.6 = 132.5g
    input.weights = input.weights.map(w => ({ ...w, body_fat: 20 }))
    input.nutrition = input.nutrition.map(n => ({ ...n, protein_grams: 150 })) // 2.6 g/kg 淨體重 → 夠
    const d = computeWeeklyCoachingDraft(input)
    expect(d.adjustments.join(' ')).not.toMatch(/蛋白/)
    expect(d.bullets.join(' ')).toMatch(/淨體重/)
    // 舊規則（2.3 × 72 = 165.6g）會誤判成不足 —— 守住這個回歸
    expect(d.bullets.join(' ')).not.toMatch(/掉肌風險/)
  })

  it('減脂 + 有體脂 + 真的吃太少 → 仍然抓得到', () => {
    const input = baseInput()
    input.client = { ...input.client, goal_type: 'cut', prep_phase: 'cut' }
    input.weights = input.weights.map(w => ({ ...w, body_fat: 20 })) // 淨體重 57.6，門檻 132.5g
    input.nutrition = input.nutrition.map(n => ({ ...n, protein_grams: 110 }))
    const d = computeWeeklyCoachingDraft(input)
    expect(d.adjustments.join(' ')).toMatch(/蛋白拉到至少/)
    expect(d.bullets.join(' ')).toMatch(/減脂掉肌風險/)
  })

  it('減脂 + 沒體脂 → 退回 1.8 g/kg 總體重的替代門檻（≈20% 體脂者的 2.3 g/kg 淨體重）', () => {
    const input = baseInput()
    input.client = { ...input.client, goal_type: 'cut', prep_phase: 'cut' }
    // 72kg × 1.8 = 129.6g 門檻
    input.nutrition = input.nutrition.map(n => ({ ...n, protein_grams: 150 })) // 2.08 g/kg → 高於替代門檻
    const d = computeWeeklyCoachingDraft(input)
    expect(d.adjustments.join(' ')).not.toMatch(/蛋白/)
    expect(d.bullets.join(' ')).toMatch(/1\.8 g\/kg 體重/)

    input.nutrition = input.nutrition.map(n => ({ ...n, protein_grams: 120 })) // 1.67 g/kg → 低於
    const d2 = computeWeeklyCoachingDraft(input)
    expect(d2.adjustments.join(' ')).toMatch(/蛋白拉到至少/)
  })

  it('體脂欄填錯（0 或 99）不能污染門檻 → 退回體重替代值', () => {
    const input = baseInput()
    input.client = { ...input.client, goal_type: 'cut', prep_phase: 'cut' }
    input.weights = input.weights.map(w => ({ ...w, body_fat: 0 }))
    input.nutrition = input.nutrition.map(n => ({ ...n, protein_grams: 150 }))
    const d = computeWeeklyCoachingDraft(input)
    expect(d.bullets.join(' ')).toMatch(/1\.8 g\/kg 體重/)
    expect(d.bullets.join(' ')).not.toMatch(/淨體重/)
  })
})

describe('「沒有 adjustment」的兩種意思要分清楚', () => {
  it('引擎判定過、結論是在軌道上 → 說「數據在軌道上」，不必丟旗標吵教練', () => {
    const weights = linearWeights(72, 0.25) // ~0.35%/週，落在理想帶 → onTrackVerdict
    const d = computeWeeklyCoachingDraft(baseInput({
      weights,
      nutrition: weights.map(w => ({ date: w.date, compliant: true, calories: 3300, protein_grams: 160 })),
      training: days(14).slice(0, 8).map(d2 => ({ date: d2, training_type: 'push' })),
    }))
    expect(d.adjustments.join(' ')).toContain('數據在軌道上')
    expect(d.flags.join(' ')).not.toMatch(/請人工確認/)
  })

  it('引擎判不出來（沒有目標體重、無從對帳）→ 誠實說「沒有明確訊號」+ 標給教練', () => {
    const weights = linearWeights(72, 0.25)
    const d = computeWeeklyCoachingDraft(baseInput({
      // goal_type 空 → 不走 bulk 也不走 cut，沒有任何速率判定
      client: { name: 'X', goal_type: null, prep_phase: null, competition_date: null, competition_enabled: false, target_weight: null, calories_target: 3300, protein_target: 180 },
      weights,
      nutrition: weights.map(w => ({ date: w.date, compliant: true, calories: 3300, protein_grams: 160 })),
      training: days(14).slice(0, 8).map(d2 => ({ date: d2, training_type: 'push' })),
    }))
    expect(d.adjustments.join(' ')).toContain('沒有需要調整的明確訊號')
    expect(d.adjustments.join(' ')).not.toContain('數據都在合理區')
    expect(d.needsCoachReview).toBe(true)
    expect(d.flags.join(' ')).toMatch(/請人工確認/)
  })
})

describe('減脂路徑沒被增肌改動弄壞', () => {
  it('備賽減脂：進度落後 → 仍然講「製造赤字」，不會叫他加熱量', () => {
    const weights = linearWeights(80, 0) // 沒在掉
    const d = computeWeeklyCoachingDraft(baseInput({
      client: {
        name: '備賽者', goal_type: 'cut', prep_phase: 'cut',
        competition_date: '2026-09-01', competition_enabled: true,
        target_weight: 78, calories_target: 2000, protein_target: 180,
      },
      weights,
      nutrition: weights.map(w => ({ date: w.date, compliant: true, calories: 2000, protein_grams: 190 })),
    }))
    expect(d.adjustments.join(' ')).toMatch(/赤字/)
    expect(d.adjustments.join(' ')).not.toMatch(/加熱量|往上加/)
  })
})
