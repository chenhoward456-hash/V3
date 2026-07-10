import { describe, it, expect } from 'vitest'
import { scanMedicalCompliance, isMedicallyCompliant, degradeToSafe, deepDegrade } from '@/lib/compliance-scrub'

/**
 * compliance-scrub 的行為契約（2026-07-10 首次補測試）。
 *
 * 這支之前完全沒有測試。一個靠子字串比對的 deny-list 必然有誤判，
 * 而誤判的後果是「degradeToSafe 把整段換成罐頭句」——學員看不到真正的警告，而且沒人會發現。
 *
 * 核心設計原則：**禁的是「把人定性成有病」的句子，不是描述性名詞。**
 *   - 「系統性發炎」「發炎指標偏高」「血壓偏高」→ 描述數據，放行
 *   - 「你有系統性發炎」「疑似糖尿病」「這是脂肪肝的表現」→ 診斷句，擋
 *   - 真正的臨床診斷名（糖尿病、代謝症候群、閉經…）→ 一律擋
 */

describe('scanMedicalCompliance — 該擋的', () => {
  const MUST_BLOCK: [string, string][] = [
    ['你有非酒精性脂肪肝', '疾病名 + 你有'],
    ['符合閉經診斷標準', '診斷句型'],
    ['確診代謝症候群', '確診 + 疾病名'],
    ['這是甲狀腺功能低下的表現', '…的表現'],
    ['疑似糖尿病', '疑似 + 病'],
    ['疑似肝炎', '疑似 + 炎（原本漏掉「炎」字尾）'],
    ['這是胃癌的徵兆', '…的徵兆 + 癌'],
    ['你有系統性發炎', '你有 + 炎（描述詞被當病講）'],
    ['疑似系統性發炎', '疑似 + 炎'],
    ['這是系統性發炎的表現', '…的表現 + 炎'],
    ['建議服用 metformin 藥', '處方藥名'],
    ['請服用 atorvastatin', '藥名（statin 結尾）'],
    ['可以停藥了', '處方語氣'],
    ['心肌梗塞與中風的風險上升', '真的講中風'],
    ['高鐵蛋白與代謝症候群相關', '疾病名（即使是文獻語氣）'],
  ]

  for (const [text, why] of MUST_BLOCK) {
    it(`擋下：${text}（${why}）`, () => {
      expect(scanMedicalCompliance(text).length, `應該被擋但放行了：${text}`).toBeGreaterThan(0)
      expect(isMedicallyCompliant(text)).toBe(false)
      expect(degradeToSafe(text).degraded).toBe(true)
    })
  }
})

describe('scanMedicalCompliance — 該放行的（誤判會靜默吃掉學員該看的內容）', () => {
  const MUST_PASS: [string, string][] = [
    ['CRP 偏高（3.2）— 發炎指標偏高，建議先讓它降下來再進入減脂', '描述數據'],
    ['CRP 偏高，反映系統性發炎程度', '系統性發炎＝生理狀態描述，非診斷'],
    ['系統性發炎', '本專案 UI 自己拿它當分類標題'],
    ['5-HTTLPR SS（中風險）→ 碳水下限從 180g 提高至 220g', '「中風險」含「中風」'],
    ['基因型屬高風險，建議加強追蹤', '「高風險」'],
    ['eGFR 是估計值，建議搭配 Cystatin C 計算更準確', '「Cystatin」含「statin」'],
    ['cystatin c 比肌酸酐更準', '大小寫不敏感'],
    ['血壓偏高或正在服用血壓相關藥物者請先問醫師', '描述狀態 + 導向就醫'],
    ['血鈣偏高通常不是飲食造成的，背後原因需要醫師評估', '導向就醫、不點病因'],
    ['月經停止是能量不足最嚴重的警訊，請優先處理並儘快就醫', 'RED-S 警訊，陳述事實不下診斷'],
    ['4 項代謝指標同時偏離參考範圍', '不點病名'],
    ['多項 RCT 顯示可降空腹血糖；正在服用血糖相關藥物者請先問醫師', '不比較處方藥名'],
    ['含天然 Monacolin K，作用機制與部分降膽固醇藥物相似；併用前請先問醫師', '安全警語不點藥名'],
  ]

  for (const [text, why] of MUST_PASS) {
    it(`放行：${text.slice(0, 24)}…（${why}）`, () => {
      const hits = scanMedicalCompliance(text)
      expect(hits, `不該被擋卻命中 ${hits.map(h => h.term).join(', ')}：${text}`).toEqual([])
      expect(degradeToSafe(text).degraded).toBe(false)
      expect(degradeToSafe(text).text).toBe(text)
    })
  }
})

describe('白名單不得造成漏抓', () => {
  it('中和「Cystatin」不影響真正的 statin 藥名', () => {
    expect(scanMedicalCompliance('Cystatin C 正常，但仍需 rosuvastatin').length).toBeGreaterThan(0)
    expect(scanMedicalCompliance('他汀類藥物').length).toBeGreaterThan(0)
  })

  it('中和「中風險」不影響真正的中風', () => {
    expect(scanMedicalCompliance('中風後的復健').length).toBeGreaterThan(0)
  })
})

describe('degradeToSafe / deepDegrade', () => {
  it('命中就整段換成安全句，並回報命中詞', () => {
    const r = degradeToSafe('你有非酒精性脂肪肝')
    expect(r.degraded).toBe(true)
    expect(r.text).toContain('建議與家醫科')
    expect(r.hits.length).toBeGreaterThan(0)
  })

  it('沒命中就原樣回傳', () => {
    const r = degradeToSafe('發炎指標偏高，先降下來再減脂')
    expect(r.degraded).toBe(false)
    expect(r.text).toBe('發炎指標偏高，先降下來再減脂')
  })

  it('deepDegrade 遞迴處理巢狀物件與陣列', () => {
    const input = { title: '安全的標題', items: ['正常的一句', '你有糖尿病'], nested: { note: '也很安全' } }
    const { value, hits } = deepDegrade(input)
    expect(value.title).toBe('安全的標題')
    expect(value.items[0]).toBe('正常的一句')
    expect(value.items[1]).toContain('建議與家醫科')
    expect(value.nested.note).toBe('也很安全')
    expect(hits.length).toBeGreaterThan(0)
  })

  it('空字串/null 安全', () => {
    expect(scanMedicalCompliance('')).toEqual([])
    expect(degradeToSafe('').degraded).toBe(false)
  })
})
