import { describe, it, expect } from 'vitest'
import { looksLikeCoachCommand, parseCoachCommand } from '@/lib/line-coach-commands'

/**
 * ⚠️ 這組測試守的是一件事：**誤判的代價不對稱。**
 *
 * 「發 震宣」會真的把訊息推到學員手機上——不可逆、對外。
 * 而認不出來的代價只是「交還給 AI Agent 回一段閒聊」。
 *
 * 所以每一條都寧可嚴格：動詞後面必須剛好是一個已知學員名字，
 * 多一個字都不算。
 */
const NAMES = ['震宣', 'Sean', '林宥任', '陳胤豪']

describe('looksLikeCoachCommand：便宜的形狀檢查', () => {
  it.each(['提案', '訊息', '草稿', '本週訊息', '發 震宣', '送 Sean', '訊息 震宣', '套用 Sean'])(
    '「%s」看起來像指令', (t) => expect(looksLikeCoachCommand(t)).toBe(true),
  )

  it.each([
    '震宣這週怎麼樣',
    '幫我看一下 Sean 的體重',
    '發',                    // 單獨一個動詞不算，後面要有東西
  ])('「%s」不該進指令路徑', (t) => {
    expect(looksLikeCoachCommand(t)).toBe(false)
  })
})

describe('列表指令', () => {
  it.each(['訊息', '草稿', '本週訊息'])('「%s」= 列出本週草稿', (t) => {
    expect(parseCoachCommand(t, NAMES)).toEqual({ kind: 'list_messages' })
  })
  it('「提案」還是列提案，沒被新指令搶走', () => {
    expect(parseCoachCommand('提案', NAMES)).toEqual({ kind: 'list_proposals' })
  })
})

describe('看全文 / 送出', () => {
  it('「訊息 震宣」= 看全文', () => {
    expect(parseCoachCommand('訊息 震宣', NAMES)).toEqual({ kind: 'preview_message', name: '震宣' })
  })
  it.each(['發 震宣', '送 震宣', '發送 震宣'])('「%s」= 送出', (t) => {
    expect(parseCoachCommand(t, NAMES)).toEqual({ kind: 'send_message', name: '震宣' })
  })
  it('英文名字也要認得', () => {
    expect(parseCoachCommand('發 Sean', NAMES)).toEqual({ kind: 'send_message', name: 'Sean' })
  })
})

describe('⛔ 不可以被誤判成「送出」的句子', () => {
  it.each([
    '發現震宣這週掉太快',        // 「發」開頭但沒有空白分隔
    '送 震宣 去比賽',            // 名字後面還有字
    '發 震宣的碳水改一下',        // 同上
    '發 小明',                  // 不在名單裡
    '訊息很長要不要拆',          // 「訊息」開頭但沒有空白分隔
    '草稿我自己寫就好',
    '幫我發給震宣',              // 不是以動詞開頭
  ])('「%s」→ 不是指令', (t) => {
    const cmd = parseCoachCommand(t, NAMES)
    expect(cmd?.kind).not.toBe('send_message')
  })

  it('⚠️ 最危險的那個：名字後面多字一定要回 null，不能 includes 命中', () => {
    expect(parseCoachCommand('發 震宣 先不要動他的熱量', NAMES)).toBeNull()
  })
})

describe('既有指令沒有被破壞', () => {
  it('套用 / 不要 還在', () => {
    expect(parseCoachCommand('套用 Sean', NAMES)).toEqual({ kind: 'approve', name: 'Sean' })
    expect(parseCoachCommand('不要 Sean', NAMES)).toEqual({ kind: 'reject', name: 'Sean' })
  })
  it('代記 還在', () => {
    expect(parseCoachCommand('代記 Sean 85.2 早餐雞胸便當', NAMES)).toEqual({
      kind: 'proxy_log', name: 'Sean', content: '85.2 早餐雞胸便當',
    })
  })
  it('⚠️「不要再幫他加碳水了」不可以被當成 reject（原本就守著的那條）', () => {
    expect(parseCoachCommand('不要再幫他加碳水了', NAMES)).toBeNull()
  })
})
