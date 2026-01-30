'use client'

import { trackLineClick } from '@/lib/analytics'

interface LineButtonProps {
  source: string
  className?: string
  children: React.ReactNode
}

export default function LineButton({ source, className, children }: LineButtonProps) {
  const handleClick = () => {
    trackLineClick(source)
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
