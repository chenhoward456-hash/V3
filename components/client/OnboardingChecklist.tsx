'use client'

import { useState, useEffect, useRef } from 'react'
import { Check, ChevronRight, X } from 'lucide-react'

interface OnboardingChecklistProps {
  clientId: string
  clientName: string
  tier: string
  // Actual data to detect completion
  hasWeight: boolean       // Has at least 1 body_composition record
  hasNutrition: boolean    // Has at least 1 nutrition_logs record
  hasTraining: boolean     // Has at least 1 training_logs record (if training_enabled)
  hasWellness: boolean     // Has at least 1 daily_wellness record (if wellness_enabled)
  hasLineBinding: boolean  // client.line_user_id is not null
  // Feature flags
  trainingEnabled: boolean
  wellnessEnabled: boolean
  // Dismiss control
  onDismiss: () => void
}

interface ChecklistItem {
  id: string
  label: string
  completed: boolean
  sectionId: string | null // null means external link (LINE)
  externalUrl?: string
}

export default function OnboardingChecklist({
  clientId,
  clientName,
  tier,
  hasWeight,
  hasNutrition,
  hasTraining,
  hasWellness,
  hasLineBinding,
  trainingEnabled,
  wellnessEnabled,
  onDismiss,
}: OnboardingChecklistProps) {
  const [dismissed, setDismissed] = useState(false)
  const [celebrating, setCelebrating] = useState(false)
  const [justCompleted, setJustCompleted] = useState<Set<string>>(new Set())
  const prevCompletedRef = useRef<Set<string>>(new Set())

  const todayStr = new Date().toISOString().slice(0, 10)
  const dismissKey = `checklist_dismissed_${clientId}_${todayStr}`

  // Check if dismissed today on mount
  useEffect(() => {
    if (typeof window === 'undefined') return
    const wasDismissed = localStorage.getItem(dismissKey)
    if (wasDismissed) setDismissed(true)
  }, [dismissKey])

  // Build checklist items
  const items: ChecklistItem[] = [
    {
      id: 'weight',
      label: '記錄第一筆體重',
      completed: hasWeight,
      sectionId: 'section-body',
    },
    {
      id: 'nutrition',
      label: '記錄第一筆飲食',
      completed: hasNutrition,
      sectionId: 'section-nutrition-general',
    },
    ...(trainingEnabled
      ? [
          {
            id: 'training',
            label: '記錄第一筆訓練',
            completed: hasTraining,
            sectionId: 'section-training',
          },
        ]
      : []),
    ...(wellnessEnabled
      ? [
          {
            id: 'wellness',
            label: '記錄身心狀態',
            completed: hasWellness,
            sectionId: 'section-wellness',
          },
        ]
      : []),
    {
      id: 'line',
      label: '綁定 LINE',
      completed: hasLineBinding,
      sectionId: null,
      externalUrl: 'https://lin.ee/LP65rCc',
    },
  ]

  const completedCount = items.filter((i) => i.completed).length
  const totalCount = items.length
  const allComplete = completedCount === totalCount
  const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0

  // Track newly completed items for animation
  useEffect(() => {
    const currentCompleted = new Set(items.filter((i) => i.completed).map((i) => i.id))
    const newlyCompleted = new Set<string>()
    currentCompleted.forEach((id) => {
      if (!prevCompletedRef.current.has(id)) {
        newlyCompleted.add(id)
      }
    })
    if (newlyCompleted.size > 0) {
      setJustCompleted(newlyCompleted)
      const timer = setTimeout(() => setJustCompleted(new Set()), 800)
      return () => clearTimeout(timer)
    }
    prevCompletedRef.current = currentCompleted
  }, [hasWeight, hasNutrition, hasTraining, hasWellness, hasLineBinding]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-dismiss when all items complete: show celebration then dismiss
  useEffect(() => {
    if (allComplete && !celebrating) {
      setCelebrating(true)
      const timer = setTimeout(() => {
        handleDismiss()
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [allComplete]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleDismiss = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(dismissKey, '1')
    }
    setDismissed(true)
    onDismiss()
  }

  const handleNavigate = (item: ChecklistItem) => {
    if (item.completed) return
    if (item.externalUrl) {
      window.open(item.externalUrl, '_blank', 'noopener,noreferrer')
      return
    }
    if (item.sectionId) {
      const el = document.getElementById(item.sectionId)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    }
  }

  if (dismissed) return null

  return (
    <div className="mb-4 animate-fade-in-up">
      <div className="relative overflow-hidden rounded-2xl bg-white shadow-sm border border-gray-100">
        {/* Gradient top border */}
        <div className="h-1 bg-gradient-to-r from-blue-500 via-blue-600 to-indigo-600" />

        <div className="p-4">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              {celebrating ? (
                <span className="text-lg animate-bounce">🎉</span>
              ) : (
                <span className="text-lg">📋</span>
              )}
              <div>
                <h3 className="text-sm font-bold text-gray-900">
                  {celebrating ? '太棒了！全部完成' : '新手任務'}
                </h3>
                <p className="text-[11px] text-gray-500">
                  {celebrating
                    ? `${clientName}，你已經掌握所有基本功能！`
                    : `${completedCount}/${totalCount} 完成`}
                </p>
              </div>
            </div>
            {!celebrating && (
              <button
                onClick={handleDismiss}
                className="p-1.5 rounded-full text-gray-300 hover:text-gray-500 hover:bg-gray-50 transition-all"
                aria-label="稍後再說"
              >
                <X size={16} />
              </button>
            )}
          </div>

          {/* Progress bar */}
          <div className="mb-3">
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700 ease-out"
                style={{
                  width: `${progressPercent}%`,
                  background: allComplete
                    ? 'linear-gradient(90deg, #22c55e, #16a34a)'
                    : 'linear-gradient(90deg, #3b82f6, #6366f1)',
                }}
              />
            </div>
          </div>

          {/* Celebration message */}
          {celebrating && (
            <div className="text-center py-3 animate-celebrate">
              <div className="text-4xl mb-2 animate-bounce">🎊</div>
              <p className="text-sm font-semibold text-green-700">
                所有新手任務已完成！
              </p>
              <p className="text-xs text-gray-500 mt-1">
                繼續保持，系統會幫你追蹤所有進度
              </p>
            </div>
          )}

          {/* Checklist items */}
          {!celebrating && (
            <div className="space-y-1">
              {items.map((item) => {
                const isJustCompleted = justCompleted.has(item.id)
                return (
                  <div
                    key={item.id}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-300 ${
                      item.completed
                        ? 'bg-green-50/60'
                        : 'bg-gray-50 hover:bg-blue-50/60 cursor-pointer active:scale-[0.98]'
                    } ${isJustCompleted ? 'scale-[1.02]' : ''}`}
                    onClick={() => handleNavigate(item)}
                    role={item.completed ? undefined : 'button'}
                    tabIndex={item.completed ? undefined : 0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        handleNavigate(item)
                      }
                    }}
                  >
                    {/* Check indicator */}
                    <div
                      className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center transition-all duration-500 ${
                        item.completed
                          ? 'bg-green-500 text-white'
                          : 'border-2 border-gray-300'
                      } ${isJustCompleted ? 'animate-ping-once' : ''}`}
                    >
                      {item.completed && <Check size={12} strokeWidth={3} />}
                    </div>

                    {/* Label */}
                    <span
                      className={`flex-1 text-sm transition-all duration-300 ${
                        item.completed
                          ? 'text-green-700 line-through decoration-green-400/50'
                          : 'text-gray-700 font-medium'
                      }`}
                    >
                      {item.label}
                    </span>

                    {/* Action indicator for incomplete items */}
                    {!item.completed && (
                      <ChevronRight
                        size={16}
                        className="text-gray-300 flex-shrink-0"
                      />
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Dismiss button */}
          {!celebrating && (
            <button
              onClick={handleDismiss}
              className="mt-3 w-full text-center text-xs text-gray-400 hover:text-gray-600 transition-colors py-1"
            >
              稍後再說
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
