import { NextRequest } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase'
import { verifyCoachAuth, createErrorResponse, createSuccessResponse } from '@/lib/auth-middleware'
import { EXPERIMENT_METRICS } from '@/lib/body-experiments'

export const dynamic = 'force-dynamic'

const supabase = createServiceSupabase()
const isDate = (v: unknown) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)
const clip = (v: unknown, n = 500) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, n) : null)

/** POST：開一個身體實驗（教練）。判決不存，每次讀取重算。 */
export async function POST(request: NextRequest) {
  const { authorized, error: authError } = await verifyCoachAuth(request)
  if (!authorized) return createErrorResponse(authError || '權限不足', 403)

  let b: Record<string, unknown>
  try { b = await request.json() } catch { return createErrorResponse('格式錯誤', 400) }

  if (typeof b.clientId !== 'string') return createErrorResponse('clientId 必填', 400)
  const title = clip(b.title, 80)
  if (!title) return createErrorResponse('實驗名稱必填', 400)
  if (typeof b.metric !== 'string' || !(b.metric in EXPERIMENT_METRICS)) return createErrorResponse('指標不在清單內', 400)
  if (!isDate(b.startDate) || !isDate(b.endDate) || String(b.endDate) <= String(b.startDate)) return createErrorResponse('日期格式錯誤，或結束日不晚於開始日', 400)
  if (!['up', 'down', 'stable'].includes(String(b.expectedDirection))) return createErrorResponse('預期方向只能是 up/down/stable', 400)
  const expectedDelta = b.expectedDelta === '' || b.expectedDelta == null ? null : Number(b.expectedDelta)
  if (expectedDelta != null && !(Number.isFinite(expectedDelta) && expectedDelta > 0)) return createErrorResponse('目標幅度要是正數', 400)
  const baselineDays = b.baselineDays == null || b.baselineDays === '' ? 14 : Number(b.baselineDays)
  if (!Number.isInteger(baselineDays) || baselineDays < 7 || baselineDays > 60) return createErrorResponse('對照天數 7–60', 400)

  const { data, error } = await supabase.from('body_experiments').insert({
    client_id: b.clientId,
    title,
    action: clip(b.action),
    metric: b.metric,
    start_date: b.startDate,
    end_date: b.endDate,
    baseline_days: baselineDays,
    expected_direction: b.expectedDirection,
    expected_delta: expectedDelta,
    note: clip(b.note),
  }).select('id').single()
  if (error) return createErrorResponse(`寫入失敗：${error.message}`, 500)
  return createSuccessResponse({ id: data.id })
}

/** DELETE ?id=：刪掉一個實驗（寫錯時用） */
export async function DELETE(request: NextRequest) {
  const { authorized, error: authError } = await verifyCoachAuth(request)
  if (!authorized) return createErrorResponse(authError || '權限不足', 403)
  const id = new URL(request.url).searchParams.get('id')
  if (!id) return createErrorResponse('id 必填', 400)
  const { error } = await supabase.from('body_experiments').delete().eq('id', id)
  if (error) return createErrorResponse(`刪除失敗：${error.message}`, 500)
  return createSuccessResponse({ id })
}
