'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Handles returning-user redirect logic on the homepage:
 *
 * 1. PWA / standalone mode OR ?pwa=1 query param:
 *    Auto-redirect to /c/{code} if saved code exists in localStorage.
 *
 * 2. Regular browser visit:
 *    Show a non-intrusive banner so the user can tap to return to their dashboard.
 */
export default function PwaRedirect() {
  const router = useRouter()
  const [savedCode, setSavedCode] = useState<string | null>(null)

  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as any).standalone === true

    const isPwaParam = new URLSearchParams(window.location.search).get('pwa') === '1'

    let code: string | null = null
    try {
      code = localStorage.getItem('hp_client_id')
    } catch {
      // localStorage may be unavailable (private browsing, quota, etc.)
    }

    if (!code) return

    // PWA or ?pwa=1 visitors: auto-redirect to dashboard
    if (isStandalone || isPwaParam) {
      router.replace(`/c/${code}`)
      return
    }

    // Regular browser: show return banner
    setSavedCode(code)
  }, [router])

  if (!savedCode) return null

  return (
    <div className="bg-[#2563eb] text-white text-center py-3 px-4 sticky top-0 z-50">
      <a
        href={`/c/${savedCode}`}
        className="text-sm font-medium hover:underline inline-flex items-center gap-1.5"
      >
        回到我的儀表板 &rarr;
      </a>
    </div>
  )
}
