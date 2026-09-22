import { describe, it, expect } from 'vitest'
import { checkPlanHealth, summarizePlanHealth } from '@/lib/plan-health'

/** training_plan 的真實形狀（教練貼文字 → parse 出來的） */
const plan = (days: Array<{ label: string; ex: Array<[string, string | number]> }>) => ({
  name: '測試計畫',
  days: days.map((d, i) => ({
    dayOfWeek: i + 1,
    label: d.label,
    exercises: d.ex.map(([name, sets]) => ({ name, sets })),
  })),
})

describe('checkPlanHealth', () => {
  it('沒課表回 hasPlan=false', () => {
    expect(checkPlanHealth(null).hasPlan).toBe(false)
    expect(checkPlanHealth({ days: [] }).hasPlan).toBe(false)
  })

  it('算得出週組數與天數', () => {
    const h = checkPlanHealth(plan([
      { label: '推', ex: [['平板臥推', 4], ['上斜臥推', 3], ['側平舉', 3]] },
      { label: '拉', ex: [['引體向上', 4], ['坐姿划船', 3]] },
    ]))
    expect(h.hasPlan).toBe(true)
    expect(h.dayCount).toBe(2)
    expect(h.totalSets).toBe(17)
    expect(h.rows.find((r) => r.muscle === 'chest')?.sets).toBe(7)
    expect(h.rows.find((r) => r.muscle === 'back')?.sets).toBe(7)
  })

  it('⭐ 抓得到掛零 —— 這是課表健檢存在的主要理由', () => {
    const h = checkPlanHealth(plan([
      { label: '推', ex: [['平板臥推', 5], ['上斜臥推', 5], ['側平舉', 5]] },
      { label: '拉', ex: [['引體向上', 5], ['坐姿划船', 5]] },
      { label: '腿', ex: [['深蹲', 5], ['腿彎舉', 5]] },
    ]))
    const zeros = h.gaps.filter((g) => g.severity === 'zero').map((g) => g.muscle)
    expect(zeros).toContain('calves')      // 沒排小腿
    expect(zeros).toContain('core')        // 沒排核心
    expect(zeros).toContain('delts_rear')  // 沒排肩後束
    expect(h.hasFindings).toBe(true)
  })

  it('⭐ 抓得到對立肌群失衡', () => {
    const h = checkPlanHealth(plan([
      { label: '肩', ex: [['側平舉', 12], ['反向飛鳥', 3]] },
    ]))
    const im = h.imbalances.find((x) => x.high === 'delts_side')
    expect(im?.low).toBe('delts_rear')
    expect(im?.ratio).toBeGreaterThanOrEqual(2.5)
  })

  it('⚠️ 認不出的動作要單獨列出來 —— 它會讓其他數字整批失真', () => {
    const h = checkPlanHealth(plan([
      { label: '推', ex: [['平板臥推', 4], ['某種沒人知道的怪動作XYZ', 4]] },
    ]))
    expect(h.unresolved).toContain('某種沒人知道的怪動作XYZ')
    expect(h.totalSets).toBe(4)   // 認不出的那 4 組沒被算進去
    expect(h.hasFindings).toBe(true)
  })

  it('⚠️ 暖身／有氧不計入組數，但要看得到被排除幾組', () => {
    const h = checkPlanHealth(plan([
      { label: '推', ex: [['平板臥推', 4], ['跑步機', 3], ['空槓', 2]] },
    ]))
    expect(h.totalSets).toBe(4)
    expect(h.excludedSets).toBe(5)
  })

  it('sets 是字串或區間也要吃得下（教練實際會這樣寫）', () => {
    const h = checkPlanHealth(plan([
      { label: '推', ex: [['平板臥推', '4'], ['上斜臥推', '3-4'], ['側平舉', 3]] },
    ]))
    expect(h.totalSets).toBe(10)   // 區間取下限 3
  })

  it('備註列（sets 為 null）直接跳過，不算成 0 組動作', () => {
    const h = checkPlanHealth({
      name: 'x',
      days: [{ dayOfWeek: 1, label: '推', exercises: [
        { name: '平板臥推', sets: 4 },
        { name: '⚠️ 累了先砍這天', sets: null },
      ] }],
    })
    expect(h.totalSets).toBe(4)
    expect(h.unresolved).not.toContain('⚠️ 累了先砍這天')
  })
})

describe('summarizePlanHealth：一句話總結', () => {
  it('只講掛零跟認不出，不講失衡', () => {
    const h = checkPlanHealth(plan([
      { label: '肩', ex: [['側平舉', 12], ['反向飛鳥', 3], ['怪動作ABC', 3]] },
    ]))
    const s = summarizePlanHealth(h)!
    expect(s).toContain('0 組')
    expect(s).toContain('認不出')
    // ⚠️ 失衡要知道目標才判得準（備賽期腿刻意壓低不是錯），不進一句話總結
    expect(s).not.toContain(':')
    expect(s).not.toContain('肩中束 12')
  })

  it('沒問題就回 null', () => {
    const h = checkPlanHealth(plan([
      { label: '全身', ex: [
        ['平板臥推', 10], ['引體向上', 10], ['側平舉', 10], ['反向飛鳥', 10],
        ['二頭彎舉', 10], ['三頭下壓', 10], ['深蹲', 10], ['腿彎舉', 10],
        ['臀推', 10], ['提踵', 10], ['捲腹', 10], ['啞鈴肩推', 10],
      ] },
    ]))
    expect(summarizePlanHealth(h)).toBeNull()
  })

  it('沒課表回 null', () => {
    expect(summarizePlanHealth(checkPlanHealth(null))).toBeNull()
  })
})

/**
 * ⭐ 課表健檢最大的失敗模式：把「刻意的」報成「漏掉的」。
 *
 * 真實案例（林宥任 2026-09）：他的 phaseNote 明寫
 * 「胸椎太直…整份課表刻意減少把肩膀往後夾的動作（面拉、坐姿划船、反式蝴蝶全部拿掉），
 *  後縮類動作從 16 組/週砍到 6 組」
 * 而健檢把「肩後束 0 組」報成紅色缺口 —— 那不是漏排，是教練的處方。
 */
describe('phaseNote：別把刻意的報成漏掉的', () => {
  const REAL_NOTE =
    '他相反：胸椎太直、肩胛過度貼在背上、肋骨外翻。'
    + '所以整份課表刻意減少「把肩膀往後夾」的動作（面拉、坐姿划船、反式蝴蝶全部拿掉），'
    + '改成練「肩胛往前跑」的能力。後縮類動作從 16 組/週砍到 6 組。'

  const withNote = (phaseNote: string) => ({
    ...plan([{ label: '肩', ex: [['側平舉', 12], ['反向飛鳥', 3], ['深蹲', 5]] }]),
    phaseNote,
  })

  it('phaseNote 交代過的部位標 notedByCoach', () => {
    const h = checkPlanHealth(withNote(REAL_NOTE))
    const rear = h.gaps.find((g) => g.muscle === 'delts_rear')
    const im = h.imbalances.find((x) => x.low === 'delts_rear')
    expect(rear?.notedByCoach ?? im?.notedByCoach).toBe(true)
  })

  it('⛔「胸椎」不可以被當成胸大肌', () => {
    const h = checkPlanHealth(withNote(REAL_NOTE))
    expect(h.gaps.find((g) => g.muscle === 'chest')?.notedByCoach).toBe(false)
  })

  it('⛔「肩胛過度貼在背上」不可以被當成背肌', () => {
    const h = checkPlanHealth(withNote(REAL_NOTE))
    expect(h.gaps.find((g) => g.muscle === 'back')?.notedByCoach).toBe(false)
  })

  it('沒有 phaseNote 時一律 notedByCoach=false', () => {
    const h = checkPlanHealth(plan([{ label: '肩', ex: [['側平舉', 12], ['深蹲', 5]] }]))
    expect(h.gaps.every((g) => !g.notedByCoach)).toBe(true)
    expect(h.phaseNote).toBeNull()
  })

  it('⚠️ 已註明的不從清單移除，只是降級 —— 寫了理由不代表數字就對', () => {
    const h = checkPlanHealth(withNote(REAL_NOTE))
    expect(h.gaps.some((g) => g.muscle === 'delts_rear') || h.imbalances.length > 0).toBe(true)
  })

  it('一句話總結要跳過已註明的', () => {
    const h = checkPlanHealth({
      ...plan([{ label: '全身', ex: [
        ['平板臥推', 10], ['引體向上', 10], ['側平舉', 10], ['反向飛鳥', 10],
        ['二頭彎舉', 10], ['三頭下壓', 10], ['深蹲', 10], ['腿彎舉', 10],
        ['臀推', 10], ['捲腹', 10], ['啞鈴肩推', 10],
      ] }]),
      phaseNote: '小腿不排 —— 他打籃球本來就夠用了',
    })
    // 小腿 0 組，但 phaseNote 交代過 → 不進一句話總結
    expect(summarizePlanHealth(h)).toBeNull()
  })
})

describe('⛔ 姿勢前綴不可以吃掉實質動作', () => {
  it('「單腳站提踵」是小腿訓練，不是不計量的平衡動作', () => {
    const h = checkPlanHealth(plan([{ label: 'C', ex: [['單腳站提踵', 3]] }]))
    expect(h.rows.find((r) => r.muscle === 'calves')?.sets).toBe(3)
    expect(h.totalSets).toBe(3)
  })
  it('但真正否定訓練量的前綴仍然要贏（空槓／徒手）', () => {
    const h = checkPlanHealth(plan([{ label: 'A', ex: [['空槓過頭深蹲', 5], ['徒手深蹲', 5]] }]))
    expect(h.totalSets).toBe(0)
    expect(h.excludedSets).toBe(10)
  })
})
