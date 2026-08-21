import { describe, it, expect } from 'vitest'
import { buildAssessmentReport } from '@/lib/assessment-report'
import type { InBodyReading } from '@/lib/inbody-ocr'

/** 2026-08-15 那張真實 ACCUNIQ 報表（已去識別）：男 35 歲 175cm 75.8kg */
const REAL: InBodyReading = {
  measured_at: '2026-08-15', gender: '男性', weight: 75.8, height: 175, age: 35,
  body_fat_pct: 21.0, body_fat_mass: 15.9, skeletal_muscle: 33.5, lean_mass: 59.9,
  smi: 8.16, bmi: 24.8, visceral_fat: 8, visceral_fat_area: 83,
  waist_cm: 94, waist_was_inches: true, whr: 0.9, bmr: 1664, machine_tdee: 2562,
  body_water: 44, protein: 11.9, mineral: 4.1, obesity_degree: 12.5,
  health_score: 80, edema_index: 0.373, target_weight: 72.7,
  fat_control: -3.1, muscle_control: 0,
  segmental_muscle: { 軀幹: 26.4, 左臂: 3.37, 右臂: 3.4, 左腿: 9.11, 右腿: 9.12 },
  segmental_fat: { 軀幹: 8.4, 左臂: 0.85, 右臂: 0.83, 左腿: 2.23, 右腿: 2.26 },
  history: [], uncertain: [],
}

const blank = (over: Partial<InBodyReading>): InBodyReading => ({
  ...REAL, ...over,
})

describe('體測報告判讀', () => {
  it('真實案例：判成「肌肉夠，問題是軀幹脂肪」', () => {
    const r = buildAssessmentReport({ reading: REAL })
    expect(r.headline).toContain('肌肉量是夠的')
    expect(r.headline).toContain('8.4')
    expect(r.headlineDetail).toContain('53%')   // 8.4 / 15.9
  })

  it('三個數字都帶「所以呢」，不只報數', () => {
    const r = buildAssessmentReport({ reading: REAL })
    expect(r.keyStats).toHaveLength(3)
    for (const s of r.keyStats) {
      expect(s.soWhat.length).toBeGreaterThan(10)
    }
    expect(r.keyStats.find(s => s.label === '腹圍')?.tone).toBe('watch')
    expect(r.keyStats.find(s => s.label === '骨骼肌重')?.tone).toBe('good')
  })

  it('腹圍超標時，目標要指向腹圍不是體重', () => {
    const r = buildAssessmentReport({ reading: REAL })
    expect(r.goal?.primaryMetricNote).toContain('腹圍')
    expect(r.goal?.primaryMetricNote).toContain('副產品')
  })

  it('⭐ 肌肉量偏低的人不建議減脂（先減會掉肌肉）', () => {
    // SMI 6.2 < 男性參考線 7.0
    const r = buildAssessmentReport({ reading: blank({ smi: 6.2, skeletal_muscle: 24, weight: 62, body_fat_mass: 14, body_fat_pct: 22.6, lean_mass: 48 }) })
    expect(r.headline).toContain('先把肌肉量拉起來')
    expect(r.goal!.targetWeight).toBeGreaterThan(r.goal!.currentWeight)  // 往上не往下
    expect(r.nutrition!.calories).toBeGreaterThan(r.nutrition!.tdee)     // 盈餘不是赤字
    expect(r.training[0].title).toContain('三次重訓')
    expect(r.training[2].title).toContain('先不要做有氧')
  })

  it('女性用女性的參考值', () => {
    const r = buildAssessmentReport({
      reading: blank({ gender: '女性', weight: 57.7, height: 168, age: 26, body_fat_pct: 22.8, body_fat_mass: 13.2, lean_mass: 44.5, smi: 6.1, waist_cm: 78, segmental_fat: null }),
    })
    // 女性 SMI 低標 5.7，6.1 不算低 → 不該判成肌肉不足
    expect(r.headline).not.toContain('先把肌肉量拉起來')
    // 腹圍 78 < 女性參考線 80 → 不該標 watch
    expect(r.keyStats.find(s => s.label === '腹圍')?.tone).toBe('good')
  })

  it('速率超過安全線時自動拉長期程，不給做不到的數字', () => {
    // 體脂 32% 的人想在 12 週掉到 27.5%，那是每週 >0.5% 體重
    const r = buildAssessmentReport({
      reading: blank({ weight: 95, body_fat_pct: 32, body_fat_mass: 30.4, lean_mass: 64.6, waist_cm: 105 }),
      weeks: 12,
    })
    expect(r.goal!.weeks).toBeGreaterThan(12)
    expect(r.goal!.ratePerWeek).toBeLessThanOrEqual(95 * 0.005 + 0.01)
  })

  it('每日熱量用 Mifflin 算，不直接採用機器的 TDEE', () => {
    const r = buildAssessmentReport({ reading: REAL, activity: 'light' })
    // Mifflin: 10*75.8 + 6.25*175 - 5*35 + 5 = 1682 → ×1.4 = 2355
    expect(r.nutrition!.tdee).toBeGreaterThan(2300)
    expect(r.nutrition!.tdee).toBeLessThan(2400)
    expect(r.nutrition!.tdee).not.toBe(REAL.machine_tdee)  // 機器給 2562，對久坐者高估
    expect(r.nutrition!.protein).toBe(152)                  // 2.0 g/kg
  })

  it('巨量加起來要等於設定的熱量', () => {
    const n = buildAssessmentReport({ reading: REAL }).nutrition!
    const calc = n.protein * 4 + n.carbs * 4 + n.fat * 9
    expect(Math.abs(calc - n.calories)).toBeLessThan(15)
  })

  it('OCR 讀不到的欄位列進 missing，不硬算', () => {
    const r = buildAssessmentReport({ reading: blank({ weight: null, body_fat_pct: null, height: null }) })
    expect(r.missing).toContain('體重')
    expect(r.missing).toContain('體脂率')
    expect(r.nutrition).toBeNull()
    expect(r.goal).toBeNull()
  })

  it('OCR 標了不確定 → 報告帶提醒，而且用教練看得懂的欄位名', () => {
    const r = buildAssessmentReport({ reading: blank({ uncertain: ['body_fat_pct', 'waist_cm'] }) })
    expect(r.warnings.join()).toContain('體脂率')
    expect(r.warnings.join()).toContain('腹圍')
    expect(r.warnings.join()).not.toContain('body_fat_pct')   // 不要丟原始鍵名給人看
  })

  it('history 相關的不確定不當雜訊講出來（那組已整組丟棄，不影響報告）', () => {
    const r = buildAssessmentReport({
      reading: blank({ uncertain: ['history[0].date', 'history[1].date', 'history'] }),
    })
    expect(r.warnings.join()).not.toContain('history[0]')
    expect(r.warnings.join()).toContain('歷史趨勢')
    expect(r.warnings.join()).toContain('不影響')
  })

  it('腹圍換算過要說出來（會員可能拿報表對照）', () => {
    const r = buildAssessmentReport({ reading: REAL })
    expect(r.warnings.join()).toContain('英吋')
  })

  it('已經精瘦的人不該被叫去再減', () => {
    const r = buildAssessmentReport({
      reading: blank({ body_fat_pct: 12, body_fat_mass: 9, lean_mass: 66, waist_cm: 82, segmental_fat: { 軀幹: 3.5 } }),
    })
    expect(r.headline).toContain('不錯的位置')
  })
})

describe('複測比對（Howard：「一份報告不是差異化」→ 差在第二次）', () => {
  /** 三個月前：91.7kg、體脂 26.2%、骨骼肌 37.8、腹圍 98.6 */
  const PREV: InBodyReading = blank({
    measured_at: '2026-05-15', weight: 91.7, body_fat_pct: 26.2, body_fat_mass: 24.0,
    skeletal_muscle: 37.8, lean_mass: 67.7, waist_cm: 98.6, smi: 8.7,
  })

  it('⭐ 掉脂肪、肌肉沒掉 → 講成「最好的那種變化」', () => {
    const now = blank({
      measured_at: '2026-08-15', weight: 88.9, body_fat_pct: 23.2, body_fat_mass: 20.6,
      skeletal_muscle: 37.9, lean_mass: 68.3, waist_cm: 95.1,
    })
    const c = buildAssessmentReport({ reading: now, previous: PREV }).comparison!
    expect(c.verdict).toContain('3.4')          // 脂肪掉 3.4
    expect(c.verdict).toContain('最好的那種變化')
    expect(c.verdict).toContain('腹圍')          // 腹圍掉 3.5 也要講
    expect(c.weeks).toBe(13)
  })

  it('⭐ 體重掉但肌肉也掉 → 要點出來，不能只報喜', () => {
    const now = blank({
      weight: 87.5, body_fat_pct: 24.5, body_fat_mass: 21.4,
      skeletal_muscle: 35.9, lean_mass: 66.1, measured_at: '2026-08-15',
    })
    const c = buildAssessmentReport({ reading: now, previous: PREV }).comparison!
    expect(c.verdict).toContain('肌肉也少了')
    expect(c.verdict).toContain('這個要處理')
    expect(c.changes.find(x => x.label === '骨骼肌')?.tone).toBe('watch')
  })

  it('體重沒動但脂肪掉了 → 仍然是好事（體重單獨看沒意義）', () => {
    const now = blank({
      weight: 91.7, body_fat_pct: 24.6, body_fat_mass: 22.6,
      skeletal_muscle: 39.0, lean_mass: 69.1, measured_at: '2026-08-15',
    })
    const c = buildAssessmentReport({ reading: now, previous: PREV }).comparison!
    expect(c.verdict).toContain('最好的那種變化')
    // 體重沒變 → 不列進變化清單
    expect(c.changes.find(x => x.label === '體重')).toBeUndefined()
  })

  it('幾乎沒變 → 不責備，但點出要調做法', () => {
    const now = blank({ measured_at: '2026-08-15', body_fat_mass: 23.9, skeletal_muscle: 37.8 })
    const c = buildAssessmentReport({ reading: now, previous: PREV }).comparison!
    expect(c.verdict).toContain('變化不大')
    expect(c.verdict).toContain('不算失敗')
  })

  it('沒有上一次 → 不產生比對段落', () => {
    expect(buildAssessmentReport({ reading: REAL }).comparison).toBeNull()
  })

  it('上一次缺體重 → 不硬比', () => {
    const c = buildAssessmentReport({ reading: REAL, previous: blank({ weight: null }) }).comparison
    expect(c).toBeNull()
  })
})
