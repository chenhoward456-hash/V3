import { describe, it, expect } from 'vitest'
import {
  isScreened, needsProfessionalReferral, referralReasons, toReferenceRange,
  type HealthScreening,
} from '@/lib/health-screening'

describe('入會健康篩檢', () => {
  it('沒篩檢過 → isScreened false，但不當成需要轉介（只是還不知道）', () => {
    expect(isScreened(null)).toBe(false)
    expect(isScreened({})).toBe(false)
    expect(needsProfessionalReferral(null)).toBe(false)
  })

  it('篩檢過且全部為 false → 不需轉介', () => {
    const s: HealthScreening = {
      screened_at: '2026-08-14', chronic_condition: false, on_medication: false,
      pregnant_or_lactating: false, recent_surgery: false, eating_disorder_history: false,
    }
    expect(isScreened(s)).toBe(true)
    expect(needsProfessionalReferral(s)).toBe(false)
    expect(referralReasons(s)).toEqual([])
  })

  it('任一 flag 為真 → 需要轉介，並列出命中項目', () => {
    for (const key of ['chronic_condition', 'on_medication', 'pregnant_or_lactating',
                       'recent_surgery', 'eating_disorder_history'] as const) {
      const s: HealthScreening = { screened_at: '2026-08-14', [key]: true }
      expect(needsProfessionalReferral(s)).toBe(true)
      expect(referralReasons(s).length).toBe(1)
    }
  })

  it('多個 flag → 全部列出', () => {
    const s: HealthScreening = { screened_at: '2026-08-14', chronic_condition: true, on_medication: true }
    expect(referralReasons(s)).toEqual(['慢性疾病', '規則性服藥'])
  })

  it('精確目標轉成參考範圍（拿掉處方感）', () => {
    expect(toReferenceRange(2250)).toBe('2140–2360')
    expect(toReferenceRange(null)).toBeNull()
    expect(toReferenceRange(0)).toBeNull()
  })
})
