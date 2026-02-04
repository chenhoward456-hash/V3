'use client'

import { useState } from 'react'

interface LoadingButtonProps {
  children: React.ReactNode
  onClick?: () => void | Promise<void>
  disabled?: boolean
  className?: string
  loadingText?: string
}

export default function LoadingButton({ 
  children, 
  onClick, 
  disabled = false,
  className = '',
  loadingText = '載入中...'
}: LoadingButtonProps) {
  const [isLoading, setIsLoading] = useState(false)
  
  const handleClick = async () => {
    if (onClick && !isLoading && !disabled) {
      setIsLoading(true)
      try {
        await onClick()
      } finally {
        setIsLoading(false)
      }
    }
  }
  
  return (
    <button
      onClick={handleClick}
      disabled={disabled || isLoading}
      className={`bg-primary text-white px-8 py-4 rounded-xl font-bold transition-all hover:opacity-90 disabled:opacity-50 ${className}`}
    >
      {isLoading ? loadingText : children}
    </button>
  )
}
