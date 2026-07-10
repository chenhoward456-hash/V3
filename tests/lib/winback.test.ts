import { describe, it, expect } from 'vitest'
import { buildWinbackMessage, type WinbackContext } from '@/lib/winback'
import { scanMedicalCompliance } from '@/lib/compliance-scrub'

const base: WinbackContext = { name: '小美', situation: 'cut_silent', daysSilent: 9, weeksIntoCut: 6 }

describe('buildWinbackMessage', () => {
  it('cut_silent：有下降趨勢時點出「斷在正在掉的時候」+ 上次體重', () => {
    const msg = buildWinbackMessage({ ...base, lastWeight: 62.35, trendPerWeek: -0.6 })
    expect(msg).toContain('減脂第 6 週')
    expect(msg).toContain('9 天沒記錄')
    expect(msg).toContain('62.4kg')      // 四捨五入到 1 位
    expect(msg).toContain('每週掉 0.6kg')
    expect(msg).toContain('量一個體重')  // 唯一動作
  })

  it('cut_silent：趨勢持平只提上次體重、不硬掰「正在掉」', () => {
    const msg = buildWinbackMessage({ ...base, lastWeight: 80, trendPerWeek: 0 })
    expect(msg).toContain('上次量是 80kg')
    expect(msg).not.toContain('正在掉')
  })

  it('cut_silent：完全沒體重資料也能成句', () => {
    const msg = buildWinbackMessage({ ...base })
    expect(msg).toContain('完全看不到你的狀況')
    expect(msg).not.toContain('kg')
  })

  it('never_started：講加入天數 + 第一筆門檻', () => {
    const msg = buildWinbackMessage({ name: '世傳', situation: 'never_started', daysSilent: 9 })
    expect(msg).toContain('加入 9 天')
    expect(msg).toContain('第一筆')
  })

  it('idle：一般未活動、有上次體重就帶上', () => {
    const msg = buildWinbackMessage({ name: '阿宏', situation: 'idle', daysSilent: 6, lastWeight: 91.02 })
    expect(msg).toContain('6 天沒看到')
    expect(msg).toContain('91kg')
  })

  it('weeksIntoCut 缺漏/0 時夾成第 1 週，不出現「第 0 週」', () => {
    const msg = buildWinbackMessage({ name: '小美', situation: 'cut_silent', daysSilent: 5, weeksIntoCut: 0 })
    expect(msg).toContain('減脂第 1 週')
  })

  it('合規契約：三種情境的草稿都不得命中醫療合規紅線', () => {
    const variants: WinbackContext[] = [
      { ...base, lastWeight: 62.4, trendPerWeek: -0.6 },
      { name: '世傳', situation: 'never_started', daysSilent: 12 },
      { name: '阿宏', situation: 'idle', daysSilent: 7, lastWeight: 91 },
    ]
    for (const v of variants) {
      expect(scanMedicalCompliance(buildWinbackMessage(v))).toEqual([])
    }
  })

  it('長度守門：遠低於發送上限 1500 字', () => {
    const msg = buildWinbackMessage({ ...base, lastWeight: 62.4, trendPerWeek: -0.6 })
    expect(msg.length).toBeLessThan(300)
  })
})
