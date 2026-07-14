/**
 * Peak Week 訓練衝突檢查
 *
 * 為什麼需要：Helms《The Muscle & Strength Pyramid: Nutrition》Ch.7 明確指出——
 *   「避免造成肌肉損傷的訓練（高訓練量、練到力竭、長肌長下的高張力，尤其離心）。
 *     **肌肉損傷會損害肝醣儲存。**」
 *   點名要避開的：Romanian deadlifts、good mornings、deep dumbbell flyes。
 *
 * 後果（不是理論，是會直接毀掉比賽的）：
 *   1. 賽前做完硬舉/深蹲 → 肌肉損傷 → 之後幾天的充碳有一半白做（儲糖能力受損）
 *   2. 形體選手賽日要站著 posing 一整天（有些項目台上 40-60 分鐘），腿痠會毀掉台風
 *
 * 這個坑系統本來抓不到——教練的 training_plan 和 peak week 計畫是兩套資料，
 * 沒有人在比對。實際案例：學員的週四是腿日（硬舉+哈克深蹲），而週四剛好是賽前 3 天。
 */

/** 會造成明顯肌肉損傷 / DOMS 的動作（長肌長高張力、重離心） */
export const PEAK_WEEK_DAMAGING_PATTERNS: { pattern: RegExp; label: string; why: string }[] = [
  { pattern: /羅馬尼亞|\bRDL\b|romanian/i, label: '羅馬尼亞硬舉', why: 'Helms 點名：長肌長高張力離心' },
  { pattern: /早安|good\s*morning/i, label: '早安', why: 'Helms 點名：長肌長高張力離心' },
  { pattern: /飛鳥|fly(e|es)?\b/i, label: '飛鳥', why: 'Helms 點名：深飛鳥在長肌長造成損傷' },
  { pattern: /硬舉|deadlift/i, label: '硬舉', why: '全身性高負荷離心，DOMS 最重' },
  { pattern: /深蹲|squat/i, label: '深蹲', why: '長肌長重離心（含哈克深蹲、前蹲）' },
  { pattern: /弓箭步|lunge/i, label: '弓箭步', why: '單腿長肌長離心' },
  { pattern: /保加利亞|bulgarian/i, label: '保加利亞分腿蹲', why: '單腿長肌長離心，DOMS 重' },
]

export interface PeakTrainingConflict {
  date: string
  daysOut: number
  /** 課表上那天的名字，例如 'Legs Day' */
  dayLabel: string
  /** 命中的動作原名（學員課表上寫的） */
  exercises: string[]
  /** 命中的損傷類型 */
  reasons: string[]
}

interface TrainingPlanLike {
  days?: {
    dayOfWeek: number   // 1=週一 … 7=週日
    label?: string
    exercises?: { name?: string }[]
  }[]
}

/**
 * 比對「peak week 的每一天」× 「週間訓練課表」，找出排到損傷動作的日子。
 *
 * @param trainingPlan  clients.training_plan
 * @param peakDays      peak week 計畫的日期（date 用 ISO，daysOut 用於排序/嚴重度）
 */
export function checkPeakWeekTrainingConflicts(
  trainingPlan: TrainingPlanLike | null | undefined,
  peakDays: { date: string; daysOut: number }[],
): PeakTrainingConflict[] {
  if (!trainingPlan?.days?.length || !peakDays?.length) return []

  const conflicts: PeakTrainingConflict[] = []

  for (const pd of peakDays) {
    if (!pd?.date) continue
    // 用 UTC 中午解析，避免時區把日期推移一天（本機 vs UTC 主機會不一致）
    const jsDay = new Date(`${pd.date}T12:00:00Z`).getUTCDay()   // 0=週日
    if (Number.isNaN(jsDay)) continue
    const isoDow = jsDay === 0 ? 7 : jsDay                        // 課表慣例：1=週一 … 7=週日

    const planDay = trainingPlan.days.find(d => d.dayOfWeek === isoDow)
    if (!planDay?.exercises?.length) continue

    const hitExercises: string[] = []
    const hitReasons = new Set<string>()

    for (const ex of planDay.exercises) {
      const name = ex?.name?.trim()
      if (!name) continue
      for (const p of PEAK_WEEK_DAMAGING_PATTERNS) {
        if (p.pattern.test(name)) {
          hitExercises.push(name)
          hitReasons.add(p.label)
          break   // 一個動作命中一次就好
        }
      }
    }

    if (hitExercises.length > 0) {
      conflicts.push({
        date: pd.date,
        daysOut: pd.daysOut,
        dayLabel: planDay.label ?? '',
        exercises: hitExercises,
        reasons: [...hitReasons],
      })
    }
  }

  // 越接近比賽越嚴重 → 先列最靠近的
  return conflicts.sort((a, b) => a.daysOut - b.daysOut)
}

/** 產生給教練/學員看的警告句（引擎 warnings 用） */
export function formatPeakTrainingConflict(c: PeakTrainingConflict): string {
  const when = c.daysOut === 0 ? '比賽當天' : `賽前 ${c.daysOut} 天`
  const dayName = c.dayLabel ? `（課表「${c.dayLabel}」）` : ''
  return `🏋️ ⚠️ ${c.date} = ${when}${dayName}，課表排了 ${c.exercises.join('、')} — `
    + `這類動作（${c.reasons.join('、')}）會造成肌肉損傷，而**肌肉損傷會直接損害肝醣儲存**，`
    + `等於把接下來的充碳做掉一半；賽日還要站著 posing，腿痠會毀掉台風。`
    + `改成機械式輕量（腿推 / 腿彎舉 / 提踵，RIR 2-3）或改練上半身。`
}
