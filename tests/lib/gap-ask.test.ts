import { describe, it, expect } from 'vitest'
import { pickGap, gapPrompt, type GapContext } from '@/lib/gap-ask'

const ctx = (o: Partial<GapContext> = {}): GapContext => ({
  today: { weight: true, nutrition: false, training: false, wellness: false },
  days14: { weight: 12, nutrition: 1, training: 0, wellness: 6 },
  enabled: { weight: true, nutrition: true, training: true, wellness: true },
  ...o,
})

describe('pickGap', () => {
  it('Sean 型：體重天天量、飲食幾乎沒記 → 先問飲食（引擎吃的格），即使訓練記得更少', () => {
    expect(pickGap(ctx(), 'weight')).toBe('nutrition')
  })
  it('核心兩格都夠 → 才問訓練／身體感受裡記得最少的', () => {
    expect(pickGap(ctx({ days14: { weight: 12, nutrition: 13, training: 0, wellness: 6 } }), 'weight')).toBe('training')
  })
  it('今天已經記過別的 → 不是第一次，不問', () => {
    expect(pickGap(ctx({ today: { weight: true, nutrition: true, training: false, wellness: false } }), 'weight')).toBeNull()
  })
  it('其他格都記得很勤（≥80%）→ 不問', () => {
    expect(pickGap(ctx({ days14: { weight: 14, nutrition: 13, training: 5, wellness: 12 } }), 'weight')).toBeNull()
  })
  it('訓練用每週 3 次當滿分，不拿 14 天比', () => {
    // 訓練 5 次/14 天 = 83% of 6 → 不算漏洞；身體感受 6/14 → 問它
    expect(pickGap(ctx({ days14: { weight: 12, nutrition: 13, training: 5, wellness: 6 } }), 'weight')).toBe('wellness')
  })
  it('不會問剛記的那格', () => {
    expect(pickGap(ctx({ today: { weight: false, nutrition: false, training: true, wellness: false }, days14: { weight: 12, nutrition: 13, training: 0, wellness: 12 } }), 'training')).toBeNull()
  })
})

describe('gapPrompt', () => {
  it('體重按鈕用上次體重生', () => {
    const p = gapPrompt('weight', 3, 80)
    expect(p.items.map(i => i.text)).toEqual(['體重 79.5', '體重 80.0', '體重 80.5'])
    expect(p.text).toContain('3/14')
  })
  it('身體感受按鈕接分步驟流程，不再送「身心 4 4 4」（三個同分）', () => {
    const texts = gapPrompt('wellness', 5).items.map(i => i.text)
    expect(texts.every(t => /^睡眠 \d$/.test(t))).toBe(true)
  })
  it('飲食按鈕送出的文字要能被 webhook 接住', () => {
    expect(gapPrompt('nutrition', 1).items.map(i => i.text)).toEqual(['達標', '未達標'])
  })
})
