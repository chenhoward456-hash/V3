import { NextRequest } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase'
import { verifyCoachAuth, createErrorResponse, createSuccessResponse } from '@/lib/auth-middleware'

export const dynamic = 'force-dynamic'

const supabase = createServiceSupabase()

/** POST：記一筆 VO2max／握力（教練） */
export async function POST(request: NextRequest) {
  const { authorized, error: authError } = await verifyCoachAuth(request)
  if (!authorized) return createErrorResponse(authError || '權限不足', 403)
  let b: Record<string, unknown>
  try { b = await request.json() } catch { return createErrorResponse('格式錯誤', 400) }

  if (typeof b.clientId !== 'string') return createErrorResponse('clientId 必填', 400)
  if (b.kind !== 'vo2max' && b.kind !== 'grip') return createErrorResponse('kind 只能是 vo2max/grip', 400)
  if (typeof b.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(b.date)) return createErrorResponse('日期格式錯誤', 400)
  const value = Number(b.value)
  const [min, max] = b.kind === 'vo2max' ? [10, 95] : [5, 120]
  if (!Number.isFinite(value) || value < min || value > max) return createErrorResponse(`數值要在 ${min}–${max} 之間`, 400)
  const method = typeof b.method === 'string' ? b.method.trim().slice(0, 60) : ''
  if (!method) return createErrorResponse('請填量法（例：Garmin 估算／握力計）', 400)

  const { data, error } = await supabase.from('fitness_markers').insert({
    client_id: b.clientId, kind: b.kind, date: b.date, value, method,
    note: typeof b.note === 'string' && b.note.trim() ? b.note.trim().slice(0, 300) : null,
  }).select('id').single()
  if (error) return createErrorResponse(`寫入失敗：${error.message}`, 500)
  return createSuccessResponse({ id: data.id })
}

/** DELETE ?id= */
export async function DELETE(request: NextRequest) {
  const { authorized, error: authError } = await verifyCoachAuth(request)
  if (!authorized) return createErrorResponse(authError || '權限不足', 403)
  const id = new URL(request.url).searchParams.get('id')
  if (!id) return createErrorResponse('id 必填', 400)
  const { error } = await supabase.from('fitness_markers').delete().eq('id', id)
  if (error) return createErrorResponse(`刪除失敗：${error.message}`, 500)
  return createSuccessResponse({ id })
}
