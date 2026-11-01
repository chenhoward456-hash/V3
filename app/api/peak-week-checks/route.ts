import { NextRequest } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase'
import { createErrorResponse, createSuccessResponse, rateLimit, getClientIP } from '@/lib/auth-middleware'
import { resolveActiveClient } from '@/lib/active-client'
import { buildPrepChecklist } from '@/lib/peak-week-checklist'
import { isTrialVisual, peakFromTrial, type TrialLoad } from '@/lib/peak-week-trial'

export const dynamic = 'force-dynamic'

const supabase = createServiceSupabase()

type ClientRow = {
  competition_date: string | null
  coach_peak_week_plan: { trialLoad?: TrialLoad | null } | null
}

/**
 * 賽前清單＋試灌
 *
 * GET  ?code=  → { competitionDate, trial, items, checked: {key: value|true}, trialResult, suggestedPeak }
 * POST { code, itemKey, checked, visual? } → 勾選／取消；itemKey='trial_result' 要帶 visual
 *
 * 清單綁 competition_date：換比賽日期就是新的一份（舊的勾選不會帶過去）。
 */
export async function GET(request: NextRequest) {
  const code = new URL(request.url).searchParams.get('code')
  if (!code) return createErrorResponse('缺少 code', 400)
  const resolved = await resolveActiveClient<ClientRow>(supabase, code, {
    select: 'competition_date, coach_peak_week_plan',
    request,
  })
  if (resolved.response) return resolved.response
  const client = resolved.client

  if (!client.competition_date) {
    return createSuccessResponse({ competitionDate: null, trial: null, items: [], checked: {}, trialResult: null, suggestedPeak: null })
  }

  const trial = client.coach_peak_week_plan?.trialLoad ?? null
  const items = buildPrepChecklist(client.competition_date, { trial })

  const { data: rows } = await supabase
    .from('peak_week_checks')
    .select('item_key, value')
    .eq('client_id', client.id)
    .eq('competition_date', client.competition_date)

  const checked: Record<string, unknown> = {}
  for (const r of rows ?? []) checked[r.item_key] = r.value ?? true

  const trialVisual = (checked.trial_result as { visual?: unknown } | undefined)?.visual
  const trialResult = isTrialVisual(trialVisual) ? trialVisual : null

  return createSuccessResponse({
    competitionDate: client.competition_date,
    trial,
    items,
    checked,
    trialResult,
    suggestedPeak: trial && trialResult ? peakFromTrial(trial.carbs, trialResult) : null,
  })
}

export async function POST(request: NextRequest) {
  const { allowed } = await rateLimit(`peak-week-checks:${getClientIP(request)}`, 60, 60_000)
  if (!allowed) return createErrorResponse('請求過於頻繁', 429)

  let body: { code?: unknown; itemKey?: unknown; checked?: unknown; visual?: unknown }
  try { body = await request.json() } catch { return createErrorResponse('格式錯誤', 400) }

  const { code, itemKey, checked, visual } = body
  if (typeof code !== 'string' || !code) return createErrorResponse('缺少 code', 400)
  if (typeof itemKey !== 'string') return createErrorResponse('缺少 itemKey', 400)

  const resolved = await resolveActiveClient<ClientRow>(supabase, code, {
    select: 'competition_date, coach_peak_week_plan',
    request,
  })
  if (resolved.response) return resolved.response
  const client = resolved.client
  if (!client.competition_date) return createErrorResponse('還沒設定比賽日期', 400)

  // 只接受這份清單裡真的有的 key（避免亂寫）
  const items = buildPrepChecklist(client.competition_date, { trial: client.coach_peak_week_plan?.trialLoad ?? null })
  const item = items.find(i => i.key === itemKey)
  if (!item) return createErrorResponse('沒有這個項目', 400)

  if (checked === false) {
    await supabase.from('peak_week_checks').delete()
      .eq('client_id', client.id).eq('competition_date', client.competition_date).eq('item_key', itemKey)
    return createSuccessResponse({ itemKey, checked: false })
  }

  let value: Record<string, unknown> | null = null
  if (item.kind === 'trial_result') {
    if (!isTrialVisual(visual)) return createErrorResponse('請選擇試灌結果', 400)
    value = { visual }
  }

  const { error } = await supabase.from('peak_week_checks').upsert(
    { client_id: client.id, competition_date: client.competition_date, item_key: itemKey, value, checked_at: new Date().toISOString() },
    { onConflict: 'client_id,competition_date,item_key' },
  )
  if (error) return createErrorResponse('儲存失敗', 500)
  return createSuccessResponse({ itemKey, checked: true, value })
}
