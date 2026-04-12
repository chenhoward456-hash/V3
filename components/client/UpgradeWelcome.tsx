'use client'

import { useState, useEffect, useRef } from 'react'
import { Check, ChevronRight, X, ExternalLink } from 'lucide-react'

const TIER_RANK: Record<string, number> = {
  free: 0,
  self_managed: 1,
  coached: 2,
}

function getStorageKey(clientId: string) {
  return `hp_last_known_tier_${clientId}`
}

function getDismissKey(clientId: string) {
  return `hp_upgrade_checklist_dismissed_${clientId}`
}

type UpgradePath = 'free→self_managed' | 'any→coached'

interface ChecklistTask {
  id: string
  icon: string
  title: string
  description: string
  completed: boolean
  action?: { type: 'scroll'; sectionId: string } | { type: 'link'; url: string } | { type: 'callback'; callback: () => void }
}

interface UpgradeWelcomeProps {
  clientId: string
  tier: string | null
  // free -> self_managed checklist data
  todayBody?: boolean
  todayNutrition?: boolean
  todayTraining?: boolean
  todayWellness?: boolean
  // any -> coached checklist data
  supplementCount?: number
  labResultCount?: number
  hasGeneData?: boolean
  // Callback to open AI chat
  onOpenAiChat?: () => void
}

function buildTasks(
  upgradePath: UpgradePath,
  props: UpgradeWelcomeProps,
): ChecklistTask[] {
  if (upgradePath === 'free→self_managed') {
    return [
      {
        id: 'body',
        icon: '\u2696\uFE0F',
        title: '\u8A18\u9304\u9AD4\u91CD',
        description: '\u8A18\u4E0B\u4ECA\u5929\u7684\u9AD4\u91CD\uFF0C\u958B\u59CB\u8FFD\u8E64\u9032\u5EA6',
        completed: !!props.todayBody,
        action: { type: 'scroll', sectionId: 'section-body' },
      },
      {
        id: 'nutrition',
        icon: '\uD83E\uDD57',
        title: '\u8A18\u9304\u98F2\u98DF',
        description: '\u8A18\u4E0B\u4ECA\u5929\u5403\u4E86\u4EC0\u9EBC\uFF0CAI \u5E6B\u4F60\u6821\u6B63\u71B1\u91CF',
        completed: !!props.todayNutrition,
        action: { type: 'scroll', sectionId: 'section-nutrition-general' },
      },
      {
        id: 'training',
        icon: '\uD83C\uDFCB\uFE0F',
        title: '\u8A18\u9304\u8A13\u7DF4',
        description: '\u8A18\u4E0B\u4ECA\u5929\u7684\u8A13\u7DF4\u5167\u5BB9\u8207\u5F37\u5EA6',
        completed: !!props.todayTraining,
        action: { type: 'scroll', sectionId: 'section-training' },
      },
      {
        id: 'wellness',
        icon: '\uD83D\uDE0A',
        title: '\u586B\u5BEB\u611F\u53D7',
        description: '\u8A18\u9304\u7761\u7720\u3001\u7CBE\u529B\u3001\u5FC3\u60C5\u8B93\u7CFB\u7D71\u66F4\u4E86\u89E3\u4F60',
        completed: !!props.todayWellness,
        action: { type: 'scroll', sectionId: 'section-wellness' },
      },
      {
        id: 'ai_chat',
        icon: '\uD83E\uDD16',
        title: '\u8DDF AI \u9867\u554F\u804A\u4E00\u6B21',
        description: '\u554F\u4EFB\u4F55\u98F2\u98DF\u6216\u8A13\u7DF4\u554F\u984C\uFF0C\u7ACB\u523B\u5F97\u5230\u5EFA\u8B70',
        completed: false, // Can't auto-detect, user must click
        action: props.onOpenAiChat
          ? { type: 'callback', callback: props.onOpenAiChat }
          : undefined,
      },
    ]
  }

  // any -> coached
  return [
    {
      id: 'supplements',
      icon: '\uD83D\uDC8A',
      title: '\u52A0\u5165\u4F60\u5728\u5403\u7684\u88DC\u54C1',
      description: '\u8B93\u6559\u7DF4\u77E5\u9053\u4F60\u76EE\u524D\u7684\u88DC\u5145\u65B9\u6848',
      completed: (props.supplementCount ?? 0) > 0,
      action: { type: 'scroll', sectionId: 'section-supplements' },
    },
    {
      id: 'lab',
      icon: '\uD83E\uDE78',
      title: '\u4E0A\u50B3\u8840\u6AA2\u5831\u544A',
      description: '\u4E0A\u50B3\u5F8C\u6559\u7DF4\u6703\u5354\u52A9\u5206\u6790\u4F60\u7684\u5065\u5EB7\u72C0\u6CC1',
      completed: (props.labResultCount ?? 0) > 0,
      action: { type: 'scroll', sectionId: 'section-lab' },
    },
    {
      id: 'gene',
      icon: '\uD83E\uDDEC',
      title: '\u586B\u5BEB\u57FA\u56E0\u8CC7\u6599',
      description: '\u63D0\u4F9B\u57FA\u56E0\u6AA2\u6E2C\u7D50\u679C\u4EE5\u500B\u4EBA\u5316\u88DC\u54C1\u5EFA\u8B70',
      completed: !!props.hasGeneData,
      action: { type: 'scroll', sectionId: 'section-lab' },
    },
    {
      id: 'line_coach',
      icon: '\uD83D\uDCAC',
      title: '\u5728 LINE \u8DDF\u6559\u7DF4\u6253\u62DB\u547C',
      description: '\u8B93\u6559\u7DF4\u77E5\u9053\u4F60\u5DF2\u7D93\u52A0\u5165\uFF0C\u958B\u59CB\u4E00\u5C0D\u4E00\u6307\u5C0E',
      completed: false, // Can't auto-detect
      action: { type: 'link', url: 'https://lin.ee/LP65rCc' },
    },
  ]
}

export default function UpgradeWelcome({
  clientId,
  tier,
  todayBody,
  todayNutrition,
  todayTraining,
  todayWellness,
  supplementCount,
  labResultCount,
  hasGeneData,
  onOpenAiChat,
}: UpgradeWelcomeProps) {
  const [upgradePath, setUpgradePath] = useState<UpgradePath | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const [celebrating, setCelebrating] = useState(false)
  const [justCompleted, setJustCompleted] = useState<Set<string>>(new Set())
  const prevCompletedRef = useRef<Set<string>>(new Set())

  // Detect tier upgrade (same logic as before)
  useEffect(() => {
    const currentTier = tier || 'free'
    const key = getStorageKey(clientId)
    const dismissKey = getDismissKey(clientId)
    const lastKnown = localStorage.getItem(key)

    // Already dismissed permanently
    if (localStorage.getItem(dismissKey)) {
      return
    }

    if (lastKnown === null) {
      // First visit: store current tier, don't show checklist
      localStorage.setItem(key, currentTier)
      return
    }

    const lastRank = TIER_RANK[lastKnown] ?? 0
    const currentRank = TIER_RANK[currentTier] ?? 0

    if (currentRank > lastRank) {
      // Determine upgrade path
      if (currentTier === 'coached') {
        setUpgradePath('any→coached')
      } else if (currentTier === 'self_managed' && lastKnown === 'free') {
        setUpgradePath('free→self_managed')
      }
    } else {
      // Tier same or downgraded: update stored tier silently
      localStorage.setItem(key, currentTier)
    }
  }, [clientId, tier])

  // Build tasks based on upgrade path
  const tasks = upgradePath
    ? buildTasks(upgradePath, {
        clientId,
        tier,
        todayBody,
        todayNutrition,
        todayTraining,
        todayWellness,
        supplementCount,
        labResultCount,
        hasGeneData,
        onOpenAiChat,
      })
    : []

  const completedCount = tasks.filter((t) => t.completed).length
  const totalCount = tasks.length
  const allComplete = completedCount === totalCount && totalCount > 0
  const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0

  // Track newly completed items for animation
  useEffect(() => {
    if (!tasks.length) return
    const currentCompleted = new Set(tasks.filter((t) => t.completed).map((t) => t.id))
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
  }, [todayBody, todayNutrition, todayTraining, todayWellness, supplementCount, labResultCount, hasGeneData]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-celebrate when all tasks complete
  useEffect(() => {
    if (allComplete && !celebrating && !dismissed) {
      setCelebrating(true)
      const timer = setTimeout(() => {
        handleDismiss()
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [allComplete]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleDismiss() {
    const currentTier = tier || 'free'
    // Update stored tier so banner won't show again
    localStorage.setItem(getStorageKey(clientId), currentTier)
    // Permanently dismiss
    localStorage.setItem(getDismissKey(clientId), '1')
    setDismissed(true)
    setUpgradePath(null)
  }

  function handleTaskClick(task: ChecklistTask) {
    if (task.completed) return
    if (!task.action) return

    if (task.action.type === 'scroll') {
      const el = document.getElementById(task.action.sectionId)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    } else if (task.action.type === 'link') {
      window.open(task.action.url, '_blank', 'noopener,noreferrer')
    } else if (task.action.type === 'callback') {
      task.action.callback()
    }
  }

  if (!upgradePath || dismissed) return null

  const tierLabel = upgradePath === 'free→self_managed' ? '自主管理版' : '教練版'

  return (
    <div className="mb-4 animate-fade-in-up">
      <div className="relative overflow-hidden rounded-2xl bg-white shadow-sm border border-gray-100">
        {/* Gradient top border */}
        <div
          className="h-1"
          style={{
            background:
              upgradePath === 'any→coached'
                ? 'linear-gradient(90deg, #8b5cf6, #6366f1, #3b82f6)'
                : 'linear-gradient(90deg, #3b82f6, #6366f1, #8b5cf6)',
          }}
        />

        <div className="p-4">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              {celebrating ? (
                <span className="text-lg animate-bounce">🎉</span>
              ) : (
                <span className="text-lg">🚀</span>
              )}
              <div>
                <h3 className="text-sm font-bold text-gray-900">
                  {celebrating ? '太棒了！全部完成' : `已升級至${tierLabel}！`}
                </h3>
                <p className="text-[11px] text-gray-500">
                  {celebrating
                    ? '你已經完成所有新手任務，開始享受新功能吧！'
                    : `完成以下任務開始使用 (${completedCount}/${totalCount})`}
                </p>
              </div>
            </div>
            {!celebrating && (
              <button
                onClick={handleDismiss}
                className="p-1.5 rounded-full text-gray-300 hover:text-gray-500 hover:bg-gray-50 transition-all"
                aria-label="關閉"
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
                    : upgradePath === 'any→coached'
                      ? 'linear-gradient(90deg, #8b5cf6, #6366f1)'
                      : 'linear-gradient(90deg, #3b82f6, #6366f1)',
                }}
              />
            </div>
          </div>

          {/* Celebration */}
          {celebrating && (
            <div className="text-center py-3 animate-celebrate">
              <div className="text-4xl mb-2 animate-bounce">🎊</div>
              <p className="text-sm font-semibold text-green-700">
                所有升級任務已完成！
              </p>
              <p className="text-xs text-gray-500 mt-1">
                繼續保持，系統會幫你追蹤所有進度
              </p>
            </div>
          )}

          {/* Task list */}
          {!celebrating && (
            <div className="space-y-1">
              {tasks.map((task) => {
                const isJustCompleted = justCompleted.has(task.id)
                const isExternal = task.action?.type === 'link'

                return (
                  <div
                    key={task.id}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-300 ${
                      task.completed
                        ? 'bg-green-50/60'
                        : 'bg-gray-50 hover:bg-blue-50/60 cursor-pointer active:scale-[0.98]'
                    } ${isJustCompleted ? 'scale-[1.02]' : ''}`}
                    onClick={() => handleTaskClick(task)}
                    role={task.completed ? undefined : 'button'}
                    tabIndex={task.completed ? undefined : 0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        handleTaskClick(task)
                      }
                    }}
                  >
                    {/* Check indicator */}
                    <div
                      className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center transition-all duration-500 ${
                        task.completed
                          ? 'bg-green-500 text-white'
                          : 'border-2 border-gray-300'
                      } ${isJustCompleted ? 'animate-ping-once' : ''}`}
                    >
                      {task.completed && <Check size={12} strokeWidth={3} />}
                    </div>

                    {/* Icon + text */}
                    <span className="text-base flex-shrink-0" aria-hidden="true">
                      {task.icon}
                    </span>
                    <div className="flex-1 min-w-0">
                      <span
                        className={`text-sm transition-all duration-300 ${
                          task.completed
                            ? 'text-green-700 line-through decoration-green-400/50'
                            : 'text-gray-700 font-medium'
                        }`}
                      >
                        {task.title}
                      </span>
                      <p className="text-[11px] text-gray-400 leading-tight mt-0.5 truncate">
                        {task.description}
                      </p>
                    </div>

                    {/* Action indicator */}
                    {!task.completed && (
                      isExternal ? (
                        <ExternalLink size={14} className="text-gray-300 flex-shrink-0" />
                      ) : (
                        <ChevronRight size={16} className="text-gray-300 flex-shrink-0" />
                      )
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* All complete / dismiss button */}
          {!celebrating && allComplete && (
            <button
              onClick={handleDismiss}
              className="mt-3 w-full text-center text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors py-2 bg-blue-50 rounded-xl"
            >
              全部完成
            </button>
          )}
          {!celebrating && !allComplete && (
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
