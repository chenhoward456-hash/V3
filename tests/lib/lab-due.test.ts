import { describe, it, expect } from 'vitest'
import {
  findLabsDue, evaluateLabDue, formatLabDueLines,
  DUE_SOON_DAYS, STALE_DAYS, MAX_WATCH_ITEMS,
  type LabDueClientInput,
} from '@/lib/lab-due'

/**
 * 血檢到期的契約。
 *
 * 這段決定的是「Howard 早上那封信裡會不會出現『你該去抽血了』」。
 * 判錯的代價有兩個方向、都很實際：
 *   - 漏判 → 就是 2026-09-13 當下的狀況：謝佳峻的回檢日過了 5 天、
 *     陳胤豪 panel note 排的 09-03 過了 10 天，沒有任何人知道。
 *   - 過度判 → 每天都在唸同一個人，整封信會被滑過去（跟掉線名單設 30 天上限同一個理由）。
 */

const TODAY = '2026-09-13'

const c = (o: Partial<LabDueClientInput> = {}): LabDueClientInput => ({
  id: 'x', name: '某人', gender: '男性', labs: [], ...o,
})

describe('evaluateLabDue：誰該回檢', () => {
  it('排定日逾期 → 到期，daysUntil 是負數', () => {
    const { item, due } = evaluateLabDue(c({ next_checkup_date: '2026-09-08' }), TODAY)
    expect(due).toBe(true)
    expect(item.daysUntil).toBe(-5)
    expect(item.reason).toBe('scheduled')
  })

  it(`剩 ${DUE_SOON_DAYS} 天內 → 到期；再遠一天 → 還不用唸`, () => {
    const soon = new Date(Date.parse(TODAY) + DUE_SOON_DAYS * 86400000).toISOString().split('T')[0]
    const later = new Date(Date.parse(TODAY) + (DUE_SOON_DAYS + 1) * 86400000).toISOString().split('T')[0]
    expect(evaluateLabDue(c({ next_checkup_date: soon }), TODAY).due).toBe(true)
    expect(evaluateLabDue(c({ next_checkup_date: later }), TODAY).due).toBe(false)
  })

  it('🚨 兩個回檢日來源取「較早」的 —— 寧可早提醒也不要漏', () => {
    // 陳胤豪本人的真實狀況：學員頁 09-26、報告總結 09-03，差 23 天。
    const { item } = evaluateLabDue(
      c({ next_checkup_date: '2026-09-26', panel_next_review_date: '2026-09-03' }),
      TODAY,
    )
    expect(item.dueDate).toBe('2026-09-03')
    expect(item.daysUntil).toBe(-10)
  })

  it('兩個日期不一致要標出來，這本身就是該去對帳的事', () => {
    expect(evaluateLabDue(
      c({ next_checkup_date: '2026-09-26', panel_next_review_date: '2026-09-03' }), TODAY,
    ).item.conflictingDates).toBe(true)

    expect(evaluateLabDue(
      c({ next_checkup_date: '2026-09-26', panel_next_review_date: '2026-09-26' }), TODAY,
    ).item.conflictingDates).toBe(false)

    // 只有一個來源不算衝突
    expect(evaluateLabDue(c({ next_checkup_date: '2026-09-26' }), TODAY).item.conflictingDates).toBe(false)
  })

  it(`沒排回檢日 + 上次抽血超過 ${STALE_DAYS} 天 → 到期（reason=stale）`, () => {
    const old = new Date(Date.parse(TODAY) - (STALE_DAYS + 1) * 86400000).toISOString().split('T')[0]
    const { item, due } = evaluateLabDue(c({ labs: [{ test_name: 'HbA1c', value: 5.1, date: old }] }), TODAY)
    expect(due).toBe(true)
    expect(item.reason).toBe('stale')
    expect(item.daysUntil).toBeNull()
  })

  it('🚨 已經排了 3 個月後的人，不因為「上次抽血很久」被天天唸', () => {
    // stale 只在「沒排回檢日」時兜底。排了就該相信那個日期，
    // 否則排程等於沒用，信裡天天多一個不需要動的人。
    const old = new Date(Date.parse(TODAY) - 300 * 86400000).toISOString().split('T')[0]
    const { due } = evaluateLabDue(c({
      next_checkup_date: '2026-12-20',
      labs: [{ test_name: 'HbA1c', value: 5.1, date: old }],
    }), TODAY)
    expect(due).toBe(false)
  })

  it('沒排日期也從沒抽過血 → 不算到期（那是還沒開始，不是逾期）', () => {
    expect(evaluateLabDue(c({ labs: [] }), TODAY).due).toBe(false)
  })
})

describe('watch：這次要盯哪幾項', () => {
  const overdue = { next_checkup_date: '2026-09-08' }

  it('把上次沒回到標準的項目帶進來 —— 不然「該回檢」等於只講了一半', () => {
    const { item } = evaluateLabDue(c({
      ...overdue,
      labs: [
        { test_name: '同半胱胺酸', value: 9, unit: 'μmol/L', date: '2026-01-07' },
        { test_name: 'ApoB', value: 42, unit: 'mg/dL', date: '2025-08-12' },
      ],
    }), TODAY)
    const names = item.watch.map(w => w.name)
    expect(names).toContain('同半胱胺酸')   // 9 > normal 8.0
    expect(names).not.toContain('ApoB')     // 42 遠低於 80，沒事就別佔版面
  })

  it(`最多 ${MAX_WATCH_ITEMS} 項 —— 列太多等於沒列`, () => {
    const labs = ['同半胱胺酸', '三酸甘油酯', 'ApoB', 'HOMA-IR', 'HbA1c', '尿酸']
      .map(test_name => ({ test_name, value: 9999, date: '2026-01-07' }))
    const { item } = evaluateLabDue(c({ ...overdue, labs }), TODAY)
    expect(item.watch.length).toBeLessThanOrEqual(MAX_WATCH_ITEMS)
  })

  it('女性走女性閾值（紅線 4：判讀一律用 labStatus 重算，不吃 DB 的 status）', () => {
    // 尿酸 6.5：男性 normal(<7.0)、女性 attention(>6.0)
    const labs = [{ test_name: '尿酸', value: 6.5, date: '2026-01-07' }]
    const male = evaluateLabDue(c({ ...overdue, gender: '男性', labs }), TODAY).item.watch
    const female = evaluateLabDue(c({ ...overdue, gender: '女性', labs }), TODAY).item.watch
    expect(male.map(w => w.name)).not.toContain('尿酸')
    expect(female.map(w => w.name)).toContain('尿酸')
  })

  it('DB 寫 status=normal 也照樣重算（紅線 4）', () => {
    const { item } = evaluateLabDue(c({
      ...overdue,
      labs: [{ test_name: '同半胱胺酸', value: 15, date: '2026-01-07', status: 'normal' }],
    }), TODAY)
    expect(item.watch.map(w => w.name)).toContain('同半胱胺酸')
  })
})

describe('findLabsDue：排序與過濾', () => {
  it('只回傳到期的，逾期最久的排最前面、沒日期的墊底', () => {
    const staleDate = new Date(Date.parse(TODAY) - 200 * 86400000).toISOString().split('T')[0]
    const out = findLabsDue([
      c({ id: '1', name: '快到期', next_checkup_date: '2026-09-20' }),
      c({ id: '2', name: '逾期久', next_checkup_date: '2026-07-25' }),
      c({ id: '3', name: '沒日期但放很久', labs: [{ test_name: 'HbA1c', value: 5.1, date: staleDate }] }),
      c({ id: '4', name: '還很遠', next_checkup_date: '2027-01-01' }),
    ], TODAY)
    expect(out.map(o => o.name)).toEqual(['逾期久', '快到期', '沒日期但放很久'])
  })
})

describe('formatLabDueLines：寫進信裡長怎樣', () => {
  it('逾期講「已逾期 N 天」，不是給一個要自己心算的日期', () => {
    const { item } = evaluateLabDue(c({ name: '謝佳峻', next_checkup_date: '2026-09-08' }), TODAY)
    expect(formatLabDueLines(item).join('\n')).toContain('已逾期 5 天')
  })

  it('當天就說「就是今天」', () => {
    const { item } = evaluateLabDue(c({ next_checkup_date: TODAY }), TODAY)
    expect(formatLabDueLines(item).join('\n')).toContain('就是今天')
  })

  it('帶要盯的項目與最佳區間', () => {
    const { item } = evaluateLabDue(c({
      name: '陳胤豪',
      next_checkup_date: '2026-09-03',
      labs: [{ test_name: '同半胱胺酸', value: 9, unit: 'μmol/L', date: '2026-01-07' }],
    }), TODAY)
    const text = formatLabDueLines(item).join('\n')
    expect(text).toContain('這次要盯')
    expect(text).toContain('同半胱胺酸 9')
  })

  it('日期打架要在信裡講，不然只有開後台才看得到', () => {
    const { item } = evaluateLabDue(
      c({ next_checkup_date: '2026-09-26', panel_next_review_date: '2026-09-03' }), TODAY,
    )
    expect(formatLabDueLines(item).join('\n')).toContain('回檢日不一致')
  })
})

describe('開單摘要進晨報', () => {
  const TPL = [
    { name: 'Testosterone 總睪固酮', price: 300, priority: 'must' },
    { name: 'Free Testosterone 游離睪固酮', price: 400, priority: 'must' },
    { name: '25-OH Vitamin D Total', price: 700, priority: 'must' },
  ]

  it('該回檢的人要順便講「這次開什麼、多少錢」—— 不然只講了一半', () => {
    const { item } = evaluateLabDue(c({
      name: '陳胤豪',
      next_checkup_date: '2026-09-03',
      templateItems: TPL,
      templateBasePrice: 3600,
      labs: [
        { test_name: '睪固酮', value: 403.92, date: '2026-03-20' },
        { test_name: 'SHBG', value: 38.4, date: '2026-03-20' },
      ],
    }), TODAY)
    const text = formatLabDueLines(item).join('\n')
    expect(text).toContain('這次開')
    expect(text).toContain('公版全開')
    expect(text).toContain('省：')
  })

  it('沒有對應公版就不出開單建議，不要硬掰', () => {
    const { item } = evaluateLabDue(c({ next_checkup_date: '2026-09-03' }), TODAY)
    expect(item.order).toBeNull()
    expect(formatLabDueLines(item).join('\n')).not.toContain('這次開')
  })
})
