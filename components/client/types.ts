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
  { value: 'upper_body', label: '上肢', emoji: '🤸' },
  { value: 'lower_body', label: '下肢', emoji: '🦿' },
  { value: 'cardio', label: '有氧', emoji: '🏃' },
  { value: 'chest', label: '胸', emoji: '💪' },
  { value: 'shoulder', label: '肩', emoji: '🏔️' },
  { value: 'arms', label: '手臂', emoji: '💪🏼' },
  { value: 'rest', label: '休息', emoji: '😴' },
] as const

// 重訓類型 — 只有這些算「訓練日」影響碳循環
export const WEIGHT_TRAINING_TYPES = ['push', 'pull', 'legs', 'full_body', 'upper_body', 'lower_body', 'chest', 'shoulder', 'arms'] as const
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
    case 'HOMA-IR': return value < 0.8 ? '胰島素敏感度頂尖' : value < 1.0 ? '很好，目標 <0.8 可再精進' : value < 2.0 ? '正常，可透過運動與飲食進一步優化' : '胰島素阻抗偏高'
    case '空腹血糖': return value < 80 ? '血糖控制頂尖' : value < 85 ? '很好，目標 <80 可再優化' : value < 90 ? '正常，可透過進食順序與餐後走路再優化' : value < 100 ? '血糖偏高，注意碳水攝取' : '血糖過高'
    case '空腹胰島素': return value < 2.5 ? '胰島素分泌效率頂尖' : value < 5 ? '正常，持續維持低精製碳水飲食' : value < 8 ? '胰島素偏高' : '胰島素過高'
    case 'HbA1c': return value < 5.0 ? '長期血糖控制頂尖' : value < 5.5 ? '正常，可透過碳水管理進一步優化' : value < 5.7 ? '血糖略高' : '糖化血色素偏高'
    case '尿酸': return value < 5.0 ? '尿酸控制頂尖' : value < 5.5 ? '很好，目標 <5.0 可再精進' : value < 7.0 ? '正常，可減少高普林食物再優化' : '尿酸偏高，注意飲食'
    // 血脂
    case '三酸甘油酯': return value < 60 ? '三酸甘油酯頂尖' : value < 100 ? '正常，目標 <60 可透過 Omega-3 再優化' : value < 150 ? '偏高，減少精緻碳水' : '過高，需飲食調整'
    case 'ApoB': return value < 50 ? 'ApoB 頂尖，心血管風險極低' : value < 80 ? '正常，目標 <50 可透過纖維與飲食優化' : value < 100 ? 'ApoB 偏高' : 'ApoB 過高，心血管風險升高'
    case 'Lp(a)': return value < 30 ? 'Lp(a) 正常' : 'Lp(a) 偏高（基因相關）'
    case 'LDL-C': return value < 60 ? 'LDL 頂尖' : value < 100 ? '正常，目標 <60 可增加纖維與植物固醇來優化' : value < 130 ? 'LDL 偏高' : 'LDL 過高'
    case 'HDL-C': return value >= 65 ? 'HDL 頂尖' : value >= 50 ? '正常，目標 65+ 可透過有氧運動與好油脂提升' : value >= 40 ? 'HDL 偏低，建議增加運動與好油脂' : 'HDL 偏低'
    case '總膽固醇': return value < 170 ? '總膽固醇頂尖' : value < 200 ? '正常，可透過飲食再優化' : '總膽固醇偏高'
    // 肝功能
    case 'AST': return value < 25 ? '肝功能極佳' : value < 40 ? '正常，目標 <25 可透過生活習慣優化' : '肝指數偏高'
    case 'ALT': return value < 25 ? '肝功能極佳' : value < 40 ? '正常，目標 <25 可透過控制體脂與飲食優化' : '肝指數偏高'
    case 'GGT': return value < 30 ? 'GGT 極佳' : value < 60 ? '正常，目標 <30 可減少酒精攝取' : 'GGT 偏高'
    case '白蛋白': return value >= 4.2 ? '營養狀態極佳' : value >= 3.5 ? '正常，目標 >4.2 可增加優質蛋白攝取' : '白蛋白偏低，注意蛋白質攝取'
    // 腎功能
    case '肌酸酐': return value >= 0.7 && value <= 1.3 ? '腎功能正常' : '肌酸酐異常'
    case 'BUN': return value >= 7 && value <= 20 ? '腎功能正常' : 'BUN 異常'
    case 'eGFR': return value >= 100 ? '腎功能頂尖' : value >= 90 ? '正常，目標 100+ 可透過水分與血壓管理優化' : value >= 60 ? '腎功能輕度下降' : '腎功能需注意'
    // 甲狀腺
    case 'TSH': return value >= 1.0 && value <= 2.5 ? '甲狀腺功能頂尖' : value >= 0.4 && value <= 4.0 ? '正常，目標 1.0-2.5 可透過碘/硒/睡眠優化' : value < 0.4 ? 'TSH 偏低' : 'TSH 偏高'
    case 'Free T4': return value >= 1.0 && value <= 1.5 ? '游離甲狀腺素頂尖' : value >= 0.8 && value <= 1.8 ? '正常，目標 1.0-1.5 可關注碘與硒攝取' : 'Free T4 異常'
    case 'Free T3': return value >= 3.0 && value <= 4.0 ? 'Free T3 頂尖' : value >= 2.3 && value <= 4.2 ? '正常，目標 3.0-4.0 確保充足碳水與睡眠' : 'Free T3 異常'
    // 鐵代謝
    case '鐵蛋白': return value >= 70 && value <= 120 ? '鐵儲存頂尖' : value >= 50 && value <= 150 ? '正常，目標 70-120 可透過富鐵食物搭配維生素C' : value < 50 ? '鐵儲存偏低' : '鐵儲存偏高'
    case '血紅素': return value >= 14.5 && value <= 16.5 ? '血紅素頂尖' : value >= 13.5 && value <= 17.5 ? '正常，目標 14.5-16.5 確保鐵與B群攝取充足' : value < 13.5 ? '血紅素偏低，可能貧血' : '血紅素偏高'
    case 'MCV': return value >= 85 && value <= 95 ? 'MCV 頂尖' : value >= 80 && value <= 100 ? '正常，目標 85-95' : value < 80 ? '小球性（可能缺鐵）' : '巨球性（可能缺 B12/葉酸）'
    // 發炎
    case 'CRP': return value < 0.5 ? '發炎指標頂尖' : value < 1.0 ? '正常，目標 <0.5 可增加 Omega-3 與抗發炎食物' : value < 3.0 ? '輕度發炎' : '發炎指標偏高'
    case 'hs-CRP': return value < 0.5 ? '發炎指標頂尖' : value < 1.0 ? '正常，目標 <0.5 可增加 Omega-3 與抗發炎食物' : value < 3.0 ? '輕度發炎' : '發炎指標偏高'
    case '同半胱胺酸': return value < 6 ? '甲基化代謝頂尖' : value < 8 ? '正常，目標 <6 可增加 B6、B12、葉酸攝取' : '甲基化代謝需要改善'
    // 維生素
    case '維生素D': return value >= 60 && value <= 80 ? '維生素D頂尖區間' : value >= 50 && value <= 100 ? '充足，目標 60-80 可進一步優化' : value < 50 ? (value > 30 ? '維生素D偏低，建議補充' : '維生素D不足') : '維生素D過高，注意高血鈣風險'
    case '維生素B12': return value >= 500 && value <= 800 ? 'B12 頂尖區間' : value >= 400 && value <= 900 ? '充足，目標 500-800 可再優化' : value < 400 ? 'B12 偏低，建議補充' : 'B12 異常偏高，建議檢查肝功能及發炎指標'
    case '葉酸': return value >= 10 && value <= 18 ? '葉酸頂尖區間' : value >= 5.4 && value <= 20 ? '充足，目標 10-18 可透過深色蔬菜再優化' : value < 5.4 ? '葉酸偏低' : '葉酸過高，可能遮蔽B12缺乏'
    // 礦物質
    case '鎂': return value >= 2.1 && value <= 2.3 ? '鎂頂尖' : value >= 2.0 && value <= 2.4 ? '正常，目標 2.1-2.3 可增加堅果與深色蔬菜' : value < 2.0 ? '鎂偏低' : '鎂偏高'
    case '鋅': return value >= 85 && value <= 110 ? '鋅頂尖' : value >= 70 && value <= 120 ? '正常，目標 85-110 可增加牡蠣、牛肉攝取' : value < 70 ? '鋅偏低' : '鋅偏高'
    case '鈣': return value >= 9.0 && value <= 10.0 ? '鈣頂尖' : value >= 8.5 && value <= 10.5 ? '正常，目標 9.0-10.0' : value < 8.5 ? '鈣偏低' : '鈣偏高'
    // 荷爾蒙
    case '睪固酮': return value >= 700 ? '睪固酮頂尖' : value >= 500 ? '正常，目標 700+ 可透過重訓、睡眠與鋅再提升' : value >= 300 ? '正常偏低，建議加強重訓、充足睡眠與鋅攝取' : value < 300 ? '睪固酮偏低' : '睪固酮偏高'
    case '游離睪固酮': return value >= 150 ? '游離睪固酮頂尖' : value >= 100 ? '正常，目標 150+ 可透過重訓與睡眠再提升' : value >= 47 ? '正常偏低，建議重訓、睡眠、鋅與維生素D優化' : value < 47 ? '游離睪固酮偏低' : '游離睪固酮偏高'
    case '皮質醇': return value >= 8 && value <= 12 ? '皮質醇頂尖' : value >= 6 && value <= 18 ? '正常，目標 8-12 注意壓力管理與睡眠品質' : value < 6 ? '皮質醇偏低' : '皮質醇偏高'
    case 'DHEA-S': return value >= 250 && value <= 450 ? 'DHEA-S 頂尖' : value >= 100 && value <= 500 ? '正常，目標 250+ 可透過運動與壓力管理優化' : value < 100 ? 'DHEA-S 偏低' : 'DHEA-S 偏高'
    case '雌二醇': return value >= 15 && value <= 30 ? '雌二醇頂尖' : value >= 10 && value <= 40 ? '正常，目標 15-30 可透過體脂管理優化' : value < 10 ? '雌二醇偏低' : '雌二醇偏高'
    case 'SHBG': return value >= 20 && value <= 40 ? 'SHBG 頂尖' : value >= 10 && value <= 57 ? '正常，目標 20-40（太高會降低游離T）' : value < 10 ? 'SHBG 偏低' : 'SHBG 偏高'
    default: return ''
  }
}
