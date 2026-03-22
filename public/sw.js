/**
 * Service Worker — 離線快取 + 推播通知
 */

// 每次部署自動更新：cache name 含 build timestamp，舊快取自動失效
// Vercel 每次 build 會重新部署 sw.js，timestamp 就會變
const CACHE_NAME = 'hp-v5-' + '20260322'
const PRECACHE_URLS = [
  '/icon-192.png',
  '/icon-512.png',
  '/icon.svg',
  '/manifest.json',
  '/offline.html',
]

// Install: precache core assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  )
  self.skipWaiting()
})

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

// Fetch: network-first for API/pages, cache-first for static assets
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)

  // Skip non-GET and cross-origin
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return

  // API requests: network only (don't cache)
  if (url.pathname.startsWith('/api/')) return

  // Static assets (images, fonts, icons, CSS, JS): cache-first with network update
  if (
    url.pathname.match(/\.(png|jpg|jpeg|svg|ico|woff2?|ttf|css|js)$/) ||
    url.pathname.startsWith('/_next/static/')
  ) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        const fetchPromise = fetch(event.request).then((response) => {
          if (response.ok) {
            const clone = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone))
          }
          return response
        }).catch(() => cached)

        return cached || fetchPromise
      })
    )
    return
  }

  // Pages: network-first, fall back to cache, then offline fallback
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone))
        }
        return response
      })
      .catch(() => caches.match(event.request).then((cached) => cached || caches.match('/offline.html')))
  )
})

// Push notifications
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
    self.registration.showNotification(data.title || 'Howard Protocol', options)
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
        if (client.url.includes(url) && 'focus' in client) {
          return client.focus()
        }
      }
      return self.clients.openWindow(url)
    })
  )
})
