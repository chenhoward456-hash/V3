'use client'

import { useEffect, useRef } from 'react'
import { trackArticleScroll } from '@/lib/analytics'

export function useScrollTracking(articleTitle: string) {
  const tracked25 = useRef(false)
  const tracked50 = useRef(false)
  const tracked75 = useRef(false)
  const tracked100 = useRef(false)

  useEffect(() => {
    const handleScroll = () => {
      const scrollHeight = document.documentElement.scrollHeight - window.innerHeight
      const scrolled = (window.scrollY / scrollHeight) * 100

      if (scrolled >= 25 && !tracked25.current) {
        trackArticleScroll(articleTitle, 25)
        tracked25.current = true
      }
      if (scrolled >= 50 && !tracked50.current) {
        trackArticleScroll(articleTitle, 50)
        tracked50.current = true
      }
      if (scrolled >= 75 && !tracked75.current) {
        trackArticleScroll(articleTitle, 75)
        tracked75.current = true
      }
      if (scrolled >= 100 && !tracked100.current) {
        trackArticleScroll(articleTitle, 100)
        tracked100.current = true
      }
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [articleTitle])
}
