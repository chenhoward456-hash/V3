/**
 * 學員自己設定目標時的安全驗證。
 *
 * ⚠️ 為什麼要有（2026-08-19 Howard：「萬哲鴻比賽日過了、現在有新階段的增重目標，
 * 但他沒辦法自己設定，必須透過我這邊…我有些學生也懶得管，我都是開給他們讓他們自己玩玩看」）：
 *
 * `PUT /api/clients` 一直就允許改 goal_type / target_weight / target_date，
 * 但①學員端沒有任何入口 ②那支 API 只檢查數值範圍（30–300 kg），
 * **不檢查速率**。所以「八週掉二十公斤」是合法輸入。
 *
 * 分界線（跟營養素不同，這裡可以放手）：
 *   · 目標體重／日期 ＝ **這個人想要什麼** → 本來就該他自己決定
 *   · 每天吃幾克碳水 ＝ **處方** → 留給教練（見 lib/health-screening 的法規 gate）
 * 系統的角色是把「想要」翻譯成「安不安全」，不安全就講清楚為什麼、並給一個做得到的替代。
 *
 * 速率依據：Helms 2014（天然選手減脂 0.5–1.0% 體重/週；增肌 0.25–0.5%）。
 * 這裡取更保守的上緣當硬上限，因為學員是自己設的、沒有教練在旁邊看。
 */

/** 減脂：每週掉幾 % 體重 */
const CUT_MAX_PCT = 0.010   // 1.0%/週 硬上限
const CUT_IDEAL_PCT = 0.007 // 建議值
/** 增肌：每週長幾 % 體重 */
const BULK_MAX_PCT = 0.005  // 0.5%/週
const BULK_IDEAL_PCT = 0.003

const MIN_DAYS = 14         // 目標日至少要離今天這麼久
const MAX_DAYS = 730        // 兩年以上沒有意義

export type GoalCheck = {
  ok: boolean
  /** 擋下的原因（給學員看，人話） */
  message?: string
  /** 系統建議的替代方案 */
  suggestion?: { targetWeight?: number; targetDate?: string; label: string }
  /** 這個目標算出來的每週速率（kg） */
  ratePerWeek?: number
}

function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / 86_400_000)
}

function fmt(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/**
 * @param currentWeight 目前體重（kg）
 * @param targetWeight  學員想設的目標體重
 * @param targetDate    學員想設的目標日期（YYYY-MM-DD）
 * @param goalType      cut / bulk / recomp
 */
export function checkGoalSafety(
  currentWeight: number | null,
  targetWeight: number,
  targetDate: string,
  goalType: string | null,
  now: Date = new Date(),
): GoalCheck {
  if (!Number.isFinite(targetWeight) || targetWeight <= 30 || targetWeight >= 300) {
    return { ok: false, message: '目標體重超出合理範圍。' }
  }

  const target = new Date(targetDate + 'T00:00:00')
  if (isNaN(target.getTime())) return { ok: false, message: '日期格式不對。' }

  const days = daysBetween(now, target)
  if (days < MIN_DAYS) {
    return {
      ok: false,
      message: `目標日至少要離今天 ${MIN_DAYS} 天 —— 太短的話身體還來不及反應，量到的多半是水分不是脂肪。`,
      suggestion: { targetDate: fmt(new Date(now.getTime() + 28 * 86_400_000)), label: '改成 4 週後' },
    }
  }
  if (days > MAX_DAYS) return { ok: false, message: '目標日太遠了，先設一年內的階段目標會比較好追蹤。' }

  // 沒有體重資料就只能做基本檢查（不擋，讓他先設，之後量了體重系統會再判斷）
  if (currentWeight == null || !Number.isFinite(currentWeight)) {
    return { ok: true, message: '先記一次體重，系統才能幫你確認這個進度安不安全。' }
  }

  const deltaKg = targetWeight - currentWeight
  const weeks = days / 7
  const ratePerWeek = deltaKg / weeks
  const ratePct = Math.abs(ratePerWeek) / currentWeight

  // 方向與 goal_type 相反 → 只提醒，不擋（他可能真的要換階段，例如賽後轉增重）
  const wrongDirection =
    (goalType === 'cut' && deltaKg > 0.5) || (goalType === 'bulk' && deltaKg < -0.5)

  const isCutting = deltaKg < 0
  const maxPct = isCutting ? CUT_MAX_PCT : BULK_MAX_PCT
  const idealPct = isCutting ? CUT_IDEAL_PCT : BULK_IDEAL_PCT

  if (ratePct > maxPct) {
    // 算一個做得到的日期：用建議速率反推
    const safeWeeks = Math.abs(deltaKg) / (currentWeight * idealPct)
    const safeDate = new Date(now.getTime() + Math.ceil(safeWeeks * 7) * 86_400_000)
    const verb = isCutting ? '掉' : '增'
    return {
      ok: false,
      ratePerWeek,
      message:
        `這樣算下來一週要${verb} ${Math.abs(ratePerWeek).toFixed(2)} 公斤（${(ratePct * 100).toFixed(1)}% 體重），` +
        (isCutting
          ? '超過安全線了 —— 掉太快的那部分大半是肌肉跟水，而且很難撐過三週。'
          : '增太快的話多出來的大半是脂肪，之後要花更久減回去。'),
      suggestion: { targetDate: fmt(safeDate), label: `同樣目標，改成 ${fmt(safeDate)}（一週約 ${(currentWeight * idealPct).toFixed(2)} 公斤）` },
    }
  }

  if (wrongDirection) {
    return {
      ok: true,
      ratePerWeek,
      message: `注意：你目前的方案是${goalType === 'cut' ? '減脂' : '增肌'}，但這個目標是往反方向。如果要換階段，跟教練說一聲會比較準。`,
    }
  }

  return { ok: true, ratePerWeek }
}
