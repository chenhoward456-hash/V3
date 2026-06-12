import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createServiceSupabase } from '@/lib/supabase'
import {
  createErrorResponse,
  createSuccessResponse,
  rateLimit,
  getClientIP,
} from '@/lib/auth-middleware'
import { LAB_THRESHOLDS } from '@/utils/labStatus'

export const dynamic = 'force-dynamic'

const supabase = createServiceSupabase()

let _anthropic: Anthropic | null = null
function getClient(): Anthropic {
  if (!_anthropic) {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY 未設定')
    _anthropic = new Anthropic({ apiKey })
  }
  return _anthropic
}

const SYSTEM_PROMPT = `你是專業的健檢報告 OCR 助手。從健檢報告圖片或 PDF 逐項萃取血檢數值，輸出 JSON 陣列。

# 最重要：逐「列」對齊，絕不跨列混用
報告是表格，每個檢驗項目自成一「列」(row)。同一列由左到右是：項目名稱 → 檢查值 →（有時）單位 → 參考範圍。
- 一個數值只屬於它「同一列」的項目名稱。**絕對不要把某列的數值配到另一列的名稱**（這是最常見也最危險的錯誤）。
- 報告可能旋轉、有手寫圈記／箭頭／底線 — 那些是人工標記，請忽略，只讀印刷的表格內容。
- 中文名稱與其英文／縮寫常上下兩行併在同一列（例：「丙氨酸轉胺酶 / ALT(GPT)」「腎絲球過濾率值 / CKD-EPI」），視為同一項。

# 合理範圍檢查（用來驗證對齊，不是用來篩選）
配對後快速檢查數值量級是否合理；若明顯不合理，代表你對錯列了，請重新對齊再輸出：
ALT/AST≈5-100 U/L、肌酸酐≈0.4-1.6 mg/dL、eGFR≈30-130 mL/min、尿酸≈2-12 mg/dL、空腹血糖≈60-200 mg/dL、HbA1c≈4-10 %、總膽固醇/LDL≈50-300 mg/dL。
（例：某列名稱是 eGFR 卻配到 1.x 的值、或某列是肌酸酐卻配到 70+ 的值 → 一定是對錯列。）

# test_name 對照表（只能用這些中文標準名稱）
代謝：HOMA-IR, 空腹胰島素, 空腹血糖, HbA1c, 尿酸
血脂：三酸甘油酯, ApoB, Lp(a), LDL-C, 總膽固醇, HDL-C
肝：AST, ALT, GGT, 白蛋白
腎：肌酸酐, BUN, eGFR
甲狀腺：TSH, Free T4, Free T3
鐵：鐵蛋白
發炎：CRP, hs-CRP, 同半胱胺酸
維生素：維生素D, 維生素B12, 葉酸
礦物質：鎂, 鋅, 鈣
荷爾蒙：睪固酮, 游離睪固酮, 皮質醇, DHEA-S, 雌二醇, SHBG
血球：MCV, 血紅素, 白血球, 血小板

# 常見別名 → 標準名稱
丙氨酸轉胺酶 / ALT / GPT / SGPT → ALT
天門冬胺酸轉胺酶 / 麩草酸轉胺酶 / AST / GOT / SGOT → AST
肌酸酐 / 肌酐 / Creatinine / Cr → 肌酸酐
腎絲球過濾率(值) / 絲球過濾率 / CKD-EPI / eGFR / GFR → eGFR
尿酸 / Uric Acid / UA → 尿酸
丙麩氨酸轉肽酶 / γ-GT / GGT → GGT
糖化血色素 / 糖化血紅素 / HbA1c → HbA1c
Vitamin D / 25-OH Vitamin D → 維生素D

# 規則
- 單位取「同一列」印的單位（eGFR 通常 mL/min、肌酸酐 mg/dL、ALT/AST U/L），不要把別列的單位搬過來。
- reference_range 也取同一列印的（原樣）。
- 看不清楚、無法確定屬於哪一列的，**寧可跳過也不要猜**。
- date 取報告頂部「採檢／檢驗日期」；民國年轉西元（民國年 + 1911，例 115/06/08 → 2026-06-08）；輸出 YYYY-MM-DD，找不到用空字串。
- 數字保留報告上的小數位。

# 輸出
**只輸出純 JSON 陣列**，不要 markdown code fence、不要說明、不要前後文字：
[{"test_name":"...","value":...,"unit":"...","reference_range":"...","date":"..."}]
完全沒有可辨識的血檢資料則輸出 []。`

const KNOWN_TEST_NAMES = new Set(Object.keys(LAB_THRESHOLDS).filter(k => !k.endsWith('_female')))

const VALID_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp'])

interface ExtractedRow {
  test_name: string
  value: number
  unit?: string
  reference_range?: string
  date?: string
}

/**
 * POST /api/lab-results/ocr
 * body: {
 *   clientId: string (unique_code),
 *   files: { mediaType: string, data: string }[]   // base64 (no data: prefix)
 * }
 *
 * 用 Claude Vision/PDF 萃取健檢報告中的血檢數值，回傳結構化陣列供前端確認後再寫入。
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { clientId, files } = body
    if (!clientId) return createErrorResponse('缺少 clientId', 400)
    if (!Array.isArray(files) || files.length === 0) {
      return createErrorResponse('缺少 files', 400)
    }
    if (files.length > 5) return createErrorResponse('一次最多 5 個檔案', 400)

    // Rate limit — OCR 花錢，學員 ip 限 5 次/10 分鐘
    const ip = getClientIP(request)
    const { allowed } = await rateLimit(`lab-ocr:${ip}`, 5, 10 * 60_000)
    if (!allowed) return createErrorResponse('OCR 請求過於頻繁，10 分鐘後再試', 429)

    // Resolve client（同 self-entry 模式驗證）
    const { data: client } = await supabase
      .from('clients')
      .select('id, is_active, expires_at, lab_enabled')
      .eq('unique_code', clientId)
      .single()
    if (!client) return createErrorResponse('找不到客戶', 404)
    if (client.is_active === false) return createErrorResponse('帳號已停用', 403)
    if (client.lab_enabled === false) return createErrorResponse('血檢功能未啟用', 403)

    // 組 Claude 訊息
    type AnthropicContent = Exclude<Anthropic.MessageCreateParams['messages'][0]['content'], string>
    const content: AnthropicContent = []
    for (const f of files) {
      const { mediaType, data } = f as { mediaType?: string; data?: string }
      if (!mediaType || !data) continue
      if (mediaType === 'application/pdf') {
        content.push({
          type: 'document',
          source: {
            type: 'base64',
            media_type: 'application/pdf',
            data,
          },
        } as AnthropicContent[number])
      } else if (VALID_IMAGE_TYPES.has(mediaType)) {
        content.push({
          type: 'image',
          source: {
            type: 'base64',
            media_type: mediaType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
            data,
          },
        })
      } else {
        return createErrorResponse(`不支援的檔案類型：${mediaType}`, 400)
      }
    }
    if (content.length === 0) return createErrorResponse('沒有有效檔案', 400)
    content.push({ type: 'text', text: '請逐項萃取上述健檢報告中的血檢數值，輸出純 JSON 陣列。' })

    // 血檢 OCR 對齊準確度攸關安全，用較強的視覺模型（與全站 CLAUDE_MODEL 脫鉤；
    // 可用 LAB_OCR_MODEL 覆寫，例如 claude-opus-4-8 追求最高準確度）
    const model = process.env.LAB_OCR_MODEL || 'claude-sonnet-4-6'
    const response = await getClient().messages.create({
      model,
      max_tokens: 4000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content }],
    })

    const textBlock = response.content.find(b => b.type === 'text')
    const raw = textBlock && 'text' in textBlock ? textBlock.text : ''

    // 容錯 parse — 抓 [ ... ]
    let jsonStr = raw.trim()
    jsonStr = jsonStr.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '')
    const firstBracket = jsonStr.indexOf('[')
    const lastBracket = jsonStr.lastIndexOf(']')
    if (firstBracket >= 0 && lastBracket > firstBracket) {
      jsonStr = jsonStr.slice(firstBracket, lastBracket + 1)
    }

    let parsed: ExtractedRow[] = []
    try {
      parsed = JSON.parse(jsonStr)
      if (!Array.isArray(parsed)) parsed = []
    } catch {
      console.error('[ocr] JSON parse failed, raw head:', raw.slice(0, 200))
      return createErrorResponse('AI 萃取結果無法解析，請重試或改用手動輸入', 500)
    }

    // 標記哪些指標在 LAB_THRESHOLDS 裡（可被趨勢引擎正確分析）
    const enriched = parsed.map(r => ({
      test_name: r.test_name,
      value: r.value,
      unit: r.unit ?? '',
      reference_range: r.reference_range ?? '',
      date: r.date ?? '',
      isKnown: KNOWN_TEST_NAMES.has(r.test_name),
    }))

    return createSuccessResponse({
      rows: enriched,
      count: enriched.length,
      modelUsed: model,
    })
  } catch (err) {
    console.error('[lab-results/ocr] exception:', err)
    const msg = err instanceof Error ? err.message : 'OCR 失敗'
    return createErrorResponse(msg, 500)
  }
}
