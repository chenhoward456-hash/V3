'use client'

import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'

export default function ManifestLink() {
  const pathname = usePathname()
  const [savedClientId, setSavedClientId] = useState<string | null>(null)

  useEffect(() => {
    // 非 dashboard 頁面：嘗試從 localStorage 讀取已存的 clientId
    if (!pathname.match(/^\/c\/([a-zA-Z0-9_-]+)/)) {
      const stored = localStorage.getItem('hp_client_id')
      if (stored && /^[a-zA-Z0-9_-]{1,20}$/.test(stored)) {
        setSavedClientId(stored)
      }
    }
  }, [pathname])

  // Dashboard pages: dynamic manifest with start_url = /c/{clientId}
  const match = pathname.match(/^\/c\/([a-zA-Z0-9_-]+)/)
  if (match) {
    return <link rel="manifest" href={`/api/manifest?clientId=${match[1]}`} />
  }

  // Non-dashboard but has saved clientId: still use dynamic manifest
  if (savedClientId) {
    return <link rel="manifest" href={`/api/manifest?clientId=${savedClientId}`} />
  }

  // Fallback: static manifest
  return <link rel="manifest" href="/manifest.json" />
}
