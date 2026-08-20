import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockCreate = vi.fn()
vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = { create: mockCreate }
  },
}))

const { extractInBody, isUsable } = await import('@/lib/inbody-ocr')

function reply(obj: unknown) {
  mockCreate.mockResolvedValueOnce({
    content: [{ type: 'text', text: JSON.stringify(obj) }],
  })
}

const FILE = { mediaType: 'image/jpeg', data: 'AAAA' }

describe('ACCUNIQ / InBody 報表萃取', () => {
  beforeEach(() => {
    mockCreate.mockReset()
    process.env.ANTHROPIC_API_KEY = 'test-key'
  })

  it('讀得出林宥任那張報表的欄位', async () => {
    reply({
      measured_at: '2026-08-12', weight: 91.7, height: 183, body_fat_pct: 26.2,
      body_fat_mass: 24.0, skeletal_muscle: 37.8, lean_mass: 67.7, smi: 8.7,
      visceral_fat: 8, waist_cm: 98.6, whr: 0.85, bmr: 1916, machine_tdee: 2819,
      segmental_muscle: { 右腿: 10.84, 左腿: 10.74 }, uncertain: [],
    })
    const r = await extractInBody([FILE])
    expect(r.weight).toBe(91.7)
    expect(r.body_fat_pct).toBe(26.2)
    expect(r.smi).toBe(8.7)
    expect(r.segmental_muscle?.['右腿']).toBe(10.84)
    expect(isUsable(r)).toBe(true)
  })

  it('⭐ 離譜的數值當成讀錯，不讓它進引擎', async () => {
    // OCR 少讀一位數：917 公斤、體脂 262%
    reply({ weight: 917, body_fat_pct: 262, height: 183, uncertain: [] })
    const r = await extractInBody([FILE])
    expect(r.weight).toBeNull()
    expect(r.body_fat_pct).toBeNull()
    expect(r.uncertain).toContain('weight')
    expect(r.uncertain).toContain('body_fat_pct')
    expect(isUsable(r)).toBe(false)   // 沒有體重就不能用
  })

  it('讀不到的欄位是 null，不會被填成 0', async () => {
    reply({ weight: 70, body_fat_pct: null, waist_cm: null, uncertain: [] })
    const r = await extractInBody([FILE])
    expect(r.body_fat_pct).toBeNull()
    expect(r.waist_cm).toBeNull()
    expect(r.weight).toBe(70)
  })

  it('模型回傳包 markdown 圍欄也能解析', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: '```json\n{"weight": 80, "uncertain": []}\n```' }],
    })
    const r = await extractInBody([FILE])
    expect(r.weight).toBe(80)
  })

  it('日期格式不對就丟掉，不硬轉', async () => {
    reply({ weight: 80, measured_at: '2026/8/12', uncertain: [] })
    expect((await extractInBody([FILE])).measured_at).toBeNull()
  })

  it('回傳不是 JSON → 給看得懂的錯誤', async () => {
    mockCreate.mockResolvedValueOnce({ content: [{ type: 'text', text: '這張照片太模糊了' }] })
    await expect(extractInBody([FILE])).rejects.toThrow('無法解析')
  })

  it('不支援的檔案類型直接擋', async () => {
    await expect(extractInBody([{ mediaType: 'image/tiff', data: 'x' }])).rejects.toThrow('不支援')
  })

  it('沒有檔案直接擋', async () => {
    await expect(extractInBody([])).rejects.toThrow('沒有有效檔案')
  })
})

describe('真實 ACCUNIQ 報表的三個陷阱（2026-08-20 實測抓到）', () => {
  beforeEach(() => {
    mockCreate.mockReset()
    process.env.ANTHROPIC_API_KEY = 'test-key'
  })

  it('⭐ 腹圍印成英吋卻標 cm → 自動轉公分並標記', () => {
    // 實測那張：「腹圍 37.0（少於 90 cm）cm」—— 37 吋 ≈ 94 公分。
    // 原樣採用會得到「腹圍 37 公分」，而且它會流進中央肥胖判斷。
    reply({ weight: 75.8, body_fat_mass: 15.9, waist_raw: 37.0, uncertain: [] })
    return extractInBody([FILE]).then(r => {
      expect(r.waist_cm).toBe(94)
      expect(r.waist_was_inches).toBe(true)
    })
  })

  it('已經是公分的不要重複換算', async () => {
    reply({ weight: 91.7, body_fat_mass: 24, waist_raw: 98.6, uncertain: [] })
    const r = await extractInBody([FILE])
    expect(r.waist_cm).toBe(98.6)
    expect(r.waist_was_inches).toBe(false)
  })

  it('⭐ 用體脂重÷體重校正誤讀的體脂率', async () => {
    // 實測 OCR 讀 20.8，報表是 20.9；15.9/75.8 = 20.97 → 反算比直接讀那格穩
    reply({ weight: 75.8, body_fat_mass: 15.9, body_fat_pct: 20.8, uncertain: [] })
    const r = await extractInBody([FILE])
    expect(r.body_fat_pct).toBeCloseTo(21.0, 1)
  })

  it('⭐ 用體重−體脂重校正除脂體重（實測讀成 59.8，正確 59.9）', async () => {
    reply({ weight: 75.8, body_fat_mass: 15.9, lean_mass: 59.8, uncertain: [] })
    const r = await extractInBody([FILE])
    expect(r.lean_mass).toBe(59.9)
  })

  it('體脂率與反算差太多 → 不自作主張，標記給人看', async () => {
    reply({ weight: 75.8, body_fat_mass: 15.9, body_fat_pct: 35, uncertain: [] })
    const r = await extractInBody([FILE])
    expect(r.uncertain).toContain('body_fat_pct')
  })

  it('⭐ 模型對 history 沒把握 → 整組丟掉（錯的趨勢比沒趨勢糟）', async () => {
    reply({
      weight: 75.8, body_fat_mass: 15.9, measured_at: '2026-08-15',
      history: [
        { date: '2026-01-08', weight: 77.2, skeletal_muscle: 33.7, body_fat_pct: 20.6 },
        { date: '2026-08-15', weight: 75.8, skeletal_muscle: 33.5, body_fat_pct: 20.9 },
      ],
      uncertain: ['history[0].date'],
    })
    const r = await extractInBody([FILE])
    expect(r.history).toEqual([])
    expect(r.uncertain).toContain('history')
  })

  it('history 最後一筆對不上當次體重 → 整組錯位，丟掉', async () => {
    reply({
      weight: 75.8, body_fat_mass: 15.9, measured_at: '2026-08-15',
      history: [{ date: '2026-08-15', weight: 82.4, skeletal_muscle: 33.5, body_fat_pct: 20.9 }],
      uncertain: [],
    })
    expect((await extractInBody([FILE])).history).toEqual([])
  })

  it('history 乾淨時保留', async () => {
    reply({
      weight: 75.8, body_fat_mass: 15.9, measured_at: '2026-08-15',
      history: [
        { date: '2026-07-06', weight: 77.2, skeletal_muscle: 33.7, body_fat_pct: 20.6 },
        { date: '2026-08-15', weight: 75.8, skeletal_muscle: 33.5, body_fat_pct: 20.9 },
      ],
      uncertain: [],
    })
    const r = await extractInBody([FILE])
    expect(r.history).toHaveLength(2)
    expect(r.history[0].date).toBe('2026-07-06')
  })
})
