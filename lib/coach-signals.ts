/**
 * 教練判讀訊號 —— 把「Howard 問 Claude 一個學員怎麼了」那一輪手工判讀寫成規則。
 *
 * ## 為什麼有這支（2026-10-07）
 *
 * Howard：「我覺得我的後台設計很爛，我還不如問你」。
 * 同一天他問了震宣（「卡關是怎樣，他很焦慮」）跟林宥任，兩個答案裡真正有用的東西，
 * 後台一個都沒有：
 *
 *   震宣  10/3 秤到 84.0 → 其實是 10/2 吃 3352 大卡的水，10/6 已回 82.2。
 *         後台卻拿含這幾天的 14 天斜率，印出「紀錄差 +999kcal」。
 *         ＋爆吃→隔天補償少吃（9/26 2935→1413、10/2 3352→1460），補償日蛋白只剩 ~100g。
 *   宥任  9/30–10/3 四天全空（斷線前兆），訓練筆記裡問「坐姿划船背是不是要延展出去」
 *         —— 剛好是他課表的核心重點，卻沒人回。
 *
 * 這些都不是新資料，dashboard 早就抓了，只是沒有人把它們讀出來。
 *
 * ## 原則
 * - 每個訊號都要帶**具體日期與數字**。「飲食不穩定」是描述；「10/2 3352→10/3 1460」是證據。
 * - 只陳述資料看得到的東西，不指控（同 lib/implied-intake 的立場）。
 * - 純函式，不碰 DB；呼叫端餵資料。
 */

export type SignalKind = 'water_spike' | 'binge_compensate' | 'protein_low' | 'log_gap' | 'student_note'

export type CoachSignal = {
  kind: SignalKind
  /** 越大越該先看。3＝會讓教練/學員誤判、2＝要處理、1＝順手看 */
  sev: 1 | 2 | 3
  text: string
}

export type SignalInput = {
  caloriesTarget: number | null
  proteinTarget: number | null
  /** 升冪 */
  weights: { date: string; weight: number }[]
  nutrition: { date: string; calories?: number | null; protein_grams?: number | null; carbs_grams?: number | null }[]
  training: { date: string; note?: string | null }[]
  /** 台灣日 YYYY-MM-DD */
  today: string
  /** 看幾天內（預設 14）*/
  windowDays?: number
}

/** 體重一次跳多少才算「異常跳升」 */
export const SPIKE_JUMP_KG = 1.2
/** 前一天吃超過處方多少才算「大餐」 */
export const BIG_DAY_OVER_KCAL = 600
/** 大餐隔天低於處方多少算「補償少吃」 */
export const COMPENSATE_UNDER_KCAL = 400
/** 回到跳升前基準 + 這個數字以內就算水退了 */
export const SPIKE_RECOVER_KG = 0.6
/** 跳升後最多幾天內還算「同一波水」 */
export const SPIKE_MAX_DAYS = 6

const DAY = 86400000
const dnum = (d: string) => Date.parse(d + 'T00:00:00Z')
const md = (d: string) => `${+d.slice(5, 7)}/${+d.slice(8, 10)}`
const addDays = (d: string, n: number) => new Date(dnum(d) + n * DAY).toISOString().slice(0, 10)

type Spike = { date: string; weight: number; bigDay: string; kcal: number; carbs: number | null; baseline: number; recoveredOn: string | null; recoveredWeight: number | null; affected: Set<string> }

/**
 * 找「大餐 → 隔天體重跳 ≥1.2kg」的水腫波。
 * 基準用跳升前最多 3 筆的平均（單一筆可能本身就是低點，例如震宣 10/1 的 81.2）。
 */
export function findWaterSpikes(
  weights: SignalInput['weights'],
  nutrition: SignalInput['nutrition'],
  caloriesTarget: number | null,
): Spike[] {
  if (!caloriesTarget || weights.length < 2) return []
  const kcalByDate = new Map(nutrition.map(n => [n.date, n]))
  const spikes: Spike[] = []
  for (let i = 1; i < weights.length; i++) {
    const prev = weights[i - 1], cur = weights[i]
    const gapDays = (dnum(cur.date) - dnum(prev.date)) / DAY
    if (gapDays > 3 || cur.weight - prev.weight < SPIKE_JUMP_KG) continue
    // 跳升前一段期間（prev 當天到 cur 前一天）有沒有大餐
    let big: { date: string; kcal: number; carbs: number | null } | null = null
    for (let d = prev.date; d < cur.date; d = addDays(d, 1)) {
      const n = kcalByDate.get(d)
      if (n?.calories != null && n.calories - caloriesTarget >= BIG_DAY_OVER_KCAL && (!big || n.calories > big.kcal)) {
        big = { date: d, kcal: n.calories, carbs: n.carbs_grams ?? null }
      }
    }
    if (!big) continue
    const before = weights.slice(Math.max(0, i - 3), i).map(w => w.weight)
    const baseline = before.reduce((a, b) => a + b, 0) / before.length
    const affected = new Set<string>([cur.date])
    let recoveredOn: string | null = null, recoveredWeight: number | null = null
    for (let j = i + 1; j < weights.length; j++) {
      if ((dnum(weights[j].date) - dnum(cur.date)) / DAY > SPIKE_MAX_DAYS) break
      if (weights[j].weight <= baseline + SPIKE_RECOVER_KG) { recoveredOn = weights[j].date; recoveredWeight = weights[j].weight; break }
      affected.add(weights[j].date)
    }
    spikes.push({ date: cur.date, weight: cur.weight, bigDay: big.date, kcal: big.kcal, carbs: big.carbs, baseline, recoveredOn, recoveredWeight, affected })
  }
  return spikes
}

/**
 * 把水腫波那幾天的體重拿掉，再拿去算趨勢。
 * ⚠️ 跟碳水回補期同一個道理（project_v3_carb_repletion_doctrine）：
 * 不只是「那幾天不判斷」，而是要從回歸裡丟掉，不然一路把斜率拉歪。
 */
export function dropWaterSpikeDays<T extends { date: string; weight: number }>(
  weights: T[],
  nutrition: SignalInput['nutrition'],
  caloriesTarget: number | null,
): T[] {
  const spikes = findWaterSpikes(weights, nutrition, caloriesTarget)
  if (!spikes.length) return weights
  const drop = new Set<string>()
  for (const s of spikes) s.affected.forEach(d => drop.add(d))
  return weights.filter(w => !drop.has(w.date))
}

/** 訓練筆記裡值得教練看一眼的句子：問題、感受不到、疼痛 */
const ASK_RE = /[?？]|不確定|是不是|要不要|怎麼/
const PAIN_RE = /痛|不舒服|受傷|拉傷/
const FEEL_RE = /抓不到|沒感覺|感受不到|不太好|不夠穩|不穩|卡卡|比較沒感覺/

export function readSignals(input: SignalInput): CoachSignal[] {
  const win = input.windowDays ?? 14
  const since = addDays(input.today, -win)
  const out: CoachSignal[] = []
  const tgt = input.caloriesTarget
  const nut = input.nutrition.filter(n => n.date >= since && n.date <= input.today).sort((a, b) => a.date.localeCompare(b.date))
  const weights = input.weights.filter(w => w.date >= addDays(since, -4))

  // 1. 水腫波 —— 只講最近一次（老的已經不影響判讀）
  const spikes = findWaterSpikes(weights, input.nutrition, tgt).filter(s => s.date >= since)
  const s = spikes[spikes.length - 1]
  if (s) {
    const carb = s.carbs != null ? `（碳水 ${Math.round(s.carbs)}g）` : ''
    const head = `${md(s.date)} 的 ${s.weight.toFixed(1)} 是 ${md(s.bigDay)} 吃 ${Math.round(s.kcal)} 大卡${carb}留下的水，不是胖`
    out.push({
      kind: 'water_spike', sev: 3,
      text: s.recoveredOn
        ? `${head}；${md(s.recoveredOn)} 已回到 ${s.recoveredWeight!.toFixed(1)}`
        : `${head}；還沒退完，這幾天的體重先不算進趨勢`,
    })
  }

  // 2. 爆吃 → 隔天補償少吃
  if (tgt) {
    const byDate = new Map(nut.map(n => [n.date, n]))
    const pairs: string[] = []
    const compProtein: number[] = []
    for (const n of nut) {
      if (n.calories == null || n.calories - tgt < BIG_DAY_OVER_KCAL) continue
      const next = byDate.get(addDays(n.date, 1))
      if (next?.calories != null && tgt - next.calories >= COMPENSATE_UNDER_KCAL) {
        pairs.push(`${md(n.date)} ${Math.round(n.calories)}→${Math.round(next.calories)}`)
        if (next.protein_grams != null) compProtein.push(next.protein_grams)
      }
    }
    if (pairs.length) {
      const p = compProtein.length ? `；少吃那天蛋白只剩 ~${Math.round(compProtein.reduce((a, b) => a + b, 0) / compProtein.length)}g` : ''
      out.push({ kind: 'binge_compensate', sev: pairs.length >= 2 ? 2 : 1, text: `爆吃後隔天少吃補回來 ${pairs.length} 次（${pairs.join('、')}）${p}` })
    }
  }

  // 3. 蛋白質不足的天數
  if (input.proteinTarget) {
    const floor = Math.round(input.proteinTarget * 0.8)
    const withP = nut.filter(n => n.protein_grams != null && n.protein_grams > 0)
    const low = withP.filter(n => (n.protein_grams as number) < floor)
    if (withP.length >= 4 && low.length >= 3) {
      out.push({ kind: 'protein_low', sev: 1, text: `蛋白質有 ${low.length}/${withP.length} 天不到 ${floor}g（目標 ${input.proteinTarget}）` })
    }
  }

  // 4. 中間整段沒紀錄（斷線前兆）—— 只抓「斷了又回來」的空窗；還沒回來的交給掉線判定
  const active = new Set<string>([
    ...input.weights.map(w => w.date),
    ...input.nutrition.filter(n => n.calories != null || n.protein_grams != null).map(n => n.date),
    ...input.training.map(t => t.date),
  ])
  let best: [string, string, number] | null = null
  let runStart: string | null = null
  for (let d = since; d < input.today; d = addDays(d, 1)) {
    if (!active.has(d)) { runStart ??= d; continue }
    if (runStart) {
      const len = (dnum(d) - dnum(runStart)) / DAY
      if (len >= 3 && (!best || len > best[2])) best = [runStart, addDays(d, -1), len]
      runStart = null
    }
  }
  // 現在又斷了的人交給掉線判定講，這裡再講一次只是重複（Eddie）
  const recentlyBack = [...active].some(d => d >= addDays(input.today, -3) && d <= input.today)
  if (best && recentlyBack) out.push({ kind: 'log_gap', sev: 2, text: `${md(best[0])}–${md(best[1])} 連續 ${best[2]} 天完全沒紀錄（後來有回來，但這是斷線前會出現的樣子）` })

  // 5. 訓練筆記裡的問題／疼痛／抓不到感覺
  const notes = input.training
    .filter(t => t.date >= since && t.note)
    .sort((a, b) => b.date.localeCompare(a.date))
    .flatMap(t => (t.note as string).split(/\n+/).map(line => ({ date: t.date, line: line.replace(/^\[[^\]]*\]\s*/, '').trim() })))
    .filter(x => x.line)
  const pick = (re: RegExp) => notes.filter(x => re.test(x.line))
  const pain = pick(PAIN_RE), asks = pick(ASK_RE), feel = pick(FEEL_RE).filter(x => !ASK_RE.test(x.line) && !PAIN_RE.test(x.line))
  for (const x of pain.slice(0, 1)) out.push({ kind: 'student_note', sev: 3, text: `${md(x.date)} 他寫：「${x.line}」—— 有提到不舒服` })
  for (const x of asks.slice(0, 2)) out.push({ kind: 'student_note', sev: 2, text: `${md(x.date)} 他問：「${x.line}」` })
  if (feel.length) {
    const shown = feel.slice(0, 2).map(x => `「${x.line}」`).join('、')
    out.push({ kind: 'student_note', sev: 1, text: `動作抓不到感覺 ${feel.length} 處，最近：${shown}` })
  }

  return out.sort((a, b) => b.sev - a.sev)
}
