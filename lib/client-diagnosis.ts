/**
 * 一個學員，一句**原因**。不是描述曲線，是講為什麼。
 *
 * ## 為什麼有這支（2026-09-14）
 *
 * Howard：「教練後台我寧可用你去分析也不要自己看，你懂嗎」
 *
 * 後台 `computeProgress` 只看體重，產出的是「停滯 · 0.0kg / 13天 幾乎沒動 距目標 -5.8kg」。
 * 那是**描述**，不是診斷。看到它之後還要自己想「所以為什麼卡住」——
 * 而那一步正是他說他不做的那一步。於是整頁資料都在等一個不會發生的動作。
 *
 * 這支把那一步寫下來。推理鏈不是我發明的，是 2026-09-14 那晚對震宣／Sean／林宥任／
 * 陳胤豪各手做一次之後，發現四次走的是同一條：
 *
 *   1. 他有在練嗎？        沒練 → 代謝掉下去，熱量處方就失真。先講這個，其餘免談。
 *   2. 他吃的跟回報的一樣嗎？不一樣 → 是執行落差，砍處方只會讓落差更大。
 *   3. 一樣，但體重還是偏？ → 這時候才輪到處方本身要調。
 *   4. 什麼都答不出來？     → 缺的是飲食紀錄，先要到數字再說。
 *
 * ⚠️ **順序就是價值。** 對一個 18 天沒練的人砍熱量、對一個少報 400 大卡的人砍熱量，
 * 都是拿正確的公式解錯的問題。Howard 自己 2026-08-16 被系統這樣砍過一次，
 * 他的原話：「在明知我亂吃的情況下，你怎麼會幫我調降成這樣？」
 *
 * ⚠️ 判斷一律轉呼叫既有引擎（`lib/implied-intake.ts`），不在這裡另寫一套門檻 ——
 * 兩套門檻會讓後台跟學員端各說各話（紅線 6）。
 */

import {
  estimateActualIntake, prescriptionVerdict,
  lastCarbIncreaseDate, inCarbRepletionWindow, carbRepletionCutoff, type MacroLogRow,
} from './implied-intake'
import { DAY_MS } from './date-utils'

/** 完全沒有任何紀錄幾天就算「人不見了」 */
export const OFFLINE_DAYS = 7
/** 幾天沒練就算「訓練停了」。低於這個數字的空窗是正常作息，不是問題。 */
export const TRAINING_GAP_DAYS = 14
/** 反推攝取至少要幾天有熱量數字的飲食紀錄才算得準 */
export const MIN_CALORIE_DAYS = 5

export type DiagnosisInput = {
  goalType: string | null
  caloriesTarget: number | null
  /** 這個學員有沒有開訓練功能 —— 沒開就不要拿「沒練」當原因 */
  trainingEnabled?: boolean
  weights: { date: string; weight: number | null }[]
  nutritionLogs: { date: string; calories: number | null }[]
  trainingLogs: { date: string; training_type: string | null }[]
  /** macro 變更紀錄 —— 用來偵測碳水回補窗（見 implied-intake 的 CARB_REPLETION_DAYS） */
  macroLog?: MacroLogRow[]
  /** 台灣日 YYYY-MM-DD */
  today: string
  /**
   * 呼叫端餵進來的資料涵蓋幾天（預設 30）。
   *
   * ⚠️ 一定要有這個。第一版沒有，於是「窗內沒有任何紀錄」被講成「從來沒有任何紀錄」——
   * 謝佳峻／William／張承鈞／Eddie 明明都有舊紀錄，只是比查詢窗更舊。
   * 引擎只能陳述它看得到的範圍，不能替呼叫端宣稱歷史上不存在。
   */
  windowDays?: number
}

export type DiagnosisCode =
  | 'offline'             // 人不見了
  | 'no_training_data'    // 沒有訓練紀錄（⚠️ 不等於沒練）
  | 'carb_repletion'      // 碳水剛拉回來，肝醣＋水回補中，體重趨勢不可信
  | 'undetermined'        // 體重沒跟上，但分不出是紀錄漏了還是處方開太高
  | 'execution_gap'       // 吃的比回報多（或少）
  | 'prescription'        // 處方本身要調
  | 'no_food_data'        // 缺飲食紀錄，問不出來
  | 'on_track'            // 沒事

export type Diagnosis = {
  code: DiagnosisCode
  /** 一句原因，給後台與晨報直接印 */
  cause: string
  /** 要做什麼。刻意跟 cause 分開 —— 看到原因不等於知道下一步。 */
  action: string
  /**
   * 附註：會降低判斷把握度但本身不是原因的事（目前只有訓練紀錄缺口）。
   * ⚠️ 刻意跟 cause 分開：「我看不到」不可以印成「他沒做」。
   */
  note?: string
}

const uniqDays = (rows: { date: string }[]) =>
  new Set(rows.map(r => (r.date ?? '').slice(0, 10)).filter(Boolean))

export function diagnoseClient(input: DiagnosisInput): Diagnosis {
  const { goalType, caloriesTarget, today } = input
  const days = (from: string) => Math.round((Date.parse(today) - Date.parse(from.slice(0, 10))) / DAY_MS)

  // ── 0. 人還在嗎 ──
  //
  // ⚠️ 這條一定要排最前面。第一版沒有它，9 個學員有 5 個被診斷成
  // 「完全沒有訓練紀錄 → 確認他有沒有在練」—— 而那 5 個是失聯 30 到 51 天的人。
  // 對一個 51 天沒出現的人分析他的訓練頻率，是拿正確的公式解錯的問題：
  // 他的問題不是沒練，是人不見了。任何營養／訓練診斷都要先確認對象還在。
  const anyDates = [
    ...input.weights.map(w => w.date),
    ...input.nutritionLogs.map(n => n.date),
    ...input.trainingLogs.map(t => t.date),
  ].filter(Boolean).sort()
  const lastAny = anyDates[anyDates.length - 1]
  const win = input.windowDays ?? 30
  if (!lastAny) {
    return {
      code: 'offline',
      cause: `近 ${win} 天沒有任何紀錄`,
      action: '先把人找回來。沒有資料的時候談調整都是猜的',
    }
  }
  const silent = days(lastAny)
  if (silent >= OFFLINE_DAYS) {
    return {
      code: 'offline',
      cause: `${silent} 天沒有任何紀錄`,
      action: '先把人找回來。沒有資料的時候談調整都是猜的',
    }
  }

  // ── 訓練紀錄缺口：**註記，不是診斷** ──
  //
  // ⚠️ 2026-09-14 Howard 當場推翻我的第一版：「其實他們都有練，只是他們都沒有紀錄而已」。
  // 第一版把「沒有訓練紀錄」直接讀成「沒在練」，對震宣與 Sean 各輸出一句
  // 「18 天沒練 → 槓桿是訓練不是熱量」—— 那是我自己推的因果，不是資料說的。
  // **缺紀錄 ≠ 沒做。** 這是這個產品最常見的一種錯：把「我看不到」講成「他沒做」。
  //
  // 所以訓練空窗降級成 note：它讓代謝變成未知（影響判斷的把握度），
  // 但它本身不是原因，也不該蓋過「吃的跟回報對不對得上」——
  // 後者只用體重與回報熱量算，完全不依賴訓練紀錄，反而是這裡最硬的證據。
  let note: string | undefined
  if (input.trainingEnabled !== false) {
    const real = input.trainingLogs
      .filter(t => t.training_type && t.training_type !== 'rest')
      .map(t => t.date).sort()
    const last = real[real.length - 1]
    const gap = last ? days(last) : null
    if (gap == null || gap >= TRAINING_GAP_DAYS) {
      note = gap == null
        ? `近 ${input.windowDays ?? 30} 天沒有訓練紀錄（不代表他沒練，可能只是沒記）`
        : `${gap} 天沒有訓練紀錄（不代表他沒練，可能只是沒記）`
    }
  }

  // ── 2. 吃的跟回報的一樣嗎 ──
  const withCal = input.nutritionLogs.filter(n => n.calories != null)
  if (withCal.length < MIN_CALORIE_DAYS) {
    return {
      code: 'no_food_data',
      cause: `近期只有 ${withCal.length} 筆飲食紀錄有熱量數字`,
      action: '在問「為什麼」之前先要到數字。只有達標/未達標推不出任何東西',
      note,
    }
  }

  if (caloriesTarget == null) {
    return { code: 'no_food_data', cause: '沒設熱量目標', action: '先把處方設起來，不然沒有東西可以對帳', note }
  }

  // 回補期那幾天的體重被水蓋住，要從回歸裡丟掉 —— 否則窗過了之後它們還會把斜率拉平
  const carbIncrease = lastCarbIncreaseDate(input.macroLog ?? [])
  const est = estimateActualIntake(
    input.weights, caloriesTarget, goalType, 21, carbRepletionCutoff(carbIncrease),
  )
  // 他自己記的平均熱量：要斷定「執行超出處方」必須有這個獨立證據，
  // 不能只靠體重沒掉就反推（見 prescriptionVerdict 檔內 2026-09-19 的更正）。
  const loggedDaily = withCal.length
    ? Math.round(withCal.reduce((a, r) => a + (r.calories as number), 0) / withCal.length)
    : null
  const repletion = inCarbRepletionWindow(carbIncrease, today)
  const verdict = prescriptionVerdict(
    est ? { impliedDaily: est.impliedDaily, targetCalories: caloriesTarget } : null,
    loggedDaily,
    repletion,
  )

  // 碳水回補窗內：體重趨勢不可信，直接講這件事，不要往下判執行或處方
  // （prescriptionVerdict 也把這條排在「資料不足」前面 —— 窗內 cutoff 在未來、
  //   體重會被全排除，先撞資料不足的話引擎反而會照樣去砍處方）
  if (repletion) {
    return { code: 'carb_repletion', cause: verdict.reason, action: '不用動。等回補期過了趨勢才算數', note }
  }

  // prescriptionVerdict 說「不要調處方」＝ 這是執行落差，不是處方錯
  if (est && !verdict.adjustPrescription) {
    // ⚠️ 不再自己重寫理由 —— 直接用 prescriptionVerdict 的判詞。
    // 舊版在這裡把所有「不調處方」的情況都寫成「體重反推實際吃 N，比處方多 M」，
    // 那句話假設處方是對的（循環論證），會冤枉照著吃的人（震宣 2026-09-19）。
    if (verdict.cause === 'execution') {
      return { code: 'execution_gap', cause: verdict.reason, action: '先讓實際吃的對上處方，再談調整', note }
    }
    if (verdict.cause === 'under-eating') {
      return { code: 'execution_gap', cause: verdict.reason, action: '要處理的是為什麼吃不到，不是調數字', note }
    }
    return { code: 'undetermined', cause: verdict.reason, action: '分不出是紀錄漏了還是處方開太高 —— 這個要你看一眼', note }
  }

  // ── 3. 吃得跟處方一致，體重還是偏 → 這時才輪到處方 ──
  if (est) {
    const offTrack = Math.abs(est.slopePerWeek - est.expectedRatePerWeek) > 0.15
    if (offTrack) {
      return {
        code: 'prescription',
        cause: `實際吃的對上處方了，但體重 ${est.slopePerWeek >= 0 ? '+' : ''}${est.slopePerWeek.toFixed(2)}kg/週（該 ${est.expectedRatePerWeek >= 0 ? '+' : ''}${est.expectedRatePerWeek.toFixed(2)}）`,
        action: '這次是處方本身要調，可以動數字',
        note,
      }
    }
  }

  // 什麼都對，但訓練沒紀錄 → 那才是唯一還缺的東西
  // ⚠️ `note` 也要一起回：呼叫端不該因為「這次它剛好升級成 cause」就要分兩種情況讀。
  if (note) {
    return {
      code: 'no_training_data',
      cause: note,
      action: '數據面沒問題。缺的是訓練紀錄 —— 有了才算得出他的代謝，不然處方是用體重反推的',
      note,
    }
  }
  return { code: 'on_track', cause: '在軌道上', action: '不用動' }
}

/**
 * 近 N 天的營養素攝取平均。
 *
 * Howard 2026-09-14：「除了 7 天的體重平均以外，營養素的攝取平均我也需要知道。」
 *
 * ⚠️ **分母只算「有記的天」，不是 N。** 記 3 天平均 2000 跟記 7 天平均 2000
 * 是完全不同的資訊，把沒記的天當成 0 會把前者稀釋成 857，看起來像他在挨餓。
 * 所以回傳一定附上 `daysLogged` / `windowDays`，呼叫端該把「7 天記了 3 天」講出來。
 */
export type NutritionAverage = {
  windowDays: number
  daysLogged: number
  calories: number | null
  protein: number | null
  carbs: number | null
  fat: number | null
  /** 蛋白質佔目標的百分比等對照，交給呼叫端；這裡只給事實 */
}

export function averageNutrition(
  logs: { date: string; calories: number | null; protein_grams?: number | null; carbs_grams?: number | null; fat_grams?: number | null }[],
  today: string,
  windowDays = 7,
): NutritionAverage {
  const cutoff = Date.parse(today) - (windowDays - 1) * DAY_MS
  const inWindow = logs.filter(l => l.date && Date.parse(l.date.slice(0, 10)) >= cutoff)

  // 同一天多筆只留最後一筆 —— 重複紀錄會讓平均偏向記比較多次的那天
  const byDay = new Map<string, typeof inWindow[number]>()
  for (const l of inWindow) byDay.set(l.date.slice(0, 10), l)
  const rows = [...byDay.values()]

  const avg = (pick: (r: typeof rows[number]) => number | null | undefined) => {
    const vals = rows.map(pick).filter((v): v is number => v != null && Number.isFinite(v))
    return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null
  }

  return {
    windowDays,
    daysLogged: rows.length,
    calories: avg(r => r.calories),
    protein: avg(r => r.protein_grams),
    carbs: avg(r => r.carbs_grams),
    fat: avg(r => r.fat_grams),
  }
}
