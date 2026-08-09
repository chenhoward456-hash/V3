// 課表分化的共用邏輯：把 training_plan.days[].label 映射到 training_type
//
// 單一真相（紅線 6）：app/c/[clientId]/page.tsx 的 todayPlanType 預設值、
// components/client/TodayWorkout.tsx 的分化切換都用這支，別在別處再寫一份 regex。

/**
 * 把課表某一天的 label（例：「Push Day」「拉日」「腿」）映射到 training_type。
 * 對不到回 null（呼叫端自行決定要不要當 rest 或忽略）。
 */
// training_type → 中文簡稱 + emoji（跟 components/client/types.ts 的 TRAINING_TYPES 對齊，
// 抽這份是為了 lib 層不反向依賴 components）
const TYPE_DISPLAY: Record<string, { zh: string; emoji: string }> = {
  push: { zh: '推', emoji: '🫸' },
  pull: { zh: '拉', emoji: '🫷' },
  legs: { zh: '腿', emoji: '🦵' },
  full_body: { zh: '全身', emoji: '🏋️' },
  upper_body: { zh: '上肢', emoji: '🤸' },
  cardio: { zh: '有氧', emoji: '🏃' },
  chest: { zh: '胸', emoji: '💪' },
  shoulder: { zh: '肩', emoji: '🏔️' },
  arms: { zh: '手臂', emoji: '💪🏼' },
  rest: { zh: '休息', emoji: '😴' },
}

/**
 * 把課表某一天的 label（例：「Push Day」）顯示成中文簡稱。
 * 對不到 training_type 時回原 label（保留教練自訂命名）。
 */
export function splitDisplayLabel(label: string | null | undefined, withEmoji = false): string {
  const type = labelToTrainingType(label)
  const d = type ? TYPE_DISPLAY[type] : null
  if (!d) return label || ''
  return withEmoji ? `${d.emoji} ${d.zh}` : d.zh
}

export function labelToTrainingType(label: string | null | undefined): string | null {
  const l = (label || '').toLowerCase()
  if (!l) return null
  if (/upper|上肢/.test(l)) return 'upper_body'
  if (/lower|下肢/.test(l)) return 'legs'
  if (/push|推/.test(l)) return 'push'
  if (/pull|拉|背/.test(l)) return 'pull'
  if (/leg|腿/.test(l)) return 'legs'
  if (/chest|胸/.test(l)) return 'chest'
  if (/shoulder|肩/.test(l)) return 'shoulder'
  if (/arm|手臂|二頭|三頭/.test(l)) return 'arms'
  if (/full|全身/.test(l)) return 'full_body'
  if (/cardio|有氧|跑/.test(l)) return 'cardio'
  if (/rest|休息/.test(l)) return 'rest'
  return null
}

// ─────────────────────────────────────────────
// 主項（compound lift）
// ─────────────────────────────────────────────
// 一個訓練類型的「預設主項」。舊的 training_logs 沒有 compound_lift 欄位，
// 讀取時視為這裡的預設值——當初就是照這張表顯示的。
export const DEFAULT_COMPOUND_LIFT: Record<string, string> = {
  push: '臥推', pull: '槓鈴划船', legs: '深蹲',
  chest: '臥推', shoulder: '肩推', arms: '彎舉',
  full_body: '深蹲', upper_body: '臥推',
}

// 這筆訓練紀錄的主項是哪個動作。
// ⚠️ 同一個分化可以排兩天（拉A 槓鈴划船 / 拉B 加重引體），主項不同。
// 只用 training_type 比對會把兩個不同動作的重量混成同一條進步曲線。
export function compoundLiftOf(
  log: { compound_lift?: string | null; training_type?: string | null }
): string | null {
  if (log.compound_lift) return log.compound_lift
  return (log.training_type && DEFAULT_COMPOUND_LIFT[log.training_type]) || null
}
