import { describe, it, expect } from 'vitest'
import { buildCoachDigest, type CoachDigestInput } from '@/lib/coach-digest'
import { evaluateLabDue } from '@/lib/lab-due'

/**
 * 這支的輸出是「每天早上真的會推到 Howard 手機上的那封信」，
 * 但它在 cron 裡躺了好幾個月一支測試都沒有 —— 所以「沒有連結」這種破口
 * 可以放著沒人發現。契約補在這裡。
 */

const base = (o: Partial<CoachDigestInput> = {}): CoachDigestInput => ({
  today: '2026-08-23',
  clients: [
    { id: 'a', name: '阿明', body_composition_enabled: true, nutrition_enabled: true },
    { id: 'b', name: '小華', body_composition_enabled: true },
  ],
  yesterdayWeightIds: ['a', 'b'],
  yesterdayNutritionIds: ['a'],
  yesterdayTraining: [],
  yesterdayWellness: [],
  lastActiveByClient: { a: '2026-08-23', b: '2026-08-23' },
  recentWeights: [],
  competitions: [],
  labsDue: [],
  proposals: [],
  adminUrl: 'https://example.com',
  ...o,
})

describe('教練晨報', () => {
  it('永遠帶可點的後台連結 —— 沒連結的通知等於還是要他自己想起來去開', () => {
    const d = buildCoachDigest(base({ lastActiveByClient: { a: '2026-08-10', b: '2026-08-23' } }))
    expect(d.text).toContain('https://example.com/admin')
  })

  it('開頭第一句就是結論，不是流水帳', () => {
    const d = buildCoachDigest(base({ lastActiveByClient: { a: '2026-08-10', b: '2026-08-23' } }))
    expect(d.text!.split('\n')[1]).toBe('1 個人需要你出手')
  })

  it('掉線的人排最前面、久的在上面', () => {
    const d = buildCoachDigest(base({
      clients: [
        { id: 'a', name: '阿明' }, { id: 'b', name: '小華' }, { id: 'c', name: '大文' },
      ],
      lastActiveByClient: { a: '2026-08-19', b: '2026-08-06', c: '2026-08-23' },
    }))
    const lines = d.text!.split('\n')
    expect(lines[3]).toContain('2 個人掉線了')
    expect(lines[4]).toContain('小華')   // 17 天
    expect(lines[5]).toContain('阿明')   // 4 天
    expect(d.text).not.toContain('大文')
  })

  it('超過 30 天不列 —— 叫不回來的人天天唸只會讓整封信變雜訊', () => {
    const d = buildCoachDigest(base({
      clients: [{ id: 'a', name: '鬼魂' }],
      lastActiveByClient: { a: '2026-05-01' },
      yesterdayWeightIds: [], yesterdayNutritionIds: [],
    }))
    expect(d.offline).toHaveLength(0)
    expect(d.text ?? '').not.toContain('鬼魂')
  })

  it('剛好 2 天不算掉線、3 天才算（邊界）', () => {
    const two = buildCoachDigest(base({
      clients: [{ id: 'a', name: '阿明' }], lastActiveByClient: { a: '2026-08-21' },
    }))
    expect(two.offline).toHaveLength(0)
    const three = buildCoachDigest(base({
      clients: [{ id: 'a', name: '阿明' }], lastActiveByClient: { a: '2026-08-20' },
    }))
    expect(three.offline).toEqual([{ name: '阿明', days: 3 }])
  })

  it('掉線的人不會在「昨日未記錄」再被唸一次', () => {
    const d = buildCoachDigest(base({
      clients: [{ id: 'a', name: '阿明', body_composition_enabled: true }],
      lastActiveByClient: { a: '2026-08-10' },
      yesterdayWeightIds: [],
    }))
    expect(d.text!.match(/阿明/g)).toHaveLength(1)
  })

  it('鬼魂（>30天／從沒記錄）也不從「昨日未記錄」爬回信裡', () => {
    const d = buildCoachDigest(base({
      clients: [
        { id: 'a', name: '鬼魂', body_composition_enabled: true },
        { id: 'z', name: '從沒記錄過', body_composition_enabled: true },
        { id: 'c', name: '在跑的', body_composition_enabled: true },
      ],
      lastActiveByClient: { a: '2026-05-01', c: '2026-08-23' },
      yesterdayWeightIds: [],
    }))
    expect(d.text ?? '').not.toContain('鬼魂')
    expect(d.text ?? '').not.toContain('從沒記錄過')
    expect(d.text).toContain('在跑的')
  })

  it('什麼事都沒有 → 不發空信', () => {
    const d = buildCoachDigest(base())
    expect(d.text).toBeNull()
  })

  it('精力偏低 / RPE 過高會列出來，名字對得上人', () => {
    const d = buildCoachDigest(base({
      yesterdayWellness: [{ client_id: 'b', energy_level: 2 }],
      yesterdayTraining: [{ client_id: 'a', rpe: 9.5 }],
    }))
    expect(d.text).toContain('小華：精力 2/5')
    expect(d.text).toContain('阿明：RPE 9.5')
  })

  it('體重停滯要 ≥7 筆才算，6 筆不誤報', () => {
    const flat = (n: number) => Array.from({ length: n }, () => ({ client_id: 'a', weight: 80 }))
    expect(buildCoachDigest(base({ recentWeights: flat(6) })).text).toBeNull()
    expect(buildCoachDigest(base({ recentWeights: flat(7) })).text).toContain('體重停滯')
  })
})

describe('血檢到期', () => {
  // 2026-09-13 的真實狀況：這兩個人的回檢日都過了，而唯一會顯示的地方是
  // 要他自己想起來去開的 /admin/labs。信裡沒有 = 等於沒有。
  const overdue = (name: string, date: string) =>
    evaluateLabDue({ id: name, name, gender: '男性', next_checkup_date: date, labs: [] }, '2026-08-23').item

  it('逾期的血檢要進開頭那句 —— 不能第一行說「沒人掉線」就把它藏在下面', () => {
    const d = buildCoachDigest(base({ labsDue: [overdue('謝佳峻', '2026-07-25')] }))
    expect(d.text).toContain('血檢逾期')
    expect(d.text).not.toContain('沒人掉線')
  })

  it('排在「昨日未記錄」前面 —— 有期限的事優先於例行雜訊', () => {
    const d = buildCoachDigest(base({
      yesterdayNutritionIds: [],
      labsDue: [overdue('謝佳峻', '2026-07-25')],
    }))
    expect(d.text!.indexOf('🩸')).toBeLessThan(d.text!.indexOf('昨日未記錄'))
  })

  it('沒人到期就整段不出現，不發空標題', () => {
    const d = buildCoachDigest(base({ yesterdayNutritionIds: [], labsDue: [] }))
    expect(d.text).not.toContain('🩸')
  })
})
