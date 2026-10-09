import { describe, it, expect } from 'vitest'
import { LAB_OPTIMAL_RANGES, isInOptimalRange } from '@/utils/labStatus'
import { getLabAdvice } from '@/components/client/types'
import { analyzeLabs } from '@/lib/lab-trend-analyzer'
import { generateSupplementSuggestions } from '@/lib/supplement-engine'

// 2026-10-08 健康報告稽核：6/27 閾值對帳只改了 LAB_OPTIMAL_RANGES，建議文字沒跟上，
// 同一列出現「最佳 40-60」＋「目標 60-80」、「最佳 40-60」＋「HDL 頂尖(68)」。
describe('建議文字與最佳區間一致（男性）', () => {
  for (const [name, optimal] of Object.entries(LAB_OPTIMAL_RANGES)) {
    if (name.endsWith('_female')) continue
    it(name, () => {
      const lo = typeof optimal === 'number' ? optimal * 0.2 : optimal.min * 0.5
      const hi = typeof optimal === 'number' ? optimal * 2 : optimal.max * 1.6
      for (let i = 0; i <= 100; i++) {
        const v = +(lo + ((hi - lo) * i) / 100).toFixed(3)
        const advice = getLabAdvice(name, v)
        if (!advice) return
        const inOptimal = isInOptimalRange(name, v, '男性')
        if (!inOptimal) expect(advice, `${name} ${v}`).not.toContain('頂尖')
        else expect(advice.includes('頂尖') || advice.includes('極佳') || advice.includes('最佳區間內'), `${name} ${v}: ${advice}`).toBe(true)
      }
    })
  }
})

describe('趨勢判讀', () => {
  it('前後都在最佳區間內的範圍型指標算持平，不叫退步', () => {
    const [f] = analyzeLabs([
      { test_name: '維生素D', value: 45, unit: 'ng/mL', date: '2026-01-01' },
      { test_name: '維生素D', value: 58, unit: 'ng/mL', date: '2026-03-20' },
    ] as never, { gender: '男性' })
    expect(f.trend).toBe('stable')
  })
  it('男性 SHBG 上升＝變差，即使還在 20-40（跟血檢進退同一條規則，Howard 2026-09-24 立場）', () => {
    const [f] = analyzeLabs([
      { test_name: 'SHBG', value: 24.4, unit: 'nmol/L', date: '2026-01-01' },
      { test_name: 'SHBG', value: 38.4, unit: 'nmol/L', date: '2026-03-20' },
    ] as never, { gender: '男性' })
    expect(f.trend).toBe('declining')
  })
})

describe('補品建議', () => {
  it('實測維生素 D 已 ≥40 時，不因 5-HTTLPR 基因型再建議補 D3', () => {
    const s = generateSupplementSuggestions([{ test_name: '維生素D', value: 59, unit: 'ng/mL', date: '2026-03-20' }] as never,
      { gender: '男性', genetics: { serotonin: 'SL' } })
    expect(s.some(x => x.name.includes('D3'))).toBe(false)
  })
  it('沒有維生素 D 數值時，基因型仍會建議 D3', () => {
    const s = generateSupplementSuggestions([], { gender: '男性', genetics: { serotonin: 'SL' } })
    expect(s.some(x => x.name.includes('D3'))).toBe(true)
  })
})
