// Serwist service worker 源碼。build 時由 @serwist/next 編譯成 public/sw.js。
// 取代原本手刻的 public/sw.js：install/activate/fetch/precache/離線 fallback 全自動，
// 快取版本自動管理（不用再手動 bump CACHE_NAME）。
// ⚠️ 原本的「push / notificationclick」推播處理完整搬過來——陳胤豪每早收量體重推播靠這個，不能掉。
// 這個檔在 tsconfig exclude（webworker 型別跟 dom 衝突），由 Serwist 獨立編譯。
import { defaultCache } from '@serwist/next/worker'
import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist'
import { Serwist } from 'serwist'

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined
  }
}
declare const self: ServiceWorkerGlobalScope

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
  fallbacks: {
    entries: [
      { url: '/offline.html', matcher: ({ request }) => request.destination === 'document' },
    ],
  },
})

// ── 推播（原 sw.js 逐字搬過來，行為不變）──
self.addEventListener('push', (event) => {
  if (!event.data) return
  const data = event.data.json()
  const options = {
    body: data.body || '',
    icon: data.icon || '/icon-192.png',
    badge: '/icon-192.png',
    data: { url: data.url || '/' },
    vibrate: [100, 50, 100],
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'Howard Protocol', options as NotificationOptions)
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  let url = event.notification.data?.url || '/'
  // 只允許同源路徑，防止 open redirect
  if (!url.startsWith('/')) url = '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(url) && 'focus' in client) return client.focus()
      }
      return self.clients.openWindow(url)
    })
  )
})

serwist.addEventListeners()
