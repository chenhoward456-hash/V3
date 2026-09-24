/**
 * 訓練表單「一列 = 某動作 × 某重量做幾組」 ↔ DB training_sets「一列 = 一組」的互轉。
 *
 * 稽核 D5：原本載入時用 exercise_name 分組、只留第一組的重量次數、其他只算組數；存檔時再照組數複製
 * 同一組數字。金字塔／遞減組（20×10 / 25×8 / 30×6，包括 LINE 記的）只要回表單改一下再存，
 * 就全變成 20×10 ×3，真實的漸進資料永久遺失。另外同一動作在表單出現兩列時，每列的 set_number
 * 都從 1 開始編 → 同一動作出現重複的 set_number。
 *
 * 這裡的規則：
 *  - 載入：同一動作裡「連續、重量／次數／RPE 都一樣」的組才合成一列，不一樣就分開成多列（不丟資料）。
 *  - 存檔：set_number 以「動作」為單位連續編號，跨列不重來。
 */

export interface SetFormRow {
  exercise_name: string
  muscle_group: string
  set_number: number
  num_sets: number | null
  weight: number | null
  reps: number | null
  rpe: number | null
  is_main_lift: boolean
}

export interface SetDbRow {
  exercise_name: string
  muscle_group?: string | null
  set_number: number
  weight?: number | null
  reps?: number | null
  rpe?: number | null
  is_main_lift?: boolean | null
}

const n = (v: number | null | undefined) => (v == null ? null : Number(v))

/** DB 逐組 → 表單列（依動作首次出現順序；同動作內依 set_number）。 */
export function groupSetRows(rows: SetDbRow[]): SetFormRow[] {
  const order: string[] = []
  const byExercise: Record<string, SetDbRow[]> = {}
  for (const r of rows) {
    if (!byExercise[r.exercise_name]) {
      byExercise[r.exercise_name] = []
      order.push(r.exercise_name)
    }
    byExercise[r.exercise_name].push(r)
  }

  const out: SetFormRow[] = []
  for (const name of order) {
    const sets = [...byExercise[name]].sort((a, b) => a.set_number - b.set_number)
    let current: SetFormRow | null = null
    for (const s of sets) {
      const same =
        current &&
        current.weight === n(s.weight) &&
        current.reps === n(s.reps) &&
        current.rpe === n(s.rpe)
      if (current && same) {
        current.num_sets = (current.num_sets ?? 0) + 1
        continue
      }
      current = {
        exercise_name: s.exercise_name,
        muscle_group: s.muscle_group || '',
        set_number: s.set_number,
        num_sets: 1,
        weight: n(s.weight),
        reps: n(s.reps),
        rpe: n(s.rpe),
        is_main_lift: !!s.is_main_lift,
      }
      out.push(current)
    }
  }
  return out
}

/** 表單列 → DB 逐組。set_number 在同一動作內連續編號（跨列不重來）。 */
export function expandSetRows(rows: SetFormRow[]): Array<{
  exercise_name: string
  muscle_group: string | null
  set_number: number
  weight: number | null
  reps: number | null
  rpe: number | null
  is_main_lift: boolean
}> {
  const counter: Record<string, number> = {}
  return rows.flatMap((s) => {
    const name = s.exercise_name.trim()
    const count = Math.max(1, s.num_sets || 1)
    return Array.from({ length: count }, () => {
      counter[name] = (counter[name] ?? 0) + 1
      return {
        exercise_name: name,
        muscle_group: s.muscle_group || null,
        set_number: counter[name],
        weight: s.weight,
        reps: s.reps,
        rpe: s.rpe,
        is_main_lift: s.is_main_lift,
      }
    })
  })
}
