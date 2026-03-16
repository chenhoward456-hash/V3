import { NextRequest, NextResponse } from 'next/server'
import { createErrorResponse, createSuccessResponse, rateLimit, getClientIP } from '@/lib/auth-middleware'
import { createServiceSupabase } from '@/lib/supabase'
import { isCompetitionMode, validatePrepPhase, getValidPhases } from '@/lib/client-mode'

const supabase = createServiceSupabase()

export async function PUT(request: NextRequest) {
  const ip = getClientIP(request)
  const { allowed } = rateLimit(`prep-phase:${ip}`, 10, 60_000)
  if (!allowed) return createErrorResponse('請求過於頻繁，請稍後再試', 429)

  try {
    const body = await request.json()
    const { clientId, prepPhase } = body

    if (!clientId || !prepPhase) {
      return createErrorResponse('缺少必要欄位', 400)
    }

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
  } catch {
    return createErrorResponse('伺服器錯誤', 500)
  }
}
