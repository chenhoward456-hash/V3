/**
 * 跨表 invariant 檢查（共用邏輯）
 *
 * 檢查 DB 裡「沒有 constraint 保護、只能靠人記得」的跨表約束：
 *   A. lab_results.test_name 必須存在於 LAB_THRESHOLDS（否則前端 fallback 成 attention）
 *   B. clients.training_plan 與 training_templates.plan_json 必須符合課表 JSON 結構
 *   C. 有 coach_macro_override 的學員不應再被 system 自動調 macro
 *   D. 有性別差異閾值血檢的學員，gender 不可為空（否則套男性閾值）
 *   E. 同一份血檢只有一個答案：健康報告（lab-trend-analyzer）與血檢進退（longevity-lens）
 *      不准對同一項講相反方向；學員抽血單的必驗項目都要出現在顧問卡的下次清單
 *
 * 入口：scripts/check-invariants.ts（手動 / CI）、app/api/cron/invariants（每日排程）
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { LAB_THRESHOLDS, FEMALE_VARIANTS } from '@/utils/labStatus'
import { getLabCanonicalId } from '@/utils/labMatch'
import { analyzeLabs } from '@/lib/lab-trend-analyzer'
import { MARKERS, buildMarkerStory } from '@/lib/longevity-lens'
import { loadLabConsult } from '@/lib/lab-consult-data'
import { loadStudentLabOrder } from '@/lib/lab-order-data'
import { resolveMarkerId } from '@/lib/lab-order'
import { getTaiwanDate } from '@/lib/date-utils'

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

// ── E. 同一份血檢只有一個答案 ──
// 2026-10-08～09 Howard 連續抓到：同一個數字報告說持平、血檢進退說變差（SHBG）；
// 顧問卡說要驗 Cystatin C、抽血單沒有。都是「同一件事有兩份算法、各自走偏」，
// 而且都是他用眼睛看出來的。這條讓系統每天自己對一次。
async function checkLabConsistency(supabase: SupabaseClient, findings: Finding[]) {
  const today = getTaiwanDate()
  const clients = await fetchAll<{ id: string; name: string; gender: string | null }>(
    supabase, 'clients', 'id, name, gender', q => q.eq('is_active', true).eq('lab_enabled', true)
  )
  for (const c of clients) {
    const labs = await fetchAll<{ test_name: string; value: number | string | null; unit: string | null; date: string }>(
      supabase, 'lab_results', 'test_name, value, unit, date', q => q.eq('client_id', c.id)
    )
    if (labs.length === 0) continue
    const gender = c.gender === '女性' ? '女性' : c.gender === '男性' ? '男性' : undefined

    // E1. 方向不准相反
    const byName: Record<string, { date: string; value: number; unit: string | null }[]> = {}
    for (const l of labs) {
      const v = typeof l.value === 'string' ? parseFloat(l.value) : l.value
      if (v == null || !Number.isFinite(v)) continue
      ;(byName[l.test_name] ??= []).push({ date: l.date, value: v, unit: l.unit })
    }
    const report = new Map(analyzeLabs(labs as never, { gender }).map(f => [f.testName, f]))
    for (const name of Object.keys(MARKERS)) {
      const pts = byName[name]
      const f = report.get(name)
      if (!pts || pts.length < 2 || !f) continue
      const story = buildMarkerStory(name, pts, { weights: [], nutrition: [], training: [], wellness: [] }, today, gender)
      const lens = story.direction
      const rep = f.trend === 'improving' ? 'better' : f.trend === 'declining' ? 'worse' : null
      if (lens && rep && lens !== rep) {
        findings.push({ severity: 'violation', check: 'E. 血檢判讀一致性',
          detail: `${c.name}｜${name}：健康報告判「${rep === 'better' ? '進步' : '退步'}」、血檢進退判「${lens === 'better' ? '變好' : '變差'}」` })
      }
    }

    // E2. 抽血單的必驗 ⊆ 顧問卡的下次清單
    const [consult, order] = await Promise.all([loadLabConsult(supabase, c.id), loadStudentLabOrder(supabase, c.id)])
    if (!consult?.consult || !order || !order.enabled) continue
    const key = (label: string) => resolveMarkerId(label) ?? getLabCanonicalId(label) ?? label.replace(/[（(].*$/, '').trim()
    const nextKeys = new Set(consult.consult.next.items.map(i => key(i.label)))
    const missing = order.must.map(m => m.label).filter(l => !nextKeys.has(key(l)))
    if (missing.length) {
      findings.push({ severity: 'violation', check: 'E. 血檢判讀一致性',
        detail: `${c.name}｜抽血單必驗、顧問卡下次清單沒有：${missing.join('、')}` })
    }
  }
}

export async function runInvariantChecks(supabase: SupabaseClient): Promise<Finding[]> {
  const findings: Finding[] = []
  const checks: Array<[string, () => Promise<void>]> = [
    ['A. lab_results.test_name ⊆ LAB_THRESHOLDS', () => checkLabTestNames(supabase, findings)],
    ['B. training_plan / plan_json 結構', () => checkTrainingPlanShapes(supabase, findings)],
    ['C. coach_macro_override 優先權', () => checkCoachOverride(supabase, findings)],
    ['D. 性別相關血檢 gender 完整性', () => checkGenderForLabs(supabase, findings)],
    ['E. 血檢判讀一致性', () => checkLabConsistency(supabase, findings)],
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
