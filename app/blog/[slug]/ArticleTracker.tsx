'use client'

import { useEffect } from 'react'
import { trackArticleView } from '@/lib/analytics'
import { useScrollTracking } from '@/hooks/useScrollTracking'

interface ArticleTrackerProps {
  title: string
  category: string
  readTime: string
  slug: string
}

export default function ArticleTracker({ title, category, readTime, slug }: ArticleTrackerProps) {
  useEffect(() => {
    trackArticleView(title, category, readTime, slug)
  }, [title, category, readTime, slug])

  useScrollTracking(title, slug)

  return null
}
