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
