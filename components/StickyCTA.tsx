'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import LineButton from '@/components/LineButton'
import ResourceDownloadButton from '@/components/ResourceDownloadButton'

interface StickyCTAProps {
  articleTitle?: string
  slug?: string
  intent?: 'fat_loss' | 'recovery' | 'muscle_gain' | 'performance'
  resource?: {
    title: string
    fileUrl: string
  }
}

export default function StickyCTA({ articleTitle, slug, intent = 'performance', resource }: StickyCTAProps) {
  const [visible, setVisible] = useState(false)
  const [closed, setClosed] = useState(false)

  useEffect(() => {
    const key = 'sticky_cta_closed'
    if (typeof window === 'undefined') return

    const isClosed = window.localStorage.getItem(key) === '1'
    if (isClosed) {
      setClosed(true)
      return
    }

    const onScroll = () => {
      const scrollHeight = document.documentElement.scrollHeight - window.innerHeight
      if (scrollHeight <= 0) return
      const scrolled = (window.scrollY / scrollHeight) * 100
      if (scrolled >= 20) {
        setVisible(true)
      }
    }

    window.addEventListener('scroll', onScroll)
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const copy = useMemo(() => {
    switch (intent) {
      case 'fat_loss':
        return '想減脂/改善腰圍，我想先從三層脂肪策略開始。'
      case 'recovery':
        return '想改善睡眠/精神/恢復，我想先從 HRV 與睡眠優化開始。'
      case 'muscle_gain':
        return '想增肌，我想先確認目前訓練計畫是否有效。'
      default:
        return '我想了解你的系統化訓練與生活型態優化方式。'
    }
  }, [intent])

  if (closed || !visible) return null

  return (
    <div className="fixed bottom-4 left-0 right-0 z-50 px-4">
      <div className="max-w-3xl mx-auto bg-white border-2 border-gray-200 shadow-xl rounded-2xl p-4 md:p-5">
        <div className="flex items-start gap-3">
          <div className="flex-1">
            <div className="text-sm font-semibold" style={{ color: '#2D2D2D' }}>
              {resource ? '想要更快開始？先把計畫表拿走' : '想把方向走對？先做 30 秒系統診斷'}
            </div>
            <div className="text-xs text-gray-600 mt-1">
              {resource ? resource.title : '我會用結果頁幫你分級引導下一步'}
            </div>
          </div>

          <button
            type="button"
            className="text-gray-400 hover:text-gray-700 text-sm"
            onClick={() => {
              setClosed(true)
              if (typeof window !== 'undefined') {
                window.localStorage.setItem('sticky_cta_closed', '1')
              }
            }}
          >
            ✕
          </button>
        </div>

        <div className="mt-3 flex flex-col md:flex-row gap-2">
          {resource ? (
            <ResourceDownloadButton
              fileUrl={resource.fileUrl}
              source="sticky_cta"
              articleTitle={articleTitle}
              slug={slug}
              className="inline-block bg-success text-white px-5 py-3 rounded-xl font-bold text-center hover:opacity-90 transition-all"
            />
          ) : (
            <Link
              href="/diagnosis"
              className="inline-block bg-primary text-white px-5 py-3 rounded-xl font-bold text-center hover:opacity-90 transition-all"
            >
              開始 30 秒診斷
            </Link>
          )}

          <LineButton
            source="sticky_cta"
            intent={intent}
            slug={slug}
            articleTitle={articleTitle}
            className="inline-block bg-gray-900 text-white px-5 py-3 rounded-xl font-bold text-center hover:opacity-90 transition-all"
          >
            直接加 LINE（我想說：{copy}）
          </LineButton>
        </div>
      </div>
    </div>
  )
}
