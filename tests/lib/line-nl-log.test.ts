import { describe, it, expect } from 'vitest'
import { validateNL, hasAnything, confirmText, extractJSON, textFromContent, type NLParsed } from '@/lib/line-nl-log'

/**
 * 這支的輸出會直接寫進 body_composition / training_logs / nutrition_logs / daily_wellness，
 * 而那些數字會餵進 TDEE 與趨勢引擎去改學員的熱量。
 * 所以驗證層的契約是：**寧可沒記到，也不要記錯。**
 */

describe('validateNL：範圍外一律丟掉，不夾到邊界值', () => {
  it('體重超出 30-200 直接丟，不夾成 200', () => {
    expect(validateNL({ weight: 857 }).weight).toBeUndefined()
    expect(validateNL({ weight: 5 }).weight).toBeUndefined()
    expect(validateNL({ weight: 85.74 }).weight).toBe(85.7)
  })

  it('身心分數超出 1-5 丟掉 —— 夾成 5 會變成看起來合法的幻覺', () => {
    const w = validateNL({ wellness: { sleep_quality: 9, energy_level: 3, mood: 0 } })
    expect(w.wellness).toEqual({ energy_level: 3 })
  })

  it('training_type 不在 DB 白名單內 → 整組訓練丟掉（否則 upsert 撞 CHECK）', () => {
    expect(validateNL({ training: { training_type: '深蹲日', duration: 45 } }).training).toBeUndefined()
    expect(validateNL({ training: { training_type: 'push', duration: 45, rpe: 7 } }).training)
      .toEqual({ training_type: 'push', duration: 45, rpe: 7 })
  })

  it('RPE 超出 1-10 丟掉但保留其餘訓練欄位', () => {
    expect(validateNL({ training: { training_type: 'pull', duration: 60, rpe: 15 } }).training)
      .toEqual({ training_type: 'pull', duration: 60 })
  })

  it('not_a_log = true → 什麼都不寫，就算模型同時給了數字', () => {
    const w = validateNL({ not_a_log: true, weight: 85.7, wellness: { mood: 3 } })
    expect(hasAnything(w)).toBe(false)
  })

  it('compliant 只認真正的布林，null/字串不寫', () => {
    expect(validateNL({ nutrition: { compliant: false } }).nutrition).toEqual({ compliant: false })
    expect(validateNL({ nutrition: { compliant: null } }).nutrition).toBeUndefined()
  })
})

describe('Sean 真實用法：一則訊息取代十次按鈕', () => {
  it('「85.7 今天推日45分鐘RPE7 飲食達標 睡眠精力心情都3」四種資料一次到位', () => {
    const parsed: NLParsed = {
      weight: 85.7,
      training: { training_type: 'push', duration: 45, rpe: 7 },
      nutrition: { compliant: true },
      wellness: { sleep_quality: 3, energy_level: 3, mood: 3 },
    }
    const w = validateNL(parsed)
    expect(w.weight).toBe(85.7)
    expect(w.training).toEqual({ training_type: 'push', duration: 45, rpe: 7 })
    expect(w.nutrition).toEqual({ compliant: true })
    expect(w.wellness).toEqual({ sleep_quality: 3, energy_level: 3, mood: 3 })
  })

  it('只講一件事也要能記 —— 不強迫填滿', () => {
    const w = validateNL({ training: { training_type: 'rest' } })
    expect(hasAnything(w)).toBe(true)
    expect(w.training).toEqual({ training_type: 'rest' })
  })
})

describe('confirmText：一定要把實際寫進去的值念回去', () => {
  it('念回去才看得出系統聽錯 —— 不然兩週後看報表才發現資料是錯的', () => {
    const t = confirmText(validateNL({
      weight: 85.7,
      training: { training_type: 'push', duration: 45, rpe: 7 },
      nutrition: { compliant: true },
      wellness: { sleep_quality: 3, energy_level: 3, mood: 3 },
    }))
    expect(t).toContain('85.7kg')
    expect(t).toContain('推 45分 RPE 7')
    expect(t).toContain('飲食達標')
    expect(t).toContain('睡 3 精力 3 心情 3')
  })

  it('被驗證丟掉的欄位不會出現在確認句裡（不能謊稱記到了）', () => {
    const t = confirmText(validateNL({ weight: 85.7, wellness: { sleep_quality: 99 } }))
    expect(t).toContain('85.7kg')
    expect(t).not.toContain('睡')
  })
})

describe('textFromContent：不能寫死 content[0]', () => {
  /**
   * 實測踩過的坑：Opus 5 回 [thinking, text]，取 [0] 拿到 thinking → 空字串 →
   * 解析失敗 → 整則訊息被當成讀不懂。而且是**安靜地**失敗，模型其實解對了。
   */
  it('thinking 排在前面時仍取得到 text', () => {
    expect(textFromContent([
      { type: 'thinking', text: undefined },
      { type: 'text', text: '{"weight":85.7}' },
    ])).toBe('{"weight":85.7}')
  })
  it('只有 text 時照常', () => {
    expect(textFromContent([{ type: 'text', text: 'ok' }])).toBe('ok')
  })
  it('完全沒有 text block → 空字串，不丟例外', () => {
    expect(textFromContent([{ type: 'thinking' }])).toBe('')
    expect(textFromContent([])).toBe('')
  })
})

describe('extractJSON：模型偶爾會包圍欄或加開場白', () => {
  it('吃得下 markdown 圍欄', () => {
    expect(extractJSON('```json\n{"weight":85.7}\n```')?.weight).toBe(85.7)
  })
  it('吃得下開場白', () => {
    expect(extractJSON('好的，解析結果：{"weight":80}')?.weight).toBe(80)
  })
  it('壞 JSON 回 null 而不是丟例外', () => {
    expect(extractJSON('{我不是 JSON')).toBeNull()
    expect(extractJSON('完全沒有大括號')).toBeNull()
  })
})
