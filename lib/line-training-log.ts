/**
 * line-training-log.ts —— 學員在 LINE 回報訓練的**確定性路徑**
 *
 * ⚠️ 為什麼需要它：既有的 `handleNaturalTraining` 走 Claude API 解析，
 *    觸發條件是「必須有 數字x數字」——那擋掉了一半以上的自然寫法：
 *
 *      深蹲 100x5x3      ✓ 接得住
 *      深蹲 4組          ✗ 沒有 x
 *      臥推 80公斤 8下4組 ✗ 沒有 x
 *      今天深蹲 3組       ✗
 *
 *    而 2026-09-23 查 production 的組數覆蓋率：四個活躍學員三個是 **0%**。
 *    入口有摩擦，資料就進不來；資料進不來，訓練端的所有判讀都是空的。
 *
 * ⭐ 這支用 `lib/workout-parse.ts`（28 支測試）＋ `lib/volume-audit.ts` 的
 *    動作辨識，不打 API：
 *      · 零延遲（AI 那條要 3–20 秒）
 *      · 零成本
 *      · 行為可測、可重現
 *
 * ⚠️ 守門的關鍵不是正則，是**「動作名認不認得出來」**：
 *      「深蹲 4組」      → 深蹲認得 → 收
 *      「我想問3個問題」  → 「問題」認不出 → 不收，交還原本的流程
 *    這比「有沒有 數字x數字」準得多，也不會把教練的問句寫成學員的紀錄。
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { parseWorkout, type ParsedExercise } from './workout-parse'
import { resolveExercise, MUSCLE_LABEL, type Muscle } from './volume-audit'
import { getTaiwanDate } from './date-utils'

/** 一次最多寫幾組，防呆（打錯字變成 999 組） */
const MAX_SETS_PER_EXERCISE = 50

export interface TrainingLogAttempt {
  /** 有沒有信心處理這句話 */
  confident: boolean
  /** 認得出部位的動作 */
  recognized: Array<ParsedExercise & { muscleLabel: string }>
  /** 解析得出組數、但認不出是練什麼的 */
  unknown: ParsedExercise[]
}

/**
 * 這句話是不是「學員在報今天練了什麼」？
 *
 * ⚠️ 判準刻意嚴格：**至少要有一個動作名是系統認得的，而且組數是明確寫出來的**
 *    （不是從孤立數字猜的）。兩個條件都滿足才回 confident。
 *    認不出來的代價只是交還給既有流程；認錯的代價是把別的東西寫進訓練紀錄。
 */
export function tryParseTrainingLog(text: string): TrainingLogAttempt {
  const { exercises } = parseWorkout(text)
  const recognized: TrainingLogAttempt['recognized'] = []
  const unknown: ParsedExercise[] = []

  for (const e of exercises) {
    const hit = resolveExercise(e.name)
    if (hit) recognized.push({ ...e, muscleLabel: MUSCLE_LABEL[hit.entry.muscle] })
    else unknown.push(e)
  }

  // ⚠️ 只有 guess 等級的組數不算數：「我想問 3 個問題」如果動作名剛好命中，
  //    仍然不該被寫進去。要求至少一個是明確寫出組數的。
  const confident = recognized.some((e) => e.confidence === 'exact')
  return { confident, recognized, unknown }
}

/** 把解析結果寫進 training_sets（append，不覆寫當天既有的） */
export async function writeTrainingSets(
  supabase: SupabaseClient,
  clientId: string,
  items: Array<ParsedExercise>,
): Promise<{ ok: boolean; rows: number; error?: string }> {
  const today = getTaiwanDate()

  // 取當日各動作現有 set_number 起點 → append 不覆寫（學員可以分次記）
  const { data: existing } = await supabase
    .from('training_sets')
    .select('exercise_name, set_number')
    .eq('client_id', clientId)
    .eq('date', today)

  const maxByEx = new Map<string, number>()
  for (const r of (existing ?? []) as Array<{ exercise_name: string; set_number: number | null }>) {
    const cur = maxByEx.get(r.exercise_name) ?? 0
    if ((r.set_number ?? 0) > cur) maxByEx.set(r.exercise_name, r.set_number ?? 0)
  }

  const rows: Array<Record<string, unknown>> = []
  for (const e of items) {
    const n = Math.min(Math.max(e.sets, 1), MAX_SETS_PER_EXERCISE)
    let sn = maxByEx.get(e.name) ?? 0
    for (let i = 0; i < n; i++) {
      sn += 1
      rows.push({
        client_id: clientId,
        date: today,
        exercise_name: e.name,
        set_number: sn,
        weight: e.weight,
        reps: e.reps,
        // ⚠️ muscle_group 刻意留 null —— 部位一律由動作名推（lib/volume-audit.ts）。
        //    production 這欄的填寫率是 0%，寫進去只會多一個不同步的真相。
        muscle_group: null,
      })
    }
    maxByEx.set(e.name, sn)
  }

  if (rows.length === 0) return { ok: true, rows: 0 }

  const { error } = await supabase.from('training_sets').insert(rows)
  if (error) return { ok: false, rows: 0, error: error.message }
  return { ok: true, rows: rows.length }
}

/**
 * 從練到的部位推「今天練什麼」（training_logs 的日層級標記）。
 *
 * ⚠️ AI 那條路徑是問模型要 training_type；這裡改成**從動作推**——
 *    確定性、不花錢，而且比模型猜得準（它看得到實際的組數分佈）。
 * ⚠️ training_type 有 DB CHECK 約束，只能回白名單裡的值。
 */
export function inferTrainingType(
  recognized: Array<{ name: string; sets: number }>,
): 'push' | 'pull' | 'legs' | 'full_body' | 'cardio' {
  const byGroup: Record<'push' | 'pull' | 'legs' | 'cardio', number> = { push: 0, pull: 0, legs: 0, cardio: 0 }
  const PUSH: Muscle[] = ['chest', 'delts_front', 'delts_side', 'triceps']
  const PULL: Muscle[] = ['back', 'biceps', 'delts_rear', 'traps']
  const LEGS: Muscle[] = ['quads', 'hamstrings', 'glutes', 'calves', 'adductors', 'abductors']

  for (const e of recognized) {
    const hit = resolveExercise(e.name)
    if (!hit) continue
    const m = hit.entry.muscle
    if (hit.entry.pattern === 'cardio') byGroup.cardio += e.sets
    else if (PUSH.includes(m)) byGroup.push += e.sets
    else if (PULL.includes(m)) byGroup.pull += e.sets
    else if (LEGS.includes(m)) byGroup.legs += e.sets
  }

  const entries = (Object.entries(byGroup) as Array<[keyof typeof byGroup, number]>)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1])
  if (entries.length === 0) return 'full_body'

  const [top, topN] = entries[0]
  const total = entries.reduce((s, [, n]) => s + n, 0)
  // 沒有任何一類佔到六成就是全身 —— 不要硬分類
  return topN / total >= 0.6 ? top : 'full_body'
}

/** 標記今天有訓練（只動 training_type，不碰既有的 duration/rpe） */
export async function markTrainedToday(
  supabase: SupabaseClient,
  clientId: string,
  recognized: Array<{ name: string; sets: number }>,
): Promise<void> {
  const { error } = await supabase
    .from('training_logs')
    .upsert(
      { client_id: clientId, date: getTaiwanDate(), training_type: inferTrainingType(recognized) },
      { onConflict: 'client_id,date' },
    )
  if (error) console.error('[line-training-log] training_logs upsert 失敗', error)
}

/** 回給學員的確認訊息 */
export function confirmText(attempt: TrainingLogAttempt, totalRows: number): string {
  const lines = attempt.recognized.map((e) => {
    const bits = [`${e.sets} 組`]
    if (e.reps) bits.push(`${e.reps} 下`)
    if (e.weight) bits.push(`${e.weight} kg`)
    return `・${e.name}　${bits.join(' × ')}`
  })

  let msg = `✅ 記好了，共 ${totalRows} 組\n\n${lines.join('\n')}`

  if (attempt.unknown.length > 0) {
    // ⚠️ 認不出部位的照樣記（動作名原樣存），但要講出來 ——
    //    不然學員以為記到了，教練那邊的組數卻少一塊。
    msg += `\n\n⚠️ 這些我認不出是練哪個部位，還是幫你記了：${attempt.unknown.map((e) => e.name).join('、')}`
  }
  return msg
}
