'use client'

import type { NutritionSuggestion } from '@/lib/nutrition-engine'

interface SystemActionsProps {
  suggestion: NutritionSuggestion | null
  prepPhase?: string | null
}

interface ActionItem {
  emoji: string
  text: string
  type: 'adjustment' | 'info' | 'warning'
}

export default function SystemActions({ suggestion, prepPhase }: SystemActionsProps) {
  if (!suggestion) return null

  const actions: ActionItem[] = []
  const s = suggestion

  // 1. 營養目標調整
  if (s.caloriesDelta !== 0 || s.carbsDelta !== 0 || s.fatDelta !== 0 || s.proteinDelta !== 0) {
    const parts: string[] = []
    if (s.caloriesDelta !== 0) parts.push(`熱量 ${s.caloriesDelta > 0 ? '+' : ''}${s.caloriesDelta} kcal`)
    if (s.carbsDelta !== 0) parts.push(`碳水 ${s.carbsDelta > 0 ? '+' : ''}${s.carbsDelta}g`)
    if (s.fatDelta !== 0) parts.push(`脂肪 ${s.fatDelta > 0 ? '+' : ''}${s.fatDelta}g`)
    if (s.proteinDelta !== 0) parts.push(`蛋白質 ${s.proteinDelta > 0 ? '+' : ''}${s.proteinDelta}g`)
    if (parts.length > 0) {
      actions.push({
        emoji: '🔧',
        text: `系統根據你的體重趨勢微調了 ${parts.join('、')}`,
        type: 'adjustment',
      })
    }
  } else if (s.status === 'on_track') {
    actions.push({
      emoji: '✅',
      text: '目前進度正常，系統維持現有目標不動',
      type: 'info',
    })
  }

  // 2. TDEE 校正
  if (s.estimatedTDEE) {
    actions.push({
      emoji: '📊',
      text: `你的估計 TDEE 為 ${s.estimatedTDEE.toLocaleString()} kcal（系統根據體重變化持續校正）`,
      type: 'info',
    })
  }

  // 3. Refeed 建議
  if (s.refeedSuggested && s.refeedReason) {
    actions.push({
      emoji: '🍚',
      text: `系統建議安排 Refeed — ${s.refeedReason}`,
      type: 'warning',
    })
  }

  // 4. Diet Break
  if (s.dietBreakSuggested) {
    actions.push({
      emoji: '⏸️',
      text: `已連續減脂 ${s.dietDurationWeeks} 週，系統建議安排 1-2 週 Diet Break`,
      type: 'warning',
    })
  }

  // 5. 代謝壓力
  if (s.metabolicStress && s.metabolicStress.score >= 45) {
    actions.push({
      emoji: '🌡️',
      text: `代謝壓力偏高（${s.metabolicStress.score}/100），系統已納入調整考量`,
      type: 'warning',
    })
  }

  // 6. 減脂閘門
  if (s.cuttingReadinessGate?.blocked) {
    actions.push({
      emoji: '🚦',
      text: `減脂閘門啟動 — ${s.cuttingReadinessGate.recommendation}`,
      type: 'warning',
    })
  }

  // 7. 恢復期
  if (prepPhase === 'recovery') {
    actions.push({
      emoji: '🧘',
      text: '恢復期模式：系統自動提高熱量至維持 +10%，保護荷爾蒙恢復',
      type: 'info',
    })
  }

  // 8. 基因修正
  if (s.geneticCorrections.length > 0) {
    actions.push({
      emoji: '🧬',
      text: `已套用 ${s.geneticCorrections.length} 項基因修正（${s.geneticCorrections.map(g => g.rule).join('、')}）`,
      type: 'info',
    })
  }

  // 9. 血檢驅動調整
  if (s.labMacroModifiers.length > 0) {
    actions.push({
      emoji: '🩸',
      text: `已根據血檢結果調整 ${s.labMacroModifiers.length} 項營養素`,
      type: 'info',
    })
  }

  if (actions.length === 0) return null

  // 最多顯示 4 條
  const visible = actions.slice(0, 4)

  return (
    <div className="bg-white rounded-3xl shadow-sm p-5 mb-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">⚙️</span>
        <h2 className="text-base font-bold text-gray-900">系統幫你做了什麼</h2>
      </div>

      <div className="space-y-2">
        {visible.map((action, i) => (
          <div
            key={i}
            className={`flex items-start gap-2 px-3 py-2 rounded-xl text-xs ${
              action.type === 'warning'
                ? 'bg-amber-50 text-amber-800'
                : action.type === 'adjustment'
                ? 'bg-blue-50 text-blue-800'
                : 'bg-gray-50 text-gray-700'
            }`}
          >
            <span className="shrink-0 mt-0.5">{action.emoji}</span>
            <span className="leading-relaxed">{action.text}</span>
          </div>
        ))}
      </div>

      <p className="text-[9px] text-gray-400 mt-2 text-center">
        以上調整由引擎根據你的數據自動執行
      </p>
    </div>
  )
}
