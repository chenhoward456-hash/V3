import { NextRequest } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase'
import { verifyCoachAuth, createErrorResponse, createSuccessResponse } from '@/lib/auth-middleware'
import { MARKERS } from '@/lib/longevity-lens'

export const dynamic = 'force-dynamic'

const supabase = createServiceSupabase()
const isDate = (v: unknown) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)
const clip = (v: unknown, n = 500) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, n) : null)

/** POST：記一個預測（教練）。判決不存，GET /api/admin/longevity 每次重算。 */
export async function POST(request: NextRequest) {
  const { authorized, error: authError } = await verifyCoachAuth(request)
  if (!authorized) return createErrorResponse(authError || '權限不足', 403)

  let b: Record<string, unknown>
  try { b = await request.json() } catch { return createErrorResponse('格式錯誤', 400) }

  if (typeof b.clientId !== 'string') return createErrorResponse('clientId 必填', 400)
  if (typeof b.marker !== 'string' || !(b.marker in MARKERS)) return createErrorResponse('marker 不在清單內', 400)
  if (!isDate(b.baselineDate) || !Number.isFinite(Number(b.baselineValue))) return createErrorResponse('起點日期／數值格式錯誤', 400)
  if (!['up', 'down', 'stable'].includes(String(b.expectedDirection))) return createErrorResponse('預期方向只能是 up/down/stable', 400)
  if (b.retestBy != null && b.retestBy !== '' && !isDate(b.retestBy)) return createErrorResponse('重測日格式錯誤', 400)
  const expectedValue = b.expectedValue === '' || b.expectedValue == null ? null : Number(b.expectedValue)
  if (expectedValue != null && !Number.isFinite(expectedValue)) return createErrorResponse('目標值格式錯誤', 400)

  const { data, error } = await supabase.from('lab_hypotheses').insert({
    client_id: b.clientId,
    marker: b.marker,
    baseline_date: b.baselineDate,
    baseline_value: Number(b.baselineValue),
    cause: clip(b.cause),
    action: clip(b.action),
    expected_direction: b.expectedDirection,
    expected_value: expectedValue,
    retest_by: b.retestBy || null,
    note: clip(b.note),
  }).select('id').single()
  if (error) return createErrorResponse(`寫入失敗：${error.message}`, 500)
  return createSuccessResponse({ id: data.id })
}

/** DELETE ?id=：刪掉一個預測（寫錯時用） */
export async function DELETE(request: NextRequest) {
  const { authorized, error: authError } = await verifyCoachAuth(request)
  if (!authorized) return createErrorResponse(authError || '權限不足', 403)
  const id = new URL(request.url).searchParams.get('id')
  if (!id) return createErrorResponse('id 必填', 400)
  const { error } = await supabase.from('lab_hypotheses').delete().eq('id', id)
  if (error) return createErrorResponse(`刪除失敗：${error.message}`, 500)
  return createSuccessResponse({ id })
}
