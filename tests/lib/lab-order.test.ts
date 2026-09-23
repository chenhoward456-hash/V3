import { describe, it, expect } from 'vitest'
import { buildLabOrder, resolveMarkerId, RECENT_DAYS, type TemplateItem } from '@/lib/lab-order'
import { deriveTestosterone, deriveHomaIR } from '@/lib/lab-derive'

/**
 * 開單減法引擎的契約。
 *
 * 這支決定的是 Howard（和學員）**實際要付多少錢**。兩種錯法都很貴：
 *   - 少扣 → 就是它原本的行為：公版 11,970 整包吐出來。他的原話是「太貴了，乾，沒錢啦」。
 *   - 多扣 → 更糟，會讓人以為某件事已經知道了。血檢跳過一項的代價不是 400 元，
 *     是下一次抽血之前都沒有那個數字。
 *
 * 所以每條「不用驗」的規則都要有測試釘住它為什麼成立。
 */

const TODAY = '2026-09-13'
const daysAgo = (n: number) => new Date(Date.parse(TODAY) - n * 86400000).toISOString().split('T')[0]

const TPL: TemplateItem[] = [
  { name: 'Testosterone 總睪固酮', price: 300, priority: 'must' },
  { name: 'Free Testosterone 游離睪固酮', price: 400, priority: 'must' },
  { name: 'Estradiol E2 雌激素', price: 400, priority: 'must' },
  { name: 'Prolactin 催乳激素', price: 400, priority: 'must' },
  { name: 'DHEA-S', price: 400, priority: 'must' },
  { name: 'Homocysteine 同半胱胺酸', price: 250, priority: 'must' },
  { name: 'Vitamin B12', price: 600, priority: 'must' },
  { name: 'Folate 葉酸', price: 600, priority: 'must' },
  { name: '25-OH Vitamin D Total', price: 700, priority: 'must' },
  { name: 'HOMA-IR (Insulin + Glucose)', price: 470, priority: 'must' },
  { name: 'Apo B (外送大安聯合)', price: 600, priority: 'must' },
  { name: 'Apo E genotyping', price: 1500, priority: 'optional' },
]

const plan = (labs: { test_name: string; value: number; date: string }[]) =>
  buildLabOrder({ labs, templateItems: TPL, basePrice: 3600, gender: '男性', today: TODAY })

const find = (p: ReturnType<typeof plan>, needle: string) =>
  [...p.must, ...p.defer, ...p.skip].find(l => l.label.includes(needle))

describe('resolveMarkerId：公版的混寫要對得回 canonical', () => {
  it('中英混寫、括號註記都要認得', () => {
    expect(resolveMarkerId('Testosterone 總睪固酮')).toBe('testosterone')
    expect(resolveMarkerId('Apo B (外送大安聯合)')).toBe('apob')
    expect(resolveMarkerId('25-OH Vitamin D Total')).toBe('vitamin_d')
    expect(resolveMarkerId('Prolactin 催乳激素')).toBe('prolactin')
    expect(resolveMarkerId('Free Testosterone 游離睪固酮')).toBe('free_testosterone')
  })

  it('🚨 ApoB 跟 ApoE 是兩回事，不能混', () => {
    expect(resolveMarkerId('Apo B (外送大安聯合)')).toBe('apob')
    expect(resolveMarkerId('Apo E genotyping')).toBe('apoe')
  })

  it('對不到就回 null，不要瞎猜', () => {
    expect(resolveMarkerId('某某某全套健檢')).toBeNull()
  })
})

describe('不用開的四種理由', () => {
  it('基因型驗過就終身不用再驗', () => {
    const p = buildLabOrder({
      labs: [{ test_name: 'Lp(a)', value: 76.84, date: '2025-08-12' }],
      templateItems: [{ name: 'Lp(a)', price: 800, priority: 'must' }],
      gender: '男性', today: TODAY,
    })
    expect(p.skip[0].rule).toBe('genetic-once')
    expect(p.must).toHaveLength(0)
  })

  it('最近驗過而且在最佳範圍 → 驗完動作一樣，不用花這筆', () => {
    // 維生素D 59，最佳 40-60，177 天前
    const p = plan([{ test_name: '維生素D', value: 59, date: daysAgo(177) }])
    expect(find(p, 'Vitamin D')!.rule).toBe('recent-optimal')
  })

  it(`超過 ${RECENT_DAYS} 天就算太久，回到「可延後」`, () => {
    const p = plan([{ test_name: '維生素D', value: 59, date: daysAgo(RECENT_DAYS + 1) }])
    expect(find(p, 'Vitamin D')!.rule).toBe('stale')
    expect(find(p, 'Vitamin D')!.bucket).toBe('defer')
  })

  it('🚨 沒定義最佳區間的指標，不可以被判成 recent-optimal', () => {
    // 游離睪固酮刻意不設最佳目標（只看趨勢），isInOptimalRange 對它一律回 true。
    // 直接拿來當跳過理由，會把腰斬掉的數字判成「驗完動作一樣」。
    const p = plan([
      { test_name: '游離睪固酮', value: 72.8, date: daysAgo(30) },
      { test_name: '睪固酮', value: 403.92, date: daysAgo(30) },
    ])
    expect(find(p, '游離睪固酮')!.rule).not.toBe('recent-optimal')
  })

  it('算得出來的不用驗，而且要講出處', () => {
    const p = plan([{ test_name: '睪固酮', value: 403.92, date: daysAgo(200) }])
    const ft = find(p, '游離睪固酮')!
    expect(ft.rule).toBe('derivable')
    expect(ft.why).toContain('Vermeulen')
  })

  it('上游還沒結果，下游先不要開', () => {
    const p = plan([{ test_name: '同半胱胺酸', value: 9, date: daysAgo(200) }])
    expect(find(p, '同半胱胺酸')!.bucket).toBe('must')    // 上游要驗
    expect(find(p, 'B12')!.rule).toBe('deferred')          // 下游等結果
    expect(find(p, 'Folate')!.rule).toBe('deferred')
  })

  it('上游這次不驗（最近才驗過且最佳）時，下游不該被莫名其妙擋掉', () => {
    const p = plan([
      { test_name: '睪固酮', value: 800, date: daysAgo(10) },     // 最佳 700-900
      { test_name: 'SHBG', value: 30, date: daysAgo(10) },
    ])
    expect(find(p, '總睪固酮')!.bucket).toBe('skip')
    expect(find(p, 'Prolactin')!.rule).not.toBe('deferred')
  })
})

describe('🚨 假省錢：套裝不能拆成「用算的」', () => {
  it('HOMA-IR 那一筆本身就是胰島素＋血糖，不能劃掉再單點輸入', () => {
    // 公版沒有獨立的胰島素／血糖行 → 470 就是套裝本身。
    // 劃掉它再去單點兩個輸入，帳面省 470、實際付一樣多。
    const p = plan([])
    const h = find(p, 'HOMA-IR')!
    expect(h.rule).not.toBe('derivable')
    expect(h.bucket).not.toBe('skip')
    expect(find(p, '空腹胰島素')).toBeUndefined()
    expect(find(p, '空腹血糖')).toBeUndefined()
  })

  it('輸入真的分開賣時才算得出來 —— 總睪固酮有獨立一行，所以游離 T 可以省', () => {
    const p = plan([{ test_name: '睪固酮', value: 403.92, date: daysAgo(200) }])
    expect(find(p, '游離睪固酮')!.rule).toBe('derivable')
  })
})

describe('🚨 公版漏掉的輸入要自己補回來', () => {
  const withT = [
    { test_name: '睪固酮', value: 403.92, date: daysAgo(177) },
    { test_name: 'SHBG', value: 38.4, date: daysAgo(177) },
  ]

  it('SHBG 不在公版裡，但少了它算不出游離／生物可利用睪固酮', () => {
    const shbg = find(plan(withT), 'SHBG')!
    expect(shbg.rule).toBe('companion')
    expect(shbg.bucket).toBe('must')
    expect(shbg.price).toBeNull()   // 公版沒列價，要誠實講不知道
  })

  it('價格不明的要被算進 unknownPriceCount，不能當成 0 元混進總價', () => {
    const p = plan(withT)
    expect(p.unknownPriceCount).toBeGreaterThan(0)
    expect(p.mustCost).toBe(p.must.reduce((s, l) => s + (l.price ?? 0), 0))
  })

  it('🚨 同一個計算式的輸入必須同一管血 —— 不能拿新的總T配舊的 SHBG', () => {
    // SHBG 177 天前驗過（在 RECENT_DAYS 內），但總睪固酮這次要重驗。
    // 沿用舊 SHBG 算出來的游離 T 是垃圾 —— SHBG 正是 Howard 變最多的那一項（+57%）。
    const p = plan(withT)
    expect(find(p, '總睪固酮')!.bucket).toBe('must')
    expect(find(p, 'SHBG')!.bucket).toBe('must')
  })

  it('全部輸入都夠新、都不用重驗時，不要硬補一項出來', () => {
    const p = plan([
      { test_name: '睪固酮', value: 800, date: daysAgo(10) },
      { test_name: 'SHBG', value: 30, date: daysAgo(10) },
    ])
    expect(find(p, 'SHBG（性荷爾蒙')).toBeUndefined()
  })
})

describe('三個桶子＝預算分層', () => {
  it('有已知異常要追的進「必開」，沒問題的基準線進「可延後」', () => {
    const p = plan([
      { test_name: '睪固酮', value: 403.92, date: daysAgo(177) },  // 最佳 700-900 → 追
      { test_name: 'SHBG', value: 38.4, date: daysAgo(177) },
    ])
    expect(find(p, '總睪固酮')!.rule).toBe('follow-up')
    expect(find(p, 'Apo B')!.bucket).toBe('defer')   // 從沒驗過、沒有已知問題
  })

  it('optional 項目不進任何桶，也不算進公版對照價', () => {
    const p = plan([])
    expect(find(p, 'Apo E')).toBeUndefined()
    expect(p.templateCost).toBe(TPL.filter(t => t.priority === 'must').reduce((s, t) => s + t.price!, 0))
  })

  it('必開一定比公版全開便宜 —— 不然這支沒有存在意義', () => {
    const p = plan([{ test_name: '睪固酮', value: 403.92, date: daysAgo(177) }])
    expect(p.mustCost).toBeLessThan(p.templateCost)
  })
})

describe('底盤套餐要不要再開', () => {
  const routine = (date: string) => [
    { test_name: 'ALT', value: 30, date }, { test_name: 'AST', value: 30, date },
    { test_name: '總膽固醇', value: 159, date }, { test_name: '三酸甘油酯', value: 63, date },
  ]

  it('常規項目最近才驗過而且都正常 → 底盤可以不開，直接開單項', () => {
    const p = plan(routine(daysAgo(79)))
    expect(p.basePackage.skippable).toBe(true)
  })

  it('太久沒驗 → 底盤該開', () => {
    expect(plan(routine(daysAgo(RECENT_DAYS + 1))).basePackage.skippable).toBe(false)
  })

  it('最近驗過但有項目不正常 → 底盤值得再開', () => {
    // ⚠️ 同一個指標同一天不能塞兩筆來測 —— buildHistory 每個指標只留最新一筆，
    // 日期相同時先到先留，第二筆會被吃掉。用不同指標。
    const p = plan([...routine(daysAgo(30)), { test_name: '肌酸酐', value: 2.4, date: daysAgo(30) }])
    expect(p.basePackage.skippable).toBe(false)
  })

  it('完全沒紀錄 → 底盤該開', () => {
    expect(plan([]).basePackage.skippable).toBe(false)
  })
})

describe('lab-derive：算出來的要跟實測對得上', () => {
  // 用 Howard 自己的兩組真實資料回歸驗證。誤差大於 10% 就代表公式或單位寫錯了。
  it.each([
    ['2026-03-20', 403.92, 38.4, 4.6, 72.8, 182],
    ['2025-08',    515,    24.4, 4.6, 123,  325],
  ])('%s 的游離／生物可利用睪固酮', (_d, t, shbg, alb, expectFree, expectBio) => {
    const r = deriveTestosterone(t as number, shbg as number, alb as number)!
    expect(Math.abs(r.freeTestosterone - (expectFree as number)) / (expectFree as number)).toBeLessThan(0.1)
    expect(Math.abs(r.bioavailableTestosterone - (expectBio as number)) / (expectBio as number)).toBeLessThan(0.1)
  })

  it('沒給白蛋白時用預設值，而且要標記出來（數字要保守看）', () => {
    const r = deriveTestosterone(403.92, 38.4, null)!
    expect(r.albuminAssumed).toBe(true)
    expect(r.freeTestosterone).toBeGreaterThan(50)
  })

  it('HOMA-IR = 胰島素 × 血糖 / 405', () => {
    expect(deriveHomaIR(2.17, 90)!).toBeCloseTo(0.48, 2)
  })

  it('垃圾輸入回 null，不要吐一個看起來像數字的東西', () => {
    expect(deriveTestosterone(0, 38.4, 4.6)).toBeNull()
    expect(deriveTestosterone(400, 0, 4.6)).toBeNull()
    expect(deriveTestosterone(NaN, 38.4, 4.6)).toBeNull()
    expect(deriveHomaIR(NaN, 90)).toBeNull()
    expect(deriveHomaIR(2.17, -1)).toBeNull()
  })
})

describe('風險連動：Lp(a) 偏高 → ApoB 升為必驗（2026-09-24 謝佳峻）', () => {
  it('Lp(a) 76.84、ApoB 從沒驗過 → ApoB 必驗（原本會被放「有錢再加」）', () => {
    const p = plan([{ test_name: 'Lp(a)', value: 76.84, date: daysAgo(200) }])
    const apob = find(p, 'Apo B')!
    expect(apob.bucket).toBe('must')
    expect(apob.rule).toBe('risk-linked')
  })
  it('Lp(a) 正常（10）→ ApoB 維持基準線', () => {
    const p = plan([{ test_name: 'Lp(a)', value: 10, date: daysAgo(200) }])
    expect(find(p, 'Apo B')!.bucket).toBe('defer')
  })
  it('Lp(a) 偏高但 ApoB 最近才驗過 → 不重複升級', () => {
    const p = plan([
      { test_name: 'Lp(a)', value: 76.84, date: daysAgo(200) },
      { test_name: 'ApoB', value: 55, date: daysAgo(30) },
    ])
    expect(find(p, 'Apo B')!.rule).not.toBe('risk-linked')
  })
})
