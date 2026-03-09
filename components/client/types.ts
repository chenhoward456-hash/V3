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
    // 代謝 / 血糖
    case 'HOMA-IR': return value < 1.0 ? '胰島素敏感度很好' : value < 2.0 ? '胰島素敏感度正常' : '胰島素阻抗偏高'
    case '空腹血糖': return value < 90 ? '血糖控制良好' : value < 100 ? '血糖偏高，注意碳水攝取' : '血糖過高'
    case '空腹胰島素': return value < 5 ? '胰島素正常' : value < 8 ? '胰島素偏高' : '胰島素過高'
    case 'HbA1c': return value < 5.5 ? '三個月平均血糖正常' : value < 5.7 ? '血糖略高' : '糖化血色素偏高'
    case '尿酸': return value < 7.0 ? '尿酸正常' : '尿酸偏高，注意飲食'
    // 血脂
    case '三酸甘油酯': return value < 100 ? '三酸甘油酯正常' : value < 150 ? '偏高，減少精緻碳水' : '過高，需飲食調整'
    case 'ApoB': return value < 80 ? 'ApoB 正常' : value < 100 ? 'ApoB 偏高' : 'ApoB 過高，心血管風險升高'
    case 'Lp(a)': return value < 30 ? 'Lp(a) 正常' : 'Lp(a) 偏高（基因相關）'
    case 'LDL-C': return value < 100 ? 'LDL 正常' : value < 130 ? 'LDL 偏高' : 'LDL 過高'
    case 'HDL-C': return value >= 50 ? 'HDL 理想' : value >= 40 ? 'HDL 正常' : 'HDL 偏低'
    case '總膽固醇': return value < 200 ? '總膽固醇正常' : '總膽固醇偏高'
    // 肝功能
    case 'AST': return value < 40 ? '肝功能正常' : '肝指數偏高'
    case 'ALT': return value < 40 ? '肝功能正常' : '肝指數偏高'
    case 'GGT': return value < 60 ? 'GGT 正常' : 'GGT 偏高'
    case '白蛋白': return value >= 3.5 ? '營養狀態良好' : '白蛋白偏低，注意蛋白質攝取'
    // 腎功能
    case '肌酸酐': return value >= 0.7 && value <= 1.3 ? '腎功能正常' : '肌酸酐異常'
    case 'BUN': return value >= 7 && value <= 20 ? '腎功能正常' : 'BUN 異常'
    case 'eGFR': return value >= 90 ? '腎絲球過濾率正常' : value >= 60 ? '腎功能輕度下降' : '腎功能需注意'
    // 甲狀腺
    case 'TSH': return value >= 0.4 && value <= 4.0 ? '甲狀腺功能正常' : value < 0.4 ? 'TSH 偏低' : 'TSH 偏高'
    case 'Free T4': return value >= 0.8 && value <= 1.8 ? '游離甲狀腺素正常' : 'Free T4 異常'
    case 'Free T3': return value >= 2.3 && value <= 4.2 ? 'Free T3 正常' : 'Free T3 異常'
    // 鐵代謝
    case '鐵蛋白': return value >= 50 && value <= 150 ? '鐵儲存正常' : value < 50 ? '鐵儲存偏低' : '鐵儲存偏高'
    case '血紅素': return value >= 13.5 && value <= 17.5 ? '血紅素正常' : value < 13.5 ? '血紅素偏低，可能貧血' : '血紅素偏高'
    case 'MCV': return value >= 80 && value <= 100 ? 'MCV 正常' : value < 80 ? '小球性（可能缺鐵）' : '巨球性（可能缺 B12/葉酸）'
    // 發炎
    case 'CRP': return value < 1.0 ? '發炎指標正常' : value < 3.0 ? '輕度發炎' : '發炎指標偏高'
    case '同半胱胺酸': return value < 8 ? '甲基化代謝正常' : '甲基化代謝需要改善'
    // 維生素
    case '維生素D': return value > 50 ? '維生素D充足' : value > 30 ? '維生素D偏低，建議補充' : '維生素D不足'
    case '維生素B12': return value > 400 ? 'B12 充足' : value > 200 ? 'B12 偏低' : 'B12 不足'
    case '葉酸': return value > 5.4 ? '葉酸充足' : '葉酸偏低'
    // 礦物質
    case '鎂': return value >= 2.0 && value <= 2.4 ? '鎂正常' : value < 2.0 ? '鎂偏低' : '鎂偏高'
    case '鋅': return value >= 70 && value <= 120 ? '鋅正常' : value < 70 ? '鋅偏低' : '鋅偏高'
    case '鈣': return value >= 8.5 && value <= 10.5 ? '鈣正常' : value < 8.5 ? '鈣偏低' : '鈣偏高'
    // 荷爾蒙
    case '睪固酮': return value >= 300 && value <= 1000 ? '睪固酮正常' : value < 300 ? '睪固酮偏低' : '睪固酮偏高'
    case '游離睪固酮': return value >= 47 && value <= 244 ? '游離睪固酮正常' : value < 47 ? '游離睪固酮偏低' : '游離睪固酮偏高'
    case '皮質醇': return value >= 6 && value <= 18 ? '皮質醇正常' : value < 6 ? '皮質醇偏低' : '皮質醇偏高'
    case 'DHEA-S': return value >= 100 && value <= 500 ? 'DHEA-S 正常' : value < 100 ? 'DHEA-S 偏低' : 'DHEA-S 偏高'
    case '雌二醇': return value >= 10 && value <= 40 ? '雌二醇正常' : value < 10 ? '雌二醇偏低' : '雌二醇偏高'
    case 'SHBG': return value >= 10 && value <= 57 ? 'SHBG 正常' : value < 10 ? 'SHBG 偏低' : 'SHBG 偏高'
    default: return ''
  }
}
