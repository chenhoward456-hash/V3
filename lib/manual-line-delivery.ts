import { pushMessage, type LineMessage } from '@/lib/line'

/** Manual commands only: stop on the first failure and never automatically resend. */
export async function sendManualLineMessages(to: string, batches: LineMessage[][], delayMs = 0) {
  let sentCount = 0
  for (const messages of batches) {
    try {
      const response = await pushMessage(to, messages, { deliveryReceipt: true })
      if (!response?.ok) return { pushed: false, sent_count: sentCount, total_count: batches.length, partial: sentCount > 0, notification: 'failed' as const, notification_status: response?.status ?? null, error: 'LINE 拒絕推送；請先核對已收到的訊息，勿整批重送' }
      sentCount++
    } catch {
      return { pushed: false, sent_count: sentCount, total_count: batches.length, partial: sentCount > 0, notification: 'unknown' as const, notification_status: null, error: 'LINE 連線中斷，最後一則是否送達不明；請先核對，勿整批重送' }
    }
    if (delayMs && sentCount < batches.length) await new Promise(resolve => setTimeout(resolve, delayMs))
  }
  return { pushed: true, sent_count: sentCount, total_count: batches.length, partial: false, notification: 'sent' as const, notification_status: 200 }
}
