import { describe, it, expect } from 'vitest'
import { formatLabSummary, type LabSummaryInput } from '@/lib/line-lab-summary'
import { buildMarkerStory, gradeHypothesis, type LabHypothesis } from '@/lib/longevity-lens'

const rows = { weights: [], nutrition: [], training: [], wellness: [] }
const today = '2026-09-25'
const story = (name: string, pts: [string, number][], gender = '男性') =>
  buildMarkerStory(name, pts.map(([date, value]) => ({ date, value, unit: 'mg/dL' })), rows, today, gender)

const base = (over: Partial<LabSummaryInput>): LabSummaryInput => ({
  stories: [], hypotheses: [], order: null, dashboardUrl: 'https://x/c/abc', today, ...over,
})

describe('formatLabSummary', () => {
  it('沒資料也沒開血檢 → 引導跟 Howard 說，不丟空卡', () => {
    const t = formatLabSummary(base({ order: { enabled: false } }))
    expect(t).toContain('還沒有血檢紀錄')
    expect(t).not.toContain('https://x/c/abc')
  })

  it('真的變好／雜訊分開放：雜訊只列名字，不列成「在變」', () => {
    const t = formatLabSummary(base({
      stories: [
        story('ApoB', [['2026-01-01', 110], ['2026-09-01', 80]]),     // -27%，遠超波動
        story('三酸甘油酯', [['2026-01-01', 100], ['2026-09-01', 105]]), // +5%，雜訊
      ],
    }))
    expect(t).toContain('✅ 真的變好')
    expect(t).toMatch(/ApoB 110 → 80 mg\/dL（-27%/)
    expect(t).toContain('沒真的變（在正常波動內）：三酸甘油酯')
    expect(t).not.toContain('⚠️ 真的變差')
    expect(t).toContain('最近一次抽血 9/1')
  })

  it('都沒超過波動 → 直說沒真的變', () => {
    const t = formatLabSummary(base({ stories: [story('三酸甘油酯', [['2026-01-01', 100], ['2026-09-01', 104]])] }))
    expect(t).toContain('沒有超過正常波動的變化')
  })

  it('只驗過一次 → 歸到看不出趨勢', () => {
    const t = formatLabSummary(base({ stories: [story('ApoB', [['2026-09-01', 80]])] }))
    expect(t).toContain('只驗過一次、還看不出趨勢：ApoB')
  })

  it('預測：等結果的列預計日期、有結果的對答案；教練手寫的 cause/action 不外洩', () => {
    const h: LabHypothesis = {
      id: '1', marker: '睪固酮', baseline_date: '2026-06-01', baseline_value: 400,
      cause: '某某病因說明', action: '吃某藥', expected_direction: 'up', expected_value: 550,
      retest_by: '2026-09-26', note: null, created_at: '2026-06-01',
    }
    const pending = formatLabSummary(base({ hypotheses: [{ ...h, grade: gradeHypothesis(h, [], today, '男性') }] }))
    expect(pending).toContain('睪固酮 預測 ≥ 550（預計 9/26 前驗） → ⏳ 等結果')
    expect(pending).not.toContain('某某病因')
    expect(pending).not.toContain('吃某藥')

    const done = formatLabSummary(base({
      hypotheses: [{ ...h, grade: gradeHypothesis(h, [{ date: '2026-09-20', value: 600 }], today, '男性') }],
    }))
    expect(done).toContain('這次 600 → ✅ 中了')
  })

  it('超過半年前出爐的預測不翻舊帳', () => {
    const h: LabHypothesis = {
      id: '1', marker: 'ApoB', baseline_date: '2025-01-01', baseline_value: 100, cause: null, action: null,
      expected_direction: 'down', expected_value: 80, retest_by: '2025-03-01', note: null, created_at: '2025-01-01',
    }
    const t = formatLabSummary(base({
      stories: [story('ApoB', [['2025-01-01', 100], ['2025-03-01', 78]])],
      hypotheses: [{ ...h, grade: gradeHypothesis(h, [{ date: '2025-03-01', value: 78 }], today) }],
    }))
    expect(t).not.toContain('🎯')
  })

  it('下次抽血：列必驗＋金額＋省下來的項數', () => {
    const t = formatLabSummary(base({
      stories: [story('ApoB', [['2026-09-01', 80]])],
      order: {
        enabled: true, nextCheckupDate: '2026-12-01',
        must: [{ label: 'ApoB', price: 500, why: '' }, { label: 'Lp(a)', price: null, why: '' }],
        defer: [], skip: [{ label: '血紅素', price: 100, why: '' }],
        mustCost: 500, fullCost: 500, templateCost: 2000, unknownPriceCount: 1,
        basePackage: { price: 0, skippable: true, why: '' }, prepNotes: null,
      },
    }))
    expect(t).toContain('下次抽血（預計 12/1）驗這些，約 $500')
    expect(t).toContain('・ApoB $500')
    expect(t).toContain('・Lp(a)\n')
    expect(t).toContain('1 項上次已經很好或不用重驗')
    expect(t).toContain('https://x/c/abc?openExternalBrowser=1')
  })

  it('列太多會截斷，不爆 LINE 5000 字上限', () => {
    const names = ['ApoB', 'LDL-C', '總膽固醇', '三酸甘油酯', 'HbA1c', '空腹血糖', '空腹胰島素', 'ALT']
    const t = formatLabSummary(base({ stories: names.map(n => story(n, [['2026-09-01', 100]])) }))
    expect(t.length).toBeLessThan(5000)
  })
})

describe('formatLabSummary 邊界', () => {
  const order = (nextCheckupDate: string) => ({
    enabled: true as const, nextCheckupDate, must: [{ label: 'ApoB', price: 500, why: '' }], defer: [], skip: [],
    mustCost: 500, fullCost: 500, templateCost: 500, unknownPriceCount: 0,
    basePackage: { price: 0, skippable: true, why: '' }, prepNotes: null,
  })
  it('預計抽血日已過 → 講「已經過了，該約了」而不是假裝還沒到', () => {
    const t = formatLabSummary(base({ order: order('2026-09-08') }))
    expect(t).toContain('原訂 9/8，已經過了，該約了')
  })
  it('名字清單超過 8 個 → 只列 8 個＋總數', () => {
    const many = ['ApoB', 'LDL-C', '總膽固醇', '三酸甘油酯', 'HbA1c', '空腹血糖', '空腹胰島素', 'ALT', 'AST', 'GGT']
    const t = formatLabSummary(base({ stories: many.map(n => story(n, [['2026-09-01', 100]])) }))
    expect(t).toContain('等 10 項')
  })
})
