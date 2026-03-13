// ============================================================================
// Upgrade Trigger Logic
// Determines which contextual upgrade prompt to show free-tier users
// based on their usage milestones and behavior patterns.
// ============================================================================

export type TriggerType =
  | 'data_milestone_7d'
  | 'weight_plateau'
  | 'usage_milestone_30'
  | 'feature_discovery'

export interface TriggerProps {
  plan: string // 'free' | 'self_managed' | 'coached'
  daysTracked?: number
  mealsLogged?: number
  weightEntries?: Array<{ date: string; weight: number }>
  featureAttempted?: string
}

export interface TriggerContent {
  type: TriggerType
  title: string
  message: string
  cta: string
  link: string
}

// ---------------------------------------------------------------------------
// localStorage key helpers
// ---------------------------------------------------------------------------

const DISMISS_PREFIX = 'hp_upgrade_trigger_dismissed_'

/** Build a localStorage key for a given trigger type. */
export function getDismissKey(type: TriggerType): string {
  return `${DISMISS_PREFIX}${type}`
}

/**
 * Check whether a trigger was dismissed within the cooldown window (7 days).
 * Returns `true` if the trigger should remain hidden.
 */
export function isDismissed(type: TriggerType): boolean {
  if (typeof window === 'undefined') return false
  try {
    const raw = window.localStorage.getItem(getDismissKey(type))
    if (!raw) return false
    const dismissedAt = Number(raw)
    if (Number.isNaN(dismissedAt)) return false
    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000
    return Date.now() - dismissedAt < SEVEN_DAYS_MS
  } catch {
    return false
  }
}

/** Persist a dismissal timestamp for a trigger. */
export function dismissTrigger(type: TriggerType): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(getDismissKey(type), String(Date.now()))
  } catch {
    // localStorage may be full or blocked; fail silently
  }
}

// ---------------------------------------------------------------------------
// Condition checks
// ---------------------------------------------------------------------------

/**
 * Detect a weight plateau: weight stays within +/- 0.5 kg for 14+ consecutive
 * days based on the provided weight entries (sorted by date ascending).
 */
function hasWeightPlateau(entries: Array<{ date: string; weight: number }>): boolean {
  if (!entries || entries.length < 14) return false

  // Sort by date ascending
  const sorted = [...entries].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  )

  // Use the last 14 entries
  const recent = sorted.slice(-14)
  const baseWeight = recent[0].weight

  return recent.every((e) => Math.abs(e.weight - baseWeight) <= 0.5)
}

/**
 * Determine whether a specific trigger type should be shown, given the user's
 * current data. This does NOT check localStorage dismissals -- the caller
 * should combine this with `isDismissed()`.
 */
export function shouldShowTrigger(type: TriggerType, props: TriggerProps): boolean {
  // Only free-tier users see upgrade triggers
  if (props.plan !== 'free') return false

  switch (type) {
    case 'data_milestone_7d':
      return (props.daysTracked ?? 0) >= 7

    case 'weight_plateau':
      return hasWeightPlateau(props.weightEntries ?? [])

    case 'usage_milestone_30':
      return (props.mealsLogged ?? 0) >= 30

    case 'feature_discovery':
      return !!props.featureAttempted

    default:
      return false
  }
}

/**
 * Return the display content for a given trigger type.
 * For `feature_discovery`, the caller can optionally pass the feature name
 * to customise the message.
 */
export function getTriggerContent(
  type: TriggerType,
  featureName?: string
): TriggerContent {
  switch (type) {
    case 'data_milestone_7d':
      return {
        type,
        title: '7 天里程碑',
        message: '你已經持續追蹤 7 天了！AI 分析發現了你的飲食模式。',
        cta: '查看 AI 分析 → NT$499/月',
        link: '/upgrade?from=free',
      }

    case 'weight_plateau':
      return {
        type,
        title: '體重停滯提醒',
        message: '你的體重已經穩定了兩週。這可能代表需要調整策略。',
        cta: '讓 AI 幫你分析原因 →',
        link: '/upgrade?from=free',
      }

    case 'usage_milestone_30':
      return {
        type,
        title: '30 餐里程碑',
        message: '你已記錄 30 餐！解鎖 AI 分析，發現你的飲食模式。',
        cta: '升級自主管理 →',
        link: '/upgrade?from=free',
      }

    case 'feature_discovery':
      return {
        type,
        title: '進階功能',
        message: featureName
          ? `「${featureName}」需要自主管理方案。首月只要 NT$399。`
          : '這個功能需要自主管理方案。首月只要 NT$399。',
        cta: '了解更多 →',
        link: '/remote',
      }
  }
}

// ---------------------------------------------------------------------------
// Evaluation priority
// ---------------------------------------------------------------------------

/** Ordered list of trigger types from highest to lowest priority. */
const TRIGGER_PRIORITY: TriggerType[] = [
  'feature_discovery',   // Highest: user explicitly tried something
  'weight_plateau',      // Timely & actionable
  'data_milestone_7d',   // Early engagement hook
  'usage_milestone_30',  // Later engagement hook
]

/**
 * Evaluate all trigger conditions and return the first (highest-priority)
 * trigger that qualifies AND has not been dismissed. Returns `null` if no
 * trigger should be shown.
 */
export function getActiveTrigger(props: TriggerProps): TriggerContent | null {
  if (props.plan !== 'free') return null

  for (const type of TRIGGER_PRIORITY) {
    if (shouldShowTrigger(type, props) && !isDismissed(type)) {
      return getTriggerContent(
        type,
        type === 'feature_discovery' ? props.featureAttempted : undefined
      )
    }
  }

  return null
}
