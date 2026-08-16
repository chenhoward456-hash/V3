/**
 * 判斷飲食紀錄「像不像真的量出來的」。
 *
 * ⚠️ 為什麼需要（2026-08-16 Howard：「我的資料營養素有時候也亂填，看來是我太不自律嗎？」）：
 *
 * 學員端那顆「今天照目標吃・全部達標」是我做的，它把三個巨量一次填成目標值。
 * 好處是五秒完成、降低摩擦；代價是**它產生的數字跟真實測量長得一模一樣**，
 * 寫進 nutrition_logs 之後無從分辨（達標走 mode:'set'、記一餐走 mode:'add'，
 * 但兩者存下來的欄位相同）。
 *
 * 目前無害 —— nutrition-engine 只在記錄率 ≥70% 時才用飲食算 Adaptive TDEE，
 * 而 Howard 卡在 64%。但**再記幾天就會跨過去**，那時引擎會拿「天天剛好等於目標」
 * 的假資料回推代謝，得出「他的 TDEE 剛好等於處方」的結論 —— 永遠不會發現他多吃。
 *
 * 判準不看資料怎麼來的（那要改 schema），看它的**指紋**：
 * 真人吃東西不可能天天剛好同一個數字。同一個值反覆出現＝按鈕，不是量的。
 */

/** 至少要幾筆才判斷（太少無法看出重複模式） */
const MIN_SAMPLES = 5
/** 最常出現的值佔比超過這個 → 判定為一鍵填入 */
const MODE_RATIO_THRESHOLD = 0.6
/** 與目標值的相對誤差在此範圍內視為「等於目標」 */
const TARGET_TOLERANCE = 0.02

export type NutritionQuality = {
  /** 看起來像一鍵填的（不可信，別拿來回推 TDEE） */
  looksAutoFilled: boolean
  /** 最常出現的值 */
  modalValue: number | null
  /** 最常出現的值佔比 0-1 */
  modalRatio: number
  /** 相異值的個數 */
  distinctValues: number
  samples: number
}

/**
 * @param calories 一段期間的每日熱量紀錄
 * @param targetCalories 學員的目標熱量（有給的話會多一道「眾數剛好等於目標」的判斷）
 */
export function assessNutritionQuality(
  calories: Array<number | null | undefined>,
  targetCalories?: number | null,
): NutritionQuality {
  const vals = calories.filter((c): c is number => typeof c === 'number' && Number.isFinite(c) && c > 0)
  const samples = vals.length

  if (samples < MIN_SAMPLES) {
    return { looksAutoFilled: false, modalValue: null, modalRatio: 0, distinctValues: new Set(vals).size, samples }
  }

  const counts = new Map<number, number>()
  for (const v of vals) counts.set(v, (counts.get(v) ?? 0) + 1)

  let modalValue = vals[0]
  let modalCount = 0
  for (const [v, n] of counts) {
    if (n > modalCount) { modalValue = v; modalCount = n }
  }
  const modalRatio = modalCount / samples

  // 主判準：同一個數字反覆出現
  let looksAutoFilled = modalRatio >= MODE_RATIO_THRESHOLD

  // 加強：眾數剛好等於目標熱量 → 幾乎確定是按鈕（真人剛好天天吃到小數點對齊的機率極低）
  if (!looksAutoFilled && targetCalories && targetCalories > 0) {
    const nearTarget = Math.abs(modalValue - targetCalories) / targetCalories <= TARGET_TOLERANCE
    if (nearTarget && modalRatio >= 0.4) looksAutoFilled = true
  }

  return { looksAutoFilled, modalValue, modalRatio, distinctValues: counts.size, samples }
}

/**
 * 給教練看的一句話。**不指控學員** —— 一鍵達標是系統提供的功能，
 * 用它不是作弊；問題只在於這種資料不能拿來回推代謝。
 */
export function qualityNote(q: NutritionQuality): string | null {
  if (!q.looksAutoFilled) return null
  const pct = Math.round(q.modalRatio * 100)
  return `飲食紀錄有 ${pct}% 是同一個數字（${q.modalValue} kcal）—— 多半是按「達標」帶進來的，` +
    `不是實際量的。系統不會拿它回推代謝，判斷一律以體重趨勢為準。`
}
