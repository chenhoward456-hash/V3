import { NextRequest } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase'
import { rateLimit, getClientIP, createErrorResponse, createSuccessResponse } from '@/lib/auth-middleware'
import { loadLongevity } from '@/lib/longevity-data'
import { STUDENT_GROUP_META } from '@/lib/longevity-lens'
import { degradeToSafe } from '@/lib/compliance-scrub'

export const dynamic = 'force-dynamic'

const supabase = createServiceSupabase()

/**
 * GET /api/longevity?code=<unique_code>
 * 學員版長壽透鏡：自己的血檢進退＋身體能力。code 是 bearer（同學員 dashboard）。
 * 跟教練版差在：分組用身體系統的說法、不顯示「癌症」格、教練寫的預測文字過合規降級。
 */
export async function GET(request: NextRequest) {
  const { allowed } = await rateLimit(`longevity_${getClientIP(request)}`, 30, 60_000)
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
    const lens = await loadLongevity(supabase, client.id)
    const groups = lens.horsemen
      .filter(h => STUDENT_GROUP_META[h.key] && h.stories.length > 0)
      .map(h => ({ ...h, ...STUDENT_GROUP_META[h.key]! }))
    // 只掃教練手寫的三欄；指標名／日期不掃（避免誤傷）
    const safe = (t: string | null) => (t ? degradeToSafe(t, '（這段說明請直接問教練）').text : null)
    const hypotheses = lens.hypotheses.map(h => ({ ...h, cause: safe(h.cause), action: safe(h.action), note: safe(h.note) }))
    return createSuccessResponse({
      today: lens.today,
      groups,
      hypotheses,
      fitness: lens.fitness.filter(f => f.latest),
      decathlon: lens.decathlon.map(g => ({ ...g, event: degradeToSafe(g.event, '（跟教練聊過的目標）').text })),
      strength: lens.strength,
    })
  } catch {
    return createErrorResponse('讀取失敗', 500)
  }
}
