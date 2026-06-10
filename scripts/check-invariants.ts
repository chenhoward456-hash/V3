/**
 * 跨表 invariant 檢查
 *
 * 檢查 DB 裡「沒有 constraint 保護、只能靠人記得」的跨表約束：
 *   A. lab_results.test_name 必須存在於 LAB_THRESHOLDS（否則前端 fallback 成 attention）
 *   B. clients.training_plan 與 training_templates.plan_json 必須符合課表 JSON 結構
 *   C. 有 coach_macro_override 的學員不應再被 system 自動調 macro
 *   D. 有性別差異閾值血檢的學員，gender 不可為空（否則套男性閾值）
 *
 * 用法：npm run check:invariants
 * 有 violation → exit 1（可掛 cron / CI；warning 不影響 exit code）
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { join } from 'path'
import { z } from 'zod'
import { LAB_THRESHOLDS, FEMALE_VARIANTS } from '../utils/labStatus'

// ── env ──
function loadEnvLocal() {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) return
  try {
    const content = readFileSync(join(process.cwd(), '.env.local'), 'utf8')
    for (const line of content.split('\n')) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  } catch {
    /* .env.local 不存在時靠外部環境變數 */
  }
}
loadEnvLocal()

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('缺少 NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')
  process.exit(2)
}
const supabase = createClient(url, key)

type Finding = { severity: 'violation' | 'warning'; check: string; detail: string }
const findings: Finding[] = []
const violation = (check: string, detail: string) => findings.push({ severity: 'violation', check, detail })
const warning = (check: string, detail: string) => findings.push({ severity: 'warning', check, detail })

async function fetchAll<T>(table: string, columns: string, filter?: (q: any) => any): Promise<T[]> {
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
async function checkLabTestNames() {
  const rows = await fetchAll<{ test_name: string }>('lab_results', 'test_name')
  const counts = new Map<string, number>()
  for (const r of rows) counts.set(r.test_name, (counts.get(r.test_name) ?? 0) + 1)
  for (const [name, count] of counts) {
    if (!(name in LAB_THRESHOLDS)) {
      violation('A. 血檢項目缺閾值', `「${name}」（${count} 筆）不在 LAB_THRESHOLDS，前端會 fallback 成 attention`)
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

async function checkTrainingPlanShapes() {
  const clients = await fetchAll<{ id: string; name: string; training_plan: unknown }>(
    'clients', 'id, name, training_plan', q => q.not('training_plan', 'is', null)
  )
  for (const c of clients) {
    const r = PlanSchema.safeParse(c.training_plan)
    if (!r.success) {
      violation('B. training_plan 結構', `學員「${c.name}」(${c.id})：${r.error.issues[0]?.path.join('.')} ${r.error.issues[0]?.message}`)
    }
  }
  const templates = await fetchAll<{ id: string; name: string; plan_json: unknown }>(
    'training_templates', 'id, name, plan_json'
  )
  for (const t of templates) {
    const r = PlanSchema.safeParse(t.plan_json)
    if (!r.success) {
      violation('B. plan_json 結構', `範本「${t.name}」(${t.id})：${r.error.issues[0]?.path.join('.')} ${r.error.issues[0]?.message}`)
    }
  }
}

// ── C. coach_macro_override 優先權 ──
async function checkCoachOverride() {
  const overridden = await fetchAll<{ id: string; name: string; auto_adjust_enabled: boolean | null }>(
    'clients', 'id, name, auto_adjust_enabled', q => q.not('coach_macro_override', 'is', null)
  )
  if (overridden.length === 0) return
  for (const c of overridden) {
    if (c.auto_adjust_enabled) {
      warning('C. override + 自動調整同時開', `學員「${c.name}」(${c.id}) 有 coach_macro_override 但 auto_adjust_enabled=true，引擎有覆寫風險`)
    }
  }
  const since = new Date(Date.now() - 30 * 86400_000).toISOString()
  const ids = overridden.map(c => c.id)
  const nameOf = new Map(overridden.map(c => [c.id, c.name]))
  const logs = await fetchAll<{ client_id: string; applied_at: string; trigger_source: string }>(
    'macro_adjustment_log', 'client_id, applied_at, trigger_source',
    q => q.eq('applied_by', 'system').gte('applied_at', since).in('client_id', ids)
  )
  for (const log of logs) {
    violation('C. system 覆寫教練設定', `學員「${nameOf.get(log.client_id)}」(${log.client_id}) 有 coach_macro_override，但 ${log.applied_at} 仍被 system (${log.trigger_source}) 調整 macro`)
  }
}

// ── D. 性別相關血檢但 gender 為空 ──
async function checkGenderForLabs() {
  const noGender = await fetchAll<{ id: string; name: string }>(
    'clients', 'id, name', q => q.is('gender', null)
  )
  if (noGender.length === 0) return
  const nameOf = new Map(noGender.map(c => [c.id, c.name]))
  const labs = await fetchAll<{ client_id: string; test_name: string }>(
    'lab_results', 'client_id, test_name',
    q => q.in('client_id', noGender.map(c => c.id)).in('test_name', [...FEMALE_VARIANTS])
  )
  const affected = new Map<string, Set<string>>()
  for (const l of labs) {
    if (!affected.has(l.client_id)) affected.set(l.client_id, new Set())
    affected.get(l.client_id)!.add(l.test_name)
  }
  for (const [id, tests] of affected) {
    warning('D. 缺 gender 套男性閾值', `學員「${nameOf.get(id)}」(${id}) gender 為空，但有性別差異閾值的血檢：${[...tests].join('、')}`)
  }
}

async function main() {
  const checks: Array<[string, () => Promise<void>]> = [
    ['A. lab_results.test_name ⊆ LAB_THRESHOLDS', checkLabTestNames],
    ['B. training_plan / plan_json 結構', checkTrainingPlanShapes],
    ['C. coach_macro_override 優先權', checkCoachOverride],
    ['D. 性別相關血檢 gender 完整性', checkGenderForLabs],
  ]
  for (const [label, fn] of checks) {
    try {
      await fn()
    } catch (e) {
      violation(label, `檢查本身失敗：${e instanceof Error ? e.message : String(e)}`)
    }
  }

  const violations = findings.filter(f => f.severity === 'violation')
  const warnings = findings.filter(f => f.severity === 'warning')

  for (const f of findings) {
    console.log(`${f.severity === 'violation' ? '❌' : '⚠️ '} [${f.check}] ${f.detail}`)
  }
  console.log(`\n結果：${violations.length} violations, ${warnings.length} warnings`)
  process.exit(violations.length > 0 ? 1 : 0)
}

main()
