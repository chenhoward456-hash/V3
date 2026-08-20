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
      segmental: { 右腿肌肉: 10.84, 左腿肌肉: 10.74 }, uncertain: [],
    })
    const r = await extractInBody([FILE])
    expect(r.weight).toBe(91.7)
    expect(r.body_fat_pct).toBe(26.2)
    expect(r.smi).toBe(8.7)
    expect(r.segmental?.['右腿肌肉']).toBe(10.84)
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
