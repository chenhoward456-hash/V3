'use client'

import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Check } from 'lucide-react'

interface CollapsibleSectionProps {
  id: string
  icon: string
  title: string
  isCompleted: boolean
  summaryLine?: string
  isToday: boolean
  defaultOpen?: boolean
  children: React.ReactNode
}

export default function CollapsibleSection({
  id,
  icon,
  title,
  isCompleted,
  summaryLine,
  isToday,
  defaultOpen,
  children,
}: CollapsibleSectionProps) {
  // Auto-collapse completed sections only when viewing today
  const shouldAutoCollapse = isToday && isCompleted && !defaultOpen
  const [isOpen, setIsOpen] = useState(!shouldAutoCollapse)
  const contentRef = useRef<HTMLDivElement>(null)
  const [contentHeight, setContentHeight] = useState<number | undefined>(undefined)

  // Update collapse state when completion status changes (only for today)
  useEffect(() => {
    if (isToday && isCompleted && !defaultOpen) {
      setIsOpen(false)
    }
  }, [isCompleted, isToday, defaultOpen])

  // Past dates: always expanded, no collapse behavior
  useEffect(() => {
    if (!isToday) {
      setIsOpen(true)
    }
  }, [isToday])

  // Measure content height for smooth animation
  useEffect(() => {
    if (contentRef.current) {
      const observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
          setContentHeight(entry.contentRect.height)
        }
      })
      observer.observe(contentRef.current)
      return () => observer.disconnect()
    }
  }, [])

  const toggle = () => {
    if (!isToday) return // Don't allow collapse on past dates
    setIsOpen(prev => !prev)
  }

  return (
    <div id={id} className="scroll-mt-4 mb-3">
      {/* Clickable header — only interactive on today */}
      {isToday && (
        <button
          onClick={toggle}
          className="w-full flex items-center gap-2 px-4 py-2.5 rounded-t-2xl bg-white border-b border-gray-100 hover:bg-gray-50 transition-colors"
          aria-expanded={isOpen}
          aria-controls={`${id}-content`}
        >
          <span className="text-base">{icon}</span>
          <span className="text-sm font-semibold text-gray-800 flex-1 text-left">{title}</span>
          {isCompleted && (
            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-green-100">
              <Check size={12} className="text-green-600" />
            </span>
          )}
          <ChevronDown
            size={16}
            className={`text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          />
        </button>
      )}

      {/* Summary line — shown when collapsed + completed */}
      {isToday && !isOpen && isCompleted && summaryLine && (
        <button
          onClick={toggle}
          className="w-full text-left px-4 py-2 bg-green-50 rounded-b-2xl border-t-0"
        >
          <p className="text-xs text-green-700">{summaryLine}</p>
        </button>
      )}

      {/* Collapsible content */}
      <div
        id={`${id}-content`}
        className="overflow-hidden transition-[max-height] duration-300 ease-in-out"
        style={{
          maxHeight: isOpen ? (contentHeight != null ? `${contentHeight + 16}px` : '5000px') : '0px',
        }}
      >
        <div ref={contentRef}>
          {children}
        </div>
      </div>
    </div>
  )
}
