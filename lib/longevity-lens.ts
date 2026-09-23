/**
 * 長壽透鏡（Longevity Lens）— V3 的初衷：同一個人的血檢「看得到進退」，而且每個變化都接得到
 * 「是真的嗎 → 這段期間做了什麼 → 所以呢」。框架取自 Peter Attia《Outlive》：
 *   - 四騎士：心血管、代謝、神經退化、癌症（血檢照「防哪一類病」排，不照檢驗科分類排）
 *   - 身體能力（肌力、心肺）本身就是指標，跟血檢並列
 *
 * 純函式，不碰 DB；資料由 /api/admin/longevity 組好丟進來。
 */

export type Horseman = 'cardio' | 'metabolic' | 'neuro' | 'cancer' | 'support'

export const HORSEMAN_META: Record<Horseman, { label: string; why: string }> = {
  cardio: { label: '心血管', why: '動脈粥狀硬化是幾十年累積的，ApoB 越早壓低，累積的量越少' },
  metabolic: { label: '代謝', why: '胰島素阻抗是其他三騎士的共同上游，比血糖更早出現' },
  neuro: { label: '神經退化', why: '血檢能看的很少；最強的介入是運動、睡眠和代謝健康' },
  cancer: { label: '癌症', why: '血檢幾乎看不到，要靠定期篩檢；代謝健康是能做的上游' },
  support: { label: '荷爾蒙與營養狀態', why: '不是四騎士本身，但會影響恢復、訓練和上面四項' },
}

/**
 * 指標設定。cvi＝個人生物變異係數（同一個人重複抽血的正常波動，%）。
 * 2026-09-24 PubMed 複核：有 cviDoi 的＝摘要裡直接看得到數字（EuBIVAS／BIVAC meta-analysis）；
 * 沒有的＝EFLM 資料庫近似值，摘要沒寫數字、還沒拿到全文確認（ApoB、Lp(a)、LDL、TG、胰島素等），UI 標「近似」。
 * 用來判斷「變化大到不像誤差」，不是診斷閾值。
 */
export interface MarkerSpec {
  horseman: Horseman
  cvi: number
  /** 對長期健康來說，往哪個方向是好的 */
  better: 'lower' | 'higher' | 'range'
  /** 一生測一次就夠（主要由基因決定） */
  onceInLife?: boolean
  /** 建議回檢間隔（天） */
  retestDays: number
  /** Attia 框架下的核心指標 */
  core?: boolean
  /**
   * 「上次數字已經很好」的範圍（常用單位）。落在這裡 → 不照日曆催回檢，
   * 只有「情況變了」（體重變化 >5% 等）才建議補點。Howard 2026-09-23：
   * 「那些沒測是因為我都是頂級的基因，不想一直花錢去測」—— 錢是硬約束，好的數字不必重買。
   */
  optimalMax?: number
  optimalMin?: number
  /** cvi 的出處 DOI（PubMed 摘要可直接看到數字的才填）；沒填＝近似值、UI 標「近似」 */
  cviDoi?: string
}

export const MARKERS: Record<string, MarkerSpec> = {
  ApoB: { horseman: 'cardio', cvi: 6.5, better: 'lower', retestDays: 180, core: true, optimalMax: 60 },  // mg/dL
  'LDL-C': { horseman: 'cardio', cvi: 7.8, better: 'lower', retestDays: 180, optimalMax: 100 },  // mg/dL
  總膽固醇: { horseman: 'cardio', cvi: 5.3, better: 'lower', retestDays: 180 },
  'HDL-C': { horseman: 'cardio', cvi: 5.6, better: 'higher', retestDays: 180, optimalMin: 40 },  // mg/dL
  'Lp(a)': { horseman: 'cardio', cvi: 8.5, better: 'lower', onceInLife: true, retestDays: 0, core: true },
  hsCRP: { horseman: 'cardio', cvi: 40, better: 'lower', retestDays: 180 },
  三酸甘油酯: { horseman: 'metabolic', cvi: 19.9, better: 'lower', retestDays: 180, optimalMax: 100 },  // mg/dL
  HbA1c: { horseman: 'metabolic', cvi: 1.2, cviDoi: '10.1515/almed-2020-0029', better: 'lower', retestDays: 180, core: true, optimalMax: 5.4 },  // %
  空腹血糖: { horseman: 'metabolic', cvi: 5.0, better: 'lower', retestDays: 180, cviDoi: '10.1515/almed-2020-0029' },
  空腹胰島素: { horseman: 'metabolic', cvi: 21, better: 'lower', retestDays: 180, core: true, optimalMax: 6 },  // µIU/mL
  'HOMA-IR': { horseman: 'metabolic', cvi: 26.7, cviDoi: '10.1515/cclm-2024-0672', better: 'lower', retestDays: 180, optimalMax: 1.0 },
  ALT: { horseman: 'metabolic', cvi: 15.4, better: 'lower', retestDays: 180, cviDoi: '10.1373/clinchem.2017.281808' },
  AST: { horseman: 'metabolic', cvi: 9.5, better: 'lower', retestDays: 180 },
  尿酸: { horseman: 'metabolic', cvi: 8.4, better: 'lower', retestDays: 180 },
  同半胱胺酸: { horseman: 'neuro', cvi: 8.3, better: 'lower', retestDays: 180, optimalMax: 10 },  // µmol/L
  睪固酮: { horseman: 'support', cvi: 10, better: 'range', retestDays: 180, cviDoi: '10.1016/j.cca.2024.117806' },  // 男性
  游離睪固酮: { horseman: 'support', cvi: 11, better: 'range', retestDays: 180 },
  生物可利用睪固酮: { horseman: 'support', cvi: 11, better: 'range', retestDays: 180 },
  SHBG: { horseman: 'support', cvi: 9.7, better: 'range', retestDays: 180 },
  雌二醇: { horseman: 'support', cvi: 20, better: 'range', retestDays: 180 },
  維生素D: { horseman: 'support', cvi: 7.1, better: 'range', retestDays: 180, optimalMin: 40, optimalMax: 80 },  // ng/mL
  鐵蛋白: { horseman: 'support', cvi: 13, better: 'range', retestDays: 180 },
  TSH: { horseman: 'support', cvi: 17.7, better: 'range', retestDays: 365, cviDoi: '10.1515/cclm-2020-1885' },
  'Free T4': { horseman: 'support', cvi: 4.8, better: 'range', retestDays: 365, cviDoi: '10.1515/cclm-2020-1885' },
  白蛋白: { horseman: 'support', cvi: 2.5, better: 'range', retestDays: 365 },
}

/** 分析誤差近似值（%）。實驗室不同會更大，換家實驗室的比較另外標註 */
const ANALYTICAL_CV = 3

/**
 * Reference Change Value：兩次結果差多少才「不像同一個人正常波動＋儀器誤差」（95% 雙尾）。
 * RCV = 1.96 × √2 × √(CVa² + CVi²)
 */
export function referenceChangePct(cvi: number, cva: number = ANALYTICAL_CV): number {
  return 1.96 * Math.SQRT2 * Math.sqrt(cva * cva + cvi * cvi)
}

export interface LabPoint { date: string; value: number; unit?: string | null }

export type ChangeVerdict = 'real_up' | 'real_down' | 'noise' | 'single'

export interface ChangeRead {
  from: LabPoint
  to: LabPoint
  pctChange: number
  rcvPct: number
  verdict: ChangeVerdict
}

export function readChange(from: LabPoint, to: LabPoint, cvi: number): ChangeRead {
  const pctChange = from.value === 0 ? 0 : ((to.value - from.value) / Math.abs(from.value)) * 100
  const rcvPct = referenceChangePct(cvi)
  const verdict: ChangeVerdict = Math.abs(pctChange) < rcvPct ? 'noise' : pctChange > 0 ? 'real_up' : 'real_down'
  return { from, to, pctChange, rcvPct, verdict }
}

/** 兩次抽血之間「發生了什麼」——從日常紀錄自動對上時間軸 */
export interface PeriodContext {
  days: number
  avgCalories: number | null
  calorieDays: number
  weightStart: number | null
  weightEnd: number | null
  weightRatePerWeek: number | null
  trainingPerWeek: number | null
  avgSleepQuality: number | null
  /** 從體重變化反推的每日能量收支（kcal，負＝缺口）；1 kg ≈ 7700 kcal，只在有體重速率時給 */
  impliedDailyBalance: number | null
}

export interface DailyRows {
  weights: { date: string; weight: number | null }[]
  nutrition: { date: string; calories: number | null }[]
  training: { date: string; training_type: string | null }[]
  wellness: { date: string; sleep_quality: number | null }[]
}

const inRange = (d: string, a: string, b: string) => d > a && d <= b

export function summarizePeriod(fromDate: string, toDate: string, rows: DailyRows): PeriodContext {
  const days = Math.max(1, Math.round((Date.parse(toDate) - Date.parse(fromDate)) / 86_400_000))
  const cal = rows.nutrition.filter(n => inRange(n.date, fromDate, toDate) && n.calories != null && n.calories > 0)
  const w = rows.weights
    .filter(x => x.weight != null && x.date >= fromDate && x.date <= toDate)
    .sort((a, b) => a.date.localeCompare(b.date))
  const tr = rows.training.filter(t => inRange(t.date, fromDate, toDate) && t.training_type && t.training_type !== 'rest')
  const sl = rows.wellness.filter(x => inRange(x.date, fromDate, toDate) && x.sleep_quality != null)

  const weightStart = w.length ? (w[0].weight as number) : null
  const weightEnd = w.length ? (w[w.length - 1].weight as number) : null
  const spanDays = w.length >= 2 ? (Date.parse(w[w.length - 1].date) - Date.parse(w[0].date)) / 86_400_000 : 0

  return {
    days,
    avgCalories: cal.length >= 7 ? Math.round(cal.reduce((s, n) => s + (n.calories as number), 0) / cal.length) : null,
    calorieDays: cal.length,
    weightStart,
    weightEnd,
    weightRatePerWeek: spanDays >= 14 && weightStart != null && weightEnd != null ? ((weightEnd - weightStart) / spanDays) * 7 : null,
    // 0 筆＝沒記，不是沒練；顯示「每週 0 次」會誤導
    trainingPerWeek: days >= 14 && tr.length > 0 ? Math.round((tr.length / days) * 7 * 10) / 10 : null,
    avgSleepQuality: sl.length >= 7 ? Math.round((sl.reduce((s, x) => s + (x.sleep_quality as number), 0) / sl.length) * 10) / 10 : null,
    impliedDailyBalance: spanDays >= 14 && weightStart != null && weightEnd != null
      ? Math.round((((weightEnd - weightStart) / spanDays) * 7700) / 10) * 10
      : null,
  }
}

/**
 * never：沒測過｜once_ok：一生一次、已測｜good_hold：上次很好且情況沒變，不用花錢重測
 * changed：上次很好但之後體重變化大，值得補一個點｜single：只有一個點｜stale：太久沒測｜fresh：有趨勢且夠新
 */
export type Freshness = 'never' | 'once_ok' | 'good_hold' | 'changed' | 'single' | 'stale' | 'fresh'

/** 體重變化超過這個比例 → 「情況變了」，好的舊數字不再代表現在 */
export const CHANGED_WEIGHT_PCT = 5

export function isOptimal(spec: MarkerSpec, value: number): boolean {
  if (spec.optimalMax == null && spec.optimalMin == null) return false
  if (spec.optimalMax != null && value > spec.optimalMax) return false
  if (spec.optimalMin != null && value < spec.optimalMin) return false
  return true
}

/** 從某次抽血到今天，體重變了幾 %（用那天前後最近的體重 vs 最新體重） */
export function weightChangeSincePct(sinceDate: string, weights: DailyRows['weights']): number | null {
  const w = weights.filter(x => x.weight != null).sort((a, b) => a.date.localeCompare(b.date))
  if (w.length < 2) return null
  const base = [...w].reverse().find(x => x.date <= sinceDate) ?? w.find(x => x.date > sinceDate)
  const last = w[w.length - 1]
  if (!base || base === last) return null
  return ((last.weight as number) - (base.weight as number)) / (base.weight as number) * 100
}

export interface MarkerStory {
  name: string
  spec: MarkerSpec
  points: LabPoint[]
  latest: LabPoint | null
  change: ChangeRead | null
  context: PeriodContext | null
  daysSinceLast: number | null
  freshness: Freshness
  retestBy: string | null
  /** 上次抽血到現在體重變了幾 %（判斷「情況變了」用） */
  weightChangeSincePct: number | null
  /** 最新一次落在「很好」的範圍 */
  optimalNow: boolean
}

export function buildMarkerStory(name: string, points: LabPoint[], rows: DailyRows, today: string): MarkerStory {
  const spec = MARKERS[name]
  // 同一天多筆（重複匯入、同報告兩種單位）合併成一點取平均，不然會算出「同一天變了 0%」
  const byDate = new Map<string, LabPoint[]>()
  for (const p of points) if (Number.isFinite(p.value)) byDate.set(p.date, [...(byDate.get(p.date) ?? []), p])
  const sorted = [...byDate.entries()]
    .map(([date, ps]) => ({ date, value: ps.reduce((a, b) => a + b.value, 0) / ps.length, unit: ps.find(x => x.unit)?.unit ?? null }))
    .sort((a, b) => a.date.localeCompare(b.date))
  const latest = sorted.length ? sorted[sorted.length - 1] : null
  // 跟「至少 7 天前」的點比：同一週重抽（確認用）不算一段變化，不然 15→15→9→9 會被讀成 0%
  const MIN_GAP_DAYS = 7
  const prev = latest
    ? [...sorted].reverse().find(p => (Date.parse(latest.date) - Date.parse(p.date)) / 86_400_000 >= MIN_GAP_DAYS) ?? null
    : null
  const change = prev && latest ? readChange(prev, latest, spec.cvi) : null
  const context = prev && latest ? summarizePeriod(prev.date, latest.date, rows) : null
  const daysSinceLast = latest ? Math.round((Date.parse(today) - Date.parse(latest.date)) / 86_400_000) : null

  const wChange = latest ? weightChangeSincePct(latest.date, rows.weights) : null
  const optimalNow = latest ? isOptimal(spec, latest.value) : false

  let freshness: Freshness
  if (!latest) freshness = 'never'
  else if (spec.onceInLife) freshness = 'once_ok'
  else if (optimalNow) freshness = wChange != null && Math.abs(wChange) > CHANGED_WEIGHT_PCT ? 'changed' : 'good_hold'
  else if (daysSinceLast! > spec.retestDays) freshness = 'stale'
  else if (sorted.length === 1) freshness = 'single'
  else freshness = 'fresh'

  let retestBy: string | null = null
  if (latest && !spec.onceInLife && freshness !== 'good_hold') {
    const d = new Date(`${latest.date}T00:00:00Z`)
    d.setUTCDate(d.getUTCDate() + spec.retestDays)
    retestBy = d.toISOString().slice(0, 10)
  }

  return { name, spec, points: sorted, latest, change, context, daysSinceLast, freshness, retestBy, weightChangeSincePct: wChange, optimalNow }
}

export interface HorsemanView {
  key: Horseman
  label: string
  why: string
  stories: MarkerStory[]
  /** 核心指標沒資料或沒趨勢 → 這一區的盲點 */
  blindSpots: string[]
}

export function buildHorsemen(labsByName: Record<string, LabPoint[]>, rows: DailyRows, today: string): HorsemanView[] {
  const order: Horseman[] = ['cardio', 'metabolic', 'neuro', 'cancer', 'support']
  return order.map(key => {
    const names = Object.keys(MARKERS).filter(n => MARKERS[n].horseman === key)
    const stories = names
      .filter(n => (labsByName[n]?.length ?? 0) > 0)
      .map(n => buildMarkerStory(n, labsByName[n], rows, today))
    const blindSpots: string[] = []
    for (const n of names) {
      const spec = MARKERS[n]
      if (!spec.core) continue
      const s = stories.find(x => x.name === n)
      if (!s) blindSpots.push(`${n} 從沒測過`)
      else if (spec.onceInLife || s.freshness === 'good_hold') continue
      else if (s.freshness === 'changed') blindSpots.push(`${n} 上次很好，但之後體重變了 ${s.weightChangeSincePct!.toFixed(1)}%，那個數字不一定代表現在`)
      else if (s.freshness === 'stale') blindSpots.push(`${n} 已 ${s.daysSinceLast} 天沒測`)
      else if (s.freshness === 'single') blindSpots.push(`${n} 只有一個點，還看不出趨勢`)
    }
    return { key, ...HORSEMAN_META[key], stories, blindSpots }
  })
}

/** 力量指標：主項的估計 1RM（Epley）隨時間的最好成績 */
export interface StrengthPoint { month: string; exercise: string; e1rm: number }

export function estimateOneRepMax(weight: number, reps: number): number {
  if (reps <= 1) return weight
  return Math.round(weight * (1 + reps / 30))
}

export function strengthByMonth(
  sets: { date: string; exercise_name: string; weight: number | null; reps: number | null; is_main_lift: boolean | null }[],
): StrengthPoint[] {
  const best = new Map<string, StrengthPoint>()
  for (const s of sets) {
    if (!s.is_main_lift || !s.weight || !s.reps || s.reps > 12) continue
    const month = s.date.slice(0, 7)
    const key = `${s.exercise_name}|${month}`
    const e1rm = estimateOneRepMax(s.weight, s.reps)
    const cur = best.get(key)
    if (!cur || e1rm > cur.e1rm) best.set(key, { month, exercise: s.exercise_name, e1rm })
  }
  return [...best.values()].sort((a, b) => a.exercise.localeCompare(b.exercise) || a.month.localeCompare(b.month))
}

// ─────────────────────────────────────────────────────────────
// 預測 → 驗收（lab_hypotheses）：每個真實變化記一個「推測原因＋行動＋預期」，
// 下一次抽血自動對答案。判決不存 DB，每次用最新資料重算。
// ─────────────────────────────────────────────────────────────

export interface LabHypothesis {
  id: string
  marker: string
  baseline_date: string
  baseline_value: number
  cause: string | null
  action: string | null
  expected_direction: 'up' | 'down' | 'stable'
  expected_value: number | null
  retest_by: string | null
  note: string | null
  created_at: string
}

/**
 * pending：還沒有重測結果｜overdue：過了預計重測日還沒測
 * confirmed：方向對、也到目標｜partial：方向對但沒到目標｜no_change：變化在正常波動內
 * refuted：往反方向走
 */
export type HypothesisStatus = 'pending' | 'overdue' | 'confirmed' | 'partial' | 'no_change' | 'refuted'

export interface HypothesisGrade {
  status: HypothesisStatus
  result: LabPoint | null
  change: ChangeRead | null
}

export function gradeHypothesis(h: LabHypothesis, points: LabPoint[], today: string): HypothesisGrade {
  const spec = MARKERS[h.marker]
  const minDate = new Date(`${h.baseline_date}T00:00:00Z`)
  minDate.setUTCDate(minDate.getUTCDate() + 7)
  const minStr = minDate.toISOString().slice(0, 10)
  const after = points.filter(p => p.date >= minStr && Number.isFinite(p.value)).sort((a, b) => a.date.localeCompare(b.date))
  // 用重測日之後（或最接近的）第一筆當答案；同日多筆取平均
  if (after.length === 0) {
    return { status: h.retest_by && today > h.retest_by ? 'overdue' : 'pending', result: null, change: null }
  }
  const firstDate = after[0].date
  const same = after.filter(p => p.date === firstDate)
  const result: LabPoint = { date: firstDate, value: same.reduce((s, p) => s + p.value, 0) / same.length, unit: same[0].unit ?? null }
  const change = readChange({ date: h.baseline_date, value: Number(h.baseline_value) }, result, spec?.cvi ?? 10)

  let status: HypothesisStatus
  if (h.expected_direction === 'stable') {
    status = change.verdict === 'noise' ? 'confirmed' : 'refuted'
  } else {
    const wanted = h.expected_direction === 'up' ? 'real_up' : 'real_down'
    const opposite = h.expected_direction === 'up' ? 'real_down' : 'real_up'
    if (change.verdict === 'noise') status = 'no_change'
    else if (change.verdict === opposite) status = 'refuted'
    else if (change.verdict === wanted) {
      const hit = h.expected_value == null
        || (h.expected_direction === 'up' ? result.value >= Number(h.expected_value) : result.value <= Number(h.expected_value))
      status = hit ? 'confirmed' : 'partial'
    } else status = 'no_change'
  }
  return { status, result, change }
}

// ─────────────────────────────────────────────────────────────
// 身體能力：VO2max、握力（fitness_markers）。只跟「同一種量法」比，Garmin 估算和實驗室的數字不能混。
// ─────────────────────────────────────────────────────────────

export type FitnessKind = 'vo2max' | 'grip'

export const FITNESS_META: Record<FitnessKind, { label: string; unit: string; why: string }> = {
  vo2max: { label: '心肺（VO2max）', unit: 'ml/kg/min', why: '心肺能力的上限，預測壽命最強的指標之一' },
  grip: { label: '握力', unit: 'kg', why: '全身肌力的簡單代表，老了能不能自己提東西、撐住跌倒' },
}

export interface FitnessRow { id: string; kind: FitnessKind; date: string; value: number; method: string; note: string | null }

export interface FitnessView {
  kind: FitnessKind
  rows: FitnessRow[]
  latest: FitnessRow | null
  /** 跟同一種量法的上一筆比 */
  previousSameMethod: FitnessRow | null
  pctChange: number | null
}

export function buildFitness(rows: FitnessRow[]): FitnessView[] {
  return (['vo2max', 'grip'] as FitnessKind[]).map(kind => {
    const rs = rows.filter(r => r.kind === kind).sort((a, b) => a.date.localeCompare(b.date))
    const latest = rs.length ? rs[rs.length - 1] : null
    const previousSameMethod = latest ? [...rs].reverse().find(r => r !== latest && r.method === latest.method) ?? null : null
    const pctChange = latest && previousSameMethod
      ? ((Number(latest.value) - Number(previousSameMethod.value)) / Number(previousSameMethod.value)) * 100
      : null
    return { kind, rows: rs, latest, previousSameMethod, pctChange }
  })
}

/**
 * 學員看的分組名稱。合規（見 project_v3_compliance）：學員可見處不寫疾病名，
 * 四騎士改成身體系統的說法；「癌症」那格學員版不顯示（血檢本來就看不到，只會嚇人）。
 */
export const STUDENT_GROUP_META: Partial<Record<Horseman, { label: string; why: string }>> = {
  cardio: { label: '血管與血脂', why: '這些數字是幾十年慢慢累積的，越早維持在好的範圍越好' },
  metabolic: { label: '血糖與代謝', why: '身體處理醣類和脂肪的效率，會影響體力、體態和其他項目' },
  neuro: { label: '大腦與神經', why: '血檢能看的不多；運動、睡眠和穩定的代謝對它最有幫助' },
  support: { label: '荷爾蒙與營養', why: '會影響恢復、訓練表現和精神狀態' },
}
