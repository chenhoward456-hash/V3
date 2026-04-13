import { NextRequest } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase'
import { validateSupplementName, sanitizeInput } from '@/utils/validation'
import { createErrorResponse, createSuccessResponse, rateLimit, getClientIP } from '@/lib/auth-middleware'

const supabase = createServiceSupabase()

const VALID_TIMINGS = [
  '早餐前', '早餐後', '午餐前', '午餐後',
  '晚餐前', '晚餐後', '睡前', '訓練前', '訓練後',
]

export async function POST(request: NextRequest) {
  // Rate limit: 10 requests per minute per IP
  const ip = getClientIP(request)
  const { allowed } = await rateLimit(`supp-client:${ip}`, 10, 60_000)
  if (!allowed) {
    return createErrorResponse('請求過於頻繁，請稍後再試', 429)
  }

  try {
    const body = await request.json()
    const { clientId, name, dosage, timing } = body

    // Validate required fields
    if (!clientId || !name || !timing) {
      return createErrorResponse('缺少必要欄位（名稱、服用時間）', 400)
    }

    // Sanitize inputs
    const sanitizedName = sanitizeInput(name)
    const sanitizedDosage = dosage ? sanitizeInput(dosage) : ''
    const sanitizedTiming = sanitizeInput(timing)

    // Validate supplement name
    const nameValidation = validateSupplementName(sanitizedName)
    if (!nameValidation.isValid) {
      return createErrorResponse(nameValidation.error, 400)
    }

    // Validate timing
    if (!VALID_TIMINGS.includes(sanitizedTiming)) {
      return createErrorResponse('無效的服用時間', 400)
    }

    // Look up client by unique_code
    const { data: client } = await supabase
      .from('clients')
      .select('id, expires_at, supplement_enabled')
      .eq('unique_code', clientId)
      .single()

    if (!client) {
      return createErrorResponse('找不到客戶', 404)
    }

    // Check if expired
    if (client.expires_at && new Date(client.expires_at) < new Date()) {
      return createErrorResponse('帳號已過期', 403)
    }

    // Check if supplement feature is enabled
    if (!client.supplement_enabled) {
      return createErrorResponse('補品功能未啟用', 403)
    }

    // Limit max supplements per client to prevent abuse
    const { count } = await supabase
      .from('supplements')
      .select('id', { count: 'exact', head: true })
      .eq('client_id', client.id)

    if (count !== null && count >= 30) {
      return createErrorResponse('補品數量已達上限（30）', 400)
    }

    // Create supplement
    const { data, error } = await supabase
      .from('supplements')
      .insert({
        client_id: client.id,
        name: sanitizedName,
        dosage: sanitizedDosage || null,
        timing: sanitizedTiming,
        sort_order: (count ?? 0) + 1,
      })
      .select()
      .single()

    if (error) {
      console.error('[supplements/client] Insert error:', error)
      return createErrorResponse('建立補品失敗', 500)
    }

    return createSuccessResponse(data)
  } catch (error) {
    console.error('[supplements/client] Server error:', error)
    return createErrorResponse('伺服器錯誤', 500)
  }
}
