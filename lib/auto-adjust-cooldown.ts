/**
 * 自動調整冷卻期（2026-09-23 稽核 E2）
 *
 * 被動式引擎（減脂沒設目標／增肌）是 `currentCalories + delta`，狀態用「週平均」判斷，
 * 一週內都不會變 → 每開一次頁、每記一次體重就把同一個 delta 再疊一次
 * （模擬：60kg 女性 1500→2460 kcal 只要 4 次）。
 * 所以 7 天內自動調過就不再自動套用。
 *
 * 例外（算的是絕對值、重跑結果一樣，或有逐日協議）：goal_driven、peak_week。
 */
export const AUTO_ADJUST_COOLDOWN_DAYS = 7

const COOLDOWN_EXEMPT_STATUSES = new Set(['goal_driven', 'peak_week'])

export function isInAutoAdjustCooldown(
  lastAutoAdjustAt: string | null | undefined,
  suggestionStatus: string | null | undefined,
  now: number = Date.now(),
): boolean {
  if (!lastAutoAdjustAt) return false
  if (suggestionStatus && COOLDOWN_EXEMPT_STATUSES.has(suggestionStatus)) return false
  const last = Date.parse(lastAutoAdjustAt)
  if (!Number.isFinite(last)) return false
  return now - last < AUTO_ADJUST_COOLDOWN_DAYS * 86_400_000
}
