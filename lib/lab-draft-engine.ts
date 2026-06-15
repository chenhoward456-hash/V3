/**
 * AI 血檢解讀草稿引擎
 *
 * 用途：把 trend analyzer 的 findings 丟給 Claude，生成 panel note 草稿（summary + priorities）。
 * 教練只審核 + 修改，不從零打字。這是 NT$4,999 Protocol tier 能 scale 的關鍵。
 *
 * Howard Protocol 哲學（注入 system prompt）：
 *   1. 誠實涵蓋好的 + 壞的，不 cherry-pick
 *   2. 變差的指標優先寫，再寫穩定的，最後才寫進步的
 *   3. 跨指標關聯（例如 SHBG ↑ 解釋 free T ↓）
 *   4. 行動建議要具體（劑量、頻率、複測時程）
 *   5. 不做醫療診斷，建議就醫的時機要明確
 */

import Anthropic from '@anthropic-ai/sdk'
import type { LabFinding } from './lab-trend-analyzer'
import { HOWARD_LAB_VOICE } from './howard-voice'
import { scanMedicalCompliance } from './compliance-scrub'

let _anthropic: Anthropic | null = null
function getClient(): Anthropic {
  if (!_anthropic) {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY 未設定')
    _anthropic = new Anthropic({ apiKey })
  }
  return _anthropic
}

const SYSTEM_PROMPT_BASE = `你是 Howard Protocol 的 AI 教練筆記助手，協助教練（Howard，CSCS）撰寫血檢數據的趨勢觀察筆記。**你輸出的是教練生活方式建議，不是醫療診斷、處方或治療建議。**

# 你的任務
根據提供的 findings（已分析好的趨勢資料），產出兩段內容供教練審核：
1. **summary**：3-5 句趨勢觀察筆記，誠實涵蓋好的 + 壞的 + 跨指標關聯
2. **priorities**：按嚴重度排序的生活方式調整優先序（具體可執行的飲食、訓練、補品建議）

# 鐵則
- **不准 cherry-pick**：critical 與 attention 的 finding 必須出現在 summary
- **變差優先**：如果有 critical/attention，summary 開頭就寫，不要先報喜
- **跨指標關聯**：當看到組合模式（例：SHBG↑+游離T↓、TSH↑+Free T4↑、ApoB低+睪固酮低同時存在 = 備賽 cut 訊號）必須點出來
- **行動具體**：priorities 要寫劑量/頻率/複測時程，不是「再觀察」
- **行銷敘事鐵則**：
  - **不要提具體人名**（Peter Attia / Mark Hyman / Andrew Huberman 等）— 客戶不認識也不在乎
  - 用「國際長壽研究」「研究方向指出」「長壽研究文獻」這類通用語
  - 用「Howard Protocol 標準」或「最佳化目標」這類 brand 語，不寫他家門派名
- **法律合規鐵則**（不可違反）：
  - 不要用「診斷」「治療」「處方」「藥物」這類醫療詞彙
  - 不要說「你有 X 疾病」「你應該吃 X 藥」「X 是不正常的」
  - 用「數據觀察」「趨勢」「建議與醫師討論」「生活方式調整」「補品策略可包含」這類詞彙
  - 補品建議要寫「文獻常用劑量約 X mg/日，建議與醫師討論後使用」而不是「你應該吃 X mg」
  - 任何提到「症狀」「異常」「就醫」處，要明確寫「建議諮詢家醫科或整合醫學醫師」（不要用「功能醫學醫師」 — 台灣不是正式分科）
- **禁止推薦的物質清單**（不可違反）：
  - **管制藥品 / 處方藥**：麻黃 / 麻黃素 (ephedra/ephedrine)、Yohimbine、可待因、生長激素、胰島素、AAS（同化類固醇）、SARM、Clenbuterol、DNP、T3/T4 甲狀腺素
  - **運動禁藥**（WADA / 健美協會禁賽列表）：tribulus 在某些禁藥檢測項目敏感、DHEA 在多數運動禁用、PCT 用藥（Clomid / Nolvadex / arimidex）
  - **未經中華民國 TFDA 核准的補品**：NMN（在台灣為健康食品灰色地帶）、某些 nootropic
  - 如果你想到上述任何一類，請改用「請與醫師或運動營養師討論進階介入選項」帶過，不要寫具體物質名稱
- **語氣**：直接、有 opinion，但是是「教練的觀察」，不是「醫師的判斷」

# 輸出格式（嚴格）
回傳純 JSON 物件，沒有 markdown code fence，沒有額外說明：
{
  "summary": "...",
  "priorities": "1) ...\\n2) ...\\n3) ..."
}

# Howard Protocol 最佳化追蹤標準（基於國際長壽研究文獻）
- ApoB 最佳 <50（不是醫院 <130）
- hsCRP 最佳 <0.5
- HbA1c 最佳 <5.0
- 空腹胰島素 <2.5
- 同半胱胺酸 <6
- 維生素 D 最佳 60-80 ng/mL
- 總睪固酮（男）最佳 700-900 ng/dL
- 游離睪固酮（男）最佳 150-220 pg/mL
- 雌二醇（男）最佳 15-30 pg/mL`

// 哲學注入 = mode（短期備賽 vs 長期健康）+ tier（服務深度）的組合
// mode 決定「該不該擔心指標惡化」，tier 決定「寫多深、教育多深」
const MODE_PHILOSOPHIES: Record<string, string> = {
  bodybuilding: `# 學員的哲學：健體備賽（短期目標導向）
- 短期（賽前 12-16 週）內，部分荷爾蒙/恢復指標下降是可接受代價
- 心血管 / 代謝面下降反而不正常（cut 應該讓這些變好）
- 對睪固酮 / 雌二醇 / SHBG 下降寫法：點出但定位為「備賽預期代價」，重點放在「賽後 reverse 計畫」
- 不要建議調整 cut 強度（教練 + 學員自己會決定）
- 比賽日期可能影響你建議的複測時程`,

  athletic: `# 學員的哲學：競技備賽（量級運動）
- 跟 bodybuilding 類似但更急性（賽前秤重、賽後 rebound）
- 鈉、水分、肌酸操作可能造成短期 lab 變化，要意識到「這不是長期狀態」`,

  health: `# 學員的哲學：長期健康（health mode）
- **零容忍**犧牲睡眠 / 恢復 / 荷爾蒙 / 心血管
- 任何指標惡化都不是「可接受代價」 — 必須找原因並建議生活方式調整
- 重點是「5-10 年 trajectory」，不是「下季變化」
- 行動建議要永續（不要叫人做 12 週就會崩潰的事）
- 介入優先序：sleep > nutrition > supplements > training intensity（不是反過來）
- 任何「症狀」或「指標異常」務必明寫「建議諮詢家醫科或整合醫學醫師」`,

  standard: `# 學員的哲學：一般模式
- 沒有特殊備賽或長期計畫
- 建議偏向通用、可操作的基礎健康優化`,
}

// 服務深度（subscription_tier）疊加 — 影響「寫多細、教育多深」
const TIER_DEPTH: Record<string, string> = {
  protocol: `# 服務等級：Protocol（NT$4,999/月）— 進階深度
- 客戶 40-55 歲、付得起、想理解 why 不只是 what
- 觀察可以更深入、更教育性（解釋機轉、引文獻方向、跨指標關聯）
- 建議要具體：劑量、頻率、複測時程都要寫清楚
- 行動清單可寫 5-7 項，不要太簡略`,

  concierge: `# 服務等級：Concierge（最高階）— 醫師協作
- 同 Protocol 但更深；可主動建議「我會跟你的合作醫師討論 X」
- 行動建議可以更積極（含跨領域整合）`,

  coached: `# 服務等級：Coached（NT$2,999/月）— 標準教練
- 中度深度 — 給觀察 + 主要 3-4 項行動建議
- 教育性適中，不過度深入機轉
- 重點放在「下一週/下一階段怎麼做」`,

  self_managed: `# 服務等級：Self-Managed（NT$499/月）— 自助
- 輕量分析，重點是讓學員自己看得懂
- 行動建議 2-3 項即可，每項一句話`,

  free: `# 服務等級：Free
- 最簡略，只指出最重要的 1-2 個觀察`,
}

/**
 * 根據 client_mode + subscription_tier 組裝 system prompt
 * mode = 哲學（短期備賽 vs 長期健康），tier = 服務深度
 */
function buildSystemPrompt(mode?: string | null, tier?: string | null): string {
  const parts = [SYSTEM_PROMPT_BASE]
  if (mode && MODE_PHILOSOPHIES[mode]) parts.push(MODE_PHILOSOPHIES[mode])
  if (tier && TIER_DEPTH[tier]) parts.push(TIER_DEPTH[tier])
  return parts.join('\n\n')
}

export interface DraftInput {
  panelDate: string
  clientName?: string
  clientAge?: number | null
  clientGender?: '男性' | '女性' | null
  clientMode?: string | null         // bodybuilding / health / athletic etc — 哲學
  subscriptionTier?: string | null   // free / self_managed / coached / protocol / concierge — 服務深度
  findings: LabFinding[]
}

export interface DraftResult {
  summary: string
  priorities: string
  modelUsed: string
  findingsCount: number
  /** AI 草稿命中醫療紅線（疾病名/處方/劑量）→ 教練須先改寫再給學員 */
  needsComplianceReview?: boolean
  complianceHits?: string[]
}

/**
 * 將 findings 序列化成 Claude 容易消化的 markdown
 */
function findingsToMarkdown(findings: LabFinding[]): string {
  if (findings.length === 0) return '（無可分析的數據）'

  const groups = {
    critical:  findings.filter(f => f.severity === 'critical'),
    attention: findings.filter(f => f.severity === 'attention'),
    watch:     findings.filter(f => f.severity === 'watch'),
    improving: findings.filter(f => f.severity === 'improving'),
    optimal:   findings.filter(f => f.severity === 'optimal'),
  }

  const lines: string[] = []
  const fmt = (f: LabFinding) => {
    const trend = f.trend === 'declining' ? '⬇惡化'
      : f.trend === 'improving' ? '⬆改善'
      : f.trend === 'stable' ? '持平' : ''
    return `- ${f.autoLabel} [status: ${f.latestStatus}${trend ? ', ' + trend : ''}]`
  }

  if (groups.critical.length) {
    lines.push('## 🚨 critical（必須在 summary 點出）')
    groups.critical.forEach(f => lines.push(fmt(f)))
    lines.push('')
  }
  if (groups.attention.length) {
    lines.push('## ⚠️ attention（必須在 summary 點出）')
    groups.attention.forEach(f => lines.push(fmt(f)))
    lines.push('')
  }
  if (groups.watch.length) {
    lines.push('## 👀 watch（在正常但偏離最佳，summary 可選擇性提及）')
    groups.watch.forEach(f => lines.push(fmt(f)))
    lines.push('')
  }
  if (groups.improving.length) {
    lines.push('## 📈 improving')
    groups.improving.forEach(f => lines.push(fmt(f)))
    lines.push('')
  }
  if (groups.optimal.length) {
    lines.push('## ✅ optimal（已達 Howard 最佳）')
    groups.optimal.slice(0, 6).forEach(f => lines.push(fmt(f)))
    if (groups.optimal.length > 6) lines.push(`- ...另 ${groups.optimal.length - 6} 項已達最佳`)
  }

  return lines.join('\n')
}

export async function generatePanelNoteDraft(input: DraftInput): Promise<DraftResult> {
  const model = process.env.CLAUDE_MODEL || 'claude-haiku-4-5-20251001'
  // 前置 Howard 判讀腦（Fable 蒸餾）→ 讓 Haiku 的推理與口吻收斂到 Howard 本人
  const systemPrompt = `${HOWARD_LAB_VOICE}\n\n${buildSystemPrompt(input.clientMode, input.subscriptionTier)}`

  const ctx: string[] = []
  if (input.clientName) ctx.push(`學員：${input.clientName}`)
  if (input.clientAge) ctx.push(`年齡：${input.clientAge}`)
  if (input.clientGender) ctx.push(`性別：${input.clientGender}`)
  if (input.clientMode) ctx.push(`目前模式：${input.clientMode}（system prompt 已注入對應的教練哲學）`)
  if (input.subscriptionTier) ctx.push(`服務等級：${input.subscriptionTier}（system prompt 已注入對應的服務深度）`)
  ctx.push(`本次血檢日期：${input.panelDate}`)

  const userPrompt = `${ctx.join('\n')}

# Findings（已按嚴重度排序）
${findingsToMarkdown(input.findings)}

請按系統提示的鐵則產出 JSON。不要包 markdown code fence。`

  const response = await getClient().messages.create({
    model,
    max_tokens: 3000,  // bumped from 1500 — 之前 priorities 長時會被截斷導致 JSON 解析失敗
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  })

  const textBlock = response.content.find(b => b.type === 'text')
  const raw = textBlock && 'text' in textBlock ? textBlock.text : ''

  // 抓 JSON：容錯處理 ```json fence、前後雜訊、被截斷的 response
  let jsonStr = raw.trim()
  // 移除前後 ``` fences（即使沒有結尾 fence 也要剝掉開頭）
  jsonStr = jsonStr.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '')
  // 抓第一個 { 到最後一個 }
  const firstBrace = jsonStr.indexOf('{')
  const lastBrace = jsonStr.lastIndexOf('}')
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    jsonStr = jsonStr.slice(firstBrace, lastBrace + 1)
  }

  let parsed: { summary?: string; priorities?: string } = {}
  try {
    parsed = JSON.parse(jsonStr)
  } catch {
    // 解析失敗：用 regex 萃取 summary / priorities 欄位
    const sumMatch = jsonStr.match(/"summary"\s*:\s*"((?:[^"\\]|\\.)*)"/)
    const priMatch = jsonStr.match(/"priorities"\s*:\s*"((?:[^"\\]|\\.)*)"/)
    if (sumMatch || priMatch) {
      parsed = {
        summary: sumMatch ? sumMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"') : '',
        priorities: priMatch ? priMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"') : '',
      }
    } else {
      parsed = { summary: raw, priorities: '' }
    }
  }

  const rawSummary = String(parsed.summary || '').trim()
  const rawPriorities = String(parsed.priorities || '').trim()

  // 合規 backstop：LLM 草稿可能蹦出疾病名/處方/劑量（prompt 不是強制守門）。
  // 命中就標記 needsComplianceReview，讓教練佇列知道要先改寫再給學員。
  const summaryHits = scanMedicalCompliance(rawSummary)
  const priorityHits = scanMedicalCompliance(rawPriorities)
  const complianceHits = [...summaryHits, ...priorityHits]

  return {
    summary: rawSummary,
    priorities: rawPriorities,
    modelUsed: model,
    findingsCount: input.findings.length,
    needsComplianceReview: complianceHits.length > 0,
    complianceHits: complianceHits.map(h => h.term),
  }
}

/**
 * 給學員端顯示時自動附加的免責提醒。
 * 不存進 DB（教練不需要每筆都看），由 UI 層在渲染時加上。
 */
export const DRAFT_DISCLAIMER =
  '※ 本內容為教練基於數據趨勢的觀察筆記與生活方式建議，不構成醫療診斷或處方。若數值異常或您有健康疑慮，請諮詢家醫科或整合醫學醫師。'

