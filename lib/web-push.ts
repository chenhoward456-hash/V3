/**
 * Web Push 推播通知模組
 * 使用 VAPID 協議發送瀏覽器推播通知
 */

import webPush from 'web-push'
import { createLogger } from '@/lib/logger'

const log = createLogger('web-push')

let _initialized = false

function ensureVapid() {
  if (!_initialized) {
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    const privateKey = process.env.VAPID_PRIVATE_KEY
    if (!publicKey || !privateKey) {
      throw new Error('VAPID keys (NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY) 未設定')
    }
    webPush.setVapidDetails(
      process.env.VAPID_EMAIL || 'mailto:admin@howardprotocol.com',
      publicKey,
      privateKey
    )
    _initialized = true
  }
}

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
    ensureVapid()
    await webPush.sendNotification(
      subscription,
      JSON.stringify(payload)
    )
    return true
  } catch (err: any) {
    // 410 = 訂閱已過期，應從資料庫移除
    if (err.statusCode === 410 || err.statusCode === 404) {
      log.info('Push subscription expired', { endpoint: subscription.endpoint })
      return false
    }
    log.error('Push notification error', err)
    return false
  }
}

export { webPush }
