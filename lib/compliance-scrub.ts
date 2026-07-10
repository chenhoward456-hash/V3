/**
 * 醫療合規巡檢（runtime guard）
 *
 * V3 紅線：學員看得到的文字嚴禁出現診斷／處方／疾病名／療效宣稱。
 * 用途有二：
 *   1. 攔截教練手改的訊息（weekly-coaching/send）→ 命中回 422
 *   2. 當各引擎/AI 輸出的 runtime backstop（命中就 degradeToSafe 降級）
 *
 * 設計取捨：只擋清楚的紅線，盡量不誤殺正當教練/補品語句。
 *   - 補品劑量（DIM 300mg、creatine 5g）是學員自己的 protocol，合法 → 不靠裸 mg 偵測，
 *     處方風險改用「處方藥名」抓（metformin / 甲狀腺素…），補品 mg 不誤殺。
 */

// 疾病名／臨床診斷詞（含中英；出現幾乎都越界）
const DISEASE_TERMS = [
  // 內分泌/代謝
  '糖尿病', '糖尿病前期', '胰島素阻抗', '代謝症候群',
  '甲狀腺低下', '甲狀腺功能低下', '甲狀腺亢進', '甲狀腺功能亢進', '甲亢', '甲狀腺炎',
  '腎上腺疲勞', '腎上腺功能不全', '腎上腺功能低下', 'Addison',
  '多囊性卵巢', '多囊卵巢', 'PCOS', '閉經', '無月經症',
  // 肝腎心
  '脂肪肝', '非酒精性脂肪肝', 'NAFLD', '肝硬化', '腎衰竭', '心臟病', '中風', '高血壓', '高血脂',
  // 血液
  '貧血', '缺鐵性貧血', '小球性貧血', '大球性貧血', '巨球性貧血', '銅缺乏性貧血',
  // 其他
  // 註：「系統性發炎」已於 2026-07-10 移出 deny-list——它是生理狀態描述不是臨床診斷，
  // 且本專案自己的 UI（timeline/standards/showcase）拿它當分類標題。把它當病名擋，
  // 結果是引擎每次想講「CRP 偏高—系統性發炎」都被整段降級成罐頭句，學員反而看不到警告。
  // 危險用法（「你有系統性發炎」「疑似系統性發炎」「這是系統性發炎的表現」）由
  // DIAGNOSIS_PATTERNS 攔截，見下方測試 tests/lib/compliance-scrub.test.ts。
  '癌', '腫瘤', '痛風', '紅斑性狼瘡', '骨質疏鬆症',
  // 精神
  '憂鬱症', '焦慮症', '躁鬱', '思覺失調',
  // 英文（AI 自由生成最常蹦出）
  'diabetes', 'fatty liver', 'hypothyroidism', 'hyperthyroidism', 'anemia', 'anaemia',
  'gout', 'amenorrhea', 'metabolic syndrome', 'insulin resistance',
]

// 處方藥名（出現＝把補品/飲食扯到用藥處方，越界）。補品名不在此列，故補品 mg 不誤殺。
const DRUG_TERMS = [
  'metformin', '二甲雙胍', 'levothyroxine', '左旋甲狀腺素', '甲狀腺素藥', '優甲樂',
  'clomid', 'clomiphene', '可洛米分', 'spironolactone', 'accutane', '異維A酸',
  'statin', '史他汀', '他汀', 'prednisone', '潑尼松', 'SSRI', '血清素回收抑制劑',
]

// 病症字尾：判斷「某個詞是不是被當成病在講」。診斷句型共用。
// 原本只有 (症|病|低下|亢進)，漏掉「炎」和「癌」→「疑似肝炎」「這是胃癌的表現」都放行了。
const DISEASE_SUFFIX = '(症|病|炎|癌|低下|亢進|症候群)'

// 診斷語氣（把人定性成有病）——含「有主詞」與「無主詞」句型
//
// 設計原則（2026-07-10 修正）：**禁的是「把人定性成有病」的句子，不是描述性名詞。**
// 例：「系統性發炎」是生理狀態描述（Howard 自己的 UI 拿它當分類標題），不該進 deny-list；
// 但「你有系統性發炎」「疑似系統性發炎」「這是系統性發炎的表現」必須擋——由這裡負責。
// deny-list 只留真正的臨床診斷名（糖尿病、代謝症候群、閉經、高血壓…）。
const DIAGNOSIS_PATTERNS: { re: RegExp; label: string }[] = [
  { re: new RegExp(`你(有|患有|罹患|得了|是不是有)\\s*[一-龥A-Za-z]{0,8}${DISEASE_SUFFIX}`), label: '診斷語氣（你有/罹患…病症）' },
  { re: /(確診|診斷為|判定為|被診斷)/, label: '診斷語氣（確診/診斷為）' },
  { re: new RegExp(`(前期|疑似)\\s*[一-龥]{0,6}${DISEASE_SUFFIX}`), label: '診斷語氣（…前期/疑似…病）' },
  // 無主詞句型：符合…診斷標準 / 像是…症 / 是…的表現 / 指向…
  { re: /符合[一-龥A-Za-z]{0,10}(診斷標準|的診斷)/, label: '診斷語氣（符合…診斷標準）' },
  { re: new RegExp(`(看起來|像是|疑似|指向|傾向)\\s*[一-龥A-Za-z]{0,8}${DISEASE_SUFFIX}`), label: '診斷語氣（像是/指向…症病）' },
  // 「（這）是 XX病 的表現/徵兆」——原本註解寫了但沒實作
  { re: new RegExp(`(是|為)\\s*[一-龥A-Za-z]{0,10}${DISEASE_SUFFIX}的(表現|徵兆|症狀|跡象|結果)`), label: '診斷語氣（是…病的表現/徵兆）' },
]

// 處方語氣：開藥／服藥／與藥名綁定的劑量
const PRESCRIPTION_PATTERNS: { re: RegExp; label: string }[] = [
  { re: /(開立?|處方|建議服用|該吃|可服用)\s*[一-龥A-Za-z]{0,10}(藥|錠|膠囊|針劑)/, label: '處方語氣（開藥/服用…藥）' },
  { re: /(停藥|加藥|減藥|換藥)/, label: '處方語氣（停藥/換藥…）' },
]

/**
 * 安全詞白名單：這些是正當的檢驗項目/營養名詞，但字面上「包含」某個紅線詞，
 * 用子字串比對會誤殺。掃描前先把它們從文字中中和掉。
 *
 * 例：Cystatin C（胱抑素 C，腎功能指標）含 "statin"（史他汀類藥）。
 * 不能改用字界比對解決——真正的藥名 atorvastatin / rosuvastatin 也是以 statin 結尾，
 * 加了字界反而會漏抓真藥名。所以走白名單。
 */
const SAFE_TERMS = [
  'cystatin c',
  'cystatin',
  // 「中風險」含「中風」→ 基因/風險分級文字（如「5-HTTLPR SS（中風險）」）曾整段被降級成罐頭句。
  // 同理保護「高風險／低風險」不受未來新增詞影響。
  '中風險',
  '高風險',
  '低風險',
]

export type ComplianceHit = { term: string; reason: string }

/**
 * 掃描一段要給學員看的文字，回傳所有命中的醫療紅線詞。空陣列 = 通過。
 */
export function scanMedicalCompliance(text: string): ComplianceHit[] {
  if (!text) return []
  const hits: ComplianceHit[] = []
  const seen = new Set<string>()
  // 中和白名單詞再比對：避免 Cystatin C 被當成藥名 statin、「中風險」被當成「中風」。
  // 中英文都要中和（原本只中和英文，中文的「中風險」照樣誤判）。
  // 診斷/處方語氣的 regex 仍掃原文，因為那些 pattern 不會被安全詞影響。
  let scrubbed = text
  for (const safe of SAFE_TERMS) {
    scrubbed = scrubbed.replace(new RegExp(safe.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), ' ')
  }
  const lower = scrubbed.toLowerCase()
  const add = (term: string, reason: string) => {
    const key = `${term}|${reason}`
    if (!seen.has(key)) { seen.add(key); hits.push({ term, reason }) }
  }

  // 一律比對 scrubbed（安全詞已中和），不再比對原文 text——
  // 否則中文安全詞（「中風險」）的中和不會生效。
  for (const d of DISEASE_TERMS) {
    if (/[A-Za-z]/.test(d) ? lower.includes(d.toLowerCase()) : scrubbed.includes(d)) {
      add(d, '疾病／臨床診斷名稱')
    }
  }
  for (const drug of DRUG_TERMS) {
    if (/[A-Za-z]/.test(drug) ? lower.includes(drug.toLowerCase()) : scrubbed.includes(drug)) {
      add(drug, '處方藥名（含用藥/劑量語境）')
    }
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

const DEFAULT_SAFE =
  '這部分牽涉醫療判讀，建議與家醫科或整合醫學醫師討論；我可以幫你看數據趨勢與生活方式方向。'

/**
 * runtime backstop：文字命中紅線就換成安全句；沒命中原樣回。
 * 回傳 { text, hits, degraded } 方便呼叫端決定要不要記 log 給教練稽核。
 */
export function degradeToSafe(text: string, fallback: string = DEFAULT_SAFE): {
  text: string; hits: ComplianceHit[]; degraded: boolean
} {
  const hits = scanMedicalCompliance(text)
  return hits.length > 0
    ? { text: fallback, hits, degraded: true }
    : { text, hits, degraded: false }
}

/**
 * 遞迴把物件/陣列裡【命中紅線的字串】換成安全句，其餘原樣（沒命中不動）。
 * 給引擎輸出 route 當最後一道網：源頭措辭已改好時幾乎不會觸發，只兜未來新增/漏網。
 * 回傳 { value, hits } —— hits 非空代表有降級，呼叫端可記 log。
 */
export function deepDegrade<T>(input: T, fallback: string = DEFAULT_SAFE): { value: T; hits: ComplianceHit[] } {
  const allHits: ComplianceHit[] = []
  const walk = (v: unknown): unknown => {
    if (typeof v === 'string') {
      const g = degradeToSafe(v, fallback)
      if (g.degraded) allHits.push(...g.hits)
      return g.text
    }
    if (Array.isArray(v)) return v.map(walk)
    if (v && typeof v === 'object') {
      const out: Record<string, unknown> = {}
      for (const [k, val] of Object.entries(v)) out[k] = walk(val)
      return out
    }
    return v
  }
  return { value: walk(input) as T, hits: allHits }
}
