/**
 * 「同一個狀態不要天天推」的判斷。拿掉數字再比（score 31→21、體重 0.43→0.44 不算新狀況）。
 * 2026-09-27：「陳胤豪 卡住了」9/13–9/26 幾乎每天推一次，內容都一樣。
 */
export const reasonKey = (r: string) => r.replace(/[\d.]+/g, '#')

/** 最近（呼叫端自己決定時間窗）已經推過同樣原因 → true＝這次別推 */
export function alreadyAlerted(recentReasons: (string | null | undefined)[], currentReason: string): boolean {
  const key = reasonKey(currentReason)
  return recentReasons.some(r => !!r && reasonKey(r) === key)
}
