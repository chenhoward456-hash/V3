/**
 * 這次血檢顧問卡的資料組裝（server 端）：學員 GET /api/lab-consult 和上傳後自動排下次（/api/lab-results/bulk）共用，
 * 避免兩邊各算一套。純函式在 lib/lab-consult.ts。
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { generateLabNutritionAdvice } from '@/lib/lab-nutrition-advisor'
import { generateSupplementSuggestions } from '@/lib/supplement-engine'
import { buildLabConsult, shouldAutoSetNextCheckup, type LabConsult } from '@/lib/lab-consult'
import type { LabHypothesis } from '@/lib/longevity-lens'
import type { TemplateItem } from '@/lib/lab-order'
import { getTaiwanDate } from '@/lib/date-utils'

export interface LoadedLabConsult {
  consult: LabConsult | null
  nextCheckupDate: string | null
}

export async function loadLabConsult(supabase: SupabaseClient, clientDbId: string): Promise<LoadedLabConsult | null> {
  const { data: c } = await supabase
    .from('clients')
    .select('id, gender, next_checkup_date, goal_type, prep_phase, health_mode_enabled, gene_mthfr, gene_apoe, gene_depression_risk')
    .eq('id', clientDbId)
    .maybeSingle()
  if (!c) return null

  const [labs, hyps, template] = await Promise.all([
    supabase.from('lab_results').select('test_name, value, unit, date, reference_range, status').eq('client_id', clientDbId).order('date'),
    supabase.from('lab_hypotheses').select('*').eq('client_id', clientDbId),
    // 同 lib/lab-order-data.ts：學員版下次抽血清單用「目標導向」公版
    supabase
      .from('lab_panel_templates')
      .select('add_on_items')
      .eq('gender', c.gender || '男性')
      .eq('goal_orientation', 'target')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])
  if (labs.error) throw new Error(labs.error.message)

  const rows = (labs.data ?? []).filter(l => l.value != null)
  // 兩個引擎都只看「每項最新一筆」：先新→舊排好再丟（補品引擎內部也會再排一次）
  const newestFirst = [...rows].sort((a, b) => String(b.date ?? '').localeCompare(String(a.date ?? '')))
  const gender = c.gender === '女性' ? '女性' as const : c.gender === '男性' ? '男性' as const : undefined
  const goalType = c.goal_type === 'cut' || c.goal_type === 'bulk' ? c.goal_type : null
  const advice = generateLabNutritionAdvice(newestFirst as never, { gender, goalType })
  const supplements = generateSupplementSuggestions(newestFirst as never, {
    gender, goalType, isHealthMode: !!c.health_mode_enabled,
    genetics: { mthfr: c.gene_mthfr ?? null, apoe: c.gene_apoe ?? null, depressionRisk: c.gene_depression_risk ?? null } as never,
    prepPhase: (c.prep_phase ?? null) as never,
  })
  const consult = buildLabConsult({
    labs: rows as never,
    advice,
    supplements,
    scheduledCheckup: c.next_checkup_date ?? null,
    gender: c.gender,
    today: getTaiwanDate(),
    // 預測表讀不到（例：舊環境沒這張表）不擋整張卡
    hypotheses: hyps.error ? [] : ((hyps.data ?? []) as LabHypothesis[]),
    templateItems: (template.data?.add_on_items ?? null) as TemplateItem[] | null,
  })
  return { consult, nextCheckupDate: c.next_checkup_date ?? null }
}

/**
 * 血檢寫入後：學員還沒排下次（或排的日期已經是這次之前）→ 自動排成建議日期。
 * 教練排在這次抽血之後的日期不動。失敗只記 log，不影響上傳本身。
 * 回傳設成的日期（沒動就 null）。
 */
export async function autoScheduleNextCheckup(supabase: SupabaseClient, clientDbId: string): Promise<string | null> {
  try {
    const loaded = await loadLabConsult(supabase, clientDbId)
    if (!loaded) return null
    const target = shouldAutoSetNextCheckup(loaded.nextCheckupDate, loaded.consult)
    if (!target) return null
    const { error } = await supabase.from('clients').update({ next_checkup_date: target }).eq('id', clientDbId)
    if (error) {
      console.error('[lab-consult] auto next_checkup_date failed:', error.message)
      return null
    }
    return target
  } catch (err) {
    console.error('[lab-consult] auto next_checkup_date exception:', err)
    return null
  }
}
