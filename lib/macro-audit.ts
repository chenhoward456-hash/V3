/**
 * 巨量健全性稽核 —— 一次掃完所有學員的營養設定，找出「內部矛盾」與「超出實證邊界」。
 *
 * ## 為什麼有這支（2026-08-26）
 *
 * 8/23 我幫震宣設碳循環，把訓練日碳水拉到 271g 讓他打籃球有力，
 * 剩下的赤字全丟給休息日 —— **沒去算另一頭會掉到多少**。
 * 結果休息日只剩 1697 kcal，而他那 3 個「休息日」裡有 2 天在做有氧。
 * Howard 的原話：「幹休息日吃那麼少喔」。
 *
 * 問題不是我不會算，是**我只驗自己在意的那一端**。
 * 同一批掃描還挖出萬哲鴻／謝佳峻比賽日過了 30 天還卡在備賽巨量（休息日碳水 50g/40g），
 * 以及兩人的碳循環週均對不上 calories_target。
 *
 * 所以規則寫在這裡、可重跑、可測 —— 不依賴我下次記不記得檢查。
 *
 * ## 設計原則
 *
 * 1. **純函式**：吃已經備好的資料，不碰 DB。好測，也讓 API 與腳本共用同一份判定。
 * 2. **每條規則寫出處**。沒出處的門檻＝我的直覺，那正是這支要取代的東西。
 * 3. **分母用淨體重**。體脂高的人每公斤總體重的熱量本來就該低，
 *    用總體重當分母會對著林宥任（26% 體脂）誤報 —— 第一版真的誤報了。
 * 4. **只報事實不自動修**。改學員的數字是教練的決定。
 */

import { BULK_FLOOR_PER_KG_BW, CUT_FLOOR_PER_KG_LBM, CUT_FLOOR_PER_KG_BW_PROXY } from './weekly-coaching'

/** 低熱量日的下限。單位是**每公斤淨體重**，不是總體重。 */
export const LOW_DAY_KCAL_PER_KG_LBM = 26
/** 沒有體脂資料時的替代下限（每公斤總體重），約當 20% 體脂者的 26 kcal/kg 淨體重 */
export const LOW_DAY_KCAL_PER_KG_BW = 21
/** 脂肪佔總熱量的下限。ISSN：低於此影響荷爾蒙合成 */
export const FAT_MIN_PCT_OF_KCAL = 20
/** 碳循環兩種日子的熱量差上限。超過代表整週赤字幾乎全壓在低碳日 */
export const MAX_CYCLE_SWING_KCAL = 500
/** 減脂速率上限（% 體重／週）。Helms 2014 PMID 24092765：0.5–1.0% */
export const MAX_CUT_PCT_PER_WEEK = 1.0
/** 設定值與實際加總容許誤差 */
export const TOLERANCE_PCT = 5

export type AuditClient = {
  id: string
  name: string
  goal_type?: string | null
  prep_phase?: string | null
  target_weight?: number | null
  target_date?: string | null
  competition_date?: string | null
  competition_enabled?: boolean | null
  calories_target?: number | null
  protein_target?: number | null
  carbs_target?: number | null
  fat_target?: number | null
  carbs_training_day?: number | null
  carbs_rest_day?: number | null
}

export type AuditInput = {
  client: AuditClient
  /** 最新一筆有值的體重 */
  weight?: number | null
  /** 最近一筆合理的體脂％（3–60 之外視為填錯） */
  bodyFat?: number | null
  /** 台灣日 YYYY-MM-DD */
  today: string
}

export type Severity = 'high' | 'medium'
export type Finding = {
  clientId: string
  name: string
  rule: string
  severity: Severity
  message: string
}

const pctOff = (a: number, b: number) => Math.abs(a - b) / b * 100

/** 一位學員的稽核。回傳空陣列＝這個人沒問題。 */
export function auditClient(input: AuditInput): Finding[] {
  const { client: c, weight, bodyFat, today } = input
  const out: Finding[] = []
  const push = (rule: string, severity: Severity, message: string) =>
    out.push({ clientId: c.id, name: c.name, rule, severity, message })

  const P = c.protein_target, F = c.fat_target, C = c.carbs_target, K = c.calories_target

  // 過期的日期跟有沒有設巨量無關，先判
  if (c.competition_date && c.competition_enabled !== false) {
    const d = Math.round((Date.parse(c.competition_date) - Date.parse(today)) / 86_400_000)
    if (d < 0) push('expired_comp', 'high', `比賽日 ${c.competition_date} 已過 ${-d} 天，但備賽仍開啟 — 巨量可能還停在備賽末期`)
  }
  if (c.target_date) {
    const d = Math.round((Date.parse(c.target_date) - Date.parse(today)) / 86_400_000)
    if (d < 0) push('expired_target', 'medium', `目標日 ${c.target_date} 已過 ${-d} 天`)
  }

  if (K == null || P == null || F == null || C == null) {
    push('missing', 'medium', `巨量沒設齊（熱量 ${K ?? '—'} / 蛋白 ${P ?? '—'} / 碳水 ${C ?? '—'} / 脂肪 ${F ?? '—'}）`)
    return out
  }
  if (weight == null) {
    push('no_weight', 'medium', '沒有體重紀錄，無法驗證巨量是否合理')
    return out
  }

  const lbm = bodyFat != null && bodyFat > 3 && bodyFat < 60 ? weight * (1 - bodyFat / 100) : null
  const kcalOf = (carbs: number) => P * 4 + carbs * 4 + F * 9
  const macroSum = kcalOf(C)

  // 1) 設定的熱量對不對得上三大巨量加總
  if (pctOff(macroSum, K) > TOLERANCE_PCT) {
    push('sum_mismatch', 'high',
      `設定熱量 ${K} 對不上巨量加總 ${macroSum}（差 ${Math.round(pctOff(macroSum, K))}%）— 學員看到的熱量條會跟目標打架`)
  }

  // 2) 脂肪佔比
  const fatPct = (F * 9) / macroSum * 100
  if (fatPct < FAT_MIN_PCT_OF_KCAL) {
    push('fat_low', 'high',
      `脂肪只佔 ${fatPct.toFixed(0)}% 熱量（${F}g、${(F / weight).toFixed(2)} g/kg）— 低於 ${FAT_MIN_PCT_OF_KCAL}% 會影響荷爾蒙`)
  }

  // 3) 減脂期蛋白下限（分母用淨體重，見 weekly-coaching 的說明）
  const cutting = c.goal_type === 'cut' || c.prep_phase === 'cut'
  if (cutting) {
    const floor = lbm != null ? CUT_FLOOR_PER_KG_LBM * lbm : CUT_FLOOR_PER_KG_BW_PROXY * weight
    const basis = lbm != null
      ? `${CUT_FLOOR_PER_KG_LBM} g/kg 淨體重 ${lbm.toFixed(1)}kg`
      : `${CUT_FLOOR_PER_KG_BW_PROXY} g/kg 體重（沒體脂資料）`
    if (P < floor) push('protein_low', 'high', `蛋白 ${P}g 低於 ${Math.round(floor)}g（${basis}）— 減脂掉肌風險`)
  } else if (P < BULK_FLOOR_PER_KG_BW * weight) {
    push('protein_low', 'medium',
      `蛋白 ${P}g 低於 ${Math.round(BULK_FLOOR_PER_KG_BW * weight)}g（${BULK_FLOOR_PER_KG_BW} g/kg 體重）`)
  }

  // 4) 碳循環：擺幅、週均、低碳日下限
  if (c.carbs_training_day != null && c.carbs_rest_day != null) {
    const kt = kcalOf(c.carbs_training_day), kr = kcalOf(c.carbs_rest_day)
    const low = Math.min(kt, kr)
    // 一週抓 4 訓練日 + 3 休息日（跟 UI 與引擎同一套假設）
    const weekAvg = Math.round((kt * 4 + kr * 3) / 7)

    if (pctOff(weekAvg, K) > TOLERANCE_PCT) {
      push('cycle_avg', 'high',
        `碳循環週均 ${weekAvg} 對不上設定熱量 ${K}（差 ${weekAvg - K > 0 ? '+' : ''}${weekAvg - K}）— 實際吃的跟處方不同`)
    }
    if (Math.abs(kt - kr) > MAX_CYCLE_SWING_KCAL) {
      push('cycle_swing', 'high',
        `訓練日 ${kt} vs 休息日 ${kr}，差 ${Math.abs(kt - kr)} kcal — 整週赤字幾乎全壓在低碳日`)
    }
    if (lbm != null) {
      const perLbm = low / lbm
      if (perLbm < LOW_DAY_KCAL_PER_KG_LBM) {
        push('low_day', 'high', `低碳日 ${low} kcal = ${perLbm.toFixed(1)} kcal/kg 淨體重（低於 ${LOW_DAY_KCAL_PER_KG_LBM}）`)
      }
    } else if (low / weight < LOW_DAY_KCAL_PER_KG_BW) {
      push('low_day', 'medium',
        `低碳日 ${low} kcal = ${(low / weight).toFixed(1)} kcal/kg 體重（低於 ${LOW_DAY_KCAL_PER_KG_BW}；沒體脂資料所以用總體重估）`)
    }
  }

  // 5) 減脂速率
  if (cutting && c.target_weight != null && c.target_date) {
    const days = Math.round((Date.parse(c.target_date) - Date.parse(today)) / 86_400_000)
    if (days > 0) {
      const perWeek = (weight - c.target_weight) / (days / 7)
      const pct = perWeek / weight * 100
      if (pct > MAX_CUT_PCT_PER_WEEK) {
        push('rate', 'high',
          `要達標得掉 ${perWeek.toFixed(2)} kg/週 = ${pct.toFixed(2)}%/週，超過 ${MAX_CUT_PCT_PER_WEEK}% 上限（Helms 2014）— 掉的會有一半是肌肉`)
      }
    }
  }

  return out
}

/** 整批稽核，high 排前面、同級照姓名 */
export function auditAll(inputs: AuditInput[]): Finding[] {
  return inputs
    .flatMap(auditClient)
    .sort((a, b) =>
      (a.severity === b.severity ? 0 : a.severity === 'high' ? -1 : 1) || a.name.localeCompare(b.name))
}
