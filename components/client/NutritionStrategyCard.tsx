'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronDown } from 'lucide-react'

interface NutritionStrategyCardProps {
  client: {
    goal_type: string | null
    calories_target: number | null
    protein_target: number | null
    carbs_target: number | null
    fat_target: number | null
    carbs_training_day: number | null
    carbs_rest_day: number | null
    gene_depression_risk: string | null  // LL/SL/SS
    subscription_tier: string
  }
  labMacroModifiers?: Array<{ nutrient: string; direction: string; reason: string; percentage?: number }> | null
  weeklyAdjustmentCount?: number
}

const GOAL_LABELS: Record<string, string> = {
  cut: '減脂',
  bulk: '增肌',
  recomp: '重組',
  maintain: '維持',
}

export default function NutritionStrategyCard({
  client,
  labMacroModifiers,
  weeklyAdjustmentCount = 0,
}: NutritionStrategyCardProps) {
  const [showDetails, setShowDetails] = useState(false)

  const goalLabel = client.goal_type ? (GOAL_LABELS[client.goal_type] || client.goal_type) : null
  const hasCarbCycling = !!(client.carbs_training_day && client.carbs_rest_day)
  const isFree = client.subscription_tier === 'free'
  const hasGeneProtection = client.gene_depression_risk === 'SL' || client.gene_depression_risk === 'SS'
  const hasLabModifiers = labMacroModifiers && labMacroModifiers.length > 0

  // Build the mode description
  const modeDescription = goalLabel
    ? `${goalLabel}${hasCarbCycling && !isFree ? ' — 碳循環' : ''}`
    : null

  // Don't render if there's no goal or no targets at all
  if (!goalLabel && !client.calories_target) return null

  // ─── Free user: simplified version ───
  if (isFree) {
    return (
      <div className="bg-gradient-to-br from-emerald-50 to-green-50 border border-emerald-200 rounded-2xl p-4 mb-3">
        <div className="flex items-center gap-2 mb-2.5">
          <span className="text-lg">📋</span>
          <h3 className="text-sm font-bold text-gray-900">你的飲食策略</h3>
        </div>

        {modeDescription && (
          <p className="text-xs text-gray-600 mb-2">
            目前模式：<span className="font-semibold text-emerald-700">{modeDescription}</span>
          </p>
        )}

        <div className="space-y-1.5 mb-3">
          <div className="flex items-start gap-1.5">
            <span className="text-emerald-500 text-xs shrink-0 mt-0.5">&#10003;</span>
            <span className="text-xs text-gray-600">系統已計算你的 TDEE 和巨量營養素</span>
          </div>
        </div>

        {/* Locked features section */}
        <div className="bg-white/60 border border-emerald-100 rounded-xl p-3 mb-3">
          <div className="flex items-start gap-2">
            <span className="text-sm shrink-0">🔒</span>
            <div>
              <p className="text-[11px] text-gray-500 leading-relaxed">
                碳循環自動排程、血檢飲食調整、基因保護機制 — 升級自主管理方案解鎖
              </p>
            </div>
          </div>
        </div>

        <Link
          href="/upgrade?from=free&feature=nutrition_strategy"
          className="block text-center bg-emerald-600 text-white text-xs font-semibold py-2 rounded-xl hover:bg-emerald-700 transition-colors"
        >
          升級自主管理版 — NT$499/月
        </Link>
      </div>
    )
  }

  // ─── Coached / Self-managed user: full version ───
  const strategies: { key: string; text: string }[] = []

  if (hasCarbCycling) {
    strategies.push({
      key: 'carb-cycling',
      text: `訓練日碳水 ${client.carbs_training_day}g ｜ 休息日碳水 ${client.carbs_rest_day}g`,
    })
  }

  if (client.calories_target) {
    const parts = [`每日熱量目標 ${client.calories_target} kcal`]
    if (client.protein_target) {
      parts[0] += `（蛋白質 ${client.protein_target}g）`
    }
    strategies.push({ key: 'calories', text: parts[0] })
  }

  if (weeklyAdjustmentCount > 0) {
    strategies.push({
      key: 'tdee',
      text: `TDEE 已自動校正 ${weeklyAdjustmentCount} 次`,
    })
  }

  if (hasGeneProtection) {
    strategies.push({
      key: 'gene',
      text: `休息日碳水下限保護（基因：${client.gene_depression_risk} 型）`,
    })
  }

  return (
    <div className="bg-gradient-to-br from-emerald-50 to-green-50 border border-emerald-200 rounded-2xl p-4 mb-3">
      {/* Header */}
      <div className="flex items-center gap-2 mb-2.5">
        <span className="text-lg">📋</span>
        <h3 className="text-sm font-bold text-gray-900">你的飲食策略</h3>
      </div>

      {/* Current mode */}
      {modeDescription && (
        <p className="text-xs text-gray-600 mb-2.5">
          目前模式：<span className="font-semibold text-emerald-700">{modeDescription}</span>
        </p>
      )}

      {/* Active strategies */}
      {strategies.length > 0 && (
        <div className="space-y-1.5 mb-2">
          {strategies.map((s) => (
            <div key={s.key} className="flex items-start gap-1.5">
              <span className="text-emerald-500 text-xs shrink-0 mt-0.5">&#10003;</span>
              <span className="text-xs text-gray-700">{s.text}</span>
            </div>
          ))}
        </div>
      )}

      {/* Lab-based modifiers */}
      {hasLabModifiers && (
        <div className="bg-white/60 border border-emerald-100 rounded-xl p-3 mt-2.5">
          <p className="text-[11px] font-semibold text-blue-700 mb-1.5">🩸 根據你的血檢：</p>
          <div className="space-y-1">
            {labMacroModifiers!.map((mod, i) => (
              <p key={i} className="text-[11px] text-blue-600 leading-relaxed">
                {mod.reason}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Collapsible details */}
      <button
        onClick={() => setShowDetails(!showDetails)}
        className="flex items-center justify-center gap-1.5 w-full mt-3 py-1.5 text-[11px] text-emerald-600 hover:text-emerald-800 transition-colors"
      >
        <span>{showDetails ? '收合分析依據' : '查看完整分析依據'}</span>
        <ChevronDown size={12} className={`transition-transform ${showDetails ? 'rotate-180' : ''}`} />
      </button>

      {showDetails && (
        <div className="bg-white/60 border border-emerald-100 rounded-xl p-3 mt-1.5 space-y-2">
          <div className="space-y-1.5 text-[11px] text-gray-600 leading-relaxed">
            {client.goal_type && (
              <p>
                <span className="font-medium text-gray-700">目標：</span>
                {goalLabel}
                {client.goal_type === 'cut' && ' — 透過熱量赤字逐步降低體脂'}
                {client.goal_type === 'bulk' && ' — 透過熱量盈餘搭配訓練增加肌肉量'}
                {client.goal_type === 'recomp' && ' — 微赤字搭配高蛋白進行身體重組'}
                {client.goal_type === 'maintain' && ' — 維持目前體重與體態'}
              </p>
            )}
            {hasCarbCycling && (
              <p>
                <span className="font-medium text-gray-700">碳循環：</span>
                訓練日提供較多碳水以支持運動表現和恢復；休息日降低碳水以增加脂肪氧化。
              </p>
            )}
            {client.calories_target && client.protein_target && (
              <p>
                <span className="font-medium text-gray-700">蛋白質策略：</span>
                每日 {client.protein_target}g 蛋白質，確保肌肉合成與恢復所需。
              </p>
            )}
            {hasGeneProtection && (
              <p>
                <span className="font-medium text-gray-700">基因保護：</span>
                你的 5-HTTLPR 基因型為 {client.gene_depression_risk}，系統已自動提高休息日碳水下限以維護血清素合成。
              </p>
            )}
            {weeklyAdjustmentCount > 0 && (
              <p>
                <span className="font-medium text-gray-700">TDEE 校正：</span>
                根據你過去的體重趨勢和飲食記錄，系統已自動校正 {weeklyAdjustmentCount} 次，讓熱量目標更貼近你的實際代謝率。
              </p>
            )}
            {hasLabModifiers && (
              <p>
                <span className="font-medium text-gray-700">血檢調整：</span>
                根據你的血液檢測結果，系統已自動調整部分巨量營養素比例。
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
