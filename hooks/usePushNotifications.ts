'use client'

import { useCallback, useEffect, useState } from 'react'

// VAPID 公鑰（base64url）轉成 pushManager.subscribe 需要的 Uint8Array
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const arr = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
  return arr
}

type PushState = 'unsupported' | 'default' | 'granted' | 'denied'

/**
 * Web Push 訂閱 hook。
 * - 沒設 NEXT_PUBLIC_VAPID_PUBLIC_KEY、或瀏覽器不支援 → state='unsupported'，UI 不顯示。
 * - 訂閱：requestPermission → SW ready → pushManager.subscribe → POST /api/push/subscribe。
 * clientId 傳 unique_code（與後端 /api/push/subscribe 一致）。
 */
export function usePushNotifications(clientId: string) {
  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const [state, setState] = useState<PushState>('unsupported')
  const [busy, setBusy] = useState(false)
  const [subscribed, setSubscribed] = useState(false)

  const supported =
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window &&
    !!vapidKey

  useEffect(() => {
    if (!supported) { setState('unsupported'); return }
    setState(Notification.permission as PushState)
    // 已經有訂閱就標記為已訂閱（避免重複跳）
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setSubscribed(!!sub))
      .catch(() => {})
  }, [supported])

  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!supported || busy) return false
    setBusy(true)
    try {
      const permission = await Notification.requestPermission()
      setState(permission as PushState)
      if (permission !== 'granted') return false

      const reg = await navigator.serviceWorker.ready
      let sub = await reg.pushManager.getSubscription()
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey!),
        })
      }

      const json = sub.toJSON()
      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          subscription: {
            endpoint: sub.endpoint,
            keys: { p256dh: json.keys?.p256dh, auth: json.keys?.auth },
          },
        }),
      })
      if (!res.ok) return false
      setSubscribed(true)
      return true
    } catch {
      return false
    } finally {
      setBusy(false)
    }
  }, [supported, busy, vapidKey, clientId])

  return { supported, state, busy, subscribed, subscribe }
}
