/**
 * LINE 推播額度分級 —— 重要的訊息不能被例行提醒擠掉。
 *
 * ## 為什麼有這支（2026-10-02）
 *
 * V3 官方帳號免費方案只有 200 則推播／月。2026-09-29 晚上 22:25 推「量體重提醒」時回 429，
 * 隔天早上的抽血前提醒、晨報、說明書提案全部送不出去 —— 例行提醒先到先用，把重要的擠掉了。
 *
 * 分三級（每一則都還是先試 Web Push，那不吃額度；只有要走 LINE 才來這裡問）：
 *   - critical：抽血前準備、預測對答案、實驗結果、方案到期 → 永遠可以
 *   - normal：教練週訊、系統調整熱量通知 → 用到 90% 前可以
 *   - routine：量體重提醒、催記錄 → 全月最多用 60%，而且照日期平均配（不准月初就燒光）
 *
 * 查不到額度（LINE API 掛了、沒 token）→ 放行，維持原本行為，不要因為監控壞掉讓推播全停。
 */

export type PushPriority = 'critical' | 'normal' | 'routine'

export const ROUTINE_SHARE = 0.6
export const NORMAL_CAP = 0.9

export function budgetAllows(p: {
  priority: PushPriority
  used: number
  limit: number | null
  /** 本月第幾天（1 起算，台灣時間） */
  day: number
  daysInMonth: number
}): boolean {
  if (p.priority === 'critical') return true
  if (p.limit == null || p.limit <= 0) return true // 無上限方案
  if (p.priority === 'normal') return p.used < p.limit * NORMAL_CAP
  // routine：到今天為止「該用到」的進度
  const paced = p.limit * ROUTINE_SHARE * (p.day / p.daysInMonth)
  return p.used < paced
}

type Usage = { used: number; limit: number | null }
let cache: { at: number; usage: Usage | null } | null = null
const CACHE_MS = 5 * 60 * 1000

async function fetchUsage(): Promise<Usage | null> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN
  if (!token) return null
  try {
    const headers = { Authorization: `Bearer ${token}` }
    const [q, u] = await Promise.all([
      fetch('https://api.line.me/v2/bot/message/quota', { headers }),
      fetch('https://api.line.me/v2/bot/message/quota/consumption', { headers }),
    ])
    if (!q.ok || !u.ok) return null
    const quota = (await q.json()) as { type: string; value?: number }
    const usage = (await u.json()) as { totalUsage?: number }
    return { used: usage.totalUsage ?? 0, limit: quota.type === 'limited' ? (quota.value ?? 0) : null }
  } catch {
    return null
  }
}

/** 推一則之後呼叫，讓同一輪 cron 裡的快取跟著加，不用每則都打 LINE API */
export function noteLinePushed(): void {
  if (cache?.usage) cache.usage.used += 1
}

export async function lineBudgetAllows(priority: PushPriority, now: Date = new Date()): Promise<boolean> {
  if (priority === 'critical') return true
  if (!cache || Date.now() - cache.at > CACHE_MS) cache = { at: Date.now(), usage: await fetchUsage() }
  const usage = cache.usage
  if (!usage) return true
  const tw = new Date(now.getTime() + 8 * 3600_000)
  const day = tw.getUTCDate()
  const daysInMonth = new Date(Date.UTC(tw.getUTCFullYear(), tw.getUTCMonth() + 1, 0)).getUTCDate()
  return budgetAllows({ priority, used: usage.used, limit: usage.limit, day, daysInMonth })
}

/** 測試用 */
export function __resetLineBudgetCache() { cache = null }
