'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { trackEvent } from '@/lib/analytics'
import {
  getActiveTrigger,
  dismissTrigger,
  type TriggerContent,
} from '@/lib/upgrade-triggers'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface UpgradeTriggerProps {
  plan: string // 'free' | 'self_managed' | 'coached'
  daysTracked?: number
  mealsLogged?: number
  weightEntries?: Array<{ date: string; weight: number }>
  featureAttempted?: string
  mealsLoggedDuringPlateau?: number
}

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

function CloseIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  )
}

function SparkleIcon() {
  return (
    <svg
      className="w-5 h-5 text-amber-400"
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <path d="M12 2l2.09 6.26L20.18 10l-6.09 1.74L12 18l-2.09-6.26L3.82 10l6.09-1.74L12 2z" />
    </svg>
  )
}

function ChartIcon() {
  return (
    <svg
      className="w-5 h-5 text-blue-400"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 3v18h18" />
      <path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3" />
    </svg>
  )
}

function TrophyIcon() {
  return (
    <svg
      className="w-5 h-5 text-yellow-500"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 9H4.5a2.5 2.5 0 010-5H6" />
      <path d="M18 9h1.5a2.5 2.5 0 000-5H18" />
      <path d="M4 22h16" />
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20 7 22" />
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20 17 22" />
      <path d="M18 2H6v7a6 6 0 0012 0V2z" />
    </svg>
  )
}

function LockOpenIcon() {
  return (
    <svg
      className="w-5 h-5 text-indigo-400"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 019.9-1" />
    </svg>
  )
}

/** Pick the right icon for each trigger type. */
function TriggerIcon({ type }: { type: string }) {
  switch (type) {
    case 'data_milestone_7d':
      return <SparkleIcon />
    case 'weight_plateau':
      return <ChartIcon />
    case 'usage_milestone_30':
      return <TrophyIcon />
    case 'feature_discovery':
      return <LockOpenIcon />
    default:
      return <SparkleIcon />
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * UpgradeTrigger -- A contextual, non-intrusive upgrade prompt for free-tier
 * users. It slides in from the bottom-right corner when a trigger condition
 * is met, and can be dismissed (remembered for 7 days via localStorage).
 *
 * Usage:
 * ```tsx
 * <UpgradeTrigger
 *   plan={client.subscription_tier}
 *   daysTracked={streakDays}
 *   mealsLogged={nutritionLogs.length}
 *   weightEntries={bodyData.map(b => ({ date: b.date, weight: b.weight }))}
 * />
 * ```
 */
export default function UpgradeTrigger({
  plan,
  daysTracked,
  mealsLogged,
  weightEntries,
  featureAttempted,
  mealsLoggedDuringPlateau,
}: UpgradeTriggerProps) {
  const [trigger, setTrigger] = useState<TriggerContent | null>(null)
  const [visible, setVisible] = useState(false)
  const [exiting, setExiting] = useState(false)

  // Evaluate triggers on mount and when props change. Defer to client-side
  // only (localStorage access).
  useEffect(() => {
    const result = getActiveTrigger({
      plan,
      daysTracked,
      mealsLogged,
      weightEntries,
      featureAttempted,
      mealsLoggedDuringPlateau,
    })

    if (result) {
      setTrigger(result)
      // Small delay so the slide-in animation is noticeable after page paint
      const timer = setTimeout(() => setVisible(true), 800)
      return () => clearTimeout(timer)
    } else {
      setTrigger(null)
      setVisible(false)
    }
  }, [plan, daysTracked, mealsLogged, weightEntries, featureAttempted, mealsLoggedDuringPlateau])

  // Track impression when the trigger becomes visible
  useEffect(() => {
    if (visible && trigger) {
      trackEvent('upgrade_trigger_shown', {
        trigger_type: trigger.type,
      })
    }
  }, [visible, trigger])

  const handleDismiss = () => {
    if (!trigger) return
    setExiting(true)

    trackEvent('upgrade_trigger_dismissed', {
      trigger_type: trigger.type,
    })

    // Wait for the exit animation to finish before removing from DOM
    setTimeout(() => {
      dismissTrigger(trigger.type)
      setVisible(false)
      setExiting(false)
      setTrigger(null)
    }, 300)
  }

  const handleCtaClick = () => {
    if (!trigger) return
    trackEvent('upgrade_trigger_cta_clicked', {
      trigger_type: trigger.type,
    })
  }

  // Don't render if there is nothing to show or still SSR
  if (!trigger || !visible) return null

  return (
    <div
      className={`
        fixed bottom-20 right-4 z-50 w-[calc(100%-2rem)] max-w-sm
        sm:bottom-6 sm:right-6 sm:w-96
        ${exiting ? 'animate-slide-out-right' : 'animate-slide-in-right'}
      `}
      role="complementary"
      aria-label="升級提示"
    >
      <div className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl shadow-black/8">
        {/* Decorative gradient bar */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500" />

        {/* Close button */}
        <button
          onClick={handleDismiss}
          className="absolute top-3 right-3 p-1 rounded-lg text-gray-300 hover:text-gray-500 hover:bg-gray-100 transition-colors"
          aria-label="關閉升級提示"
        >
          <CloseIcon />
        </button>

        {/* Content */}
        <div className="px-4 pt-5 pb-4">
          <div className="flex items-start gap-3">
            {/* Icon */}
            <div className="shrink-0 mt-0.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 flex items-center justify-center">
                <TriggerIcon type={trigger.type} />
              </div>
            </div>

            {/* Text */}
            <div className="flex-1 min-w-0 pr-4">
              <p className="text-[11px] font-semibold text-blue-600 uppercase tracking-wide mb-1">
                {trigger.title}
              </p>
              <p className="text-sm text-gray-700 leading-relaxed">
                {trigger.message}
              </p>
            </div>
          </div>

          {/* CTA */}
          <div className="mt-3.5 flex items-center gap-2">
            <Link
              href={trigger.link}
              onClick={handleCtaClick}
              className="inline-flex items-center gap-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs font-semibold px-4 py-2.5 rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-sm"
            >
              {trigger.cta}
            </Link>
            <button
              onClick={handleDismiss}
              className="text-xs text-gray-400 hover:text-gray-600 transition-colors px-2 py-2"
            >
              稍後再說
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
