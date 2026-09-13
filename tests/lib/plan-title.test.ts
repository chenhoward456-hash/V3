import { describe, it, expect } from 'vitest'
import { planTitle } from '@/lib/plan-title'

/**
 * 計畫頁標題的顯示處理。
 *
 * 兩件事不能出錯：
 *   - 拿掉裝飾用 emoji（DESIGN.md：「像醫療數據產品，不像玩具」）
 *   - **但不能把警示降級**。「⚠️ 先講上次卡在哪」跟「🎯 20 週要做什麼」
 *     在畫面上的份量本來就不一樣，emoji 砍掉之後那個差別要用色點接住。
 */
describe('planTitle', () => {
  it('拿掉開頭的裝飾 emoji', () => {
    // 全部取自 production 的真實標題
    const cases: [string, string][] = [
      ['🎯 20 週要做什麼', '20 週要做什麼'],
      ['🔢 每天吃的四個數字', '每天吃的四個數字'],
      ['🏋️ Block2c 在做什麼（X-frame 優先）', 'Block2c 在做什麼（X-frame 優先）'],
      ['🗓 現在在哪、下一個關卡是什麼', '現在在哪、下一個關卡是什麼'],
      ['💼 你的生活型態要注意的', '你的生活型態要注意的'],
      ['🩺 你的血檢有兩個值得追蹤', '你的血檢有兩個值得追蹤'],
      ['✅ 每天只要做三件事', '每天只要做三件事'],
      ['⚖️ 增肌期的體重怎麼讀', '增肌期的體重怎麼讀'],
    ]
    for (const [raw, want] of cases) expect(planTitle(raw).text, raw).toBe(want)
  })

  it('🚨 警示 emoji 要轉成 tone，不能只是消失', () => {
    expect(planTitle('⚠️ 先講上次卡在哪（不是你不練）')).toEqual({ text: '先講上次卡在哪（不是你不練）', tone: 'warn' })
    expect(planTitle('🚫 這一段的三條紅線')).toEqual({ text: '這一段的三條紅線', tone: 'warn' })
  })

  it('一般條目沒有 tone', () => {
    expect(planTitle('🎯 20 週要做什麼').tone).toBe('none')
  })

  it('本來就沒 emoji 的標題原封不動', () => {
    expect(planTitle('每天吃的四個數字')).toEqual({ text: '每天吃的四個數字', tone: 'none' })
  })

  it('🚨 句子中間的 emoji 不動 —— 那是內文作者的選擇，只處理開頭', () => {
    expect(planTitle('每天吃 3 餐 🍚 這樣').text).toBe('每天吃 3 餐 🍚 這樣')
  })

  it('🚨 整串都是 emoji 時不要回空標題', () => {
    expect(planTitle('🎯').text).toBe('🎯')
    expect(planTitle('').text).toBe('')
  })
})
