export interface DiagnosisData {
  location: 'taichung' | 'other'
  goals: string[]
  experience: string
  commitment: string
  budget: string
}

export interface ServicePlan {
  id: string
  name: string
  price: number
  features: string[]
  suitableFor: string[]
  location?: 'taichung' | 'all'
}

export interface Testimonial {
  id: string
  name: string
  role: string
  avatar?: string
  content: string
  result: string
  rating: number
  date: string
}

export interface BlogPost {
  id: string
  title: string
  slug: string
  excerpt: string
  content: string
  publishedAt: string
  tags: string[]
  readingTime: number
}

export interface ContactForm {
  name: string
  email: string
  phone?: string
  message: string
  service?: string
}

export interface AnalyticsEvent {
  event: string
  parameters?: Record<string, string | number | boolean>
  timestamp: number
}

// === Client & Database Types ===

export type SubscriptionTier = 'free' | 'self_managed' | 'coached'
export type GoalType = 'cut' | 'bulk'
export type ActivityProfile = 'sedentary' | 'high_energy_flux'
export type LabStatus = 'normal' | 'attention' | 'alert'
export type Gender = '男性' | '女性' | '其他'
export type ClientMode = 'standard' | 'health' | 'bodybuilding' | 'athletic'

export interface Client {
  id: string
  unique_code: string
  name: string
  age: number | null
  gender: Gender | null
  status: string | null
  is_active: boolean
  subscription_tier: SubscriptionTier
  expires_at: string | null
  goal_type: GoalType | null
  activity_profile: ActivityProfile | null
  diet_start_date: string | null
  calories_target: number | null
  protein_target: number | null
  carbs_target: number | null
  fat_target: number | null
  water_target: number | null
  carbs_training_day: number | null
  carbs_rest_day: number | null
  target_weight: number | null
  body_fat_target: number | null
  target_date: string | null
  competition_date: string | null
  prep_phase: string | null
  weigh_in_gap_hours: number | null
  nutrition_enabled: boolean
  supplement_enabled: boolean
  wellness_enabled: boolean
  training_enabled: boolean
  body_composition_enabled: boolean
  lab_enabled: boolean
  ai_chat_enabled: boolean
  client_mode: ClientMode
  /** @deprecated Use client_mode instead */
  competition_enabled: boolean
  /** @deprecated Use client_mode instead */
  health_mode_enabled: boolean
  simple_mode: boolean
  coach_weekly_note: string | null
  coach_summary: string | null
  coach_macro_override: {
    locked_at: string
    locked_fields: string[]
    previous_values?: Record<string, number | null>
  } | null
  next_checkup_date: string | null
  quarterly_cycle_start: string | null
  created_at: string
  lab_results?: LabResult[]
  supplements?: Supplement[]
}

export interface LabResult {
  id: string
  client_id: string
  test_name: string
  value: number
  unit: string
  status: LabStatus
  reference_range: string | null
  custom_target: string | null
  custom_advice: string | null
  date: string
}

export interface Supplement {
  id: string
  client_id: string
  name: string
  dosage: string | null
  timing: string | null
  why: string | null
  sort_order: number
}

export interface SupplementLog {
  id: string
  supplement_id: string
  client_id: string
  date: string
  completed: boolean
}

export interface BodyComposition {
  id: string
  client_id: string
  date: string
  weight: number | null
  height: number | null
  body_fat: number | null
}

export interface NutritionLog {
  id: string
  client_id: string
  date: string
  compliant: boolean | null
  note: string | null
  calories: number | null
  protein_grams: number | null
  carbs_grams: number | null
  fat_grams: number | null
  water_ml: number | null
}

export interface DailyWellness {
  id: string
  client_id: string
  date: string
  sleep_quality: number | null
  energy_level: number | null
  mood: number | null
  cognitive_clarity: number | null
  stress_level: number | null
  training_drive: number | null
  period_start: boolean | null
  device_recovery_score: number | null
  resting_hr: number | null
  hrv: number | null
  wearable_sleep_score: number | null
  respiratory_rate: number | null
}

export interface TrainingLog {
  id: string
  client_id: string
  date: string
  training_type: string
  rpe: number | null
}

// === API Response Types ===

export interface ApiSuccessResponse<T = unknown> {
  success: true
  data: T
  timestamp: string
}

export interface ApiErrorResponse {
  error: string
  code: number
  timestamp: string
}

export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse

// === Audit Types ===

export interface AuditLog {
  id: string
  action: string
  actor: string
  target_type: string | null
  target_id: string | null
  details: Record<string, unknown>
  ip: string | null
  created_at: string
}
