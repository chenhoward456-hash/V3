import { describe, it, expect } from 'vitest'
import {
  buildLabConsult, buildConsultActions, standardTarget, renderLabConsultText, shouldAutoSetNextCheckup, addMonths, plainLabel,
  CONSULT_FRESH_DAYS, RETEST_MONTHS_CLEAN, RETEST_MONTHS_WITH_ISSUE,
} from '@/lib/lab-consult'
import type { LabHypothesis } from '@/lib/longevity-lens'
import type { TemplateItem } from '@/lib/lab-order'
import { scanMedicalCompliance } from '@/lib/compliance-scrub'

/**
 * 這次血檢顧問卡的契約：學員抽完血、教練還沒看，系統先講的話。
 *   - 真變化 vs 雜訊一定要分對（講錯「變差」會嚇人，漏講會讓人以為沒事）
 *   - 學員看的 → 不能出現價格／底盤／套餐、不能有病名診斷
 *   - 下次抽血：有要留意 3 個月、沒有 6 個月；教練排在未來的日期不能被覆蓋
 */

const D0 = '2026-03-20'
const D1 = '2026-09-30'
const TODAY = '2026-10-01'

type Row = [name: string, before: number, after: number, unit: string]
const pairs = (rows: Row[]) => rows.flatMap(([n, a, b, u]) => [
  { test_name: n, value: a, unit: u, date: D0 },
  { test_name: n, value: b, unit: u, date: D1 },
])

const TPL: TemplateItem[] = [
  { name: 'Testosterone 總睪固酮', price: 300, priority: 'must' },
  { name: 'Apo B (外送大安聯合)', price: 600, priority: 'must' },
  { name: 'HOMA-IR (Insulin + Glucose)', price: 470, priority: 'must' },
  { name: '25-OH Vitamin D Total', price: 700, priority: 'must' },
  { name: 'Homocysteine 同半胱胺酸', price: 250, priority: 'must' },
]

const HYP: LabHypothesis = {
  id: 'h1', marker: '睪固酮', baseline_date: D0, baseline_value: 403.92, cause: '熱量赤字太深', action: '熱量拉回維持',
  expected_direction: 'up', expected_value: 550, retest_by: TODAY, note: null, created_at: D0,
}

const MIXED: Row[] = [
  ['睪固酮', 403.92, 626.72, 'ng/dL'],   // +55%，RCV≈29% → 真的變好（男）
  ['ALT', 30, 33, 'U/L'],                // +10%，RCV≈44% → 雜訊
  ['HbA1c', 5.2, 5.3, '%'],              // +2%，RCV≈9% → 雜訊
  ['LDL-C', 69, 85, 'mg/dL'],            // +23%，RCV≈25% → 雜訊（正常值裡的漂移）
  ['空腹胰島素', 4, 9.5, 'µIU/mL'],       // +138%，RCV≈71% → 真的變差，而且 9.5 超出標準
  ['三酸甘油酯', 34, 63, 'mg/dL'],        // +85% 真變化，但前後都 <100 → 不分好壞
]

const build = (labs = pairs(MIXED), extra: Partial<Parameters<typeof buildLabConsult>[0]> = {}) =>
  buildLabConsult({ labs, gender: '男性', today: TODAY, hypotheses: [HYP], templateItems: TPL, ...extra })!

describe('這次重點：真變化 vs 正常波動', () => {
  const c = build()

  it('超過個人正常波動（RCV）才列；方向用 judgeDirection', () => {
    expect(c.drawDate).toBe(D1)
    expect(c.better.map(x => x.name)).toEqual(['睪固酮'])
    expect(c.worse.map(x => x.name)).toEqual(['空腹胰島素'])
    expect(c.better[0].pct).toBe(55)
  })

  it('雜訊不列、只算數量（ALT +10%、HbA1c +2%、LDL +23% 都在波動內）', () => {
    const listed = [...c.better, ...c.worse, ...c.shiftedInRange].map(x => x.name)
    expect(listed).not.toContain('ALT')
    expect(listed).not.toContain('HbA1c')
    expect(listed).not.toContain('LDL-C')
    expect(c.noiseCount).toBe(3)
  })

  it('真的變了但前後都在很好的範圍 → 不標變差（三酸甘油酯 34→63）', () => {
    expect(c.shiftedInRange.map(x => x.name)).toEqual(['三酸甘油酯'])
  })

  it('這次沒抽到的指標不算「這次重點」', () => {
    const labs = [...pairs(MIXED), { test_name: 'ApoB', value: 50, unit: 'mg/dL', date: '2025-01-01' }, { test_name: 'ApoB', value: 90, unit: 'mg/dL', date: D0 }]
    const x = build(labs)
    expect([...x.better, ...x.worse, ...x.shiftedInRange].map(i => i.name)).not.toContain('ApoB')
  })

  it('只有一次抽血 → 沒有變化可比，也不當雜訊', () => {
    const x = buildLabConsult({ labs: [{ test_name: '睪固酮', value: 600, unit: 'ng/dL', date: D1 }], gender: '男性', today: TODAY })!
    expect(x.better.length + x.worse.length + x.shiftedInRange.length).toBe(0)
    expect(x.noiseCount).toBe(0)
  })
})

describe('要留意／已經很好／預測對答案', () => {
  const c = build()

  it('要留意只取 analyzeLabs 的 critical/attention，正常值裡的漂移不進來', () => {
    expect(c.watch.map(w => w.name)).toEqual(['空腹胰島素'])
    expect(c.watch[0].level).toBe('high')     // 9.5 > 8 → 超出標準
    expect(c.watch[0].side).toBe('high')
    expect(c.worse[0].outOfRange).toBe(true)
  })

  it('肝指數被標要留意時，附上「練大重量會暫時升高」', () => {
    const x = build(pairs([['AST', 30, 95, 'U/L']]))
    expect(x.watch[0].note).toContain('練大重量')
  })

  it('肝指數真的變差（還在正常範圍）也附訓練提醒', () => {
    const x = build(pairs([['AST', 30, 39, 'U/L']]))
    expect(x.worse[0]?.hint).toContain('練大重量')
  })

  it('eGFR 被標要留意時，附上肌肉量／肌酸的說明', () => {
    const x = build(pairs([['eGFR', 100, 70, 'mL/min/1.73m²']]))
    expect(x.watch[0]?.note).toContain('肌酸')
  })

  it('已經很好：optimal 的數量＋名字', () => {
    expect(c.good.names).toContain('HbA1c')
    expect(c.good.count).toBeGreaterThanOrEqual(1)
  })

  it('被這次結果判決的預測列出來（睪固酮 ≥550 → 626.72 猜對）', () => {
    expect(c.answered).toHaveLength(1)
    expect(c.answered[0].status).toBe('confirmed')
  })

  it('還在等的預測（這次沒抽到那項）不列', () => {
    const x = build(pairs(MIXED), { hypotheses: [{ ...HYP, id: 'h2', marker: 'SHBG', baseline_value: 38.4, expected_direction: 'down', expected_value: 30 }] })
    expect(x.answered).toHaveLength(0)
  })
})

describe('下次抽血：日期規則', () => {
  it(`有要留意的 → ${RETEST_MONTHS_WITH_ISSUE} 個月`, () => {
    const c = build()
    expect(c.next.months).toBe(RETEST_MONTHS_WITH_ISSUE)
    expect(c.next.date).toBe('2026-12-30')
  })

  it(`沒有要留意的 → ${RETEST_MONTHS_CLEAN} 個月`, () => {
    const clean = pairs([['睪固酮', 403.92, 626.72, 'ng/dL'], ['HbA1c', 5.2, 5.3, '%'], ['LDL-C', 69, 85, 'mg/dL']])
    const c = build(clean)
    expect(c.watch).toHaveLength(0)
    expect(c.next.months).toBe(RETEST_MONTHS_CLEAN)
    expect(c.next.date).toBe('2027-03-30')
  })

  it('月底加月份不溢位', () => {
    expect(addMonths('2026-08-31', 6)).toBe('2027-02-28')
    expect(addMonths('2026-11-30', 3)).toBe('2027-02-28')
    expect(addMonths('2027-11-15', 3)).toBe('2028-02-15')
  })

  it('要留意的項目一定排進下次，而且用白話名', () => {
    const c = build()
    expect(c.next.items[0].label).toBe('空腹胰島素')
    expect(c.next.items.map(i => i.label)).toContain('ApoB（載脂蛋白 B）')
    expect(plainLabel('HOMA-IR (Insulin + Glucose)', 'homa_ir')).toBe('空腹胰島素＋空腹血糖')
    expect(plainLabel('Estradiol E2 雌激素', null)).toBe('雌激素')
  })

  it('沒有公版也能給建議（只帶這次要留意的）', () => {
    const c = build(pairs(MIXED), { templateItems: null })
    expect(c.next.items.map(i => i.label)).toEqual(['空腹胰島素'])
  })
})

describe('學員看的：沒有價格、沒有病名', () => {
  const c = build()
  const text = renderLabConsultText(c)

  it('不出現價格、底盤、套餐字眼', () => {
    expect(text).not.toMatch(/元|\$|NT|價|底盤|套餐|沒錢|公版/)
    for (const i of c.next.items) expect(`${i.label}${i.why}`).not.toMatch(/\d{3,}|元|底盤|套餐/)
  })

  it('過合規巡檢（不寫病名、不下診斷、不提藥）', () => {
    expect(scanMedicalCompliance(text)).toEqual([])
    // HOMA-IR 很容易被寫成「胰島素阻抗」（病名清單裡）
    const withHoma = renderLabConsultText(build(pairs([['HOMA-IR', 1.0, 3.5, '']])))
    expect(scanMedicalCompliance(withHoma)).toEqual([])
  })

  it('文字版包含五個段落', () => {
    for (const h of ['真的有變的', '要留意', '已經很好', '預測對答案', '下次抽血']) expect(text).toContain(h)
  })
})

describe('新鮮度與自動排下次（不覆蓋教練的未來日期）', () => {
  const c = build()

  it(`最近一次抽血超過 ${CONSULT_FRESH_DAYS} 天 → 不算「這次」`, () => {
    const old = buildLabConsult({ labs: pairs(MIXED), gender: '男性', today: '2026-12-31' })!
    expect(old.fresh).toBe(false)
    expect(shouldAutoSetNextCheckup(null, old)).toBeNull()
  })

  it('沒排過 → 設成建議日', () => {
    expect(shouldAutoSetNextCheckup(null, c)).toBe('2026-12-30')
  })

  it('原本排的日期在這次抽血之前（＝就是這次）→ 換成新的建議日', () => {
    expect(shouldAutoSetNextCheckup('2026-09-26', c)).toBe('2026-12-30')
  })

  it('🚨 教練排在這次之後的日期不動', () => {
    expect(shouldAutoSetNextCheckup('2027-01-16', c)).toBeNull()
    expect(shouldAutoSetNextCheckup(D1, c)).toBeNull()
  })

  it('沒有血檢 → null', () => {
    expect(buildLabConsult({ labs: [], today: TODAY })).toBeNull()
    expect(shouldAutoSetNextCheckup(null, null)).toBeNull()
  })
})

describe('系統沒設判讀標準的指標：照檢驗所範圍（2026-10-02）', () => {
  const labs = [
    { test_name: 'CPK', value: 397, unit: 'U/L', date: D1, reference_range: '46-171' },
    { test_name: 'LDH', value: 194, unit: 'U/L', date: D1, reference_range: '120-246' },
    { test_name: 'Amylase', value: 85, unit: 'U/L', date: D1, reference_range: '' },
    { test_name: '空腹血糖', value: 85, unit: 'mg/dL', date: D1, reference_range: '70-99' },
  ]
  const c = buildLabConsult({ labs, gender: '男性', today: TODAY })!

  it('超出檢驗所範圍的（CPK 397／46–171）進「要留意」，標偏高、附檢驗所範圍、附訓練提醒', () => {
    const cpk = c.watch.find(w => w.name === 'CPK')
    expect(cpk).toBeDefined()
    expect(cpk!.level).toBe('watch')
    expect(cpk!.side).toBe('high')
    expect(cpk!.labRangeText).toBe('46-171')
    expect(cpk!.note).toMatch(/大重量/)
  })
  it('在檢驗所範圍內、或沒印範圍的，不進「要留意」', () => {
    expect(c.watch.some(w => w.name === 'LDH')).toBe(false)
    expect(c.watch.some(w => w.name === 'Amylase')).toBe(false)
  })
  it('有要留意 → 3 個月後回來驗；文字版帶出檢驗所範圍、不含病名', () => {
    expect(c.next.months).toBe(RETEST_MONTHS_WITH_ISSUE)
    const text = renderLabConsultText(c)
    expect(text).toMatch(/CPK 397.*檢驗所範圍 46-171/)
    expect(scanMedicalCompliance(text)).toEqual([])
  })
})

describe('接下來怎麼做：營養＋補品引擎按血檢項目接起來（2026-10-02）', () => {
  const advice = [
    { category: 'glucose', title: '空腹血糖偏高', icon: '', severity: 'medium', dietaryChanges: ['晚餐減少精製碳水', '餐後散步 10-15 分鐘'], foodsToIncrease: [], foodsToReduce: [], labMarker: '空腹血糖', currentValue: 95, unit: 'mg/dL', targetRange: '<90 mg/dL（最佳）', references: [] },
    { category: 'kidney', title: 'eGFR 偏低', icon: '', severity: 'medium', dietaryChanges: ['確保充足飲水', '控制血壓', '蛋白質別過量'], foodsToIncrease: [], foodsToReduce: [], labMarker: 'eGFR', currentValue: 82.57, unit: 'mL/min', targetRange: '>90', references: [] },
    { category: 'lipid', title: 'ApoB 極低', icon: '', severity: 'positive', dietaryChanges: ['脂肪可放寬'], foodsToIncrease: [], foodsToReduce: [], labMarker: 'ApoB', currentValue: 42, unit: 'mg/dL', targetRange: '', references: [] },
  ] as never
  const sups = [
    { name: '⚠️ 停止鐵劑補充', dosage: '立即停止所有含鐵補品', timing: '—', reason: '鐵蛋白 250', priority: 'medium', evidence: '', triggerTests: ['鐵蛋白'], category: 'deficiency' },
    { name: '肌酸', dosage: '3-5g', timing: '任何時間', reason: '', priority: 'high', evidence: '', triggerTests: [], category: 'performance' },
  ] as never
  const latest = new Map([['ferritin', { value: 250, unit: 'ng/mL' }]])
  const acts = buildConsultActions(advice, sups, '2027-01-16', ['eGFR'], latest)

  it('正向建議、跟血檢無關的補品（肌酸）不進來', () => {
    expect(acts.map(a => a.name)).toEqual(['eGFR', '空腹血糖', '鐵蛋白'])
  })
  it('要留意的排前面；每項都帶驗收日', () => {
    expect(acts.every(a => a.retestDate === '2027-01-16')).toBe(true)
  })
  it('eGFR 先講肌肉量，再給引擎做法，最多 3 條', () => {
    const e = acts.find(a => a.name === 'eGFR')!
    expect(e.doThis[0]).toMatch(/肌肉量/)
    expect(e.doThis).toHaveLength(3)
  })
  it('只有補品觸發的項目，數值從最新血檢補上', () => {
    const f = acts.find(a => a.name === '鐵蛋白')!
    expect(f).toMatchObject({ value: 250, unit: 'ng/mL' })
    expect(f.supplements[0].dosage).toMatch(/停止/)
  })
  it('教練排的日期在這次抽血之後 → 驗收日用它', () => {
    const c = buildLabConsult({ labs: [{ test_name: '空腹血糖', value: 95, unit: 'mg/dL', date: D1 }], gender: '男性', today: TODAY, advice, scheduledCheckup: '2027-01-16' })!
    expect(c.actions[0].retestDate).toBe('2027-01-16')
    expect(scanMedicalCompliance(renderLabConsultText(c))).toEqual([])
  })
})

describe('2026-10-03 收尾：目標統一、重訓者 eGFR、用藥', () => {
  it('目標從標準檔讀：同半胱胺酸＝最佳 <6（正常 ≤8）、空腹血糖＝最佳 70-85（正常 ≤90）', () => {
    expect(standardTarget('同半胱胺酸', '男性')).toBe('<6（正常 ≤8）')
    expect(standardTarget('空腹血糖', '男性')).toBe('70-85（正常 ≤90）')
    expect(standardTarget('CPK')).toBeNull()
  })
  it('A 酸會影響的項目：要留意那行與接下來怎麼做都帶用藥提醒；療程外的抽血不帶', () => {
    const meds = [{ key: 'isotretinoin', since: '2026-08-01', until: null }]
    const labs = [{ test_name: 'CPK', value: 397, unit: 'U/L', date: D1, reference_range: '46-171' }]
    const c = buildLabConsult({ labs, gender: '男性', today: TODAY, medications: meds })!
    expect(c.watch.find(w => w.name === 'CPK')!.note).toMatch(/A 酸/)
    const before = buildLabConsult({ labs, gender: '男性', today: TODAY, medications: [{ key: 'isotretinoin', since: '2026-10-01', until: null }] })!
    expect(before.watch.find(w => w.name === 'CPK')!.note).not.toMatch(/A 酸/)
    expect(scanMedicalCompliance(renderLabConsultText(c))).toEqual([])
  })
  it('重訓者 eGFR 被標要留意 → 下次抽血加驗 Cystatin C', () => {
    const labs = [{ test_name: 'eGFR', value: 82.57, unit: 'mL/min/1.73m²', date: D1 }]
    const t = buildLabConsult({ labs, gender: '男性', today: TODAY, resistanceTrained: true })!
    expect(t.next.items.some(i => /Cystatin C/.test(i.label))).toBe(true)
    const u = buildLabConsult({ labs, gender: '男性', today: TODAY })!
    expect(u.next.items.some(i => /Cystatin C/.test(i.label))).toBe(false)
  })
})

describe('你在吃的保健品（2026-10-03）', () => {
  it('同名合併劑量、要注意排最前、沒驗過的寫驗收日；文字版過合規', () => {
    const labs = [
      { test_name: '鐵蛋白', value: 250, unit: 'ng/mL', date: D1 },
      { test_name: '同半胱胺酸', value: 9, unit: 'μmol/L', date: '2026-01-07' },
    ]
    const c = buildLabConsult({
      labs, gender: '男性', today: TODAY, scheduledCheckup: '2027-01-16',
      currentSupplements: [
        { name: 'tmg', dosage: '兩顆', timing: '早餐', started_at: '2026-02-07' },
        { name: 'ＴＭＧ', dosage: '兩顆', timing: '晚餐', started_at: '2026-02-07' },
        { name: 'Vitaminc', dosage: '1000mg', timing: '早餐', started_at: '2026-02-07' },
      ],
    })!
    expect(c.stack[0]).toMatchObject({ name: 'Vitaminc', status: 'caution' })
    const tmg = c.stack.find(x => x.name.toLowerCase() === 'tmg')!
    expect(tmg.dose).toBe('兩顆 早餐；兩顆 晚餐')
    expect(tmg.effect).toMatch(/還沒驗過.*2027-01-16/)
    expect(scanMedicalCompliance(renderLabConsultText(c))).toEqual([])
  })
})
