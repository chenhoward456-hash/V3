/**
 * 醫療合規巡檢（runtime guard）
 *
 * V3 紅線：學員看到的文字嚴禁出現診斷／處方／疾病名。教練在佇列可手改草稿，
 * 一旦改成含醫療宣稱的字會原樣推給學員並入庫——這裡在「發送前」攔下。
 *
 * 設計取捨：只擋最清楚的紅線（疾病名 + 診斷語氣 + 處方語氣），不做寬鬆模糊比對，
 * 避免擋掉正當的健身/營養教練用語（「血糖偏高建議追蹤」是 OK 的，「你有糖尿病」不行）。
 */

// 疾病名／臨床診斷詞（出現幾乎都越界）
const DISEASE_TERMS = [
  '糖尿病', '脂肪肝', '高血壓', '高血脂', '甲狀腺亢進', '甲狀腺低下', '甲狀腺炎',
  '癌', '腫瘤', '憂鬱症', '焦慮症', '躁鬱', '思覺失調',
  '腎衰竭', '肝硬化', '心臟病', '中風', '痛風', '紅斑性狼瘡',
  '貧血症', '骨質疏鬆症', '代謝症候群', '胰島素阻抗症', '多囊性卵巢',
]

// 診斷語氣：把人「定性成有病」
const DIAGNOSIS_PATTERNS: { re: RegExp; label: string }[] = [
  { re: /你(有|患有|罹患|得了)\s*[一-龥A-Za-z]{0,8}(症|病|炎|癌)/, label: '診斷語氣（你有/罹患…病症）' },
  { re: /(確診|診斷為|判定為)/, label: '診斷語氣（確診/診斷為）' },
  { re: /(前期|疑似)\s*[一-龥]{0,6}(症|病)/, label: '診斷語氣（…前期/疑似…病）' },
]

// 處方語氣：開藥／劑量
const PRESCRIPTION_PATTERNS: { re: RegExp; label: string }[] = [
  { re: /(開|處方|服用|建議吃)\s*[一-龥A-Za-z]{0,10}(藥|錠|膠囊|針劑)/, label: '處方語氣（開藥/服用…藥）' },
  { re: /\d+\s*(mg|毫克|ml|毫升|IU|單位)\b/i, label: '劑量數字（mg/毫克/IU…）' },
  { re: /(停藥|加藥|減藥|換藥)/, label: '處方語氣（停藥/換藥…）' },
]

export type ComplianceHit = { term: string; reason: string }

/**
 * 掃描一段要給學員看的文字，回傳所有命中的醫療紅線詞。空陣列 = 通過。
 */
export function scanMedicalCompliance(text: string): ComplianceHit[] {
  if (!text) return []
  const hits: ComplianceHit[] = []
  const seen = new Set<string>()
  const add = (term: string, reason: string) => {
    const key = `${term}|${reason}`
    if (!seen.has(key)) { seen.add(key); hits.push({ term, reason }) }
  }

  for (const d of DISEASE_TERMS) {
    if (text.includes(d)) add(d, '疾病／臨床診斷名稱')
  }
  for (const p of [...DIAGNOSIS_PATTERNS, ...PRESCRIPTION_PATTERNS]) {
    const m = text.match(p.re)
    if (m) add(m[0].trim(), p.label)
  }
  return hits
}

export function isMedicallyCompliant(text: string): boolean {
  return scanMedicalCompliance(text).length === 0
}
