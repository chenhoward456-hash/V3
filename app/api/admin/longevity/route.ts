import { NextRequest } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase'
import { verifyCoachAuth, createErrorResponse, createSuccessResponse } from '@/lib/auth-middleware'
import { buildHorsemen, strengthByMonth, gradeHypothesis, buildFitness, MARKERS, type LabPoint, type LabHypothesis, type FitnessRow } from '@/lib/longevity-lens'
import { getTaiwanDate } from '@/lib/date-utils'

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

  const [labs, weights, nutrition, training, wellness, sets, hyps, fitness] = await Promise.all([
    supabase.from('lab_results').select('test_name, value, unit, date').eq('client_id', client.id).order('date'),
    supabase.from('body_composition').select('date, weight').eq('client_id', client.id).not('weight', 'is', null).order('date'),
    supabase.from('nutrition_logs').select('date, calories').eq('client_id', client.id).order('date'),
    supabase.from('training_logs').select('date, training_type').eq('client_id', client.id).order('date'),
    supabase.from('daily_wellness').select('date, sleep_quality').eq('client_id', client.id).order('date'),
    supabase.from('training_sets').select('date, exercise_name, weight, reps, is_main_lift').eq('client_id', client.id).eq('is_main_lift', true).order('date'),
    supabase.from('lab_hypotheses').select('*').eq('client_id', client.id).order('created_at', { ascending: false }),
    supabase.from('fitness_markers').select('id, kind, date, value, method, note').eq('client_id', client.id).order('date'),
  ])
  const firstError = [labs, weights, nutrition, training, wellness, sets, hyps, fitness].find(r => r.error)?.error
  if (firstError) return createErrorResponse(`讀取失敗：${firstError.message}`, 500)

  const labsByName: Record<string, LabPoint[]> = {}
  for (const l of labs.data ?? []) {
    if (l.value == null) continue
    ;(labsByName[l.test_name] ??= []).push({ date: l.date, value: Number(l.value), unit: l.unit })
  }

  const rows = {
    weights: weights.data ?? [],
    nutrition: nutrition.data ?? [],
    training: training.data ?? [],
    wellness: wellness.data ?? [],
  }
  const today = getTaiwanDate()

  return createSuccessResponse({
    client: { name: client.name, gender: client.gender, nextCheckupDate: client.next_checkup_date },
    today,
    horsemen: buildHorsemen(labsByName, rows, today),
    strength: strengthByMonth(sets.data ?? []),
    fitness: buildFitness((fitness.data ?? []) as FitnessRow[]),
    clientId: client.id,
    hypotheses: ((hyps.data ?? []) as LabHypothesis[]).map(h => ({ ...h, grade: gradeHypothesis(h, labsByName[h.marker] ?? [], today) })),
    // 有做、但還沒排進四騎士的指標（不讓資料默默消失）
    unmapped: Object.keys(labsByName).filter(n => !(n in MARKERS)),
  })
}
