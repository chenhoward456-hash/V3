import { NextRequest } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase'
import { verifyCoachAuth, createErrorResponse, createSuccessResponse } from '@/lib/auth-middleware'

export const dynamic = 'force-dynamic'

const supabase = createServiceSupabase()
const CAPACITIES = ['strength', 'cardio', 'mobility', 'balance']

/** POST：記一個「90 歲想做到的事」（教練跟學員聊過之後） */
export async function POST(request: NextRequest) {
  const { authorized, error: authError } = await verifyCoachAuth(request)
  if (!authorized) return createErrorResponse(authError || '權限不足', 403)
  let b: Record<string, unknown>
  try { b = await request.json() } catch { return createErrorResponse('格式錯誤', 400) }
  if (typeof b.clientId !== 'string') return createErrorResponse('clientId 必填', 400)
  const event = typeof b.event === 'string' ? b.event.trim() : ''
  if (event.length < 2 || event.length > 120) return createErrorResponse('請寫 2–120 字', 400)
  if (!CAPACITIES.includes(String(b.capacity))) return createErrorResponse('能力只能是肌力／心肺／活動度／平衡', 400)
  const { data, error } = await supabase.from('decathlon_goals').insert({ client_id: b.clientId, event, capacity: b.capacity }).select('id').single()
  if (error) return createErrorResponse(`寫入失敗：${error.message}`, 500)
  return createSuccessResponse({ id: data.id })
}

/** DELETE ?id= */
export async function DELETE(request: NextRequest) {
  const { authorized, error: authError } = await verifyCoachAuth(request)
  if (!authorized) return createErrorResponse(authError || '權限不足', 403)
  const id = new URL(request.url).searchParams.get('id')
  if (!id) return createErrorResponse('id 必填', 400)
  const { error } = await supabase.from('decathlon_goals').delete().eq('id', id)
  if (error) return createErrorResponse(`刪除失敗：${error.message}`, 500)
  return createSuccessResponse({ id })
}
