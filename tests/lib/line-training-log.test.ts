import { describe, it, expect } from 'vitest'
import { tryParseTrainingLog, inferTrainingType, confirmText } from '@/lib/line-training-log'

/**
 * ⚠️ 誤判的代價不對稱：
 *   · 認不出來 → 交還既有流程（AI 那條），沒有損失
 *   · 認錯     → 把使用者的問句／閒聊寫進他的訓練紀錄，而且他不會發現
 *
 * 所以這組測試的重心是「**什麼不該被收**」。
 */

describe('✅ 該被接住的寫法（既有 AI 路徑接不住的）', () => {
  it.each([
    ['深蹲 4組', '深蹲', 4],
    ['臥推 80公斤 8下4組', '臥推', 4],
    ['今天 硬舉 3組', '硬舉', 3],
    ['側平舉 12下x4', '側平舉', 4],
    ['引體向上 8下 × 3', '引體向上', 3],
  ])('「%s」', (text, name, sets) => {
    const a = tryParseTrainingLog(text)
    expect(a.confident).toBe(true)
    expect(a.recognized[0].name).toContain(name)
    expect(a.recognized[0].sets).toBe(sets)
  })

  it('既有的 x 格式也照樣接（不能退步）', () => {
    const a = tryParseTrainingLog('深蹲 100x5x3')
    expect(a.confident).toBe(true)
    expect(a.recognized[0]).toMatchObject({ sets: 3, weight: 100, reps: 5 })
  })

  it('一次多個動作', () => {
    const a = tryParseTrainingLog('深蹲 100x5x3、臥推 80x8x4')
    expect(a.recognized).toHaveLength(2)
    expect(a.recognized.map((e) => e.sets)).toEqual([3, 4])
  })
})

describe('⛔ 不該被當成訓練紀錄的句子', () => {
  it.each([
    '我想問 3 個問題',
    '下午有 3 組會議',
    '這週練得怎麼樣',
    '幫我看一下數據',
    '今天好累',
    '教練我可以請假嗎',
    '體重 85',
    '熱量 2200',
  ])('「%s」', (text) => {
    expect(tryParseTrainingLog(text).confident).toBe(false)
  })

  it('⚠️ 動作名認得出來、但組數是猜的 → 仍然不收', () => {
    // 「深蹲 3」只有一個孤立數字，parser 標 guess
    const a = tryParseTrainingLog('深蹲 3')
    expect(a.recognized[0]?.confidence).toBe('guess')
    expect(a.confident).toBe(false)
  })

  it('⚠️ 有組數但完全認不出動作 → 不收，交還 AI 那條去猜', () => {
    const a = tryParseTrainingLog('某個我自己發明的動作XYZ 4組')
    expect(a.confident).toBe(false)
    expect(a.unknown.length).toBeGreaterThan(0)
  })
})

describe('認不出部位的照樣記，但要講出來', () => {
  it('混合的情況：認得的進 recognized，認不出的進 unknown', () => {
    const a = tryParseTrainingLog('深蹲 4組、某某怪動作ABC 3組')
    expect(a.confident).toBe(true)
    expect(a.recognized.map((e) => e.name)).toContain('深蹲')
    expect(a.unknown.map((e) => e.name).join()).toContain('怪動作')
  })

  it('確認訊息要提到認不出的那些 —— 不然學員以為記到了', () => {
    const a = tryParseTrainingLog('深蹲 4組、某某怪動作ABC 3組')
    const msg = confirmText(a, 7)
    expect(msg).toContain('認不出')
    expect(msg).toContain('怪動作')
  })
})

describe('inferTrainingType：從動作推「今天練什麼」', () => {
  it('推系動作多 → push', () => {
    expect(inferTrainingType([
      { name: '平板臥推', sets: 4 }, { name: '上斜臥推', sets: 3 }, { name: '三頭下壓', sets: 3 },
    ])).toBe('push')
  })
  it('拉系動作多 → pull', () => {
    expect(inferTrainingType([
      { name: '引體向上', sets: 4 }, { name: '坐姿划船', sets: 4 }, { name: '二頭彎舉', sets: 3 },
    ])).toBe('pull')
  })
  it('下肢 → legs', () => {
    expect(inferTrainingType([
      { name: '深蹲', sets: 4 }, { name: '腿彎舉', sets: 3 }, { name: '提踵', sets: 3 },
    ])).toBe('legs')
  })
  it('⚠️ 沒有任何一類佔到六成 → full_body，不要硬分類', () => {
    expect(inferTrainingType([
      { name: '平板臥推', sets: 3 }, { name: '引體向上', sets: 3 }, { name: '深蹲', sets: 3 },
    ])).toBe('full_body')
  })
  it('認不出的動作不影響判斷', () => {
    expect(inferTrainingType([
      { name: '平板臥推', sets: 4 }, { name: '怪動作XYZ', sets: 9 },
    ])).toBe('push')
  })
  it('全部認不出 → full_body', () => {
    expect(inferTrainingType([{ name: '怪動作XYZ', sets: 4 }])).toBe('full_body')
  })
})
