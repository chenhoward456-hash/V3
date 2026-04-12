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
  const [scrollDepth, setScrollDepth] = useState(0)

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
      setScrollDepth(scrolled)
      if (scrolled >= 20) {
        setVisible(true)
      }
    }

    window.addEventListener('scroll', onScroll, { passive: true })
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

  const dynamicCopy = useMemo(() => {
    if (scrollDepth < 40) {
      return {
        title: '想知道你一天該吃多少？',
        subtitle: '10 秒填完，馬上看到你的每日熱量和營養素目標',
        buttonText: '免費算我的營養目標',
      }
    } else if (scrollDepth < 70) {
      return {
        title: resource ? '拿免費計畫表，直接開始執行' : '你的營養目標，10 秒就能算出來',
        subtitle: resource ? '12 週完整計畫，立即下載' : '不用註冊、不用付費',
        buttonText: resource ? '下載計畫表' : '免費算我的營養目標',
      }
    } else {
      return {
        title: resource ? '計畫表準備好了，拿走開始' : '看完了，算一下你的數字吧',
        subtitle: resource ? '立即下載' : '已有 200+ 人完成分析',
        buttonText: resource ? '免費下載' : '10 秒算出我的目標',
      }
    }
  }, [scrollDepth, resource])

  if (closed || !visible) return null

  return (
    <div className="fixed bottom-4 left-0 right-0 z-50 px-4">
      <div className="max-w-3xl mx-auto bg-white border-2 border-gray-200 shadow-xl rounded-2xl p-4 md:p-5">
        <div className="flex items-start gap-3">
          <div className="flex-1">
            <div className="text-sm font-semibold" style={{ color: '#2D2D2D' }}>
              {dynamicCopy.title}
            </div>
            <div className="text-xs text-gray-600 mt-1">
              {dynamicCopy.subtitle}
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

        <div className="mt-3">
          {resource ? (
            <ResourceDownloadButton
              fileUrl={resource.fileUrl}
              source="sticky_cta"
              articleTitle={articleTitle}
              slug={slug}
              className="w-full inline-block bg-blue-600 text-white px-5 py-3.5 rounded-xl font-bold text-center text-base hover:bg-blue-700 transition-all"
            />
          ) : (
            <Link
              href="/join"
              className="w-full inline-block bg-blue-600 text-white px-5 py-3.5 rounded-xl font-bold text-center text-base hover:bg-blue-700 transition-all"
            >
              {dynamicCopy.buttonText}
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
