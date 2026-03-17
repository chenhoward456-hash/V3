/**
 * Client Mode — Single source of truth for client mode logic
 *
 * Replaces the dual-boolean system (competition_enabled / health_mode_enabled)
 * with a single `client_mode` enum field that is inherently mutually exclusive.
 *
 * Modes:
 *   - standard: Default mode, no special features
 *   - health: Health-focused mode with quarterly cycles
 *   - bodybuilding: Competition prep (bodybuilding/physique)
 *   - athletic: Competition prep (weight-class sports: boxing, wrestling, etc.)
 */

// ═══════════════════════════════════════
// Core Types
// ═══════════════════════════════════════

export type ClientMode = 'standard' | 'health' | 'bodybuilding' | 'athletic'

export type BodybuildingPhase = 'off_season' | 'bulk' | 'cut' | 'peak_week' | 'competition' | 'recovery'

export type AthleticPhase = 'off_season' | 'preparation' | 'weigh_in' | 'rebound' | 'competition' | 'recovery'

export type PrepPhase = BodybuildingPhase | AthleticPhase

// ═══════════════════════════════════════
// Phase Constants
// ═══════════════════════════════════════

export const BODYBUILDING_PHASES: readonly BodybuildingPhase[] = [
  'off_season', 'bulk', 'cut', 'peak_week', 'competition', 'recovery',
] as const

export const ATHLETIC_PHASES: readonly AthleticPhase[] = [
  'off_season', 'preparation', 'weigh_in', 'rebound', 'competition', 'recovery',
] as const

// ═══════════════════════════════════════
// Helper Functions
// ═══════════════════════════════════════

/** Returns true for bodybuilding OR athletic mode (replaces `competition_enabled`) */
export function isCompetitionMode(mode: string | null | undefined): boolean {
  return mode === 'bodybuilding' || mode === 'athletic'
}

/** Returns true for health mode (replaces `health_mode_enabled`) */
export function isHealthMode(mode: string | null | undefined): boolean {
  return mode === 'health'
}

/** Validate a prep phase against the given client mode */
export function validatePrepPhase(phase: string, mode: string | null | undefined): boolean {
  if (mode === 'bodybuilding') {
    return (BODYBUILDING_PHASES as readonly string[]).includes(phase)
  }
  if (mode === 'athletic') {
    return (ATHLETIC_PHASES as readonly string[]).includes(phase)
  }
  return false
}

/** Get valid phases for a given client mode */
export function getValidPhases(mode: string | null | undefined): readonly string[] {
  if (mode === 'bodybuilding') return BODYBUILDING_PHASES
  if (mode === 'athletic') return ATHLETIC_PHASES
  return []
}

// ═══════════════════════════════════════
// UI Constants
// ═══════════════════════════════════════

export const PHASE_LABELS: Record<string, string> = {
  // Bodybuilding phases
  off_season: '休賽期',
  bulk: '增肌期',
  cut: '減脂期',
  peak_week: 'Peak Week',
  competition: '比賽日',
  recovery: '賽後恢復',
  // Athletic-only phases
  preparation: '備戰期',
  weigh_in: '秤重日',
  rebound: '超補償期',
}

export const MODE_LABELS: Record<ClientMode, string> = {
  standard: '一般模式',
  health: '健康模式',
  bodybuilding: '健體備賽',
  athletic: '競技備賽',
}

export const MODE_DESCRIPTIONS: Record<ClientMode, string> = {
  standard: '一般體態管理',
  health: '季度健康追蹤',
  bodybuilding: '健美/健體/比基尼',
  athletic: '拔河/拳擊/角力等量級運動',
}

export const MODE_EMOJIS: Record<ClientMode, string> = {
  standard: '📊',
  health: '🌿',
  bodybuilding: '🏆',
  athletic: '🥊',
}

export const BODYBUILDING_PHASE_OPTIONS: { value: BodybuildingPhase; label: string }[] = [
  { value: 'off_season', label: '休賽期' },
  { value: 'bulk', label: '增肌期' },
  { value: 'cut', label: '減脂期' },
  { value: 'peak_week', label: 'Peak Week' },
  { value: 'competition', label: '比賽日' },
  { value: 'recovery', label: '賽後恢復' },
]

export const ATHLETIC_PHASE_OPTIONS: { value: AthleticPhase; label: string }[] = [
  { value: 'off_season', label: '休賽期' },
  { value: 'preparation', label: '備戰期' },
  { value: 'weigh_in', label: '秤重日' },
  { value: 'rebound', label: '超補償期' },
  { value: 'competition', label: '比賽日' },
  { value: 'recovery', label: '賽後恢復' },
]

export const ALL_CLIENT_MODES: ClientMode[] = ['standard', 'health', 'bodybuilding', 'athletic']

/** Mode config for UI rendering */
export const MODE_CONFIG: Record<ClientMode, {
  label: string
  emoji: string
  description: string
  hasPhases: boolean
}> = {
  standard: {
    label: '一般模式',
    emoji: '📊',
    description: '一般體態管理',
    hasPhases: false,
  },
  health: {
    label: '健康模式',
    emoji: '🌿',
    description: '季度健康追蹤',
    hasPhases: false,
  },
  bodybuilding: {
    label: '健體備賽',
    emoji: '🏆',
    description: '健美/健體/比基尼',
    hasPhases: true,
  },
  athletic: {
    label: '競技備賽',
    emoji: '🥊',
    description: '拔河/拳擊/角力等量級運動',
    hasPhases: true,
  },
}
