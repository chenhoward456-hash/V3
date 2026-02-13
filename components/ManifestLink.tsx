'use client'

import { usePathname } from 'next/navigation'

export default function ManifestLink() {
  const pathname = usePathname()

  // 學員頁面不注入 manifest，讓 iOS Safari 用當前 URL 加入主畫面
  if (pathname.startsWith('/c/')) return null

  return <link rel="manifest" href="/manifest.json" />
}
