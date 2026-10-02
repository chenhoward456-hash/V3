// 檢驗所參考範圍（報告上印的那欄）解析 —— 給「V3 沒有自己判讀標準」的指標當退路（2026-10-02）。
//
// 起因：Howard 9/30 那批 30 項裡有 9 項（CPK、LDH、澱粉酶、RDW-CV、球蛋白、直接膽紅素、紅血球、總蛋白、血球比容）
// 不在 LAB_THRESHOLDS。上傳時一律被標「正常」、顧問卡直接略過——CPK 397（檢驗所 46–171）就這樣消失。
// 這裡不發明門檻：只照檢驗所自己印的範圍判「在範圍內／範圍外」，範圍外最多給 attention（不給 alert，
// 檢驗所範圍不分輕重，要不要緊交給人看）。解析不出來就回 null，呼叫端維持原本行為。

export interface ParsedRange { min: number | null; max: number | null; text: string }

const NUM = '(\\d+(?:\\.\\d+)?)'

export function parseReferenceRange(raw: string | null | undefined): ParsedRange | null {
  if (!raw) return null
  const text = String(raw).trim()
  const s = text.replace(/,/g, '').replace(/[～〜~–—]/g, '-').replace(/\s+/g, '')
  let m = s.match(new RegExp(`^${NUM}-${NUM}`))
  if (m) {
    const min = parseFloat(m[1]), max = parseFloat(m[2])
    return min <= max ? { min, max, text } : null
  }
  m = s.match(new RegExp(`^(<=|≤|<|＜)${NUM}`))
  if (m) return { min: null, max: parseFloat(m[2]), text }
  m = s.match(new RegExp(`^(>=|≥|>|＞)${NUM}`))
  if (m) return { min: parseFloat(m[2]), max: null, text }
  return null
}

/** 範圍內 → normal；範圍外 → attention；解析不出 → null */
export function statusFromReferenceRange(value: number, raw: string | null | undefined): 'normal' | 'attention' | null {
  if (!Number.isFinite(value)) return null
  const r = parseReferenceRange(raw)
  if (!r) return null
  if (r.min != null && value < r.min) return 'attention'
  if (r.max != null && value > r.max) return 'attention'
  return 'normal'
}

/** 偏高／偏低（範圍外才有） */
export function sideFromReferenceRange(value: number, raw: string | null | undefined): 'high' | 'low' | null {
  const r = parseReferenceRange(raw)
  if (!r) return null
  if (r.min != null && value < r.min) return 'low'
  if (r.max != null && value > r.max) return 'high'
  return null
}
