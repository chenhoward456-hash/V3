/**
 * 每週教練監督 — 草擬引擎（撐月費的核心，見 docs/WEEKLY_COACHING_LOOP.md）
 *
 * 把 Howard 的教練判斷編碼：吃一位學員近期數據 → 草擬「本週該調什麼 + 為什麼 + 給學員的話」。
 * 核心規則：先偵測資料量自動切兩模式——
 *   adjust（資料夠）：數據驅動的教練調整（陳胤豪案例）
 *   accountability（資料不足/斷記錄）：不假裝，翻成召回 + 標記教練介入（謝佳峻案例）
 *
 * 純函式、可測。Howard 在核准佇列改的東西 = 未來要回頭修這裡的判斷。
 */

// 增肌速率門檻的唯一真相在 nutrition-engine（紅線 6：共用常數別各定各的）。
// 兩支引擎對「什麼叫停滯」必須講同一套話，否則學員在儀表板和週訊會收到互相矛盾的判定。
import { lastCarbIncreaseDate, carbRepletionCutoff, inCarbRepletionWindow, type MacroLogRow } from './implied-intake'
import { BULK_TARGETS } from './nutrition-engine'
// 課表健檢／組數判讀共用同一套 —— 後台說「肩後束 0 組」、週訊就不能說沒事
import { checkPlanHealth, summarizePlanHealth } from './plan-health'
import { actualVolume, findGaps } from './volume-audit'

/**
 * 蛋白質下限 —— **全系統唯一真相**（紅線 6：共用常數別各定各的）。
 * lib/macro-audit.ts 的稽核也 import 這裡，否則週訊說「夠用」、稽核說「太低」，
 * 教練會收到兩套互相矛盾的判定。
 *
 * 出處與「為什麼分母是淨體重」的完整說明見下方蛋白判定區塊的註解。
 */
/**
 * 脂肪佔總熱量的下限（%）。低於這個會壓荷爾蒙（低脂壓睪固酮，Whittaker 2021）。
 * ⚠️ 這是**地板不是目標** —— 高於它不代表配比就對了，上限看教練的 fat_target。
 */
export const FAT_FLOOR_PCT = 20

export const BULK_FLOOR_PER_KG_BW = 1.6

/**
 * 要有幾天記了「做哪些動作」，才敢用組數跟學員講話。
 * ⚠️ 2026-09-23 的 production 覆蓋率：林宥任 60%（9/15 天）、其餘三人 0%。
 *    低於這個門檻只能說「我看不到你練了什麼」，不能說「你某某部位沒練」。
 */
export const SET_LOG_MIN_DAYS = 4

/**
 * 動作模式覆蓋低到幾種才值得提。
 * ⚠️ 健美分化課表天生缺「單腳／負重行走」（那是運動表現的檢查點），
 *    6/8 是常態。設 8 會讓每個健美學員每週都收到假警報。
 */
export const PATTERN_COVERAGE_ALERT = 5
export const CUT_FLOOR_PER_KG_LBM = 2.3
export const CUT_FLOOR_PER_KG_BW_PROXY = 1.8

export type WeeklyCoachingClient = {
  name: string
  goal_type?: string | null
  prep_phase?: string | null
  competition_date?: string | null
  competition_enabled?: boolean | null
  target_weight?: number | string | null
  calories_target?: number | string | null
  protein_target?: number | string | null
  fat_target?: number | string | null
}

export type WCInput = {
  client: WeeklyCoachingClient
  // body_fat 選填：有量到才算得出淨體重，減脂蛋白下限要用它當分母（見蛋白判定區塊）
  weights: { date: string; weight: number | string | null; body_fat?: number | string | null }[]
  nutrition: { date: string; compliant?: boolean | null; calories?: number | string | null; protein_grams?: number | string | null; fat_grams?: number | string | null }[]
  training: { date: string; training_type: string | null }[]
  /**
   * 實際做的組數（training_sets，一筆＝一組）。選填。
   * ⚠️ 2026-09-23 查 production：四個活躍學員裡三個的覆蓋率是 **0%**
   *    （林宥任 60%）。所以用它之前一定要先看有幾天有記錄——
   *    分不出「沒做」和「沒記」的時候，講「你少做了 X 組」會冤枉人。
   */
  trainingSets?: { date: string; exercise_name: string | null }[]
  /** 教練寫的課表。用來做課表健檢——這個**不依賴學員記錄**，資料一定完整。 */
  trainingPlan?: unknown
  wellness: { date: string; energy_level?: number | null }[]
  labs: { test_name: string; value: number | string | null; status?: string | null; date?: string | null }[]
  /**
   * macro 變更紀錄。用來偵測碳水回補期 —— 碳水被往上調之後，肝醣＋水回補會把
   * 真實的脂肪流失蓋掉約兩週，那段的體重趨勢不能拿來跟學員講「你持平」。
   * 見 lib/implied-intake.ts 的 CARB_REPLETION_DAYS。沒傳就等於沒有這個資訊。
   */
  macroLog?: MacroLogRow[]
  now: string // YYYY-MM-DD（台灣日）
}

export type WeeklyCoachingDraft = {
  mode: 'adjust' | 'accountability'
  dataDays: number
  headline: string
  bullets: string[]        // 「本週數據怎麼說」
  adjustments: string[]    // 建議調整
  studentMessage: string   // 要發給學員的人話訊息
  needsCoachReview: boolean
  flags: string[]          // 給教練的旗標（新血檢/快流失…）
}

function num(v: number | string | null | undefined): number | null {
  if (v == null) return null
  const n = typeof v === 'number' ? v : parseFloat(v)
  return Number.isFinite(n) ? n : null
}
function daysAgo(now: string, d: string): number {
  return Math.round((Date.parse(now) - Date.parse(d)) / 86_400_000)
}
function avg(xs: number[]): number | null {
  const v = xs.filter(x => Number.isFinite(x))
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null
}

/**
 * 週體重變化速率（kg/週），用**最小平方回歸斜率**而非頭尾兩點。
 *
 * 為什麼：體重每天上下震盪 0.2-0.5kg（水分/肝醣/腸道內容物）。頭尾兩點估計等於把
 * 全部權重壓在剛好最吵的那兩天上，正負號可能整個翻掉。
 * 實例（William 真實資料，14 天 10 筆）：頭尾估 -0.075 kg/週「在掉」，
 * 回歸斜率 +0.089 kg/週「在漲」——同一組數字，相反結論。
 * 這條路徑對減脂學員一樣在用，所以兩邊都受惠。
 *
 * 回傳 null 代表點數不足（<3）或日期全同一天（分母為 0）。
 */
export function weeklyWeightSlope(points: { d: string; v: number }[]): number | null {
  if (points.length < 3) return null
  const t0 = Date.parse(points[0].d)
  const xs = points.map(p => (Date.parse(p.d) - t0) / 86_400_000) // 天
  const ys = points.map(p => p.v)
  const n = xs.length
  const mx = xs.reduce((a, b) => a + b, 0) / n
  const my = ys.reduce((a, b) => a + b, 0) / n
  let numr = 0, den = 0
  for (let i = 0; i < n; i++) { numr += (xs[i] - mx) * (ys[i] - my); den += (xs[i] - mx) ** 2 }
  if (den === 0) return null
  return (numr / den) * 7 // kg/週
}

export function computeWeeklyCoachingDraft(input: WCInput): WeeklyCoachingDraft {
  const { client, now } = input
  const name = client.name
  const recent = <T extends { date: string }>(arr: T[], days: number) => (arr || []).filter(x => x.date && daysAgo(now, x.date) <= days && daysAgo(now, x.date) >= 0)

  const w14 = recent(input.weights, 14)
  const n14 = recent(input.nutrition, 14)
  const t14 = recent(input.training, 14)
  // 近 14 天有記錄的「不同日子」數（任一類型）
  const loggedDays = new Set<string>([...w14, ...n14, ...t14, ...recent(input.wellness, 14)].map(x => x.date))
  const dataDays = loggedDays.size
  const lastWeight = [...input.weights].filter(x => num(x.weight) != null).sort((a, b) => b.date.localeCompare(a.date))[0]
  const daysSinceWeight = lastWeight ? daysAgo(now, lastWeight.date) : 999

  const flags: string[] = []
  // 新血檢（近 14 天）→ 一律標記教練看
  const newLab = (input.labs || []).find(l => l.date && daysAgo(now, l.date) <= 14 && daysAgo(now, l.date) >= 0)
  if (newLab) flags.push('近期有新血檢，需教練判讀定方向')

  // ── 模式判定：資料不足 / 斷記錄 → 問責模式 ──
  if (dataDays < 4 || daysSinceWeight > 6) {
    flags.unshift('資料不足/斷記錄 → 需教練親自介入，勿自動發')
    const gapMsg = daysSinceWeight > 6 && lastWeight ? `你已經 ${daysSinceWeight} 天沒記體重了。` : '你最近幾乎沒記錄。'
    return {
      mode: 'accountability',
      dataDays,
      headline: `資料不足（近 14 天僅 ${dataDays} 天有記錄）→ 問責召回`,
      bullets: [
        `近 14 天只有 ${dataDays} 天有任何記錄${lastWeight ? `，最後一次量體重在 ${daysSinceWeight} 天前` : ''}。`,
        '資料不夠，做數據調整會是猜的 → 不假裝、不亂調。',
        newLab ? '有新血檢可作為硬數據參考。' : '沒有近期硬數據可依。',
      ],
      adjustments: ['先不調整 macro/訓練（資料不足）', '目標：把學員拉回來記錄第一筆'],
      studentMessage: `${name}，${gapMsg}\n沒有你的數據，我看不到你、也沒辦法幫你調整。\n今天先花 10 秒記一筆體重，我才接得上。卡住的話直接回我。`,
      needsCoachReview: true,
      flags,
    }
  }

  // ── 調整模式（資料夠）──
  const bullets: string[] = []
  // ⭐ 保證會出現在學員訊息裡的話（bullets 會被 slice(0,3) 截掉，這個不會）。
  const studentExtra: string[] = []
  const adjustments: string[] = []
  const msgLines: string[] = []
  let needsReview = false
  // 引擎是否**做出過**「在軌道上」的正面判定（而不是單純沒命中任何分支）。
  // 只有真的判定過，才有資格對學員說「照走」；否則要誠實承認看不出來。
  let onTrackVerdict = false

  // 熱量先算好：增肌的「該加多少」由熱量對帳算出具體 kcal，體重速率分支只負責診斷，
  // 兩邊不要各喊一次「加熱量」（之前會產生兩條重複建議）。
  const cTarget = num(client.calories_target)
  const cAvg = avg(n14.map(x => num(x.calories)!).filter(v => v != null))
  const hasConcreteCalorieAction = cTarget != null && cAvg != null

  // 1) 體重趨勢（近 14 天最小平方回歸斜率，見 weeklyWeightSlope 的說明）
  const allWs = w14.map(x => ({ d: x.date, v: num(x.weight)! })).filter(x => x.v != null).sort((a, b) => a.d.localeCompare(b.d))

  // ⚠️ 2026-09-19：碳水回補期的體重要丟掉，否則會跟學員講一件假的事。
  // Howard 的臨床通則：「他們來之前都亂砍碳水、不算脂肪，我們第一件事一定是把碳水
  // 吃回來、脂肪調低 —— 這種情況下體重不掉是正常的。」每 1g 肝醣綁約 3g 水。
  // 震宣實測（碳水 8/25 156→224）：含回補期斜率 +0.02（草稿寫「持平」＝暗示他卡住），
  // 扣掉前 14 天是 −0.54（正中目標）。**他一直在掉，只是被水蓋住。**
  const carbIncrease = lastCarbIncreaseDate(input.macroLog ?? [])
  const repletionCutoff = carbRepletionCutoff(carbIncrease)
  const inRepletion = inCarbRepletionWindow(carbIncrease, now)
  const ws = repletionCutoff ? allWs.filter(x => x.d.slice(0, 10) >= repletionCutoff) : allWs

  if (inRepletion) {
    // 窗內：沒有可信的趨勢可講，直接講原因，不要下「持平/卡住」的結論
    bullets.push(`⚖️ 碳水剛往上調，肝醣和水分回補中 —— 這兩週體重不掉是預期內的，先不看趨勢`)
  }

  let weightNote = ''
  const slope = weeklyWeightSlope(ws)
  if (!inRepletion && ws.length >= 3 && slope != null) {
    const first = ws[0], last = ws[ws.length - 1]
    const perWeek = slope
    // 門檻用 0.05kg/週：0.09kg/週 說「持平」會跟下一行的「有在漲」自相矛盾
    const dir = perWeek < -0.05 ? '下降' : perWeek > 0.05 ? '上升' : '持平'
    const repletionNote = repletionCutoff && allWs.length > ws.length
      ? `（已扣掉碳水回補的前 ${allWs.length - ws.length} 筆）` : ''
    weightNote = `體重 ${first.v}→${last.v}（趨勢約 ${perWeek >= 0 ? '+' : ''}${perWeek.toFixed(2)}kg/週，${dir}）${repletionNote}`
    bullets.push(`⚖️ ${weightNote}`)

    // 備賽/減脂：對照目標速率
    const tw = num(client.target_weight)
    const isCut = client.goal_type === 'cut' || client.prep_phase === 'cut'
    const isBulk = client.goal_type === 'bulk' && !isCut

    // ── 增肌：週增重速率對帳 ──────────────────────────────
    // 原本整支引擎沒有任何 bulk 分支：增肌學員的體重只被「念出來」，不被判讀。
    // 後果是 hard-gainer 停滯三週，週訊照樣說「維持現況，數據都在合理區」——用權威語氣講反話。
    // 速率常數 import 自 nutrition-engine 的 BULK_TARGETS（唯一真相，別在這裡另開一組）。
    if (isBulk) {
      const ratePct = (perWeek / last.v) * 100 // % 體重/週
      const rateStr = `${ratePct >= 0 ? '+' : ''}${ratePct.toFixed(2)}%/週`
      const belowTarget = tw != null && last.v < tw
      const gapNote = belowTarget ? `，距目標 ${tw}kg 還差 ${(tw - last.v).toFixed(1)}kg` : ''

      // 速率門檻沿用 nutrition-engine 的 BULK_TARGETS（停滯 0.1 / 理想 0.25-0.5 / 太快 >0.5 %BW/週）。
      // ⚖️ 立場而非共識：這組數字來自 Iraki 2019 敘述性回顧＋教練慣例（PMID 31247944），
      // 不是 RCT 推導。方向可信（Garthe 2013 PMID 23679146：~0.4%/週已看到脂肪暴增而淨體重沒多長），
      // 但精確分界別當定律。加熱量的幅度不寫死 kcal，改由「熱量現實對帳」用實測維持熱量算 +10%。
      // 這裡只下診斷；「該加多少熱量」交給下面的熱量對帳算具體數字，避免兩條重複建議。
      const needMoreFood = ratePct < BULK_TARGETS.IDEAL_MIN
      if (ratePct > BULK_TARGETS.MAX_RATE) {
        adjustments.push('增太快 → 收一點盈餘，別把增重變增脂（多出來的多半是脂肪，不是肌肉）')
        bullets.push(`📈 增重 ${rateStr}，超過 ${BULK_TARGETS.MAX_RATE}%/週上限 → 脂肪堆積風險`)
        needsReview = true
      } else if (ratePct < 0) {
        bullets.push(`📉 增肌期體重反而在掉（${rateStr}）${gapNote} → 盈餘不足`)
        needsReview = true
      } else if (ratePct < BULK_TARGETS.MIN_RATE) {
        bullets.push(`⚠️ 增重停滯：${rateStr}，低於 ${BULK_TARGETS.MIN_RATE}%/週${gapNote} → 該加熱量`)
      } else if (ratePct < BULK_TARGETS.IDEAL_MIN) {
        // 在漲、但慢於理想（0.25%/週）。這是 William 的真實處境——不是「方向反了」，是「太慢」。
        // 舊 code 用頭尾兩點估，會把這種情況誤判成「在掉」，見 weeklyWeightSlope 的說明。
        bullets.push(`📈 增重 ${rateStr}${gapNote} → 有在漲，但慢於理想的 ${BULK_TARGETS.IDEAL_MIN}%/週`)
      } else if (ratePct <= BULK_TARGETS.IDEAL_MAX) {
        bullets.push(`📈 增重 ${rateStr}${gapNote} → 速率理想，照走`)
        onTrackVerdict = true // 判定過：速率在理想帶
      }

      // 沒有飲食記錄就算不出「加多少」→ 至少要給方向，不能因為缺資料就沉默
      if (needMoreFood && !hasConcreteCalorieAction) {
        adjustments.push(`增重速率低於 ${BULK_TARGETS.IDEAL_MIN}%/週 → 加熱量（缺飲食記錄，補記錄後才算得出加多少）`)
      }

      // 只在速率已達理想區間時才報 ETA。速率不理想時算 ETA 是假資訊——
      // 我們正打算叫他加熱量，那個「59 週」數字下週就作廢，還會白白打擊他。
      if (belowTarget && tw != null && ratePct >= BULK_TARGETS.IDEAL_MIN) {
        const kgPerWeek = (ratePct / 100) * last.v
        if (kgPerWeek > 0.01) {
          const weeks = Math.ceil((tw - last.v) / kgPerWeek)
          if (weeks <= 104) bullets.push(`🎯 照目前速率，約 ${weeks} 週到 ${tw}kg`)
        }
      }
    }

    // competition_enabled 明確為 false（已關備賽但日期沒清）就不做賽期對帳
    if (isCut && tw != null && client.competition_date && client.competition_enabled !== false) {
      const daysToComp = daysAgo(client.competition_date, now) // comp - now，賽在未來為正
      if (daysToComp <= 7) {
        // 賽期已過或剩不到一週：絕不用 0.5 週硬算出「-10kg/週」這種荒謬又危險的指令
        needsReview = true
        if (daysToComp < 0) {
          flags.unshift(`比賽日（${client.competition_date}）已過 ${-daysToComp} 天 → 需教練確認新階段/新目標`)
          bullets.push(`🎯 賽期已過，體重對帳暫停 → 等教練設定下一階段`)
        } else {
          flags.unshift(`距賽僅 ${daysToComp} 天 → Peak Week，需教練親自帶`)
          bullets.push(`🎯 距賽 ${daysToComp} 天 → Peak Week，交給教練手動帶`)
        }
      } else {
        const weeksLeft = daysToComp / 7 // 此分支必 >1，不需夾值
        const need = (last.v - tw) / weeksLeft // kg/week needed
        const weeksLabel = weeksLeft < 2 ? `${daysToComp} 天` : `~${weeksLeft.toFixed(0)} 週`
        if (need > 1.5) {
          // 需要的速率不健康（>1.5kg/週）→ 不寫進學員訊息，丟給教練重設
          needsReview = true
          flags.unshift(`距賽 ${daysToComp} 天卻需 -${need.toFixed(1)}kg/週才達標（不健康）→ 需教練重設目標或賽事`)
          bullets.push(`🎯 距賽 ${weeksLabel}、要 -${need.toFixed(1)}kg/週才到 ${tw}kg → 速率不合理，需教練介入`)
        } else if (need > 0) {
          if (perWeek > -0.1) { adjustments.push('體重沒在掉、但賽期逼近 → 製造赤字（降熱量或加有氧）'); bullets.push(`🎯 距賽 ${weeksLabel}、要 -${need.toFixed(1)}kg/週才到 ${tw}kg，目前沒掉 → 落後`) }
          else if (perWeek <= -need * 1.4) { adjustments.push('掉太快、有掉肌風險 → 略收赤字'); bullets.push(`🎯 掉得比需要的 ${need.toFixed(1)}kg/週 還快 → 太猛`) }
          else { bullets.push(`🎯 距賽 ${weeksLabel}、需 -${need.toFixed(1)}kg/週 → 進度上，別加速`); onTrackVerdict = true }
        } else {
          // need <= 0：已達標或低於目標體重——別靜默放生
          if (perWeek < -0.1) { adjustments.push('已達/低於目標體重卻還在掉 → 止跌、別再加赤字（保肌）'); bullets.push(`🎯 已到 ${tw}kg 目標仍掉 ${perWeek.toFixed(1)}kg/週 → 該止跌`) }
          else { bullets.push(`🎯 已達目標體重 ${tw}kg → 維持`); onTrackVerdict = true }
        }
      }
    } else if (isCut && tw == null && client.competition_date && client.competition_enabled !== false) {
      // 有賽期但沒填目標體重 → 無法做速率對帳，標記教練補齊（別無聲跳過）
      flags.push('有備賽日但缺目標體重，無法做速率對帳 → 建議補 target_weight')
    }
  } else {
    bullets.push('⚖️ 體重資料偏少，趨勢先觀察')
  }

  // 2) 蛋白攝取
  //
  // 判定基準＝「絕對 g/kg 下限」，不用「打到目標的 90%」。
  // 原因：沒有任何研究支持百分比門檻；實證錨點是絕對量。
  // 90% 門檻只在「目標本身訂得遠高於下限」時才安全：目標若剛好訂 1.6，90% 會掉到 1.44 → 低於門檻卻判達標。
  //
  // ⚠️ 2026-08-23 修正**分母**（Howard 質疑「Sean 2.2 g/kg 還不錯吧，要這麼嚴格？」——他是對的）：
  // 原本把減脂下限 2.3 套在**總體重**上。但這個數字的出處講的是**淨體重**：
  //   - Helms, Aragon & Fitschen 2014 JISSN（PMID 24092765）：2.3–3.1 g/kg **LBM**，
  //     且明講「越瘦、赤字越大取越高端」。
  //   - ISSN position stand（PMID 28642676）：一般族群 1.4–2.0 g/kg **體重**；
  //     低熱量狀態下的訓練者才引用上面那個 2.3–3.1 g/kg **FFM**。
  // 對 20% 體脂的人，2.3 g/kg LBM ≈ 1.84 g/kg 總體重 —— 舊門檻等於把每個人當成 0% 體脂，
  // 硬生生高了約 25%，把完全健康的攝取量誤標成「減脂掉肌風險」。
  // 實例：Sean 85.7kg 吃 185g，若體脂 20% → 2.7 g/kg LBM，穩穩在 Helms 區間中段，卻被判低於下限。
  //
  // 修法：有體脂就用淨體重當分母；沒體脂用 1.8 g/kg 總體重當替代（≈20% 體脂者的 2.3 g/kg LBM）。
  // 增肌側的 1.6 不動 —— Morton 2018 meta（49 RCT／1863 人，PMID 28698222）那個數字本來就是總體重。

  const pTarget = num(client.protein_target)
  const pAvg = avg(n14.map(x => num(x.protein_grams)!).filter(v => v != null))
  const bwForProtein = ws.length ? ws[ws.length - 1].v : null
  // 體脂不會天天量 → 取「最近一筆有量到的」，不要求跟體重同一天。
  // 範圍過濾擋掉打錯的值（3% 以下／60% 以上不是人類的體脂，多半是填錯欄位）。
  const latestBf = input.weights
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
    .reduce<number | null>((acc, r) => {
      const v = num(r.body_fat)
      return v != null && v > 3 && v < 60 ? v : acc
    }, null)
  const lbm = bwForProtein != null && latestBf != null ? bwForProtein * (1 - latestBf / 100) : null

  if (pTarget && pAvg != null) {
    const cutting = client.goal_type === 'cut' || client.prep_phase === 'cut'
    let floorG: number | null = null
    let basisStr = ''
    if (cutting) {
      if (lbm != null) {
        floorG = CUT_FLOOR_PER_KG_LBM * lbm
        basisStr = `${CUT_FLOOR_PER_KG_LBM} g/kg 淨體重`
      } else if (bwForProtein != null) {
        floorG = CUT_FLOOR_PER_KG_BW_PROXY * bwForProtein
        basisStr = `${CUT_FLOOR_PER_KG_BW_PROXY} g/kg 體重`
      }
    } else if (bwForProtein != null) {
      floorG = BULK_FLOOR_PER_KG_BW * bwForProtein
      basisStr = `${BULK_FLOOR_PER_KG_BW} g/kg 體重`
    }

    const perKg = bwForProtein != null ? pAvg / bwForProtein : null
    // 有淨體重就兩個都報 —— 教練要看得出門檻是拿什麼當分母算的
    const perKgStr = lbm != null && perKg != null
      ? `${perKg.toFixed(1)} g/kg 體重、${(pAvg / lbm).toFixed(1)} g/kg 淨體重`
      : perKg != null ? `${perKg.toFixed(1)} g/kg` : ''

    if (floorG != null && pAvg < floorG) {
      // 真的低於實證下限 → 這才是要調的
      //
      // ⚠️ 2026-09-19 紅線 3（教練設定優先於引擎）：要他拉到的數字**不可以低於教練開的處方**。
      // 舊版直接報 floorG，震宣實際長這樣：處方 P170、實證下限 148（1.8 × 82.45）、
      // 他吃 138 → 草稿跟他說「蛋白拉到至少 148g」。那是引擎把教練的 170 往下砍成 148，
      // 而且那句話會直接發給學員。取兩者較大的。
      const goalG = Math.max(Math.round(floorG), pTarget)
      adjustments.push(
        goalG > Math.round(floorG)
          ? `蛋白拉到 ${goalG}g（教練設定；近期平均才 ${Math.round(pAvg)}g，已低於 ${basisStr}下限 ${Math.round(floorG)}g）`
          : `蛋白拉到至少 ${goalG}g（${basisStr}下限，近期平均才 ${Math.round(pAvg)}g）`,
      )
      // 教練開的處方本身低於實證下限 → 那是要教練看的事，不是叫學員照著吃
      if (pTarget < floorG) {
        flags.push(`蛋白處方 ${pTarget}g 低於 ${basisStr}下限 ${Math.round(floorG)}g`)
        needsReview = true
      }
      bullets.push(`🍗 蛋白平均 ${Math.round(pAvg)}g（${perKgStr}）→ 低於 ${basisStr}下限，${cutting ? '減脂掉肌風險' : '不利增肌'}`)
    } else if (pAvg < pTarget * 0.95) {
      // 高於實證下限、但沒吃到教練設定值 → 陳述事實，不說「達標」也不叫他改
      bullets.push(`🍗 蛋白平均 ${Math.round(pAvg)}g／目標 ${pTarget}g（${perKgStr}）→ 沒吃滿目標，但已高於 ${basisStr}下限，夠用`)
    } else {
      bullets.push(`🍗 蛋白 ${Math.round(pAvg)}g／目標 ${pTarget}g${perKgStr ? `（${perKgStr}）` : ''} → 達標`)
    }
  }

  // 2b) 脂肪
  //
  // ⚠️ 2026-09-19 Howard：「啊脂肪不用跟他說一下」。他對 —— 這支草稿以前**完全看不到脂肪**
  // （WCInput 的 nutrition 根本沒帶 fat_grams），所以最常見的那個行為整個沒被講到：
  // **拿蛋白換脂肪**。震宣 P138/170（少 32）F70/55（多 15）、林宥任 P154/193 F52/69，
  // 兩個都是同一個病的兩種方向。
  //
  // 兩邊都要看：
  //   上限 —— 脂肪佔掉熱量額度，蛋白就吃不到（熱量固定時這是零和的）
  //   下限 —— 脂肪佔總熱量 20% 是荷爾蒙地板（低脂壓睪固酮，Whittaker 2021）
  const fTarget = num(client.fat_target)
  const fAvg = avg(n14.map(x => num(x.fat_grams)!).filter(v => v != null))
  if (fAvg != null && cAvg != null && cAvg > 0) {
    const fatPct = (fAvg * 9) / cAvg * 100
    const proteinShort = pTarget != null && pAvg != null && pAvg < pTarget * 0.95

    if (fatPct < FAT_FLOOR_PCT) {
      // 地板優先講 —— 這是健康問題，不是配比問題
      adjustments.push(`脂肪拉到至少 ${Math.round(cAvg * FAT_FLOOR_PCT / 100 / 9)}g（目前只佔熱量 ${Math.round(fatPct)}%，低於 ${FAT_FLOOR_PCT}% 會壓荷爾蒙）`)
      bullets.push(`🥑 脂肪平均 ${Math.round(fAvg)}g，只佔熱量 ${Math.round(fatPct)}% → 低於 ${FAT_FLOOR_PCT}% 荷爾蒙地板`)
    } else if (fTarget != null && fAvg > fTarget * 1.15) {
      const over = Math.round(fAvg - fTarget)
      // ⭐ Howard 2026-09-19：「應該提醒他脂肪要控制更仔細」。
      // 為什麼是脂肪而不是別的：**1g 脂肪 9 大卡，蛋白和碳水才 4**。
      // 同樣估錯 10g，脂肪差 90 大卡、碳水只差 40 —— 誤差被放大一倍多。
      // 而且脂肪最常藏在秤不到的地方（炒菜的油、沾的醬、拌的醬料），
      // 那正好是「拍超商標籤」這種記法看不到的部分（震宣就是這樣記的）。
      // 所以脂肪不是「少吃一點」，是**這一項要抓得比其他兩項細**。
      const careLine = '脂肪 1g 是 9 大卡、蛋白碳水才 4 —— 油和醬估錯一點熱量就差很多，這項要抓得比其他兩項細'
      if (proteinShort) {
        // 蛋白不足 + 脂肪超標 = 同一件事，講成「換位置」而不是兩條各自的指令。
        // 熱量幾乎不動，比例就回來了 —— 比「少吃脂肪」「多吃蛋白」兩句分開講好執行。
        adjustments.push(`脂肪從 ${Math.round(fAvg)}g 收回 ${fTarget}g，省下的 ${Math.round(over * 9)} 大卡換成蛋白 —— 不是吃更少，是換位置。${careLine}`)
        bullets.push(`🥑 脂肪平均 ${Math.round(fAvg)}g／目標 ${fTarget}g（多 ${over}）＋蛋白沒吃滿 → 在拿蛋白換脂肪`)
      } else {
        adjustments.push(`脂肪收回 ${fTarget}g（近期平均 ${Math.round(fAvg)}g，多 ${over}）。${careLine}`)
        bullets.push(`🥑 脂肪平均 ${Math.round(fAvg)}g／目標 ${fTarget}g → 多 ${over}g（約 ${Math.round(over * 9)} 大卡）`)
      }
    }
  }

  // 3) 熱量現實對帳：吃超過設定還在掉 → 別砍；增肌吃到設定卻沒長 → 加
  // （cTarget / cAvg 已在體重趨勢之前算好，供 bulk 分支判斷要不要自己給方向）
  if (cTarget && cAvg != null && ws.length >= 3 && slope != null) {
    const perWeek = slope // 同一個回歸斜率，不重算（避免兩處對「有沒有在掉」講不同話）
    const isBulkGoal = client.goal_type === 'bulk' && client.prep_phase !== 'cut'

    if (isBulkGoal) {
      // 增肌側的對稱判斷（原本完全沒有——整支引擎講不出「加熱量」三個字）
      const latestW = ws[ws.length - 1].v
      const ratePct = (perWeek / latestW) * 100
      if (cAvg >= cTarget * 0.95 && ratePct < BULK_TARGETS.IDEAL_MIN) {
        // 有吃到設定卻沒長到理想速率 → 體重持平代表「現在的攝取 ≈ 他的維持熱量」，
        // 那麼盈餘就從這個實測維持熱量往上加，比拿設定值瞎猜準。
        // 幅度取 +10%（Iraki 2019 建議 lean bulk +10~20%，進階者取下緣）⚖️立場非共識。
        const addKcal = Math.round((cAvg * 0.10) / 25) * 25
        adjustments.push(`熱量往上加約 +${addKcal} kcal/天（他吃 ~${Math.round(cAvg)} 卻沒長到理想速率 → 這就是他的維持熱量）`)
        bullets.push(`🔥 實際吃 ~${Math.round(cAvg)} kcal（設定 ${cTarget}）→ 體重沒推上去，這個攝取量約等於他的維持熱量`)
      } else if (cAvg < cTarget * 0.9) {
        adjustments.push(`先把熱量吃到 ${cTarget} kcal（近期平均才 ${Math.round(cAvg)}）——沒吃到就談不上盈餘`)
        bullets.push(`🔥 實際吃 ~${Math.round(cAvg)} kcal／設定 ${cTarget} → 缺 ${Math.round(cTarget - cAvg)} kcal`)
      }
    } else if (cAvg > cTarget * 1.05 && perWeek < -0.1) {
      adjustments.push('熱量不動（他吃超過設定還在掉，代表 TDEE 比設定高、砍它沒道理）')
      bullets.push(`🔥 實際吃 ~${Math.round(cAvg)} kcal（設定 ${cTarget}）卻仍在掉 → 別降熱量`)
    } else if (cAvg < cTarget * 0.95 && perWeek > -0.05) {
      adjustments.push('吃不到設定又沒掉 → 先確認執行，再考慮微調')
    }
  }

  // 4) 訓練頻率 / 休息
  //
  // ⚠️ 2026-08-23：原本寫「訓練 5 天、休息 0 天」——但「休息 0」其實是
  // **沒人手動記過休息日**，不是他 14 天沒休息。5+0 加起來對不上 14 天，
  // 學員看了只會覺得這數字是亂算的。改成把「沒記錄」明講出來。
  const trained = t14.filter(x => x.training_type && x.training_type !== 'rest')
  const rests = t14.filter(x => x.training_type === 'rest')
  const unlogged = Math.max(0, 14 - t14.length)
  if (t14.length >= 4) {
    bullets.push(
      `🏋️ 近 14 天訓練 ${trained.length} 天` +
      (rests.length > 0 ? `、記錄休息 ${rests.length} 天` : '') +
      (unlogged > 0 ? `（另有 ${unlogged} 天沒記錄）` : ''),
    )
    // 只在記錄夠完整時才敢說「你沒排休息日」——沒記錄不等於沒休息
    if (trained.length >= 10 && rests.length <= 1 && unlogged <= 2) {
      adjustments.push('排 1 個固定休息日（高頻深切恢復遲早撞牆）')
    }
  }

  // 4b) 訓練「內容」—— 不只出勤
  //
  // ⚠️ 這段的分寸是整支引擎最難拿捏的地方：
  //    `training_logs`（打卡）說他去了，`training_sets`（組數）才說他練了什麼。
  //    2026-09-23 查 production：四個活躍學員裡三個的組數覆蓋率是 0%。
  //    在那個覆蓋率下講「你少做了 X 組」會冤枉人——而冤枉一次就再也拿不回來
  //    （Sean 2026-08-31 之後一個月沒記飲食）。
  //
  //    所以分三種情況講，而且**給學員的話只講掛零，不講失衡、不講落差**：
  //    失衡要知道目標才判得準，那是教練的判斷不是學員的。
  const setRows = input.trainingSets ?? []
  const setDays = new Set(
    setRows.filter(r => r.date && daysAgo(now, r.date) <= 14 && r.exercise_name).map(r => r.date),
  ).size

  if (setDays >= SET_LOG_MIN_DAYS) {
    const vol = actualVolume(
      setRows.filter(r => r.date && daysAgo(now, r.date) <= 14 && r.exercise_name),
    )
    const zeros = findGaps(vol).filter(g => g.severity === 'zero')
    bullets.push(`📊 近 14 天有記動作的 ${setDays} 天共 ${vol.total} 組`)
    if (zeros.length > 0) {
      const names = zeros.map(z => z.label).join('、')
      bullets.push(`⚠️ 這幾天裡 ${names} 一組都沒練到`)
      // ⚠️ 措辭刻意把前提講出來（「你記錄的這幾天」）——
      //    他可能練了只是沒記，不要講成「你沒練」。
      studentExtra.push(`🏋️ 你這兩週記錄到的訓練裡，${names}一組都沒有。下次排進去就好。`)
    }
  } else if (trained.length >= 2) {
    // 有去練但沒記內容 —— 這是覆蓋率問題的源頭，直接跟他要
    bullets.push(`📊 打卡 ${trained.length} 天，但只有 ${setDays} 天記了做哪些動作 → 看不到訓練內容`)
    studentExtra.push(
      `🏋️ 這兩週你練了 ${trained.length} 天，但沒記下做了哪些動作。`
      + `記了我才看得出你哪個部位練不夠——一天花 30 秒就好。`,
    )
  }

  // 4c) 課表健檢 —— ⭐ 這段**不依賴學員記錄**，課表是教練自己寫的
  //     所以就算組數覆蓋率是 0，這條照樣講得出東西。
  if (input.trainingPlan) {
    const ph = checkPlanHealth(input.trainingPlan)
    const summary = summarizePlanHealth(ph)
    if (summary) flags.push(`課表：${summary}`)
    // ⚠️ 門檻是 ≤5 不是 <8：健美分化課表缺「單腳／負重行走」是常態不是缺陷
    //    （見 lib/plan-health.ts 兩把尺的說明）。6/8 就報等於每個健美學員每週
    //    都收到一則假警報。只有真的缺一半以上才值得講。
    if (ph.hasPlan && ph.patternsCovered <= PATTERN_COVERAGE_ALERT) {
      const missing = ph.patterns.filter(p => p.sets === 0).map(p => p.label).join('、')
      bullets.push(`📋 課表只覆蓋 ${ph.patternsCovered}/8 種動作模式，沒排到：${missing}`)
    }
  }

  // 5) 恢復（含趨勢；連續偏低或走下坡 → 旗標給教練 + 標記需介入）
  const eAvg = avg(recent(input.wellness, 7).map(x => x.energy_level ?? NaN))
  if (eAvg != null) {
    // 前一週（8~14 天前）對照，看方向
    const ePrev = avg((input.wellness || [])
      .filter(x => x.date && daysAgo(now, x.date) > 7 && daysAgo(now, x.date) <= 14)
      .map(x => num(x.energy_level)!).filter(v => v != null))
    const declining = ePrev != null && eAvg < ePrev - 0.5
    if (eAvg <= 2.5) {
      adjustments.push('恢復偏差 → 本週降量/多睡')
      bullets.push(`😴 近 7 天精力均 ${eAvg.toFixed(1)}/5 → 偏低`)
      flags.push('恢復連續偏低，關心是否訓練量/睡眠/壓力出問題')
      needsReview = true
    } else if (declining) {
      bullets.push(`😴 精力 ${ePrev!.toFixed(1)}→${eAvg.toFixed(1)}/5 → 走下坡`)
      flags.push('恢復趨勢下降，留意本週訓練量與睡眠')
      needsReview = true
    } else {
      bullets.push(`😴 恢復均 ${eAvg.toFixed(1)}/5 → 還行`)
    }
  }

  // 「沒有 adjustment」有兩種完全不同的意思，原本 code 把它們混為一談，
  // 一律說「維持現況（數據都在合理區）」——於是增肌停滯的人被告知一切正常。
  //   (a) 引擎**判定過**且結論是在軌道上（減脂進度剛好／增肌速率理想）→ 這是真結論，可以說「照走」
  //   (b) 引擎**判不出來**（缺資料、沒命中任何分支）→ 沉默不等於綠燈，要標給教練，別替它背書
  if (adjustments.length === 0) {
    if (onTrackVerdict) {
      adjustments.push('維持現況，按表執行（數據在軌道上）')
    } else {
      adjustments.push('維持現況，按表執行（這週沒有需要調整的明確訊號）')
      needsReview = true
      flags.push('引擎沒偵測到需要調整的訊號 → 請人工確認是真的穩、還是資料看不出來')
    }
  }

  // 組學員訊息
  msgLines.push(`${name}，這週我看了你的數據：`)
  msgLines.push(bullets.map(b => `・${b.replace(/^[^\s]+\s/, '')}`).slice(0, 3).join('\n'))
  // ⚠️ 訓練那條不走 bullets 的前三名篩選——它帶著明確的下一步動作
  //    （「下次排進去」「記一下做了什麼」），被截掉就白寫了。
  if (studentExtra.length) { msgLines.push(''); msgLines.push(studentExtra.join('\n')) }
  msgLines.push('')
  msgLines.push(`本週調整：${adjustments.slice(0, 3).join('；')}。`)

  return {
    mode: 'adjust',
    dataDays,
    headline: weightNote || `${dataDays} 天記錄，數據驅動調整`,
    bullets,
    adjustments,
    studentMessage: msgLines.join('\n'),
    needsCoachReview: needsReview || !!newLab,
    flags,
  }
}
