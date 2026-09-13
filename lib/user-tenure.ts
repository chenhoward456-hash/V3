/**
 * 「這個人還是新手嗎」 —— 新手導覽該不該出現的唯一判準。
 *
 * ## 為什麼有這支（2026-09-14）
 *
 * 兩個新手引導元件的顯示條件**只有 localStorage 一個鍵**：
 *   - `OnboardingGuide`：`onboarding_done_<clientId>`
 *   - `WelcomeBanner`：`hp_welcome_completed`（連 clientId 都沒帶，**全站共用一把鑰匙**）
 *
 * 兩個都**沒有任何地方看他到底是不是新人**。實測開 林宥任 的頁面：
 * 他連續記錄 33 天、四項全記、是全系統最活躍的使用者，
 * 打開第一眼是蓋滿整個畫面的「林宥任，歡迎加入！這是你的專屬健康儀表板」，
 * 下面還有一張「第一次來？看使用說明」。
 *
 * localStorage 是**裝置層**的東西：換手機、清網站資料、Safari 換到桌面 PWA、無痕視窗，
 * 全部會讓一個用了一個月的人重新被當成第一天報到。而系統手上明明就有他的資料。
 *
 * **判準用「他有沒有留下東西」，不是「這台裝置記不記得他」。**
 */

/** 有這麼多天記錄就不再是新手 —— 一週足以看完該看的東西 */
export const NEW_USER_LOG_DAYS = 3
/** 或者加入超過這麼久，就算他都沒記錄，導覽也已經沒用了 */
export const NEW_USER_MAX_AGE_DAYS = 14

export type TenureInput = {
  /** clients.created_at */
  createdAt?: string | null
  /** 各類紀錄的日期（重複沒關係，會去重） */
  logDates?: (string | null | undefined)[]
  /** 現在（測試用） */
  now?: Date
}

/**
 * 還算新手嗎？
 *
 * 兩條都要成立才算新手：記錄天數還少 **而且** 加入沒多久。
 * 任一條不成立就不要再給他看新手導覽 ——
 * 記錄很多＝他早就會用了；加入很久還沒記錄＝導覽已經證明沒用，再蓋一次只是擋路。
 */
export function isNewUser(input: TenureInput): boolean {
  const now = input.now ?? new Date()

  const days = new Set(
    (input.logDates ?? []).filter((d): d is string => !!d).map(d => d.slice(0, 10)),
  )
  if (days.size >= NEW_USER_LOG_DAYS) return false

  if (input.createdAt) {
    const age = (now.getTime() - Date.parse(input.createdAt)) / 86400000
    if (age > NEW_USER_MAX_AGE_DAYS) return false
  }

  return true
}
