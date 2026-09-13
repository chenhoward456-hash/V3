import { describe, it, expect } from 'vitest'
import { weeklySlope, intakeVerdict } from '@/lib/agent-tools-analysis'
import { AGENT_TOOLS, ANALYSIS_TOOLS } from '@/lib/agent-tools'

/**
 * 教練 agent 分析工具的契約。
 *
 * 這些數字會變成「要不要改這個學員的熱量」的依據。
 * 最重要的一條不是算得準，是**算不準的時候要說算不準** ——
 * 一個編出來的 TDEE 比沒有 TDEE 危險得多。
 */

describe('weeklySlope：體重回歸', () => {
  const mk = (vals: [string, number][]) => vals.map(([date, weight]) => ({ date, weight }))

  it('穩定下降算得出負斜率', () => {
    const s = weeklySlope(mk([['2026-09-01', 84], ['2026-09-08', 83], ['2026-09-15', 82]]))!
    expect(s).toBeCloseTo(-1, 1)
  })

  it('日期不等距也要對 —— 真實資料本來就會漏記', () => {
    // 每週 -1kg，但中間漏掉幾天
    const s = weeklySlope(mk([['2026-09-01', 84], ['2026-09-03', 83.7], ['2026-09-15', 82]]))!
    expect(s).toBeLessThan(0)
    expect(s).toBeGreaterThan(-2)
  })

  it('資料太少回 null，不要用兩點畫一條線當趨勢', () => {
    expect(weeklySlope(mk([['2026-09-01', 84], ['2026-09-08', 83]]))).toBeNull()
    expect(weeklySlope([])).toBeNull()
  })

  it('同一天多筆（x 全相同）回 null 不炸', () => {
    expect(weeklySlope(mk([['2026-09-01', 84], ['2026-09-01', 83], ['2026-09-01', 82]]))).toBeNull()
  })

  it('體重完全不動 = 0', () => {
    expect(weeklySlope(mk([['2026-09-01', 83], ['2026-09-08', 83], ['2026-09-15', 83]]))).toBe(0)
  })
})

describe('intakeVerdict：什麼時候可以下結論', () => {
  it('整個區間都低於處方 → 盈餘', () => {
    // 震宣 2026-09-14 實測：TDEE 1738-1932、處方 2070
    expect(intakeVerdict(1738, 1932, 2070)).toContain('盈餘')
  })

  it('整個區間都高於處方 → 赤字', () => {
    // 林宥任實測：TDEE 2206-2636、處方 2121
    expect(intakeVerdict(2206, 2636, 2121)).toContain('赤字')
  })

  it('🚨 區間跨過處方 → 不下結論', () => {
    // 不同時間窗給相反答案時，挑任何一邊都是瞎猜，
    // 而那個猜測會變成改學員熱量的依據。
    const v = intakeVerdict(1900, 2300, 2070)!
    expect(v).toContain('不一致')
    expect(v).not.toContain('盈餘')
    expect(v).not.toContain('赤字')
  })

  it('剛好貼邊也算跨過（不要在邊界上裝有把握）', () => {
    expect(intakeVerdict(2070, 2300, 2070)).toContain('不一致')
    expect(intakeVerdict(1800, 2070, 2070)).toContain('不一致')
  })

  it('沒設處方就沒有結論可下', () => {
    expect(intakeVerdict(1800, 2000, null)).toBeNull()
  })
})

describe('工具註冊', () => {
  it('分析工具全部是唯讀 —— 寫入只能走 line-coach-commands 的確定性指令', () => {
    const names = ANALYSIS_TOOLS.map(t => t.name)
    expect(names).toEqual([
      'analyze_weight_trend', 'estimate_true_intake', 'check_training_frequency',
      'build_lab_order', 'list_labs_due', 'list_pending_proposals',
    ])
    // 沒有任何一個名字長得像會寫入的
    for (const n of names) {
      expect(n, n).not.toMatch(/approve|apply|send|update|delete|propose|set_/)
    }
  })

  it('工具名字不能跟既有的撞', () => {
    const all = [...AGENT_TOOLS, ...ANALYSIS_TOOLS].map(t => t.name)
    expect(new Set(all).size).toBe(all.length)
  })

  it('每個工具都要有 description 跟 schema，否則 agent 不知道何時該用', () => {
    for (const t of ANALYSIS_TOOLS) {
      expect(t.description.length, t.name).toBeGreaterThan(30)
      expect(t.input_schema.type, t.name).toBe('object')
    }
  })
})
