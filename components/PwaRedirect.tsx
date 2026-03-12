'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Detects if the app is running in PWA standalone mode.
 * If user has a saved clientId, redirects to their dashboard.
 */
export default function PwaRedirect() {
  const router = useRouter()

  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as any).standalone === true

    if (!isStandalone) return

    try {
      const savedClientId = localStorage.getItem('hp_client_id')
      if (savedClientId) {
        router.replace(`/c/${savedClientId}`)
      }
    } catch {
      // localStorage may be unavailable (private browsing, quota, etc.)
    }
  }, [router])

  return null
}
