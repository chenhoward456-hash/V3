import { describe, it, expect } from 'vitest'
import { buildPeakMorningReminder, buildPeakEveningReminder } from '@/lib/peak-week-reminders'

/**
 * Helms Ch.7：「你在賽前一晚看起來如何，決定了 80% 的碳水判斷。」
 * 這條提醒的存在理由：沒人提醒就會忘，忘了 peak week 最重要的決策就只能用猜的。
 */

describe('Peak Week 早上提醒', () => {
  it('帶出教練課表的當日重點（碳水/訓練/備註）+ 一定要提醒量晨重', () => {
    const r = buildPeakMorningReminder({
      daysOut: 2,
      label: '🔺 峰值',
      phase: 'carb_load',
      carbs: 440,
      trainingNote: '輕 pump 循環',
      coachNote: '晚上比外觀',
    })!
    expect(r.title).toContain('峰值')
    expect(r.body).toContain('440')
    expect(r.body).toContain('輕 pump 循環')
    expect(r.body).toContain('晚上比外觀')
    expect(r.body).toContain('晨重')   // peak week 的晨重是判讀依據
  })

  it('比賽日：講餐次節奏 + 上台前補鈉 + 不限水', () => {
    const r = buildPeakMorningReminder({ daysOut: 0, phase: 'show_day', carbs: 300 })!
    expect(r.title).toContain('比賽日')
    expect(r.body).toContain('2–3 小時一餐')
    expect(r.body).toContain('預賽前')
    expect(r.body).toContain('補鈉')
    expect(r.body).toContain('不限水')
  })

  it('沒有當天資料 → 不推（不亂發垃圾通知）', () => {
    expect(buildPeakMorningReminder(null)).toBeNull()
    expect(buildPeakMorningReminder(undefined)).toBeNull()
  })
})

describe('Peak Week 晚上提醒（最關鍵的一刻）', () => {
  it('賽前一晚：明講「這一晚決定 80% 的賽日碳水」+ 三個判讀分支', () => {
    const r = buildPeakEveningReminder({ daysOut: 1, phase: 'taper' })!
    expect(r.title).toContain('80%')
    expect(r.body).toContain('80%')
    expect(r.body).toContain('溢出')
    expect(r.body).toContain('飽而硬')
    expect(r.body).toContain('扁')
    // 最容易誤判的：灌完當下「軟」是暫時的
    expect(r.body).toContain('12–24h')
  })

  it('充碳日晚上：比外觀決定明天碳水', () => {
    const r = buildPeakEveningReminder({ daysOut: 2, phase: 'carb_load' })!
    expect(r.title).toContain('明天碳水')
    expect(r.body).toContain('低標')
    expect(r.body).toContain('高標')
  })

  it('低碳期（賽前 3 天以上）：提醒拍基準照 + 固定條件（不然沒有可比性）', () => {
    const r = buildPeakEveningReminder({ daysOut: 5, phase: 'fat_load' })!
    expect(r.title).toContain('基準照')
    expect(r.body).toContain('固定燈光')
    expect(r.body).toContain('可比性')
  })

  it('比賽當天晚上不推（都比完了）', () => {
    expect(buildPeakEveningReminder({ daysOut: 0, phase: 'show_day' })).toBeNull()
  })

  it('沒資料不推', () => {
    expect(buildPeakEveningReminder(null)).toBeNull()
  })
})
