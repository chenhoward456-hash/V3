/**
 * 教練 agent 的**唯讀分析工具**。
 *
 * ## 為什麼有這支（2026-09-14）
 *
 * Howard：「我還是只能問你啊，那系統存在的意義是什麼？」
 *
 * 他是對的。`lib/agent-tools.ts` 只有 3 個工具（讀狀態／提 macro 建議／加筆記），
 * 而 `lib/` 裡躺著 80 支引擎。他問「震宣體重都沒動是怎樣」，bot 答不出來，
 * 不是因為引擎不存在，是因為**沒人把引擎接給它**。那題我兩分鐘就答了，
 * 靠的不是比較聰明，是我手上有工具它沒有。
 *
 * 這支就是把那些工具交出去。每一個都只是**包既有的 lib 函式**，沒有新的判斷邏輯 ——
 * 新邏輯會變成第二個真相來源，跟畫面上顯示的東西各說各話（紅線 6）。
 *
 * ## ⚠️ 為什麼這裡只有唯讀工具
 *
 * 「套用提案」「發訊息給學員」都會**寫 production 的學員資料**，
 * 而那條路 2026-09-14 已經做成確定性指令了（`lib/line-coach-commands.ts`：回「套用 X」）。
 * 再給 agent 一個同樣能寫的工具，等於同一個寫入有兩條路，其中一條是 LLM 在猜意圖。
 * 一條寫入路徑就好。**agent 負責回答「發生什麼事」，動手由教練打那個字。**
 * 所以 `list_pending_proposals` 在這裡，`approve_proposal` 不在。
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { estimateActualIntake } from './implied-intake'
import { buildLabOrder, type TemplateItem } from './lab-order'
import { findLabsDue, type LabDueClientInput } from './lab-due'
import { listActionableProposals, describeProposal } from './proposal-actions'
import { DAY_MS } from './date-utils'

const TW_TODAY = () => new Date(Date.now() + 8 * 3600 * 1000).toISOString().split('T')[0]

type Client = {
  id: string; name: string; gender: string | null
  calories_target: number | null; protein_target: number | null
  goal_type: string | null; target_weight: number | null; target_date: string | null
  next_checkup_date: string | null
}

/** 名字或 unique_code 都能找到人 —— 教練在 LINE 上不會打 UUID */
async function resolveClient(supabase: SupabaseClient, ref: string): Promise<Client | null> {
  const sel = 'id, name, gender, calories_target, protein_target, goal_type, target_weight, target_date, next_checkup_date'
  for (const col of ['id', 'unique_code', 'name'] as const) {
    // UUID 只可能是 id；名字/代碼走另外兩欄
    if (col === 'id' && !/^[0-9a-f-]{36}$/i.test(ref)) continue
    const { data } = await supabase.from('clients').select(sel).eq(col, ref).maybeSingle()
    if (data) return data as Client
  }
  return null
}

/** 最小平方回歸斜率（kg/週）。x 用「距最後一筆幾天」避免日期不等距造成偏差。 */
export function weeklySlope(points: { date: string; weight: number }[]): number | null {
  if (points.length < 3) return null
  const xs = points.map(p => Date.parse(p.date) / DAY_MS)
  const ys = points.map(p => p.weight)
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length
  const my = ys.reduce((a, b) => a + b, 0) / ys.length
  const den = xs.reduce((a, x) => a + (x - mx) ** 2, 0)
  if (den === 0) return null
  return (xs.reduce((a, x, i) => a + (x - mx) * (ys[i] - my), 0) / den) * 7
}

/**
 * 體重趨勢：多個時間窗一起看。
 *
 * ⚠️ 只給一個窗會被雜訊騙。Sean 2026-09-07→09-11 七天窗是 +0.92 kg/週，
 * 28 天窗是 −0.29 —— 前者是量測噪音，後者才是訊號。所以一律三個窗一起回，
 * 讓 agent（和教練）自己看它們有沒有互相矛盾。
 */
export async function analyzeWeightTrend(supabase: SupabaseClient, ref: string) {
  const c = await resolveClient(supabase, ref)
  if (!c) return { error: `找不到學員：${ref}` }

  const since = new Date(Date.now() - 60 * DAY_MS).toISOString().split('T')[0]
  const { data } = await supabase
    .from('body_composition').select('date, weight')
    .eq('client_id', c.id).gte('date', since).not('weight', 'is', null)
    .order('date')
  const pts = ((data ?? []) as { date: string; weight: number }[])
  if (pts.length < 3) return { name: c.name, error: '體重紀錄不足 3 筆，算不出趨勢' }

  const last = Date.parse(pts[pts.length - 1].date)
  const windows: Record<string, { slopeKgPerWeek: number | null; points: number }> = {}
  for (const w of [7, 14, 28]) {
    const sub = pts.filter(p => last - Date.parse(p.date) <= w * DAY_MS)
    windows[`${w}d`] = { slopeKgPerWeek: round(weeklySlope(sub)), points: sub.length }
  }

  let needed: number | null = null
  if (c.target_weight && c.target_date) {
    const weeksLeft = (Date.parse(c.target_date) - Date.parse(TW_TODAY())) / (7 * DAY_MS)
    if (weeksLeft > 0) needed = round((c.target_weight - pts[pts.length - 1].weight) / weeksLeft)
  }

  return {
    name: c.name,
    latest: { date: pts[pts.length - 1].date, weight: pts[pts.length - 1].weight },
    windows,
    goal: c.target_weight && c.target_date
      ? { targetWeight: c.target_weight, targetDate: c.target_date, neededKgPerWeek: needed }
      : null,
    note: '三個窗不一致時以較長的窗為準，短窗多半是量測噪音。',
  }
}

/**
 * 反推真實攝取／TDEE。包 `lib/implied-intake` 的 estimateActualIntake。
 *
 * ⚠️ 要有「有熱量數字」的飲食紀錄才算得出來。只有 compliant 布林是不夠的
 * ——那正是 Sean 的狀況（2026-09-12 修好 LINE 缺口前 0 筆有熱量），
 * 引擎因此只看得到體重曲線。算不出來就要明說算不出來，不要給一個假的數字。
 */
export async function estimateTrueIntake(supabase: SupabaseClient, ref: string) {
  const c = await resolveClient(supabase, ref)
  if (!c) return { error: `找不到學員：${ref}` }

  const since = new Date(Date.now() - 30 * DAY_MS).toISOString().split('T')[0]
  const [{ data: w }, { data: n }] = await Promise.all([
    supabase.from('body_composition').select('date, weight').eq('client_id', c.id).gte('date', since).order('date'),
    supabase.from('nutrition_logs').select('date, calories').eq('client_id', c.id).gte('date', since).order('date'),
  ])

  const logs = (n ?? []) as { date: string; calories: number | null }[]
  const withCal = logs.filter(r => r.calories != null)
  if (withCal.length < 5) {
    return {
      name: c.name,
      error: `近 30 天只有 ${withCal.length} 筆飲食紀錄有熱量數字（共 ${logs.length} 筆），反推不了真實攝取。`,
      hint: '只有「達標/未達標」推不出任何東西。要他在 LINE 打今天的總熱量。',
    }
  }

  const reported = Math.round(withCal.reduce((s, r) => s + (r.calories as number), 0) / withCal.length)

  // ⚠️ 只回一個數字會騙人。體重斜率隨時間窗變動很大 ——
  // 震宣 2026-09-14 實測：14 天窗 0.14、21 天窗 0.32、28 天窗 0.32 kg/週，
  // 反推出來的 TDEE 從 1738 到 1936 差將近 200 kcal。
  // 給單一數字＝把窗的選擇偷偷替教練做掉了。所以回**區間**，
  // 並且只在「整個區間都在處方同一側」時才下結論。
  const windows = [14, 21, 28]
    .map(days => {
      const est = estimateActualIntake(
        (w ?? []) as { date: string; weight: number | null }[],
        c.calories_target ?? reported,
        c.goal_type,
        days,
      )
      return est ? { days, slopeKgPerWeek: round(est.slopePerWeek), impliedTDEE: Math.round(reported - (est.slopePerWeek * 7700) / 7) } : null
    })
    .filter((x): x is { days: number; slopeKgPerWeek: number | null; impliedTDEE: number } => x != null)

  if (windows.length === 0) return { name: c.name, error: '體重資料不足，反推不了' }

  const tdees = windows.map(x => x.impliedTDEE)
  const [lo, hi] = [Math.min(...tdees), Math.max(...tdees)]
  const target = c.calories_target
  const verdict = intakeVerdict(lo, hi, target)

  return {
    name: c.name,
    reportedAvgCalories: reported,
    reportedDays: withCal.length,
    prescribedCalories: target,
    impliedTDEERange: [lo, hi],
    windows,
    verdict,
    method: '真實 TDEE ≈ 回報熱量平均 −（體重週斜率 × 7700 ÷ 7），三個時間窗各算一次',
  }
}

/** 訓練頻率：回報體重不動時，第一個要看的東西 */
export async function checkTrainingFrequency(supabase: SupabaseClient, ref: string, days = 30) {
  const c = await resolveClient(supabase, ref)
  if (!c) return { error: `找不到學員：${ref}` }

  const since = new Date(Date.now() - days * DAY_MS).toISOString().split('T')[0]
  const { data } = await supabase
    .from('training_logs').select('date, training_type, duration, rpe')
    .eq('client_id', c.id).gte('date', since).order('date', { ascending: false })

  const logs = (data ?? []) as { date: string; training_type: string }[]
  const lifting = logs.filter(l => l.training_type !== 'rest' && l.training_type !== 'cardio')
  return {
    name: c.name, windowDays: days,
    sessions: logs.length,
    liftingSessions: lifting.length,
    perWeek: round((logs.length / days) * 7),
    lastSession: logs[0]?.date ?? null,
    daysSinceLast: logs[0] ? Math.round((Date.parse(TW_TODAY()) - Date.parse(logs[0].date)) / DAY_MS) : null,
    byType: logs.reduce<Record<string, number>>((a, l) => { a[l.training_type] = (a[l.training_type] ?? 0) + 1; return a }, {}),
  }
}

/** 這次血檢該開什麼（減法引擎）。包 lib/lab-order。 */
export async function buildLabOrderForClient(supabase: SupabaseClient, ref: string) {
  const c = await resolveClient(supabase, ref)
  if (!c) return { error: `找不到學員：${ref}` }

  const [{ data: labs }, { data: tpls }] = await Promise.all([
    supabase.from('lab_results').select('test_name, value, unit, date, status').eq('client_id', c.id),
    supabase.from('lab_panel_templates').select('gender, goal_orientation, add_on_items, base_price'),
  ])
  type Tpl = { gender: string | null; goal_orientation: string | null; add_on_items: TemplateItem[] | null; base_price: number | null }
  const list = (tpls ?? []) as Tpl[]
  const tpl = list.find(t => t.gender === (c.gender || '男性') && t.goal_orientation === 'target')
    ?? list.find(t => t.gender === (c.gender || '男性'))
  if (!tpl?.add_on_items?.length) return { name: c.name, error: '找不到對應的血檢公版' }

  const plan = buildLabOrder({
    labs: (labs ?? []) as never,
    templateItems: tpl.add_on_items,
    basePrice: tpl.base_price,
    gender: c.gender === '女性' ? '女性' : c.gender === '男性' ? '男性' : undefined,
    today: TW_TODAY(),
  })

  const line = (l: { label: string; price: number | null; why: string }) =>
    ({ item: l.label, price: l.price, why: l.why })
  return {
    name: c.name,
    mustCost: plan.mustCost,
    unknownPriceCount: plan.unknownPriceCount,
    templateFullCost: plan.templateCost + (plan.basePackage.price ?? 0),
    basePackage: plan.basePackage,
    must: plan.must.map(line),
    deferrable: plan.defer.map(line),
    skip: plan.skip.map(line),
  }
}

/** 誰該回檢血檢。包 lib/lab-due。 */
export async function listLabsDue(supabase: SupabaseClient) {
  const [{ data: cs }, { data: notes }] = await Promise.all([
    supabase.from('clients')
      .select('id, name, unique_code, gender, next_checkup_date, lab_results(test_name, value, unit, date, status)')
      .eq('lab_enabled', true).eq('is_active', true),
    supabase.from('lab_panel_notes').select('client_id, panel_date, next_review_date'),
  ])
  const latest: Record<string, { d: string; next: string | null }> = {}
  for (const r of (notes ?? []) as { client_id: string; panel_date: string; next_review_date: string | null }[]) {
    if (!latest[r.client_id] || r.panel_date > latest[r.client_id].d) {
      latest[r.client_id] = { d: r.panel_date, next: r.next_review_date }
    }
  }
  type Row = LabDueClientInput & { lab_results: unknown[] | null }
  const input: LabDueClientInput[] = ((cs ?? []) as unknown as Row[]).map(c => ({
    id: c.id, name: c.name, unique_code: c.unique_code, gender: c.gender,
    next_checkup_date: c.next_checkup_date,
    panel_next_review_date: latest[c.id]?.next ?? null,
    labs: (c.lab_results ?? []) as never,
  }))
  return findLabsDue(input, TW_TODAY()).map(i => ({
    name: i.name, dueDate: i.dueDate, daysUntil: i.daysUntil,
    overdue: i.daysUntil != null && i.daysUntil < 0,
    watch: i.watch.map(w => `${w.name} ${w.value}${w.unit ?? ''}`),
    conflictingDates: i.conflictingDates,
  }))
}

/**
 * 還等教練處理的提案。
 * ⚠️ 只讀不寫 —— 要動手請教練在 LINE 回「套用 <名字>」（見檔頭）。
 */
export async function listProposalsForAgent(supabase: SupabaseClient) {
  const items = await listActionableProposals(supabase)
  if (items.length === 0) return { count: 0, items: [] }
  const { data } = await supabase.from('clients').select('id, name')
    .in('id', [...new Set(items.map(p => p.client_id))])
  const nameOf = Object.fromEntries(((data ?? []) as { id: string; name: string }[]).map(c => [c.id, c.name]))
  return {
    count: items.length,
    items: items.map(p => ({
      name: nameOf[p.client_id] ?? '?',
      change: describeProposal(p),
      proposedAt: p.proposed_at.slice(0, 10),
      reasoning: (p.reasoning ?? '').slice(0, 200),
    })),
    howToAct: '要套用請教練回「套用 <名字>」、要退掉回「不要 <名字>」。agent 不直接寫入。',
  }
}

/**
 * 處方到底是盈餘還是赤字。
 *
 * ⚠️ 只有在**整個區間都落在處方同一側**時才下結論。
 * 區間跨過處方＝不同時間窗給出相反答案＝資料還不夠，這時給任何一個方向都是瞎猜，
 * 而那個猜測會變成改學員熱量的依據。抽成純函式是為了能測這條界線。
 */
export function intakeVerdict(lo: number, hi: number, target: number | null): string | null {
  if (target == null) return null
  if (hi < target) return '處方高於他的真實代謝＝實際上是盈餘（所有時間窗都同意）'
  if (lo > target) return '處方低於他的真實代謝＝實際上是赤字（所有時間窗都同意）'
  return '不同時間窗結論不一致，資料還不夠下判斷 —— 再累積一週再看'
}

function round(n: number | null | undefined): number | null {
  return n == null || !Number.isFinite(n) ? null : Math.round(n * 100) / 100
}
