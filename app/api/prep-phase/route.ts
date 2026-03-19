import { NextRequest, NextResponse } from 'next/server'
import { createLogger } from '@/lib/logger'
import { createErrorResponse, createSuccessResponse, rateLimit, getClientIP } from '@/lib/auth-middleware'
import { createServiceSupabase } from '@/lib/supabase'
import { isCompetitionMode, validatePrepPhase, getValidPhases } from '@/lib/client-mode'
import { validateBody } from '@/lib/schemas/validate'
import { prepPhaseSchema } from '@/lib/schemas/api'

const logger = createLogger('api-prep-phase')
const supabase = createServiceSupabase()

export async function PUT(request: NextRequest) {
  const ip = getClientIP(request)
  const { allowed } = await rateLimit(`prep-phase:${ip}`, 10, 60_000)
  if (!allowed) return createErrorResponse('請求過於頻繁，請稍後再試', 429)

  try {
    const body = await request.json()
    const parsed = validateBody(prepPhaseSchema, body)
    if (!parsed.success) return parsed.response
    const { clientId, prepPhase } = parsed.data

    // 用 unique_code 找到客戶
    const { data: client } = await supabase
      .from('clients')
      .select('id, client_mode, competition_enabled')
      .eq('unique_code', clientId)
      .single()

    if (!client) {
      return createErrorResponse('找不到客戶', 404)
    }

    if (!isCompetitionMode(client.client_mode)) {
      return createErrorResponse('此客戶未啟用備賽模式', 400)
    }

    if (!validatePrepPhase(prepPhase, client.client_mode)) {
      const validPhases = getValidPhases(client.client_mode)
      return createErrorResponse(`無效的備賽階段。有效階段：${validPhases.join(', ')}`, 400)
    }

    const { error } = await supabase
      .from('clients')
      .update({ prep_phase: prepPhase })
      .eq('id', client.id)

    if (error) {
      return createErrorResponse('更新失敗', 500)
    }

    return createSuccessResponse({ prepPhase })
  } catch (error) {
    logger.error('PUT /api/prep-phase unexpected error', error)
    return createErrorResponse('伺服器錯誤', 500)
  }
}
