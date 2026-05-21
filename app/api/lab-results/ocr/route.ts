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

const SYSTEM_PROMPT = `你是健檢報告 OCR 助手。從提供的健檢報告圖片或 PDF 中萃取血檢數值。

# 任務
逐項辨識血檢項目並輸出為 JSON 陣列。每一項：
{
  "test_name": "中文標準名稱（從下方對照表選）",
  "value": 數字,
  "unit": "單位字串",
  "reference_range": "報告上印的參考範圍（原樣）",
  "date": "YYYY-MM-DD（從報告頂部抽，找不到就用空字串）"
}

# test_name 對照表（一定要用這些中文標準名稱）
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

# 規則
- 報告上英文 "AST/SGOT" 統一寫 "AST"
- "ALT/SGPT" 統一寫 "ALT"
- "Vitamin D" 寫 "維生素D"
- 報告上沒有 / 看不清楚的就跳過該項，不要猜
- 數字四捨五入到合理小數位（HbA1c 保留 1 位、其他通常整數）
- date 格式必須是 YYYY-MM-DD，例 "2026/03/20" → "2026-03-20"

# 輸出
**只輸出純 JSON 陣列**，不要 markdown code fence、不要說明、不要前後文字：
[{"test_name":"...","value":...,"unit":"...","reference_range":"...","date":"..."}]

如果完全沒有可辨識的血檢資料，輸出空陣列 []。`

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

    const model = process.env.CLAUDE_MODEL || 'claude-haiku-4-5-20251001'
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
