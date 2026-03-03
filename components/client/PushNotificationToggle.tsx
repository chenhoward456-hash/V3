'use client'

import { useState, useEffect } from 'react'

interface PushNotificationToggleProps {
  clientId: string
}

export default function PushNotificationToggle({ clientId }: PushNotificationToggleProps) {
  const [supported, setSupported] = useState(false)
  const [subscribed, setSubscribed] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      setSupported(true)
      // 檢查是否已訂閱
      navigator.serviceWorker.ready.then(reg => {
        reg.pushManager.getSubscription().then(sub => {
          setSubscribed(!!sub)
        })
      })
    }
  }, [])

  useEffect(() => {
    // 註冊 Service Worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }
  }, [])

  const handleToggle = async () => {
    if (!supported) return
    setLoading(true)

    try {
      const reg = await navigator.serviceWorker.ready

      if (subscribed) {
        // 取消訂閱
        const sub = await reg.pushManager.getSubscription()
        if (sub) await sub.unsubscribe()
        setSubscribed(false)
      } else {
        // 訂閱
        const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
        if (!vapidKey) {
          alert('推播服務尚未設定')
          return
        }
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey),
        })
        // 送到後端儲存
        await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clientId, subscription: sub.toJSON() }),
        })
        setSubscribed(true)
      }
    } catch (err) {
      console.error('Push subscription error:', err)
    } finally {
      setLoading(false)
    }
  }

  if (!supported) return null

  return (
    <div className="bg-white rounded-3xl shadow-sm p-5 mb-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">{subscribed ? '🔔' : '🔕'}</span>
          <div>
            <p className="text-sm font-medium text-gray-900">每日打卡提醒</p>
            <p className="text-xs text-gray-500">{subscribed ? '已開啟推播通知' : '開啟後每天提醒你記錄'}</p>
          </div>
        </div>
        <button
          onClick={handleToggle}
          disabled={loading}
          className={`relative w-12 h-7 rounded-full transition-colors ${subscribed ? 'bg-blue-600' : 'bg-gray-300'} ${loading ? 'opacity-50' : ''}`}
        >
          <span className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${subscribed ? 'translate-x-5' : ''}`} />
        </button>
      </div>
    </div>
  )
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map(char => char.charCodeAt(0)))
}
