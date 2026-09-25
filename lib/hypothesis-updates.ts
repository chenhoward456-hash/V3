/**
 * 預測 → 驗收的「通知」那一段：新血檢進來、預測被對完答案時，要有人知道。
 * 每天早上 cron（和後台晨報預覽）跑這支：
 *   - graded：判決出來了、而且跟上次通知的不一樣 → 進教練晨報＋推學員一則
 *   - overdue：過了預計重測日還沒結果 → 只進教練晨報（不推學員，不催）
 * 判決本身每次用 gradeHypothesis() 重算，DB 只記 notified_status 做去重。
 */
import { gradeHypothesis, type LabHypothesis, type HypothesisStatus, type LabPoint } from '@/lib/longevity-lens'

// 用最小介面，cron（真 supabase）和測試都能丟進來
type QueryLike = { from: (t: string) => any }

export interface HypothesisUpdate {
  id: string
  clientId: string
  name: string
  uniqueCode: string
  lineUserId: string | null
  marker: string
  status: HypothesisStatus
  baselineValue: number
  expectedDirection: 'up' | 'down' | 'stable'
  expectedValue: number | null
  retestBy: string | null
  resultValue: number | null
  resultDate: string | null
  pctChange: number | null
}

const STATUS_COACH: Record<HypothesisStatus, string> = {
  pending: '等重測',
  overdue: '過了重測日還沒測',
  confirmed: '✅ 猜對（方向對、到目標）',
  partial: '🟡 方向對、沒到目標',
  no_change: '⚪ 沒變（在正常波動內）→ 行動不夠或原因不是這個',
  refuted: '❌ 猜錯（往反方向）→ 換方向找原因',
}

const STATUS_STUDENT: Partial<Record<HypothesisStatus, string>> = {
  confirmed: '達成了：方向對、也到目標',
  partial: '有進步，還沒到目標',
  no_change: '還沒看到變化，教練會一起看原因',
  refuted: '方向不如預期，教練會調整做法',
}

const fmt = (n: number) => String(Math.round(n * 100) / 100)

export function coachLine(u: HypothesisUpdate): string {
  const target = u.expectedValue != null ? `${u.expectedDirection === 'down' ? '≤' : '≥'}${fmt(u.expectedValue)}` : (u.expectedDirection === 'stable' ? '持平' : u.expectedDirection === 'up' ? '↑' : '↓')
  if (u.resultValue == null) return `  • ${u.name}｜${u.marker} 預測 ${target}：${STATUS_COACH[u.status]}（預計 ${u.retestBy ?? '—'}）`
  const pct = u.pctChange != null ? `，${u.pctChange > 0 ? '+' : ''}${u.pctChange.toFixed(0)}%` : ''
  return `  • ${u.name}｜${u.marker} ${fmt(u.baselineValue)}→${fmt(u.resultValue)}（預測 ${target}${pct}）：${STATUS_COACH[u.status]}`
}

export function studentText(name: string, updates: HypothesisUpdate[]): string {
  const lines = updates.map(u => `・${u.marker}：${fmt(u.baselineValue)} → ${fmt(u.resultValue!)}，${STATUS_STUDENT[u.status] ?? ''}`)
  return `${name}，你的血檢對答案了 🔬\n\n${lines.join('\n')}\n\n打開「健康」分頁看細節，教練會跟你討論下一步。`
}

export async function loadHypothesisUpdates(supabase: QueryLike, today: string): Promise<{ graded: HypothesisUpdate[]; overdue: HypothesisUpdate[] }> {
  const { data: hyps, error } = await supabase
    .from('lab_hypotheses')
    .select('*, clients!inner(id, name, unique_code, line_user_id, is_active, gender)')
  if (error || !hyps || hyps.length === 0) return { graded: [], overdue: [] }

  const active = (hyps as (LabHypothesis & { client_id: string; notified_status: string | null; clients: { id: string; name: string; unique_code: string; line_user_id: string | null; is_active: boolean | null; gender?: string | null } })[])
    .filter(h => h.clients.is_active !== false)
  const clientIds = [...new Set(active.map(h => h.client_id))]
  const markers = [...new Set(active.map(h => h.marker))]
  const { data: labs } = await supabase
    .from('lab_results')
    .select('client_id, test_name, value, unit, date')
    .in('client_id', clientIds)
    .in('test_name', markers)

  const points: Record<string, LabPoint[]> = {}
  for (const l of (labs ?? []) as { client_id: string; test_name: string; value: number | null; unit: string | null; date: string }[]) {
    if (l.value == null) continue
    ;(points[`${l.client_id}|${l.test_name}`] ??= []).push({ date: l.date, value: Number(l.value), unit: l.unit })
  }

  const graded: HypothesisUpdate[] = []
  const overdue: HypothesisUpdate[] = []
  for (const h of active) {
    const g = gradeHypothesis(h, points[`${h.client_id}|${h.marker}`] ?? [], today, h.clients.gender)
    const u: HypothesisUpdate = {
      id: h.id, clientId: h.client_id, name: h.clients.name, uniqueCode: h.clients.unique_code, lineUserId: h.clients.line_user_id,
      marker: h.marker, status: g.status, baselineValue: Number(h.baseline_value),
      expectedDirection: h.expected_direction, expectedValue: h.expected_value != null ? Number(h.expected_value) : null,
      retestBy: h.retest_by, resultValue: g.result?.value ?? null, resultDate: g.result?.date ?? null,
      pctChange: g.change?.pctChange ?? null,
    }
    if (g.status === 'overdue') overdue.push(u)
    else if (g.status !== 'pending' && g.status !== h.notified_status) graded.push(u)
  }
  return { graded, overdue }
}
