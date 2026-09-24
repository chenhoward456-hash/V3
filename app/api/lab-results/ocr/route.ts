import { NextRequest } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase'
import {
  createErrorResponse,
  createSuccessResponse,
  rateLimit,
  getClientIP,
} from '@/lib/auth-middleware'
import { extractLabRows } from '@/lib/lab-ocr'

export const dynamic = 'force-dynamic'

const supabase = createServiceSupabase()

/**
 * POST /api/lab-results/ocr
 * body: {
 *   clientId: string (unique_code),
 *   files: { mediaType: string, data: string }[]   // base64 (no data: prefix)
 * }
 *
 * 用 Claude Vision/PDF 萃取健檢報告中的血檢數值，回傳結構化陣列供前端確認後再寫入。
 * OCR 核心在 lib/lab-ocr.ts（與 LINE 拍照入庫共用）。
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
    if (client.expires_at && new Date(client.expires_at) < new Date()) return createErrorResponse('帳號已過期', 403)
    if (client.lab_enabled === false) return createErrorResponse('血檢功能未啟用', 403)

    let enriched
    try {
      enriched = await extractLabRows(files)
    } catch (e) {
      // 稽核 S-14：只把 lib/lab-ocr 自己丟的「給使用者看」訊息回前端；
      // 其他（Anthropic SDK 錯誤、env 缺漏等）只進 log，對外回泛用訊息。
      console.error('[lab-results/ocr] extract failed:', e)
      return createErrorResponse(publicOcrError(e), 500)
    }

    return createSuccessResponse({
      rows: enriched,
      count: enriched.length,
    })
  } catch (err) {
    console.error('[lab-results/ocr] exception:', err)
    return createErrorResponse('OCR 失敗，請稍後再試', 500)
  }
}

const PUBLIC_OCR_ERRORS = [/^不支援的檔案類型/, /^沒有有效檔案$/, /^AI 萃取結果無法解析$/]
function publicOcrError(e: unknown): string {
  const msg = e instanceof Error ? e.message : ''
  return PUBLIC_OCR_ERRORS.some(re => re.test(msg)) ? msg : 'OCR 失敗，請稍後再試或改用手動輸入'
}
