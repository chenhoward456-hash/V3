import useSWR, { KeyedMutator } from 'swr'
import type { LabResult, Supplement, BodyData, WellnessData, TrainingLog, NutritionLog } from '@/components/client/types'

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

export interface TrainingPlan {
  name: string
  days: TrainingPlanDay[]
}

/** Client data from Supabase. Nullable fields use `| null` (DB convention). */
export interface Client {
  id: string
  unique_code: string
  name: string
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
  weigh_in_gap_hours: number | null
  coach_last_viewed_at: string | null
  coach_weekly_note: string | null
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
  line_user_id: string | null
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

export interface ClientDataPayload {
  client: Client
  todayLogs: SupplementLog[]
  bodyData: BodyData[]
  wellness: WellnessData[]
  recentLogs: SupplementLog[]
  trainingLogs: TrainingLog[]
  nutritionLogs: NutritionLog[]
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
    dedupingInterval = 10000 // 10秒內相同請求不重複發
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
      dedupingInterval,
      refreshInterval: 30000, // 30秒自動刷新（教練修改 tier 後能更快反映）
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
