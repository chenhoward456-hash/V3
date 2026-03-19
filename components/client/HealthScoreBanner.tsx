'use client'

import type { HealthScore } from '@/lib/health-score-engine'

const PILLAR_TIPS: Record<string, string> = {
  wellness: '多休息、保持正面心態',
  nutrition: '注意營養目標的執行',
  training: '保持規律的訓練頻率',
  supplement: '別忘了每天的補品打卡',
  lab: '可考慮安排血檢追蹤',
}

interface HealthScoreBannerProps {
  healthScore: HealthScore
}

export default function HealthScoreBanner({ healthScore }: HealthScoreBannerProps) {
  return (
    <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 mb-3">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">🌿</span>
          <div>
            <p className="text-xs font-semibold text-emerald-700">健康優化模式</p>
            {healthScore.daysInCycle != null && (
              <p className="text-[10px] text-emerald-500">第 {healthScore.daysInCycle} 天 / 90 天季度</p>
            )}
          </div>
        </div>
        <div className="text-right">
          <div className="flex items-center gap-1.5">
            <span className="text-2xl font-black text-emerald-700">{healthScore.total}</span>
            <div>
              <span className={`inline-block text-xs font-bold px-1.5 py-0.5 rounded ${
                healthScore.grade === 'A' ? 'bg-emerald-600 text-white' :
                healthScore.grade === 'B' ? 'bg-blue-500 text-white' :
                healthScore.grade === 'C' ? 'bg-yellow-500 text-white' :
                'bg-red-500 text-white'
              }`}>{healthScore.grade}</span>
              <p className="text-[10px] text-emerald-600">健康分數</p>
            </div>
          </div>
        </div>
      </div>
      {/* 五柱進度條（附解釋） */}
      <div className="grid grid-cols-5 gap-1">
        {healthScore.pillars.map(p => {
          return (
            <div key={p.pillar} className="text-center">
              <div className="text-base leading-none mb-1">{p.emoji}</div>
              <div className="w-full bg-emerald-100 rounded-full h-1.5 mb-0.5">
                <div
                  className={`h-1.5 rounded-full transition-all ${
                    p.score >= 80 ? 'bg-emerald-500' : p.score >= 50 ? 'bg-yellow-400' : 'bg-red-400'
                  }`}
                  style={{ width: `${p.score}%` }}
                />
              </div>
              <p className={`text-[9px] font-medium ${
                p.score >= 80 ? 'text-emerald-600' : p.score >= 50 ? 'text-yellow-600' : 'text-red-500'
              }`}>{p.score}</p>
              <p className="text-[8px] text-gray-400">{p.label}</p>
            </div>
          )
        })}
      </div>
      {/* 血檢 & 獎勵加減分 */}
      {(healthScore.labBonus > 0 || healthScore.labPenalty < 0) && (
        <div className="flex items-center gap-2 mt-2 text-[10px]">
          {healthScore.labBonus > 0 && (
            <span className="text-emerald-600 font-medium bg-emerald-100 px-1.5 py-0.5 rounded">
              +{healthScore.labBonus} 優秀獎勵
            </span>
          )}
          {healthScore.labPenalty < 0 && (
            <span className="text-red-500 font-medium bg-red-50 px-1.5 py-0.5 rounded">
              {healthScore.labPenalty} 血檢異常
            </span>
          )}
        </div>
      )}
      {/* 最低分柱提示 */}
      {(() => {
        const lowest = [...healthScore.pillars].sort((a, b) => a.score - b.score)[0]
        if (lowest && lowest.score < 70) {
          return (
            <div className="mt-2 pt-2 border-t border-emerald-200">
              <p className="text-xs text-amber-600 font-medium">
                💡 {lowest.label}分數偏低（{lowest.score}分）— {PILLAR_TIPS[lowest.pillar] || '持續改善中'}
              </p>
            </div>
          )
        }
        return null
      })()}
      {healthScore.daysUntilBloodTest != null && healthScore.daysUntilBloodTest <= 21 && (
        <div className="mt-2 pt-2 border-t border-emerald-200">
          <p className="text-xs text-emerald-600 font-medium">
            🩸 季度血檢倒數 {healthScore.daysUntilBloodTest} 天
          </p>
        </div>
      )}
    </div>
  )
}
