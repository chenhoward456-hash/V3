'use client'

import { useEffect, useMemo, useState } from 'react'
import { trackResourceDownload } from '@/lib/analytics'

interface ResourceDownloadButtonProps {
  fileUrl: string
  source: string
  articleTitle?: string
  slug?: string
  className?: string
  variantOverride?: 'A' | 'B'
  textA?: string
  textB?: string
}

export default function ResourceDownloadButton({
  fileUrl,
  source,
  articleTitle,
  slug,
  className,
  variantOverride,
  textA = '免費下載 PDF',
  textB = '拿到 12 週計畫表（含追蹤表）',
}: ResourceDownloadButtonProps) {
  const [storedVariant, setStoredVariant] = useState<'A' | 'B' | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const key = 'ab_download_variant'
    const existing = window.localStorage.getItem(key)
    if (existing === 'A' || existing === 'B') {
      setStoredVariant(existing)
      return
    }
    const next = Math.random() < 0.5 ? 'A' : 'B'
    window.localStorage.setItem(key, next)
    setStoredVariant(next)
  }, [])

  const variant = useMemo(() => {
    return variantOverride ?? storedVariant ?? 'A'
  }, [storedVariant, variantOverride])

  const buttonText = variant === 'B' ? textB : textA

  return (
    <a
      href={fileUrl}
      download
      className={className}
      onClick={() => {
        trackResourceDownload(fileUrl, source, {
          articleTitle,
          slug,
          variant,
        })
      }}
    >
      {buttonText}
    </a>
  )
}
