'use client'

import { trackLineClick } from '@/lib/analytics'

interface LineButtonProps {
  source: string
  intent?: string
  slug?: string
  articleTitle?: string
  variant?: string
  className?: string
  children: React.ReactNode
}

export default function LineButton({ source, intent, slug, articleTitle, variant, className, children }: LineButtonProps) {
  const handleClick = () => {
    trackLineClick(source, {
      intent,
      slug,
      articleTitle,
      variant,
    })
  }

  return (
    <a
      href="https://lin.ee/dnbucVw"
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      onClick={handleClick}
    >
      {children}
    </a>
  )
}
