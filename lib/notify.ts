/**
 * 智能通知模組 — Web Push 優先，LINE Push 備援
 *
 * 策略：
 * - 每日例行提醒（早安、晚間缺記錄）→ Web Push 優先（免費無限）
 * - 關鍵通知（到期、警告、里程碑）→ 直接用 LINE Push（高價值，值得花額度）
 *
 * LINE 免費方案只有 200 則 push/月，reply 不算額度。
 * Web Push 完全免費、無上限。
 */

import { createServiceSupabase } from '@/lib/supabase'
import { sendPushNotification } from '@/lib/web-push'
import { pushMessage } from '@/lib/line'
import { createLogger } from '@/lib/logger'

const log = createLogger('notify')

export type NotifyResult = {
  method: 'web_push' | 'line_push' | 'skipped'
  success: boolean
}

/**
 * 發送例行提醒（Web Push 優先，LINE 備援）
 * 用於：早安提醒、晚間未記錄提醒等每日重複訊息
 */
export async function sendRoutineReminder(
  clientId: string,
  lineUserId: string,
  message: {
    title: string      // Web Push 標題
    body: string        // Web Push 內文
    lineText: string    // LINE 訊息文字（可含 emoji、換行）
    url?: string        // Web Push 點擊導向
  }
): Promise<NotifyResult> {
  const supabase = createServiceSupabase()

  // 1. 嘗試 Web Push（免費）
  const { data: subscriptions } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('client_id', clientId)

  if (subscriptions && subscriptions.length > 0) {
    let anySent = false
    const expired: string[] = []

    for (const sub of subscriptions) {
      const success = await sendPushNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        { title: message.title, body: message.body, url: message.url }
      )
      if (success) {
        anySent = true
      } else {
        expired.push(sub.endpoint)
      }
    }

    // 清理過期訂閱
    if (expired.length > 0) {
      await supabase
        .from('push_subscriptions')
        .delete()
        .in('endpoint', expired)
    }

    if (anySent) {
      return { method: 'web_push', success: true }
    }
    // 全部過期了，fallback 到 LINE
  }

  // 2. Fallback: LINE Push
  try {
    await pushMessage(lineUserId, [{ type: 'text', text: message.lineText }])
    return { method: 'line_push', success: true }
  } catch (err: unknown) {
    log.error('LINE push fallback failed', { clientId, error: err instanceof Error ? err.message : String(err) })
    return { method: 'line_push', success: false }
  }
}
