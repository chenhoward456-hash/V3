'use client'

import { useState } from 'react'

interface ErrorBoundaryProps {
  children: React.ReactNode
  fallback?: React.ReactNode
}

interface ErrorState {
  hasError: boolean
  error?: Error
}

export default function ErrorBoundary({ children, fallback }: ErrorBoundaryProps) {
  const [errorState, setErrorState] = useState<ErrorState>({ hasError: false })
  
  const handleError = (error: Error) => {
    setErrorState({ hasError: true, error })
  }
  
  const resetError = () => {
    setErrorState({ hasError: false })
  }
  
  if (errorState.hasError) {
    return fallback || (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
        <div className="text-red-600 mb-4">
          <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h3 className="text-lg font-bold text-red-800 mb-2">發生錯誤</h3>
        <p className="text-red-600 mb-4">
          {errorState.error?.message || '系統暫時出現問題，請稍後再試。'}
        </p>
        <button 
          onClick={resetError}
          className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
        >
          重新載入
        </button>
      </div>
    )
  }
  
  return <>{children}</>
}

// 表單錯誤處理 Hook
export function useFormError() {
  const [error, setError] = useState('')
  
  const showError = (message: string) => {
    setError(message)
    setTimeout(() => setError(''), 5000) // 5秒後自動清除
  }
  
  const clearError = () => setError('')
  
  return { error, showError, clearError }
}
