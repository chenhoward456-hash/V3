/**
 * LINE 官方帳號的連結（集中一處，別再各檔案硬寫）。
 *
 * ⚠️ 2026-08-14 修：程式裡原本寫的是 `@howardprotocol`，那個帳號**不存在**
 * （page.line.me 回 404），所以學員按「貼上代碼」那顆按鈕一路都是死的。
 * 真正的 basic ID 是 @468dqekm（由 https://lin.ee/LP65rCc 導向確認）。
 * 之後若買了 premium ID，改這裡一行就好。
 */
export const LINE_OA_ID = '@468dqekm'

/** 加好友短連結（LINE 後台產的，已驗證導向 LINE_OA_ID） */
export const LINE_ADD_FRIEND_URL = 'https://lin.ee/LP65rCc'

/**
 * 「打開 LINE 並預填綁定訊息」的深連結。
 * 學員點下去 → 對話框已經帶好「綁定 XXXX」，他只要按送出。
 */
export function lineBindDeeplink(uniqueCode: string): string {
  return `https://line.me/R/oaMessage/${encodeURIComponent(LINE_OA_ID)}/?${encodeURIComponent(`綁定 ${uniqueCode}`)}`
}

/**
 * Howard 本人的 LINE user ID（系統要推東西給教練時用）。
 *
 * ⚠️ 2026-08-23：`COACH_LINE_USER_ID` 這支環境變數本機沒設，
 * 而 `app/api/cron/daily` 的教練晨報是 `if (coachLineId)` —— 沒設就整段靜靜跳過，
 * 不報錯也不留痕跡。所以「晨報寫好了」跟「晨報有送出去」是兩回事。
 * free-trial 那支路由早就自己硬寫了一份 fallback，等於已經有人踩過同一個坑，
 * 只是各寫各的（違反紅線 6）。集中到這裡，兩邊共用同一個真相。
 *
 * 環境變數優先，讓 fallback 只是保險而不是設定。
 *
 * ⚠️ 也讀 `ADMIN_LINE_USER_ID`：`lib/line.ts` 的 pushMessage 在 V3 官方帳號月配額爆掉（429）時，
 * 會借道 howard-line-bot 把訊息送到 Howard —— 但那段是用 `to === ADMIN_LINE_USER_ID` 當條件。
 * 兩支環境變數指的是同一個人，一旦哪天只改了其中一支，晨報會**安靜地失去配額備援**：
 * 推不出去、也不會借道、也不報錯。所以在這裡就把兩者串成同一個真相。
 */
export const COACH_LINE_USER_ID =
  process.env.COACH_LINE_USER_ID ||
  process.env.ADMIN_LINE_USER_ID ||
  'U3b425b2d1572d197d0992945323881e5'
