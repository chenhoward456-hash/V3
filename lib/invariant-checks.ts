/**
 * 跨表 invariant 檢查（共用邏輯）
 *
 * 檢查 DB 裡「沒有 constraint 保護、只能靠人記得」的跨表約束：
 *   A. lab_results.test_name 必須存在於 LAB_THRESHOLDS（否則前端 fallback 成 attention）
 *   B. clients.training_plan 與 training_templates.plan_json 必須符合課表 JSON 結構
 *   C. 有 coach_macro_override 的學員不應再被 system 自動調 macro
 *   D. 有性別差異閾值血檢的學員，gender 不可為空（否則套男性閾值）
 *
 * 入口：scripts/check-invariants.ts（手動 / CI）、app/api/cron/invariants（每日排程）
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { LAB_THRESHOLDS, FEMALE_VARIANTS } from '@/utils/labStatus'

export type Finding = { severity: 'violation' | 'warning'; check: string; detail: string }

async function fetchAll<T>(
  supabase: SupabaseClient,
  table: string,
  columns: string,
  filter?: (q: any) => any
): Promise<T[]> {
  const rows: T[] = []
  const page = 1000
  for (let from = 0; ; from += page) {
    let q = supabase.from(table).select(columns).range(from, from + page - 1)
    if (filter) q = filter(q)
    const { data, error } = await q
    if (error) throw new Error(`${table}: ${error.message}`)
    rows.push(...((data ?? []) as T[]))
    if (!data || data.length < page) break
  }
  return rows
}

// ── A. lab_results.test_name ⊆ LAB_THRESHOLDS ──
async function checkLabTestNames(supabase: SupabaseClient, findings: Finding[]) {
  const rows = await fetchAll<{ test_name: string }>(supabase, 'lab_results', 'test_name')
  const counts = new Map<string, number>()
  for (const r of rows) counts.set(r.test_name, (counts.get(r.test_name) ?? 0) + 1)
  for (const [name, count] of counts) {
    if (!(name in LAB_THRESHOLDS)) {
      findings.push({
        severity: 'violation',
        check: 'A. 血檢項目缺閾值',
        detail: `「${name}」（${count} 筆）不在 LAB_THRESHOLDS，前端會 fallback 成 attention`,
      })
    }
  }
}

// ── B. training_plan / plan_json 結構 ──
const ExerciseSchema = z.looseObject({ name: z.string().min(1) })
const DaySchema = z.looseObject({
  dayOfWeek: z.number(),
  exercises: z.array(ExerciseSchema),
})
const PlanSchema = z.looseObject({
  name: z.string().optional(),
  days: z.array(DaySchema).min(1),
})

async function checkTrainingPlanShapes(supabase: SupabaseClient, findings: Finding[]) {
  const clients = await fetchAll<{ id: string; name: string; training_plan: unknown }>(
    supabase, 'clients', 'id, name, training_plan', q => q.not('training_plan', 'is', null)
  )
  for (const c of clients) {
    const r = PlanSchema.safeParse(c.training_plan)
    if (!r.success) {
      findings.push({
        severity: 'violation',
        check: 'B. training_plan 結構',
        detail: `學員「${c.name}」(${c.id})：${r.error.issues[0]?.path.join('.')} ${r.error.issues[0]?.message}`,
      })
    }
  }
  const templates = await fetchAll<{ id: string; name: string; plan_json: unknown }>(
    supabase, 'training_templates', 'id, name, plan_json'
  )
  for (const t of templates) {
    const r = PlanSchema.safeParse(t.plan_json)
    if (!r.success) {
      findings.push({
        severity: 'violation',
        check: 'B. plan_json 結構',
        detail: `範本「${t.name}」(${t.id})：${r.error.issues[0]?.path.join('.')} ${r.error.issues[0]?.message}`,
      })
    }
  }
}

// ── C. coach_macro_override 優先權 ──
async function checkCoachOverride(supabase: SupabaseClient, findings: Finding[]) {
  const overridden = await fetchAll<{ id: string; name: string; auto_adjust_enabled: boolean | null; coach_macro_override: { locked_at?: string } | null }>(
    supabase, 'clients', 'id, name, auto_adjust_enabled, coach_macro_override', q => q.not('coach_macro_override', 'is', null)
  )
  if (overridden.length === 0) return
  for (const c of overridden) {
    if (c.auto_adjust_enabled) {
      findings.push({
        severity: 'warning',
        check: 'C. override + 自動調整同時開',
        detail: `學員「${c.name}」(${c.id}) 有 coach_macro_override 但 auto_adjust_enabled=true，引擎有覆寫風險`,
      })
    }
  }
  const since = new Date(Date.now() - 30 * 86400_000).toISOString()
  const ids = overridden.map(c => c.id)
  const nameOf = new Map(overridden.map(c => [c.id, c.name]))
  // 鎖定日：只有「override 鎖定之後」的 system 調整才可能是違規（鎖定前的歷史 log 不算）
  const lockedAtOf = new Map(overridden.map(c => [c.id, c.coach_macro_override?.locked_at ? Date.parse(c.coach_macro_override.locked_at) : 0]))
  const logs = await fetchAll<{ client_id: string; applied_at: string; trigger_source: string; new_macros: Record<string, unknown> | null }>(
    supabase, 'macro_adjustment_log', 'client_id, applied_at, trigger_source, new_macros',
    q => q.eq('applied_by', 'system').gte('applied_at', since).in('client_id', ids)
  )
  // 真的有改到 macro 才算（被安全層 gate / autoApply=false 的是空 new_macros，沒套用任何值 → 不是違規）
  const MACRO_KEYS = ['calories', 'protein', 'carbs', 'fat', 'calories_target', 'protein_target', 'carbs_target', 'fat_target']
  const realChange = (nm: Record<string, unknown> | null) => !!nm && MACRO_KEYS.some(k => nm[k] != null)
  for (const log of logs) {
    if (Date.parse(log.applied_at) <= (lockedAtOf.get(log.client_id) ?? 0)) continue // 鎖定前的舊 log，略過
    if (!realChange(log.new_macros)) continue // 被 gate、沒實際套用，略過
    findings.push({
      severity: 'violation',
      check: 'C. system 覆寫教練設定',
      detail: `學員「${nameOf.get(log.client_id)}」(${log.client_id}) 有 coach_macro_override（鎖定 ${overridden.find(o => o.id === log.client_id)?.coach_macro_override?.locked_at}），但 ${log.applied_at} 仍被 system (${log.trigger_source}) 實際調整 macro`,
    })
  }
}

// ── D. 性別相關血檢但 gender 為空 ──
async function checkGenderForLabs(supabase: SupabaseClient, findings: Finding[]) {
  const noGender = await fetchAll<{ id: string; name: string }>(
    supabase, 'clients', 'id, name', q => q.is('gender', null)
  )
  if (noGender.length === 0) return
  const nameOf = new Map(noGender.map(c => [c.id, c.name]))
  const labs = await fetchAll<{ client_id: string; test_name: string }>(
    supabase, 'lab_results', 'client_id, test_name',
    q => q.in('client_id', noGender.map(c => c.id)).in('test_name', [...FEMALE_VARIANTS])
  )
  const affected = new Map<string, Set<string>>()
  for (const l of labs) {
    if (!affected.has(l.client_id)) affected.set(l.client_id, new Set())
    affected.get(l.client_id)!.add(l.test_name)
  }
  for (const [id, tests] of affected) {
    findings.push({
      severity: 'warning',
      check: 'D. 缺 gender 套男性閾值',
      detail: `學員「${nameOf.get(id)}」(${id}) gender 為空，但有性別差異閾值的血檢：${[...tests].join('、')}`,
    })
  }
}

export async function runInvariantChecks(supabase: SupabaseClient): Promise<Finding[]> {
  const findings: Finding[] = []
  const checks: Array<[string, () => Promise<void>]> = [
    ['A. lab_results.test_name ⊆ LAB_THRESHOLDS', () => checkLabTestNames(supabase, findings)],
    ['B. training_plan / plan_json 結構', () => checkTrainingPlanShapes(supabase, findings)],
    ['C. coach_macro_override 優先權', () => checkCoachOverride(supabase, findings)],
    ['D. 性別相關血檢 gender 完整性', () => checkGenderForLabs(supabase, findings)],
  ]
  for (const [label, fn] of checks) {
    try {
      await fn()
    } catch (e) {
      findings.push({
        severity: 'violation',
        check: label,
        detail: `檢查本身失敗：${e instanceof Error ? e.message : String(e)}`,
      })
    }
  }
  return findings
}
