import useSWR, { KeyedMutator } from 'swr'
import type { LabResult, Supplement, BodyData, WellnessData, TrainingLog, NutritionLog } from '@/components/client/types'
import type { TrainingSetRow } from '@/lib/training-progress'

export interface TrainingPlanExercise {
  name: string
  sets?: string
  reps?: string
  rpe?: string
  note?: string
}

export interface TrainingPlanDay {
  dayOfWeek: number // 1=Monday ... 7=Sunday
  label: string
  exercises: TrainingPlanExercise[]
}

/** 週期化選配欄（方案 A 純日曆版，見 docs/DESIGN_TRAINING_PERIODIZATION.md §2） */
export interface TrainingPlanMesocycle {
  startDate: string // YYYY-MM-DD（週期起始，慣例是週一）
  weeks: number
  deloadWeek?: number
  blockLabel?: string
  note?: string
}

export interface TrainingPlan {
  name: string
  days: TrainingPlanDay[]
  mesocycle?: TrainingPlanMesocycle | null
}

/** Client data from Supabase. Nullable fields use `| null` (DB convention). */
export interface Client {
  id: string
  unique_code: string
  name: string
  // 方形臉部特寫，用在 40px 圓形頭像；NULL＝用姓名首字
  avatar_url: string | null
  // 直式全身照，顯示在備賽倒數卡旁邊；NULL＝不顯示
  goal_photo_url: string | null
  age: number | null
  gender: string | null
  status: string | null
  is_active: boolean
  expires_at: string | null
  subscription_tier: string | null
  client_mode: string
  competition_enabled: boolean
  health_mode_enabled: boolean
  body_composition_enabled: boolean
  nutrition_enabled: boolean
  wellness_enabled: boolean
  training_enabled: boolean
  supplement_enabled: boolean
  lab_enabled: boolean
  ai_chat_enabled: boolean
  simple_mode: boolean
  calories_target: number | null
  protein_target: number | null
  carbs_target: number | null
  fat_target: number | null
  carbs_training_day: number | null
  carbs_rest_day: number | null
  water_target: number | null
  sodium_target: number | null
  target_weight: number | null
  target_body_fat: number | null
  target_date: string | null
  goal_type: string | null
  activity_profile: string | null
  competition_date: string | null
  prep_phase: string | null
  auto_adjust_enabled: boolean | null
  last_auto_adjust_at: string | null
  coach_macro_override: { reason?: string | null } | null
  weigh_in_gap_hours: number | null
  coach_last_viewed_at: string | null
  coach_weekly_note: string | null
  weekly_tasks: { week_of: string; generated_at?: string; tasks: { key: string; priority: number; icon: string; title: string; detail: string }[] } | null
  onboarding_notes_rendered: { sections?: { slug: string; title: string; body: string }[]; rendered_at?: string; template_id?: string } | null
  /** 身體檔案：只放被該學員自己資料驗證過的條目（每條帶 evidence/sample/confidence） */
  body_profile: {
    updated_at?: string
    entries?: {
      key: string; label: string; value: string
      detail?: string | null; evidence?: string | null; sample?: string | null
      confidence?: 'high' | 'medium' | 'low' | null
      caveat?: string | null; measured_on?: string | null
      /** 教練 pin 到首頁定錨的那一條（最多一條） */
      pinned?: boolean
    }[]
    gaps?: string[]
  } | null
  /** 入會健康篩檢（見 lib/health-screening.ts）。NULL 或缺 screened_at = 尚未篩檢 */
  health_screening: {
    screened_at?: string; screened_by?: string
    chronic_condition?: boolean; on_medication?: boolean
    pregnant_or_lactating?: boolean; recent_surgery?: boolean
    eating_disorder_history?: boolean; note?: string | null
  } | null
  coach_summary: string | null
  next_checkup_date: string | null
  health_goals: string | null
  quarterly_cycle_start: string | null
  gene_mthfr: string | null
  gene_apoe: string | null
  gene_depression_risk: string | null
  gene_notes: string | null
  training_plan: TrainingPlan | null
  training_experience: 'beginner' | 'intermediate' | 'advanced' | null
  /** @deprecated /api/clients 不再回傳原始 line_user_id（PII）；用 has_line_binding 判斷有沒有綁 LINE */
  line_user_id?: string | null
  has_line_binding?: boolean
  created_at: string
  height: number | null
  lab_results: LabResult[]
  supplements: Supplement[]
  /** Allow extra fields from DB without breaking type safety */
  [key: string]: unknown
}

export interface SupplementLog {
  id: string
  client_id: string
  date: string
  supplement_id: string
  taken: boolean
  [key: string]: string | boolean | number | null
}

export interface MacroAdjustment {
  applied_at: string
  applied_by: string | null
  trigger_source: string | null
  old_macros: Record<string, unknown> | null
  new_macros: Record<string, unknown> | null
  reason: string | null
}

export interface CoachMessage {
  id: string
  title: string | null
  body: string
  mode: string | null
  created_at: string
}

export interface ClientDataPayload {
  client: Client
  todayLogs: SupplementLog[]
  bodyData: BodyData[]
  wellness: WellnessData[]
  recentLogs: SupplementLog[]
  trainingLogs: TrainingLog[]
  trainingSets?: TrainingSetRow[]
  nutritionLogs: NutritionLog[]
  recentMacroAdjustment?: MacroAdjustment | null
  recentCoachMessage?: CoachMessage | null
}

interface UseClientDataOptions {
  revalidateOnFocus?: boolean
  dedupingInterval?: number
}

interface UseClientDataResult {
  data?: ClientDataPayload
  error?: Error
  isLoading: boolean
  mutate: KeyedMutator<ClientDataPayload>
}

/**
 * 使用 SWR 封裝的客戶資料獲取 Hook
 * @param clientId 客戶唯一代碼
 * @param options SWR 配置選項
 * @returns SWR 結果物件
 */
export function useClientData(
  clientId: string, 
  options: UseClientDataOptions = {}
): UseClientDataResult {
  const {
    revalidateOnFocus = true,
    dedupingInterval = 30000 // 30秒內相同請求不重複發（149KB payload，別太頻繁全量重抓）
  } = options

  // 使用 API route 獲取資料
  const fetcher = async (url: string) => {
    const response = await fetch(url)
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || '獲取資料失敗')
    }
    const json = await response.json()
    if (!json.success) {
      throw new Error(json.error || 'Failed to fetch')
    }
    return json.data
  }

  const { data, error, isLoading, mutate } = useSWR(
    clientId ? `/api/clients?clientId=${clientId}` : null,
    fetcher,
    {
      revalidateOnFocus,
      focusThrottleInterval: 60000, // 切回前景(含點推播)最多每 60s 才重抓，不然 149KB 全量重抓很卡
      dedupingInterval,
      refreshInterval: 120000, // 120秒自動刷新（教練改 tier 不需 30s 即時；學員寫入後本就有 mutate 即時更新）
      errorRetryCount: 3,
      onError: (error) => {
        console.error('客戶資料獲取失敗:', error)
      }
    }
  )

  return {
    data,
    error,
    isLoading,
    mutate
  }
}
