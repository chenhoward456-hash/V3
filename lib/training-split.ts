// 課表分化的共用邏輯：把 training_plan.days[].label 映射到 training_type
//
// 單一真相（紅線 6）：app/c/[clientId]/page.tsx 的 todayPlanType 預設值、
// components/client/TodayWorkout.tsx 的分化切換都用這支，別在別處再寫一份 regex。

/**
 * 把課表某一天的 label（例：「Push Day」「拉日」「腿」）映射到 training_type。
 * 對不到回 null（呼叫端自行決定要不要當 rest 或忽略）。
 */
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
