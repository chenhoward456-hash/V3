import { NextRequest } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase'
import { rateLimit, getClientIP, createErrorResponse, createSuccessResponse } from '@/lib/auth-middleware'
import { getTaiwanDate } from '@/lib/date-utils'
import { strengthByMonth } from '@/lib/longevity-lens'
import { loadClientExperiments, describeChange, STATUS_STUDENT } from '@/lib/body-experiments'
import { buildJourney } from '@/lib/journey'
import { degradeToSafe } from '@/lib/compliance-scrub'

export const dynamic = 'force-dynamic'

const supabase = createServiceSupabase()
const isDate = (v: string | null): v is string => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v)

/**
 * GET /api/journey?code=<unique_code>[&from=YYYY-MM-DD]
 * 「你這 N 週」回顧。code 是 bearer（同學員 dashboard）。from 沒給就從第一筆記錄算起。
 */
export async function GET(request: NextRequest) {
  const { allowed } = await rateLimit(`journey_${getClientIP(request)}`, 30, 60_000)
  if (!allowed) return createErrorResponse('請求過於頻繁，請稍後再試', 429)

  const sp = new URL(request.url).searchParams
  const code = sp.get('code')
  if (!code) return createErrorResponse('缺少代碼', 400)

  const { data: c } = await supabase
    .from('clients')
    .select('id, name, is_active, goal_type, target_weight, created_at, body_profile')
    .eq('unique_code', code)
    .maybeSingle()
  if (!c) return createErrorResponse('找不到資料', 404)
  if (c.is_active === false) return createErrorResponse('帳號已暫停', 403)

  try {
    const to = getTaiwanDate()
    const [w, n, t, wl, sets] = await Promise.all([
      supabase.from('body_composition').select('date, weight, body_fat').eq('client_id', c.id).order('date'),
      supabase.from('nutrition_logs').select('date').eq('client_id', c.id),
      supabase.from('training_logs').select('date, training_type').eq('client_id', c.id),
      supabase.from('daily_wellness').select('date').eq('client_id', c.id),
      supabase.from('training_sets').select('date, exercise_name, weight, reps, is_main_lift').eq('client_id', c.id).eq('is_main_lift', true),
    ])
    const firstLog = [w.data?.[0]?.date, ...(n.data ?? []).map(x => x.date), ...(t.data ?? []).map(x => x.date)]
      .filter(Boolean).sort()[0] as string | undefined
    const fromParam = sp.get('from')
    const from = isDate(fromParam) ? fromParam : firstLog ?? String(c.created_at).slice(0, 10)

    const safe = (s: string) => degradeToSafe(s, '（跟教練聊過的實驗）').text
    const experiments = (await loadClientExperiments(supabase, c.id, to))
      .filter(e => e.grade.status !== 'running' && e.start_date >= from)
      .map(e => ({ title: safe(e.title), resultText: describeChange(e, e.grade), statusText: STATUS_STUDENT[e.grade.status] }))

    const profile = (c.body_profile ?? null) as { entries?: { key: string; label: string; value: string }[] } | null

    const journey = buildJourney({
      name: c.name,
      goalType: c.goal_type,
      targetWeight: c.target_weight != null ? Number(c.target_weight) : null,
      from, to,
      weights: (w.data ?? []) as { date: string; weight: number | null; body_fat: number | null }[],
      nutritionDates: (n.data ?? []).map(x => x.date),
      trainingDates: (t.data ?? []).filter(x => x.training_type !== 'rest').map(x => x.date),
      wellnessDates: (wl.data ?? []).map(x => x.date),
      strength: strengthByMonth(sets.data ?? []),
      profileEntries: (profile?.entries ?? []).map(e => ({ key: e.key, label: e.label, value: e.value })),
      experiments,
    })
    return createSuccessResponse(journey)
  } catch {
    return createErrorResponse('讀取失敗', 500)
  }
}
