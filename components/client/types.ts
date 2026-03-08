export interface LabResult {
  id: string
  test_name: string
  value: number
  unit: string
  reference_range: string
  status: 'normal' | 'attention' | 'alert'
  date: string
  custom_advice?: string
  custom_target?: string
}

export interface Supplement {
  id: string
  name: string
  dosage: string
  timing: string
  why?: string
  sort_order?: number
}

export interface BodyData {
  id: string
  date: string
  weight: number | null
  body_fat: number | null
  muscle_mass: number | null
  height: number | null
  visceral_fat: number | null
}

export interface WellnessData {
  id: string
  date: string
  sleep_quality: number | null
  energy_level: number | null
  mood: number | null
  note: string | null
  // 穿戴裝置數據
  device_recovery_score?: number | null
  resting_hr?: number | null
  hrv?: number | null
  wearable_sleep_score?: number | null
  respiratory_rate?: number | null
  // 進階主觀指標
  training_drive?: number | null
  cognitive_clarity?: number | null
  stress_level?: number | null
}

export interface TrainingLog {
  id: string
  date: string
  training_type: 'push' | 'pull' | 'legs' | 'full_body' | 'cardio' | 'rest' | 'chest' | 'shoulder' | 'arms'
  duration: number | null
  sets: number | null
  rpe: number | null
  note: string | null
}

export const TRAINING_TYPES = [
  { value: 'push', label: '推', emoji: '🫸' },
  { value: 'pull', label: '拉', emoji: '🫷' },
  { value: 'legs', label: '腿', emoji: '🦵' },
  { value: 'full_body', label: '全身', emoji: '🏋️' },
  { value: 'cardio', label: '有氧', emoji: '🏃' },
  { value: 'chest', label: '胸', emoji: '💪' },
  { value: 'shoulder', label: '肩', emoji: '🏔️' },
  { value: 'arms', label: '手臂', emoji: '💪🏼' },
  { value: 'rest', label: '休息', emoji: '😴' },
] as const

// 重訓類型 — 只有這些算「訓練日」影響碳循環
export const WEIGHT_TRAINING_TYPES = ['push', 'pull', 'legs', 'full_body', 'chest', 'shoulder', 'arms'] as const
export function isWeightTraining(type: string | null | undefined): boolean {
  return WEIGHT_TRAINING_TYPES.includes(type as typeof WEIGHT_TRAINING_TYPES[number])
}

export interface NutritionLog {
  id: string
  date: string
  compliant: boolean
  note: string | null
}

export interface ClientInfo {
  name: string
  status: string
  coach_summary?: string
  next_checkup_date?: string
  health_goals?: string
  lab_results?: LabResult[]
  supplements?: Supplement[]
}

export function getLabAdvice(testName: string, value: number): string {
  switch (testName) {
    case 'HOMA-IR': return value < 1.0 ? '胰島素敏感度很好' : value < 1.4 ? '胰島素敏感度正常' : '胰島素阻抗偏高'
    case '同半胱胺酸': return value < 8 ? '甲基化代謝正常' : '甲基化代謝需要改善'
    case '維生素D': return value > 50 ? '維生素D充足' : value > 30 ? '維生素D偏低，建議補充' : '維生素D不足'
    case '鐵蛋白': return value >= 50 && value <= 150 ? '鐵儲存正常' : value < 50 ? '鐵儲存偏低' : '鐵儲存偏高'
    default: return ''
  }
}
