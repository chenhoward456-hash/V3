/**
 * 身體實驗 —— 把「預測 → 對答案」從半年一次的血檢，擴到每天的數據。
 *
 * ## 為什麼有這支（2026-09-30）
 *
 * Howard：「就算我現在知道有進程，我也不覺得怎麼樣……所以呢？」
 * 血檢預測（lab_hypotheses）解了一半：有行動、有驗收日、有判決。但抽血一年兩三次，
 * 一個循環要等半年。每天的精力、睡眠、HRV 早就在記，卻從來沒拿來回答「我這樣做有沒有用」。
 *
 * 一個實驗 ＝ 一個行動（睡滿 7.5 小時）＋ 一個指標（精力）＋ 一段期間（14 天）。
 * 系統拿「實驗前 N 天」對「實驗期間」，時間到自動判決、推給學員。
 *
 * ## 判決怎麼算（刻意保守）
 *   - 兩邊各至少 MIN_POINTS 筆，不然是「資料不夠」—— 不硬判。
 *   - 差距要大過兩段本身的日常波動（Welch t 值 ≥ 2）才算「真的有變」，否則是「沒變」。
 *     每天的數據前後相關，t 值會偏樂觀 —— 所以門檻抓 2 不抓 1.96，而且只當「夠不夠明顯」的粗篩。
 *   - 判決不存 DB，每次重算（跟 gradeHypothesis 同一套哲學）；DB 只記 notified_status 去重。
 */

export type ExperimentMetric =
  | 'energy_level' | 'sleep_quality' | 'mood' | 'training_drive' | 'stress_level' | 'hunger'
  | 'cognitive_clarity' | 'hrv' | 'resting_hr' | 'wearable_sleep_score' | 'device_recovery_score' | 'weight'

export const EXPERIMENT_METRICS: Record<ExperimentMetric, { label: string; unit: string; source: 'wellness' | 'weight'; digits: number }> = {
  energy_level: { label: '精力', unit: '/5', source: 'wellness', digits: 1 },
  sleep_quality: { label: '睡眠品質', unit: '/5', source: 'wellness', digits: 1 },
  mood: { label: '心情', unit: '/5', source: 'wellness', digits: 1 },
  training_drive: { label: '想練的程度', unit: '/5', source: 'wellness', digits: 1 },
  stress_level: { label: '壓力', unit: '/5', source: 'wellness', digits: 1 },
  hunger: { label: '飢餓感', unit: '/5', source: 'wellness', digits: 1 },
  cognitive_clarity: { label: '頭腦清楚', unit: '/5', source: 'wellness', digits: 1 },
  hrv: { label: 'HRV（心率變異）', unit: 'ms', source: 'wellness', digits: 0 },
  resting_hr: { label: '安靜心率', unit: 'bpm', source: 'wellness', digits: 0 },
  wearable_sleep_score: { label: '手錶睡眠分數', unit: '分', source: 'wellness', digits: 0 },
  device_recovery_score: { label: '手錶恢復分數', unit: '分', source: 'wellness', digits: 0 },
  weight: { label: '體重', unit: 'kg', source: 'weight', digits: 1 },
}

export const MIN_POINTS = 5
export const T_THRESHOLD = 2

export type BodyExperiment = {
  id: string
  client_id: string
  title: string
  action: string | null
  metric: ExperimentMetric
  start_date: string
  end_date: string
  baseline_days: number
  expected_direction: 'up' | 'down' | 'stable'
  expected_delta: number | null
  note?: string | null
  notified_status?: string | null
  created_at?: string
}

export type DayPoint = { date: string; value: number }

export type ExperimentStatus =
  | 'running'       // 還在進行
  | 'insufficient'  // 時間到了，但資料不夠判
  | 'confirmed'     // 方向對、有到目標幅度
  | 'partial'       // 方向對、沒到目標幅度
  | 'no_change'     // 在日常波動內
  | 'refuted'       // 往反方向

export type WindowStat = { n: number; mean: number | null; sd: number | null }

export type ExperimentGrade = {
  status: ExperimentStatus
  /** 第幾天／共幾天（進行中顯示用） */
  day: number
  totalDays: number
  baseline: WindowStat
  during: WindowStat
  delta: number | null
  t: number | null
}

function addDays(d: string, n: number): string {
  const t = new Date(`${d}T00:00:00Z`)
  t.setUTCDate(t.getUTCDate() + n)
  return t.toISOString().slice(0, 10)
}

function daysBetween(a: string, b: string): number {
  return Math.round((new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime()) / 86400000)
}

function stat(values: number[]): WindowStat {
  const n = values.length
  if (n === 0) return { n, mean: null, sd: null }
  const mean = values.reduce((s, v) => s + v, 0) / n
  const sd = n > 1 ? Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1)) : null
  return { n, mean, sd }
}

export function gradeExperiment(exp: BodyExperiment, points: DayPoint[], today: string): ExperimentGrade {
  const totalDays = daysBetween(exp.start_date, exp.end_date) + 1
  const day = Math.max(0, Math.min(totalDays, daysBetween(exp.start_date, today) + 1))
  const baseStart = addDays(exp.start_date, -exp.baseline_days)
  const clean = points.filter(p => Number.isFinite(p.value))
  const baseline = stat(clean.filter(p => p.date >= baseStart && p.date < exp.start_date).map(p => p.value))
  const during = stat(clean.filter(p => p.date >= exp.start_date && p.date <= exp.end_date).map(p => p.value))
  const base = { day, totalDays, baseline, during }

  if (today <= exp.end_date) return { ...base, status: 'running', delta: null, t: null }
  if (baseline.n < MIN_POINTS || during.n < MIN_POINTS) return { ...base, status: 'insufficient', delta: null, t: null }

  const delta = during.mean! - baseline.mean!
  const se = Math.sqrt((baseline.sd ?? 0) ** 2 / baseline.n + (during.sd ?? 0) ** 2 / during.n)
  // 兩段都零波動（例：每天都填 4）→ 有差就是真差，沒差就是沒差
  const t = se === 0 ? (delta === 0 ? 0 : Math.sign(delta) * Infinity) : delta / se
  const real = Math.abs(t) >= T_THRESHOLD

  let status: ExperimentStatus
  if (exp.expected_direction === 'stable') {
    status = real ? 'refuted' : 'confirmed'
  } else if (!real) {
    status = 'no_change'
  } else {
    const wantUp = exp.expected_direction === 'up'
    if ((delta > 0) !== wantUp) status = 'refuted'
    else status = exp.expected_delta == null || Math.abs(delta) >= exp.expected_delta ? 'confirmed' : 'partial'
  }
  return { ...base, status, delta, t: Number.isFinite(t) ? t : null }
}

/** 從 daily_wellness / body_composition 的列抽出某個指標的每日值 */
export function pointsFor(
  metric: ExperimentMetric,
  wellness: Array<Record<string, unknown> & { date: string }>,
  weights: Array<{ date: string; weight: number | null }>,
): DayPoint[] {
  if (EXPERIMENT_METRICS[metric].source === 'weight') {
    return weights.filter(w => w.weight != null).map(w => ({ date: w.date, value: Number(w.weight) }))
  }
  return wellness
    .filter(w => w[metric] != null && w[metric] !== '')
    .map(w => ({ date: w.date, value: Number(w[metric]) }))
}

export const STATUS_COACH: Record<ExperimentStatus, string> = {
  running: '進行中',
  insufficient: '資料不夠判（兩段各要 5 筆以上）',
  confirmed: '✅ 有用（方向對、到目標）',
  partial: '🟡 方向對、幅度還不夠',
  no_change: '⚪ 沒變（在日常波動內）',
  refuted: '❌ 反效果（往反方向）',
}

export const STATUS_STUDENT: Record<ExperimentStatus, string> = {
  running: '進行中',
  insufficient: '這次記錄不夠多，看不出來',
  confirmed: '有用 —— 對你有效',
  partial: '有往好的方向，但還不明顯',
  no_change: '沒看到差別 —— 可能對你沒差',
  refuted: '反而變差 —— 教練會一起看原因',
}

function fmt(v: number | null, digits: number): string {
  if (v == null) return '—'
  return v.toFixed(digits)
}

/** 「精力 3.2 → 3.9（+0.7）」 */
export function describeChange(exp: BodyExperiment, g: ExperimentGrade): string {
  const m = EXPERIMENT_METRICS[exp.metric]
  const d = m.digits
  if (g.baseline.mean == null || g.during.mean == null) return `${m.label}：資料 ${g.baseline.n}＋${g.during.n} 筆`
  const delta = g.during.mean - g.baseline.mean
  return `${m.label} ${fmt(g.baseline.mean, d)} → ${fmt(g.during.mean, d)}（${delta >= 0 ? '+' : ''}${fmt(delta, d)}${m.unit === '/5' ? '' : ' ' + m.unit}）`
}

export type ExperimentUpdate = {
  id: string
  clientId: string
  name: string
  uniqueCode: string
  lineUserId: string | null
  exp: BodyExperiment
  grade: ExperimentGrade
}

export function coachExperimentLine(u: ExperimentUpdate): string {
  return `  • ${u.name}｜${u.exp.title}：${describeChange(u.exp, u.grade)} → ${STATUS_COACH[u.grade.status]}`
}

export function studentExperimentText(name: string, ups: ExperimentUpdate[]): string {
  const lines = ups.map(u => `・${u.exp.title}\n  ${describeChange(u.exp, u.grade)}\n  → ${STATUS_STUDENT[u.grade.status]}`)
  return `${name}，你的身體實驗有結果了 🧪\n\n${lines.join('\n\n')}\n\n打開「健康」分頁看細節。`
}

type QueryLike = { from: (t: string) => any }

/** 每天早上：結束了、判決出來、跟上次通知的不一樣 → 要推 */
export async function loadExperimentUpdates(supabase: QueryLike, today: string, opts: { includeNotified?: boolean; throwOnReadError?: boolean } = {}): Promise<ExperimentUpdate[]> {
  const { data: exps, error } = await supabase
    .from('body_experiments')
    .select('*, clients!inner(id, name, unique_code, line_user_id, is_active)')
    .lt('end_date', today)
  if (error && opts.throwOnReadError) throw new Error('身體實驗讀取失敗')
  if (error || !exps || exps.length === 0) return []

  type Row = BodyExperiment & { clients: { name: string; unique_code: string; line_user_id: string | null; is_active: boolean | null } }
  const active = (exps as Row[]).filter(e => e.clients.is_active !== false)
  const ids = [...new Set(active.map(e => e.client_id))]
  const earliest = active.map(e => addDays(e.start_date, -e.baseline_days)).sort()[0]
  const [{ data: wellness, error: wellnessError }, { data: weights, error: weightsError }] = await Promise.all([
    supabase.from('daily_wellness').select('*').in('client_id', ids).gte('date', earliest),
    supabase.from('body_composition').select('client_id, date, weight').in('client_id', ids).gte('date', earliest),
  ])

  if ((wellnessError || weightsError) && opts.throwOnReadError) throw new Error('身體實驗結果讀取失敗')
  const out: ExperimentUpdate[] = []
  for (const e of active) {
    const w = ((wellness ?? []) as Array<Record<string, unknown> & { date: string; client_id: string }>).filter(r => r.client_id === e.client_id)
    const b = ((weights ?? []) as Array<{ client_id: string; date: string; weight: number | null }>).filter(r => r.client_id === e.client_id)
    const grade = gradeExperiment(e, pointsFor(e.metric, w, b), today)
    if (grade.status === 'running' || (!opts.includeNotified && grade.status === e.notified_status)) continue
    out.push({ id: e.id, clientId: e.client_id, name: e.clients.name, uniqueCode: e.clients.unique_code, lineUserId: e.clients.line_user_id, exp: e, grade })
  }
  return out
}

/** 單一學員的實驗＋當下判決（教練透鏡頁、學員健康頁共用） */
export async function loadClientExperiments(supabase: QueryLike, clientId: string, today: string): Promise<Array<BodyExperiment & { grade: ExperimentGrade }>> {
  const { data: exps, error } = await supabase.from('body_experiments').select('*').eq('client_id', clientId).order('start_date', { ascending: false })
  if (error) throw new Error(error.message)
  const list = (exps ?? []) as BodyExperiment[]
  if (list.length === 0) return []
  const earliest = list.map(e => addDays(e.start_date, -e.baseline_days)).sort()[0]
  const [{ data: wellness }, { data: weights }] = await Promise.all([
    supabase.from('daily_wellness').select('*').eq('client_id', clientId).gte('date', earliest),
    supabase.from('body_composition').select('date, weight').eq('client_id', clientId).gte('date', earliest),
  ])
  return list.map(e => ({ ...e, grade: gradeExperiment(e, pointsFor(e.metric, wellness ?? [], weights ?? []), today) }))
}
