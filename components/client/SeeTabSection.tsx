'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { SectionErrorBoundary } from '@/components/ErrorBoundary'
import ExportAiSummary from '@/components/client/ExportAiSummary'
import SystemActions from '@/components/client/SystemActions'
import ProgressJourney from '@/components/client/ProgressJourney'
import BehaviorInsights from '@/components/client/BehaviorInsights'
import WellnessTrend from '@/components/client/WellnessTrend'

const RecoveryDashboard = dynamic(() => import('@/components/client/RecoveryDashboard'), { ssr: false })

interface SeeTabSectionProps {
  c: any
  clientData: any
  isFree: boolean
  latestBodyData: any
  nutritionEngineSuggestion: any
  geneCorrections: any[]
}

const TABS = [
  { key: 'analysis', label: '📊 分析', emoji: '📊' },
  { key: 'progress', label: '📈 進度', emoji: '📈' },
  { key: 'tools', label: '🛠️ 工具', emoji: '🛠️' },
] as const

type TabKey = typeof TABS[number]['key']

export default function SeeTabSection({ c, clientData, isFree, latestBodyData, nutritionEngineSuggestion, geneCorrections }: SeeTabSectionProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('analysis')

  return (
    <div className="mb-3">
      {/* Tab 切換列 */}
      <div className="flex gap-1 bg-gray-100 rounded-2xl p-1 mb-4">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 py-2.5 text-sm font-medium rounded-xl transition-all ${
              activeTab === tab.key
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab 內容 */}
      {activeTab === 'analysis' && (
        <div className="space-y-3">
          {/* 恢復評估 */}
          {c.wellness_enabled && (
            <SectionErrorBoundary name="recovery">
              <RecoveryDashboard clientId={c.unique_code} />
            </SectionErrorBoundary>
          )}

          {/* 系統動態 */}
          <SectionErrorBoundary name="system-actions">
            <SystemActions
              suggestion={nutritionEngineSuggestion}
              prepPhase={c.prep_phase as string | null}
            />
          </SectionErrorBoundary>

          {/* 行為洞察 */}
          <SectionErrorBoundary name="behavior-insights">
            <BehaviorInsights
              clientId={c.unique_code}
              code={c.unique_code}
              isFree={c.subscription_tier === 'free'}
            />
          </SectionErrorBoundary>

          {/* 感受趨勢 */}
          {c.wellness_enabled && <WellnessTrend wellness={clientData.wellness || []} />}
        </div>
      )}

      {activeTab === 'progress' && (
        <div className="space-y-3">
          <SectionErrorBoundary name="progress-journey">
            <ProgressJourney
              bodyData={(clientData.bodyData || []).map((b: any) => ({ date: b.date, weight: b.weight, body_fat: b.body_fat }))}
              wellness={(clientData.wellness || []).map((w: any) => ({ date: w.date, sleep_quality: w.sleep_quality, energy_level: w.energy_level, mood: w.mood }))}
              nutritionLogs={(clientData.nutritionLogs || []).map((n: any) => ({ date: n.date, compliant: n.compliant, protein_grams: n.protein_grams }))}
              trainingLogs={(clientData.trainingLogs || []).map((t: any) => ({ date: t.date, training_type: t.training_type }))}
              bodyWeight={latestBodyData?.weight ?? c.target_weight ?? 70}
              goalType={c.goal_type as string | null}
              prepPhase={c.prep_phase as string | null}
            />
          </SectionErrorBoundary>
        </div>
      )}

      {activeTab === 'tools' && (
        <div className="space-y-3">
          {/* AI 匯出 */}
          {!isFree && (
            <ExportAiSummary
              client={c}
              bodyData={clientData.bodyData || []}
              nutritionLogs={clientData.nutritionLogs || []}
              wellness={clientData.wellness || []}
              trainingLogs={clientData.trainingLogs || []}
              labResults={c.lab_results || []}
              suggestion={nutritionEngineSuggestion}
            />
          )}

          {/* 佔位 — 之後可以加更多工具 */}
          {isFree && (
            <div className="bg-gray-50 rounded-2xl p-6 text-center">
              <p className="text-sm text-gray-500">升級後可使用 AI 數據匯出工具</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
