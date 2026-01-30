'use client'

import { useEffect } from 'react'
import { trackArticleRead, trackLineClick } from '@/lib/analytics'
import { useScrollTracking } from '@/hooks/useScrollTracking'

interface ArticleTrackerProps {
  title: string
  category: string
  readTime: string
}

export default function ArticleTracker({ title, category, readTime }: ArticleTrackerProps) {
  // 追蹤文章閱讀
  useEffect(() => {
    trackArticleRead(title, category, readTime)
  }, [title, category, readTime])

  // 追蹤捲動深度
  useScrollTracking(title)

  return null
}
