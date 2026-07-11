import { describe, it, expect } from 'vitest'
import { BLOOD_MARKERS } from '@/lib/blood-panel'
import { scanMedicalCompliance } from '@/lib/compliance-scrub'

describe('BLOOD_MARKERS', () => {
  it('剛好 5 個指標、key 不重複', () => {
    expect(BLOOD_MARKERS).toHaveLength(5)
    expect(new Set(BLOOD_MARKERS.map(m => m.key)).size).toBe(5)
  })

  it('每個指標欄位都填齊', () => {
    for (const m of BLOOD_MARKERS) {
      for (const f of [m.name, m.en, m.plain, m.whyNhiSkips, m.askDoctor]) {
        expect(f.trim().length).toBeGreaterThan(0)
      }
    }
  })

  it('合規契約：所有指標文案不得命中醫療合規紅線', () => {
    for (const m of BLOOD_MARKERS) {
      const all = `${m.name}${m.plain}${m.whyNhiSkips}${m.askDoctor}`
      expect(scanMedicalCompliance(all)).toEqual([])
    }
  })

  it('不對讀者下判讀/診斷（askDoctor 是問句，導向醫師，不是結論）', () => {
    for (const m of BLOOD_MARKERS) {
      // 問醫師的內容應含問號、或明顯是請醫師處理的語氣，不該是「你有 XX 病」式斷言
      expect(m.askDoctor).toMatch(/[？?]/)
      for (const banned of ['你有', '你已經', '確診', '罹患']) {
        expect(m.askDoctor).not.toContain(banned)
      }
    }
  })

  it('不放療效保證/處方劑量式字眼', () => {
    for (const m of BLOOD_MARKERS) {
      const all = `${m.plain}${m.whyNhiSkips}${m.askDoctor}`
      for (const banned of ['保證', '治好', '療效', '一定會好']) {
        expect(all).not.toContain(banned)
      }
    }
  })
})
