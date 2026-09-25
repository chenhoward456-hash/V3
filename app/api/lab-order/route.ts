import { NextRequest } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase'
import { rateLimit, getClientIP, createErrorResponse, createSuccessResponse } from '@/lib/auth-middleware'
import { loadStudentLabOrder } from '@/lib/lab-order-data'

export const dynamic = 'force-dynamic'

const supabase = createServiceSupabase()

/**
 * GET /api/lab-order?code=<unique_code>
 * 學員版「下次抽血驗這些」：跑同一支減法開單引擎（lib/lab-order-data.ts，LINE「血檢」指令共用），學員打開自己就知道要驗什麼、
 * 大約多少錢、哪些不用花錢、抽血前要注意什麼。唯讀、不寫 lab_panel_recommended。
 */
export async function GET(request: NextRequest) {
  const { allowed } = await rateLimit(`lab_order_${getClientIP(request)}`, 30, 60_000)
  if (!allowed) return createErrorResponse('請求過於頻繁，請稍後再試', 429)

  const code = new URL(request.url).searchParams.get('code')
  if (!code) return createErrorResponse('缺少代碼', 400)

  const { data: c } = await supabase
    .from('clients')
    .select('id, is_active')
    .eq('unique_code', code)
    .maybeSingle()
  if (!c) return createErrorResponse('找不到資料', 404)
  if (c.is_active === false) return createErrorResponse('帳號已暫停', 403)

  const order = await loadStudentLabOrder(supabase, c.id)
  if (!order) return createErrorResponse('找不到資料', 404)
  return createSuccessResponse(order)
}
