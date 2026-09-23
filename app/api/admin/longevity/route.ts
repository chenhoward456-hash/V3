import { NextRequest } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase'
import { verifyCoachAuth, createErrorResponse, createSuccessResponse } from '@/lib/auth-middleware'
import { loadLongevity } from '@/lib/longevity-data'

export const dynamic = 'force-dynamic'

const supabase = createServiceSupabase()

/**
 * GET /api/admin/longevity?clientId=<uuid|unique_code>
 * 長壽透鏡（教練預覽）：血檢照 Attia 四騎士排，每個變化附「是真的嗎／這段期間做了什麼」，
 * 加上力量指標。唯讀。
 */
export async function GET(request: NextRequest) {
  const { authorized, error: authError } = await verifyCoachAuth(request)
  if (!authorized) return createErrorResponse(authError || '權限不足', 403)

  const clientId = new URL(request.url).searchParams.get('clientId')
  if (!clientId) return createErrorResponse('clientId is required', 400)

  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clientId)
  const { data: client } = await supabase
    .from('clients')
    .select('id, name, unique_code, gender, next_checkup_date')
    .eq(isUUID ? 'id' : 'unique_code', clientId)
    .maybeSingle()
  if (!client) return createErrorResponse('找不到學員', 404)

  try {
    const lens = await loadLongevity(supabase, client.id)
    return createSuccessResponse({
      client: { name: client.name, gender: client.gender, nextCheckupDate: client.next_checkup_date },
      clientId: client.id,
      ...lens,
    })
  } catch (e) {
    return createErrorResponse(`讀取失敗：${e instanceof Error ? e.message : String(e)}`, 500)
  }
}
