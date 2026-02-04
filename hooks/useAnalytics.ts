// 進階數據分析 Hook
import { useEffect, useRef } from 'react'
import { trackEvent, AnalyticsEvents } from '@/lib/analytics'

// 滾動深度追蹤 Hook
export function useScrollDepth(thresholds: number[] = [25, 50, 75, 90]) {
  const trackedDepths = useRef<Set<number>>(new Set())

  useEffect(() => {
    const handleScroll = () => {
      const scrollHeight = document.documentElement.scrollHeight - window.innerHeight
      const scrollPosition = window.scrollY
      const scrollPercentage = Math.round((scrollPosition / scrollHeight) * 100)

      thresholds.forEach(threshold => {
        if (scrollPercentage >= threshold && !trackedDepths.current.has(threshold)) {
          trackEvent(AnalyticsEvents.SCROLL_DEPTH, {
            scroll_percentage: threshold,
            page: window.location.pathname
          })
          trackedDepths.current.add(threshold)
        }
      })
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [thresholds])
}

// 頁面停留時間追蹤 Hook
export function useTimeOnPage() {
  const startTime = useRef(Date.now())

  useEffect(() => {
    const handlePageUnload = () => {
      const timeSpent = Math.round((Date.now() - startTime.current) / 1000)
      trackEvent(AnalyticsEvents.TIME_ON_PAGE, {
        time_seconds: timeSpent,
        page: window.location.pathname
      })
    }

    window.addEventListener('beforeunload', handlePageUnload)
    return () => window.removeEventListener('beforeunload', handlePageUnload)
  }, [])
}

// CTA 點擊追蹤 Hook
export function useCTATracking(ctaName: string, location: string) {
  const handleClick = () => {
    trackEvent(AnalyticsEvents.CTA_CLICKED, {
      cta_name: ctaName,
      location: location,
      page: window.location.pathname
    })
  }

  return handleClick
}
