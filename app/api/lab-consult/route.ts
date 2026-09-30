import { NextRequest } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase'
import { rateLimit, getClientIP, createErrorResponse, createSuccessResponse } from '@/lib/auth-middleware'
import { loadLabConsult } from '@/lib/lab-consult-data'
import { deepDegrade } from '@/lib/compliance-scrub'

export const dynamic = 'force-dynamic'

const supabase = createServiceSupabase()

/**
 * GET /api/lab-consult?code=<unique_code>
 * 學員版「這次血檢顧問卡」：抽完血不用等教練審，系統先講這次重點、要留意什麼、下次什麼時候驗、驗什麼。
 * 確定性規則（lib/lab-consult.ts），不經 AI。code 是 bearer（同學員 dashboard）。
 */
export async function GET(request: NextRequest) {
  const { allowed } = await rateLimit(`lab_consult_${getClientIP(request)}`, 30, 60_000)
  if (!allowed) return createErrorResponse('請求過於頻繁，請稍後再試', 429)

  const code = new URL(request.url).searchParams.get('code')
  if (!code) return createErrorResponse('缺少代碼', 400)

  const { data: client } = await supabase
    .from('clients')
    .select('id, is_active')
    .eq('unique_code', code)
    .maybeSingle()
  if (!client) return createErrorResponse('找不到資料', 404)
  if (client.is_active === false) return createErrorResponse('帳號已暫停', 403)

  try {
    const loaded = await loadLabConsult(supabase, client.id)
    if (!loaded || !loaded.consult) return createSuccessResponse({ consult: null, nextCheckupDate: null })
    // 源頭全是固定句＋指標名，這裡只是最後一道網（未來改句子漏網時兜住）
    const { value: consult } = deepDegrade(loaded.consult, '（這段請直接問教練）')
    return createSuccessResponse({ consult, nextCheckupDate: loaded.nextCheckupDate })
  } catch {
    return createErrorResponse('讀取失敗', 500)
  }
}
