/**
 * 用體重變化對帳飲食紀錄：「你記的」 vs 「你身體顯示的」。
 *
 * ⚠️ 為什麼要有這個（2026-08-16 Howard 自己講的）：
 *   「我都填達標，可是其實我都有多吃」「我都不太敢回報體重，或者說都虛報」
 * 連系統的設計者兼 CSCS 教練都會這樣，代表**所有學員都會**。
 * 「今天照目標吃・全部達標」那顆鈕是我做的，它把虛報的成本降到零。
 *
 * 解法不是叫人誠實，是讓誠實與否**不影響判斷**：體重會說話。
 * 兩邊對不上時不是抓誰說謊 —— 另一個同樣常見的解釋是**熱量設定本身錯了**
 * （張承鈞：處方 2285 > 她的 TDEE 1837，她照吃反而變胖）。
 *
 * 這是估算。刻意設得保守（門檻高、資料不足回 null），寧可不說話也不要冤枉人。
 */

/** 1 kg 體重變化的熱量當量。增重期組織是脂肪+瘦體+水分混合，7700（純脂肪）會偏保守，
 *  方向與量級足夠做決策。見 nutrition-engine 的動態能量密度註解。 */
const KCAL_PER_KG = 7700

const MIN_WEIGHT_POINTS = 8
const MIN_SPAN_DAYS = 10
const MIN_NUTRITION_LOGS = 5
/** 差多少才開口。300 kcal 以內是估算誤差 + 日常波動，不值得講 */
const MIN_GAP_KCAL = 300

/** 各目標的「照計畫走」時該有的體重速率（kg/週）。用來把目標熱量換算成基準。 */
const EXPECTED_RATE: Record<string, number> = {
  bulk: 0.20,
  cut: -0.50,
  recomp: 0,
}

export type IntakeReconciliation = {
  /** 體重變化推算的每日實際攝取（kcal） */
  impliedDaily: number
  /** 飲食紀錄的每日平均（kcal） */
  loggedDaily: number
  /** implied − logged；>0 = 實際吃得比記的多 */
  gap: number
  /** 近期體重斜率（kg/週） */
  slopePerWeek: number
  /** 這個目標下「照計畫走」該有的斜率（kg/週） */
  expectedRatePerWeek: number
  /** 教練設定的目標熱量（拿來跟 impliedDaily 比，判斷是「處方錯」還是「執行偏離」） */
  targetCalories: number
  weightPoints: number
  nutritionLogs: number
}

type WeightRow = { date: string; weight: number | null }
type NutritionRow = { date: string; calories: number | null }

const DAY = 86400000

function slopePerDay(points: { x: number; y: number }[]): number | null {
  const n = points.length
  if (n < 2) return null
  let sx = 0, sy = 0, sxy = 0, sxx = 0
  for (const p of points) { sx += p.x; sy += p.y; sxy += p.x * p.y; sxx += p.x * p.x }
  const denom = n * sxx - sx * sx
  if (denom === 0) return null
  return (n * sxy - sx * sy) / denom
}

/**
 * 反推邏輯：目標熱量對應「該有的體重速率」；實際速率偏離多少，就換算成多吃/少吃多少。
 *
 *   impliedDaily = targetCalories + (實際速率 − 該有速率) × 7700 / 7
 *
 * 這樣不需要另外估 TDEE —— 教練設的目標熱量已經隱含了它。
 *
 * @param targetCalories 學員的每日目標熱量（clients.calories_target）
 * @param goalType       cut / bulk / recomp
 */
export function reconcileIntake(
  weights: WeightRow[],
  nutrition: NutritionRow[],
  targetCalories: number,
  goalType: string | null,
  windowDays = 21,
): IntakeReconciliation | null {
  if (!Number.isFinite(targetCalories) || targetCalories <= 0) return null

  const valid = weights
    .filter(w => w.weight != null)
    .map(w => ({ date: w.date, value: w.weight as number }))
    .sort((a, b) => a.date.localeCompare(b.date))
  if (valid.length < MIN_WEIGHT_POINTS) return null

  const lastMs = new Date(valid[valid.length - 1].date + 'T00:00:00').getTime()
  const recent = valid.filter(v => new Date(v.date + 'T00:00:00').getTime() >= lastMs - windowDays * DAY)
  if (recent.length < MIN_WEIGHT_POINTS) return null

  const firstMs = new Date(recent[0].date + 'T00:00:00').getTime()
  if ((lastMs - firstMs) / DAY < MIN_SPAN_DAYS) return null

  const slope = slopePerDay(recent.map(v => ({
    x: (new Date(v.date + 'T00:00:00').getTime() - firstMs) / DAY,
    y: v.value,
  })))
  if (slope == null) return null

  const logs = nutrition
    .filter(n => n.calories != null && n.calories > 0)
    .filter(n => {
      const t = new Date(n.date + 'T00:00:00').getTime()
      return t >= firstMs && t <= lastMs
    })
  if (logs.length < MIN_NUTRITION_LOGS) return null

  const expectedRatePerWeek = EXPECTED_RATE[goalType ?? ''] ?? 0
  const rateGapPerWeek = slope * 7 - expectedRatePerWeek
  const loggedDaily = Math.round(logs.reduce((a, n) => a + (n.calories as number), 0) / logs.length)
  const impliedDaily = Math.round(targetCalories + rateGapPerWeek * KCAL_PER_KG / 7)

  return {
    impliedDaily,
    loggedDaily,
    gap: impliedDaily - loggedDaily,
    slopePerWeek: slope * 7,
    expectedRatePerWeek,
    targetCalories,
    weightPoints: recent.length,
    nutritionLogs: logs.length,
  }
}


/**
 * ⭐ 只靠體重估「實際每日攝取」—— **完全不需要飲食紀錄**。
 *
 * 2026-08-19 Howard：「這個模式真的偏難誒」。他說對了，而且數據站在他那邊：
 * 近 21 天全部學員加起來，飲食記錄天數只有體重的 57%；Sean 體重 48% 但飲食 10%；
 * 連 Howard 自己（CSCS 教練＋系統作者）的 67% 都是按「達標」鈕填出來的假數字。
 *
 * **如果一個迴圈需要連設計者都做不到的行為，壞的是迴圈不是人。**
 *
 * 關鍵是：`impliedDaily` 的公式本來就只用到體重 ——
 *   目標熱量對應「該有的速率」，實際速率偏離多少就換算成多吃/少吃多少。
 * 飲食紀錄只在「跟紀錄對帳」時才需要（reconcileIntake），
 * 而**判斷該調處方還是該修執行，用這支就夠了**。
 *
 * 沒有這支的話，不記飲食的人會落到 `prescriptionVerdict` 的「資料不足 → 照原邏輯」
 * 分支，引擎照樣砍他們的處方 —— 而那正是絕大多數學員。
 */
export function estimateActualIntake(
  weights: WeightRow[],
  targetCalories: number,
  goalType: string | null,
  windowDays = 21,
  /**
   * 這個日期之前的體重一律不算（YYYY-MM-DD）。
   *
   * ⚠️ 給碳水回補期用（見 CARB_REPLETION_DAYS）。只是「回補期間不下判斷」不夠 ——
   * 窗過了之後，那幾天的體重**還留在回歸裡**，會把後面真實的下降斜率一路拉平。
   * 震宣實測：含回補期 +0.016 kg/週（看起來完全卡住）；扣掉前 14 天 −0.535（正中目標）。
   * 同一組資料，差別只在有沒有把被水蓋住的那幾天丟掉。
   */
  excludeBefore?: string | null,
): { impliedDaily: number; slopePerWeek: number; expectedRatePerWeek: number; weightPoints: number } | null {
  if (!Number.isFinite(targetCalories) || targetCalories <= 0) return null

  const valid = weights
    .filter(w => w.weight != null)
    .filter(w => !excludeBefore || w.date.slice(0, 10) >= excludeBefore)
    .map(w => ({ date: w.date, value: w.weight as number }))
    .sort((a, b) => a.date.localeCompare(b.date))
  if (valid.length < MIN_WEIGHT_POINTS) return null

  const lastMs = new Date(valid[valid.length - 1].date + 'T00:00:00').getTime()
  const recent = valid.filter(v => new Date(v.date + 'T00:00:00').getTime() >= lastMs - windowDays * DAY)
  if (recent.length < MIN_WEIGHT_POINTS) return null

  const firstMs = new Date(recent[0].date + 'T00:00:00').getTime()
  if ((lastMs - firstMs) / DAY < MIN_SPAN_DAYS) return null

  const slope = slopePerDay(recent.map(v => ({
    x: (new Date(v.date + 'T00:00:00').getTime() - firstMs) / DAY,
    y: v.value,
  })))
  if (slope == null) return null

  const expectedRatePerWeek = EXPECTED_RATE[goalType ?? ''] ?? 0
  const rateGapPerWeek = slope * 7 - expectedRatePerWeek
  return {
    impliedDaily: Math.round(targetCalories + rateGapPerWeek * KCAL_PER_KG / 7),
    slopePerWeek: slope * 7,
    expectedRatePerWeek,
    weightPoints: recent.length,
  }
}

export function isGapSignificant(r: IntakeReconciliation | null): boolean {
  return !!r && Math.abs(r.gap) >= MIN_GAP_KCAL
}

/**
 * 給人看的一句話。**刻意不指控** —— 講的是「兩個數字對不起來」，
 * 因為「紀錄漏了」和「目標設錯了」一樣可能，而且處理方式完全相反。
 */
export function reconciliationMessage(r: IntakeReconciliation): string {
  const { gap, impliedDaily, loggedDaily } = r
  if (gap > 0) {
    return `紀錄平均 ${loggedDaily} kcal，但體重變化推算實際約 ${impliedDaily} kcal（多 ${gap}）。` +
      `體重是最誠實的那個數字 —— 要嘛紀錄漏了什麼，要嘛目標本身該往下調。兩個都好處理，講一聲就行。`
  }
  return `紀錄平均 ${loggedDaily} kcal，但體重變化推算實際約 ${impliedDaily} kcal（少 ${Math.abs(gap)}）。` +
    `可能是吃得比記的少，或消耗比估的高 —— 先別再往下減，跟教練確認一次。`
}

/**
 * 實際攝取與處方差多少就算「執行偏離」。
 * ⚠️ 一開始設 300，被 William 的案例打臉：他 implied 2930 / 處方 3150（差 220），
 * 落在容差內被判成「處方要調」—— 但他體重 19 天完全不動，原因正是那少吃的 220
 * 剛好抵掉 bulk 的 surplus。**他只要真的吃到 3150 就會開始長，處方是對的。**
 * 門檻改 200：只要兩邊有可觀落差（不論方向），問題就在執行，別動處方。
 */
const EXECUTION_GAP_KCAL = 200

/**
 * 體重偏離目標時，該動「處方」還是該修「執行」？
 *
 * ⚠️ 2026-08-16 血淋淋的教訓（Howard：「在明知我亂吃的情況下，你怎麼會幫我調降成這樣？」）：
 *
 * 引擎只看體重。體重漲太快時，它唯一算得出來的解釋是「處方給太高」，於是往下砍。
 * 但那個推論**預設了學員照處方吃**。Howard 的處方是 3000、體重反推實際約 3456 ——
 * 真正的原因是執行超出處方，不是處方錯。
 *
 * 兩種情況的處理方式完全相反：
 *   · 處方太高（照吃還是漲）→ 砍處方 ✅
 *   · 執行超出（沒照吃）    → 修執行，**處方不動** ✅
 *
 * 砍錯邊的代價：他照樣吃 3456，落差從 456 變成 826，數字更難看但行為沒變；
 * 而萬一他真的照新處方吃，等於一次砍掉 826 kcal，太陡。
 */
/**
 * 碳水往上調之後，體重不會馬上掉 —— 這是生理，不是執行問題。
 *
 * ## Howard 2026-09-19 的臨床通則（不是震宣個案）
 *
 *   「之前他們基本上都是亂砍碳水、不計算脂肪，導致身體卡在減不下來的狀態才來找我們。
 *    我們一開始絕對會先讓他們把碳水吃回來，但脂肪一定會調得比原本低。
 *    在這種情況下體重不掉，我後來覺得是正常的。」
 *
 * 機轉：每 1g 肝醣結合約 3g 水。碳水從「亂砍」拉回正常，肝醣重新填滿，
 * 體重會**一次性往上一階**（實務上 1–2 kg），把真正的脂肪流失蓋掉好幾週。
 *
 * ## 實際數字（震宣，碳水 8/25 從 156 → 224，+68g/天）
 *
 *   含回補窗（8/26 起 21 筆）：斜率 **+0.016** kg/週 → 看起來完全卡住
 *   扣掉前 10 天（11 筆）：    **−0.003** kg/週 → 還在階梯上
 *   扣掉前 14 天（9 筆）：     **−0.535** kg/週 ← 幾乎正中目標 −0.50
 *
 * 不扣的話，引擎會判他「執行落差 542 kcal」並把那句話印在他首頁上 ——
 * 而他飲食記 25/28 天、在超商買東西還拍熱量給教練看。**系統在冤枉一個做對的人。**
 *
 * ⚠️ 14 天是取自上面這組數字（10 天還在階梯上、14 天訊號才出來），
 * 不是文獻常數。樣本只有一個人，之後有更多案例要回頭校。
 */
export const CARB_REPLETION_DAYS = 14
/** 碳水一天多這麼多克才算「往上調」，小幅微調不觸發 */
export const CARB_INCREASE_G = 30

export type MacroLogRow = {
  applied_at: string
  old_macros: Record<string, unknown> | null
  new_macros: Record<string, unknown> | null
}

/**
 * 最近一次「碳水被往上調」的日期。沒有就回 null。
 * 用來把回補期那幾天從體重趨勢裡排除（見 CARB_REPLETION_DAYS）。
 */
export function lastCarbIncreaseDate(log: MacroLogRow[]): string | null {
  const num = (v: unknown) => { const n = typeof v === 'number' ? v : parseFloat(String(v)); return Number.isFinite(n) ? n : null }
  const hits = (log ?? [])
    .filter(m => {
      const oldC = num(m.old_macros?.carbs_target)
      const newC = num(m.new_macros?.carbs_target)
      return oldC != null && newC != null && newC - oldC >= CARB_INCREASE_G
    })
    .map(m => m.applied_at.slice(0, 10))
    .sort()
  return hits.length ? hits[hits.length - 1] : null
}

/** 這個日期還在碳水回補窗內嗎（體重趨勢此時不可信） */
export function inCarbRepletionWindow(carbIncreaseDate: string | null, today: string): boolean {
  if (!carbIncreaseDate) return false
  const days = (Date.parse(today) - Date.parse(carbIncreaseDate)) / DAY
  return days >= 0 && days < CARB_REPLETION_DAYS
}

/**
 * 回補期結束的那一天（含）。這之前的體重都被水蓋住，算趨勢時要丟掉。
 * 沒有碳水調整就回 null（不排除任何東西）。
 */
export function carbRepletionCutoff(carbIncreaseDate: string | null): string | null {
  if (!carbIncreaseDate) return null
  return new Date(Date.parse(carbIncreaseDate) + CARB_REPLETION_DAYS * DAY).toISOString().slice(0, 10)
}

export type VerdictCause =
  /** 他自己記的熱量就超過處方 —— 有獨立證據，可以斷定 */
  | 'execution'
  /** 體重沒跟上，但他記的跟處方對得上 —— **分不出來是紀錄漏了還是處方開太高** */
  | 'undetermined'
  /** 記錄與體重都顯示吃不到處方 */
  | 'under-eating'
  /** 吃的對上了、體重仍偏離 → 處方本身要調 */
  | 'prescription'
  /** 碳水剛往上調，肝醣＋水回補中 —— 體重趨勢此時不能用來判斷任何事 */
  | 'carb-repletion'
  | 'insufficient-data'

/**
 * 該調處方，還是該先處理執行？
 *
 * ## ⚠️ 2026-09-19 重大更正：這支以前會講它不知道的事
 *
 * `impliedDaily = targetCalories + (實際斜率 − EXPECTED_RATE) × 7700/7`，
 * 而 `EXPECTED_RATE` 是**寫死的常數**（cut = −0.5 kg/週），對所有減脂學員都一樣。
 * 所以 `impliedDaily − targetCalories` 在數學上**就等於**「沒掉到預期速度的差額」，
 * 跟「他吃了多少」沒有任何關係。
 *
 * 但舊版拿它斷定「這是執行超出處方，不是處方太高」—— 那是循環論證：
 * 前提（處方是對的、照吃就會掉 0.5）本身就是結論。
 *
 * **實際撞到的案例（震宣，2026-09-19）**：他飲食記 25/28 天、平均 2075（處方 2070）、
 * 而且在超商買東西會拍熱量給 Howard 看。系統卻判他「實際吃 2612，多 542」。
 * Howard：「他有拍給我看耶，就是這麼的自律啊！」——系統在冤枉一個做對的人，
 * 而那句話還印在學員自己的首頁上。
 *
 * 同一個檔案裡的 `reconciliationMessage` 早就寫對了：
 * 「**刻意不指控** —— 因為『紀錄漏了』和『目標設錯了』一樣可能，而且處理方式完全相反」。
 * 兩個函式立場相反，上線的卻是斷定的那個。
 *
 * ## 改法：要斷定執行落差，必須有**獨立證據**
 *
 * 唯一的獨立證據是他自己記的熱量。`loggedDaily > 處方` 才叫執行超出 —— 那是他自己寫的。
 * 記的跟處方對得上、體重卻沒動 → **`undetermined`**：一樣不自動砍（保留 2026-08-16
 * 那條教訓：對亂吃的人砍處方只會讓落差更大），但**不再指控**，改成交給教練看一眼。
 * 那也正是張承鈞案例需要的（處方 2285 > 她的 TDEE 1837，照吃反而變胖 —— 那要砍處方）。
 *
 * @param loggedDaily 同期飲食紀錄的每日平均熱量；沒有就傳 null
 */
export function prescriptionVerdict(
  /**
   * `reconcileIntake()` 的輸出可以直接餵進來 —— 它本來就帶 `loggedDaily`，
   * 這支會自己讀。⚠️ 沒有這個，呼叫端就得把同一個數字再傳一次，而那是一定會忘的
   * （2026-09-19 自己的測試第一時間就忘了）。只用體重的 `estimateActualIntake`
   * 沒有 loggedDaily，那種情況才需要第二個參數。
   */
  r: { impliedDaily: number; targetCalories: number; loggedDaily?: number } | null,
  loggedDaily?: number | null,
  /** 還在碳水回補窗內嗎（見 inCarbRepletionWindow）。是的話體重趨勢不可信，一律不判。 */
  carbRepletion?: boolean,
): { adjustPrescription: boolean; reason: string; cause: VerdictCause } {
  // ⚠️ 回補窗要**排在資料不足前面**檢查。
  // 窗內的時候 carbRepletionCutoff 會落在未來 → 體重全被排除 → r 變 null，
  // 於是會先撞到「資料不足 → 照原邏輯」而讓引擎照樣去砍處方 ——
  // 那正好是這整段要防的事。「現在在回補期」本身就是有效結論，不需要體重資料。
  if (carbRepletion) {
    return {
      adjustPrescription: false,
      cause: 'carb-repletion',
      reason: `碳水剛往上調，肝醣和水分正在回補（約 ${CARB_REPLETION_DAYS} 天）—— `
        + `這段期間體重不掉是預期內的，不代表執行或處方有問題。先等趨勢出來再判。`,
    }
  }

  if (!r) return { adjustPrescription: true, reason: '資料不足以判斷執行落差，照原邏輯處理', cause: 'insufficient-data' }

  const rateGapKcal = r.impliedDaily - r.targetCalories
  const logged = loggedDaily ?? r.loggedDaily ?? null
  const hasLog = logged != null && Number.isFinite(logged) && logged > 0

  if (rateGapKcal > EXECUTION_GAP_KCAL) {
    // 他自己記的就超過處方 → 有獨立證據，可以斷定
    if (hasLog && (logged as number) - r.targetCalories > EXECUTION_GAP_KCAL) {
      return {
        adjustPrescription: false,
        cause: 'execution',
        reason: `他自己記的平均 ${logged} kcal 就比處方 ${r.targetCalories} 高 ${Math.round((logged as number) - r.targetCalories)}，` +
          `體重也沒跟上 —— 這是執行超出處方。先讓實際吃的對上處方，砍處方只會讓落差更大。`,
      }
    }
    // 記的跟處方對得上（或根本沒記）→ 分不出來，不猜
    return {
      adjustPrescription: false,
      cause: 'undetermined',
      reason: hasLog
        ? `體重每週少掉約 ${(rateGapKcal * 7 / KCAL_PER_KG).toFixed(2)} kg，但他記的平均 ${logged} kcal 跟處方 ${r.targetCalories} 對得上。`
          + `可能是紀錄漏了，也可能是處方本身開在他的維持熱量上 —— 兩者處理方式相反，先不自動調，請教練看一眼。`
        : `體重每週少掉約 ${(rateGapKcal * 7 / KCAL_PER_KG).toFixed(2)} kg，但沒有飲食紀錄可以對帳。`
          + `分不出是吃超過還是處方開太高，先不自動調。`,
    }
  }

  if (rateGapKcal < -EXECUTION_GAP_KCAL) {
    return {
      adjustPrescription: false,
      cause: 'under-eating',
      reason: `體重掉得比預期快約 ${(-rateGapKcal * 7 / KCAL_PER_KG).toFixed(2)} kg/週 —— ` +
        `多半是沒吃到處方。調處方數字沒有意義，要處理的是為什麼吃不到。`,
    }
  }

  return {
    adjustPrescription: true,
    cause: 'prescription',
    reason: `體重變化與處方(${r.targetCalories})預期相符，但仍偏離目標 → 處方本身要調`,
  }
}
