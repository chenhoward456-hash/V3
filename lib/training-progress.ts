/**
 * 訓練進步追蹤（Training Progress）
 *
 * 從 training_sets 算：每個動作的推估 1RM 趨勢 + PR + 停滯、週訓練量、各肌群週組數。
 *
 * 資料現實（依 production 實況）：
 * - `muscle_group` 常為 null → 各肌群組數改用「動作名稱關鍵字」推斷（MUSCLE_KEYWORDS）。
 * - 機械式動作常無 weight（只記 reps）→ 1RM/容量只能算「有重量」的動作；無重量的只算組數。
 * 推估 1RM 用 Epley：weight × (1 + reps/30)。
 */

export type TrainingSetRow = {
  date: string
  exercise_name: string
  muscle_group?: string | null
  weight?: number | string | null
  reps?: number | null
  rpe?: number | string | null
  is_main_lift?: boolean | null
}

export type ExerciseProgress = {
  exercise: string
  sessions: number
  bestE1RM: number | null
  bestE1RMDate: string | null
  latestE1RM: number | null
  firstE1RM: number | null
  gainPct: number | null   // 最新 vs 最初推估 1RM
  topWeight: number | null
  isPR: boolean            // 最近一次訓練刷新了歷史最佳
  plateau: boolean         // 最佳 1RM 已 >= PLATEAU_WEEKS 週沒被刷新
}

export type TrainingProgress = {
  exercises: ExerciseProgress[]
  weeklyVolume: { week: string; volume: number }[]
  muscleGroupSets: { group: string; sets: number }[]
  prsThisWeek: string[]
  plateaus: string[]
  totalSets30d: number
}

const PLATEAU_WEEKS = 4

const MUSCLE_KEYWORDS: { group: string; kw: string[] }[] = [
  { group: '胸', kw: ['臥推', '飛鳥', '夾胸', '推胸', 'bench', 'chest', 'fly', 'pec'] },
  { group: '背', kw: ['划船', '引體', '下拉', '滑輪', 'row', 'pulldown', 'pull-up', 'pullup', 'lat', '背'] },
  { group: '腿', kw: ['深蹲', '蹲', '腿推', '腿舉', '腿伸', '腿彎', '弓箭', '硬舉', '臀推', 'squat', 'leg', 'lunge', 'deadlift', 'hip thrust', 'rdl'] },
  { group: '肩', kw: ['肩推', '側平舉', '推舉', '前平舉', '面拉', 'shoulder', 'press', 'lateral', 'delt', '三角'] },
  { group: '二頭', kw: ['彎舉', '二頭', 'curl', 'bicep'] },
  { group: '三頭', kw: ['三頭', '下壓', '臂屈伸', 'pushdown', 'tricep', 'dip', 'skull'] },
  { group: '核心', kw: ['腹', '捲腹', '核心', 'plank', 'crunch', 'core', 'ab'] },
]

function inferMuscleGroup(s: TrainingSetRow): string {
  if (s.muscle_group && s.muscle_group.trim()) return s.muscle_group.trim()
  const n = (s.exercise_name || '').toLowerCase()
  for (const m of MUSCLE_KEYWORDS) if (m.kw.some(k => n.includes(k.toLowerCase()))) return m.group
  return '其他'
}

function num(v: number | string | null | undefined): number | null {
  if (v == null) return null
  const n = typeof v === 'number' ? v : parseFloat(v)
  return Number.isFinite(n) ? n : null
}

function e1rm(weight: number | null, reps: number | null): number | null {
  if (!weight || !reps || weight <= 0 || reps <= 0) return null
  return Math.round(weight * (1 + reps / 30) * 10) / 10
}

/** ISO 週起始（週一）字串 YYYY-MM-DD，避免 Date.now()——以資料日期推算。 */
function weekStart(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00Z')
  const day = (d.getUTCDay() + 6) % 7 // 週一=0
  d.setUTCDate(d.getUTCDate() - day)
  return d.toISOString().slice(0, 10)
}

function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000)
}

export function computeTrainingProgress(sets: TrainingSetRow[], opts?: { now?: string }): TrainingProgress {
  const rows = (sets || []).filter(s => s.date && s.exercise_name)
  const now = opts?.now ?? rows.reduce((m, s) => (s.date > m ? s.date : m), rows[0]?.date ?? '1970-01-01')

  // ── 每個動作的 1RM 進程 ──
  const byExercise = new Map<string, { date: string; e1rm: number; weight: number }[]>()
  for (const s of rows) {
    const w = num(s.weight); const r = s.reps ?? null
    const est = e1rm(w, r)
    if (est == null || w == null) continue
    const arr = byExercise.get(s.exercise_name) ?? []
    arr.push({ date: s.date, e1rm: est, weight: w })
    byExercise.set(s.exercise_name, arr)
  }

  const exercises: ExerciseProgress[] = []
  const prsThisWeek: string[] = []
  const plateaus: string[] = []
  const thisWeek = weekStart(now)

  for (const [exercise, pts] of byExercise.entries()) {
    pts.sort((a, b) => a.date.localeCompare(b.date))
    const dates = [...new Set(pts.map(p => p.date))]
    let best = -Infinity, bestDate = ''
    for (const p of pts) if (p.e1rm > best) { best = p.e1rm; bestDate = p.date }
    const firstDayBest = Math.max(...pts.filter(p => p.date === dates[0]).map(p => p.e1rm))
    const lastDay = dates[dates.length - 1]
    const latestBest = Math.max(...pts.filter(p => p.date === lastDay).map(p => p.e1rm))
    const topWeight = Math.max(...pts.map(p => p.weight))
    const gainPct = firstDayBest > 0 ? Math.round(((latestBest - firstDayBest) / firstDayBest) * 100) : null
    // 最近一次訓練（最後一天）= 歷史最佳 → 視為剛 PR
    const isPR = bestDate === lastDay && dates.length > 1
    // 停滯：最佳已超過 PLATEAU_WEEKS 週沒被刷新，且至少練過 3 次
    const plateau = !isPR && dates.length >= 3 && daysBetween(bestDate, lastDay) >= PLATEAU_WEEKS * 7

    exercises.push({
      exercise, sessions: dates.length,
      bestE1RM: best === -Infinity ? null : best, bestE1RMDate: bestDate || null,
      latestE1RM: latestBest, firstE1RM: firstDayBest,
      gainPct, topWeight,
      isPR, plateau,
    })
    if (isPR && weekStart(lastDay) === thisWeek) prsThisWeek.push(exercise)
    if (plateau) plateaus.push(exercise)
  }
  // 排序：剛 PR 的最前，再按進步幅度
  exercises.sort((a, b) => (Number(b.isPR) - Number(a.isPR)) || ((b.gainPct ?? -999) - (a.gainPct ?? -999)))

  // ── 週訓練量（有重量的動作，最近 8 週）──
  const volByWeek = new Map<string, number>()
  for (const s of rows) {
    const w = num(s.weight); const r = s.reps ?? null
    if (!w || !r) continue
    const wk = weekStart(s.date)
    volByWeek.set(wk, (volByWeek.get(wk) ?? 0) + w * r)
  }
  const weeklyVolume = [...volByWeek.entries()]
    .map(([week, volume]) => ({ week, volume: Math.round(volume) }))
    .sort((a, b) => a.week.localeCompare(b.week))
    .slice(-8)

  // ── 各肌群週組數（最近 7 天，肌群用 muscle_group 否則從名稱推斷）──
  const sevenAgo = new Date(now + 'T00:00:00Z'); sevenAgo.setUTCDate(sevenAgo.getUTCDate() - 6)
  const sevenStr = sevenAgo.toISOString().slice(0, 10)
  const mgCount = new Map<string, number>()
  let totalSets30d = 0
  const thirtyAgo = new Date(now + 'T00:00:00Z'); thirtyAgo.setUTCDate(thirtyAgo.getUTCDate() - 29)
  const thirtyStr = thirtyAgo.toISOString().slice(0, 10)
  for (const s of rows) {
    if (s.date >= thirtyStr) totalSets30d++
    if (s.date >= sevenStr) {
      const g = inferMuscleGroup(s)
      mgCount.set(g, (mgCount.get(g) ?? 0) + 1)
    }
  }
  const muscleGroupSets = [...mgCount.entries()]
    .map(([group, sets]) => ({ group, sets }))
    .sort((a, b) => b.sets - a.sets)

  return { exercises, weeklyVolume, muscleGroupSets, prsThisWeek, plateaus, totalSets30d }
}
