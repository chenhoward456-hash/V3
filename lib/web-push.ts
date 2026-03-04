/**
 * Web Push 推播通知模組
 * 使用 VAPID 協議發送瀏覽器推播通知
 */

import webPush from 'web-push'

webPush.setVapidDetails(
  process.env.VAPID_EMAIL || 'mailto:admin@howardprotocol.com',
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
)

export interface PushSubscription {
  endpoint: string
  keys: {
    p256dh: string
    auth: string
  }
}

export interface PushPayload {
  title: string
  body: string
  icon?: string
  url?: string
}

/**
 * 發送推播通知給單一訂閱者
 */
export async function sendPushNotification(
  subscription: PushSubscription,
  payload: PushPayload
): Promise<boolean> {
  try {
    await webPush.sendNotification(
      subscription,
      JSON.stringify(payload)
    )
    return true
  } catch (err: any) {
    // 410 = 訂閱已過期，應從資料庫移除
    if (err.statusCode === 410 || err.statusCode === 404) {
      console.log('Push subscription expired:', subscription.endpoint)
      return false
    }
    console.error('Push notification error:', err)
    return false
  }
}

export { webPush }
