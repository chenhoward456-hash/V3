'use client'

import React from 'react'

interface ErrorBoundaryProps {
  children: React.ReactNode
  fallback?: React.ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export default class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo)
  }

  resetErrorBoundary = (): void => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="min-h-[200px] flex items-center justify-center px-4 py-12">
          <div className="text-center max-w-sm">
            <div className="text-5xl mb-4">⚠️</div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              頁面發生錯誤
            </h2>
            <p className="text-gray-600 text-sm mb-6">
              很抱歉，頁面遇到了問題。請嘗試重新整理。
            </p>
            <button
              onClick={this.resetErrorBoundary}
              className="inline-flex items-center gap-2 bg-blue-600 text-white text-sm font-semibold px-6 py-2.5 rounded-xl hover:bg-blue-700 transition-colors"
            >
              重新整理
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

/** Lightweight error boundary for individual dashboard sections */
interface SectionErrorBoundaryProps {
  children: React.ReactNode
  name?: string
}

interface SectionErrorBoundaryState {
  hasError: boolean
}

export class SectionErrorBoundary extends React.Component<SectionErrorBoundaryProps, SectionErrorBoundaryState> {
  constructor(props: SectionErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(): SectionErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error(`[SectionError:${this.props.name || 'unknown'}]`, error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 mb-3 text-center">
          <p className="text-xs text-gray-400">此區塊暫時無法顯示</p>
        </div>
      )
    }
    return this.props.children
  }
}
