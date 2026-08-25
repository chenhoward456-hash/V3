import { describe, it, expect } from 'vitest'
import { isCoachCommand } from '@/lib/line-handlers'

/**
 * 教練快速記錄的分流守則。
 *
 * 這條攔在 AI Agent 前面。判錯的代價是**把教練的指令寫成他自己的紀錄** ——
 * 「把震宣的碳水改成 250」被當成「教練今天吃了 250g 碳水」，
 * 而那個數字會餵進他自己的 TDEE 引擎。所以寧可漏判（交還給 Agent，行為不變）
 * 也不要誤判成記錄。
 */

const OTHERS = ['震宣', 'Sean', '林宥任', '萬哲鴻']

describe('isCoachCommand：是指令還是在記自己的資料', () => {
  it('教練指令 → true（交還給 Agent）', () => {
    const commands = [
      '幫我看震宣這週怎樣',
      '列出待審提案',
      '查一下 Sean 的血檢',
      '這樣調可以嗎？',
      '為什麼他掉這麼慢',
      '把週報發給林宥任',
      '批准那個提案',
    ]
    for (const c of commands) expect(isCoachCommand(c, OTHERS), c).toBe(true)
  })

  it('自我記錄 → false（直接寫，不走 Agent）', () => {
    const logs = [
      '82.8今天推日 75分rpe9',
      '早上量82.8',
      '今天好累 沒練',
      '飲食達標',
      '練了背 一小時 大概8',
      '睡眠4 精力4 心情3',
    ]
    for (const l of logs) expect(isCoachCommand(l, OTHERS), l).toBe(false)
  })

  it('提到別的學員名字一律當指令 —— 這是最重要的一道防線', () => {
    // 沒有這條，下面這句會被寫成「教練自己吃了 250g 碳水」
    expect(isCoachCommand('把震宣的碳水改成 250', OTHERS)).toBe(true)
    expect(isCoachCommand('Sean 今天 86.1', OTHERS)).toBe(true)
    expect(isCoachCommand('萬哲鴻 82.8今天推日', OTHERS)).toBe(true)
  })

  it('教練自己的名字不算「別人」', () => {
    // otherNames 由呼叫端濾掉教練本人；這裡確認帶進來的清單不含他時行為正確
    expect(isCoachCommand('陳胤豪 82.8', OTHERS)).toBe(false)
  })

  it('太長 → 當指令（多半在交代事情）', () => {
    // ⚠️ 門檻是 45 不是 80：中文一字算一長度，80 字是很長一段話。
    // 下面這句 63 字明顯是在交代事情，用 80 會漏放。
    const long = '今天跟震宣討論了他回歸之後的計畫，決定先把目標訂在 77 公斤，'
      + '然後訓練照原本的四天分化跑，有氧維持一週兩次，飲食先看兩週再說'
    expect(long.length).toBeGreaterThan(45)
    expect(isCoachCommand(long, [])).toBe(true)
  })

  it('真實記錄都在門檻內', () => {
    for (const l of ['82.8今天推日 75分rpe9', '85.7 今天推日45分鐘RPE7 飲食達標 睡眠精力心情都3']) {
      expect(l.length, l).toBeLessThanOrEqual(45)
      expect(isCoachCommand(l, OTHERS), l).toBe(false)
    }
  })

  it('沒有其他學員時仍照關鍵字判斷', () => {
    expect(isCoachCommand('82.8今天推日', [])).toBe(false)
    expect(isCoachCommand('幫我查一下', [])).toBe(true)
  })
})
