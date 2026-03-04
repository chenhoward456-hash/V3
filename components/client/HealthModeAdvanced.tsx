'use client'

import { useState, useEffect } from 'react'

interface HealthModeAdvancedProps {
  clientId: string
  code?: string
}

// 微營養素每日建議量
const MICRO_TARGETS = [
  { key: 'omega3', label: 'Omega-3 (EPA+DHA)', target: '2g', icon: '🐟', tip: '鮭魚 100g ≈ 1.8g' },
  { key: 'vitD', label: '維生素 D', target: '2000 IU', icon: '☀️', tip: '鮭魚 100g ≈ 500 IU' },
  { key: 'magnesium', label: '鎂', target: '400mg', icon: '🥬', tip: '南瓜子 30g ≈ 150mg' },
  { key: 'fiber', label: '膳食纖維', target: '25-30g', icon: '🥦', tip: '蔬菜 300g + 全穀 = 25g' },
  { key: 'zinc', label: '鋅', target: '15mg', icon: '🦪', tip: '牡蠣 6 顆 ≈ 32mg' },
]

interface LabAdvice {
  category: string
  title: string
  icon: string
  severity: 'high' | 'medium'
  dietaryChanges: string[]
  foodsToIncrease: string[]
  foodsToReduce: string[]
  macroAdjustment?: { nutrient: string; direction: string; detail: string }
  labMarker: string
  currentValue: number
  unit: string
  targetRange: string
  references?: string[]
  caveat?: string
}

interface ComparisonItem {
  label: string
  icon: string
  current: number | string | null
  previous: number | string | null
  unit: string
  improved: boolean | null
}

interface LabComparison {
  testName: string
  current: { value: number; status: string; date: string } | null
  previous: { value: number; status: string; date: string } | null
  improved: boolean | null
  unit: string
}

interface ReportData {
  report: {
    comparisons: ComparisonItem[]
    labComparisons: LabComparison[]
    currentGrade: string | null
    previousGrade: string | null
    daysInCycle: number | null
  }
  labNutritionAdvice: LabAdvice[]
}

export default function HealthModeAdvanced({ clientId, code }: HealthModeAdvancedProps) {
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'advice' | 'report' | 'micro'>('advice')

  useEffect(() => {
    const fetchReport = async () => {
      try {
        const res = await fetch(`/api/health-report?clientId=${clientId}${code ? `&code=${code}` : ''}`)
        if (res.ok) {
          const json = await res.json()
          setData(json)
        }
      } catch { /* ignore */ }
      finally { setLoading(false) }
    }
    fetchReport()
  }, [clientId])

  if (loading) return null

  const hasAdvice = data?.labNutritionAdvice && data.labNutritionAdvice.length > 0
  const hasReport = data?.report?.comparisons && data.report.comparisons.some(c => c.previous != null)

  // 沒有任何數據 → 不顯示
  if (!data && !hasAdvice) return null

  return (
    <div className="bg-white rounded-3xl shadow-sm p-6 mb-6">
      {/* 標題 */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-2xl">🌿</span>
        <h2 className="text-lg font-bold text-gray-900">健康優化中心</h2>
      </div>

      {/* Tab 切換 */}
      <div className="flex gap-1 mb-4 bg-gray-100 rounded-xl p-1">
        {[
          { key: 'advice' as const, label: '血檢飲食', icon: '🩸', show: true },
          { key: 'report' as const, label: '季度對比', icon: '📊', show: hasReport },
          { key: 'micro' as const, label: '微營養素', icon: '💊', show: true },
        ].filter(t => t.show).map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === tab.key
                ? 'bg-white text-emerald-700 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* ===== 血檢飲食建議 ===== */}
      {activeTab === 'advice' && (
        <div>
          {hasAdvice ? (
            <div className="space-y-3">
              {data!.labNutritionAdvice.map((advice, i) => (
                <LabAdviceCard key={i} advice={advice} />
              ))}
            </div>
          ) : (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-center">
              <p className="text-sm text-emerald-700">
                {data?.report?.labComparisons?.length
                  ? '🎉 所有血檢指標正常，目前無需特別飲食調整'
                  : '📋 尚無血檢資料，請在本季安排血檢後上傳結果'}
              </p>
            </div>
          )}
        </div>
      )}

      {/* ===== 季度對比 ===== */}
      {activeTab === 'report' && data?.report && (
        <div>
          {/* 等級對比 */}
          {data.report.currentGrade && data.report.previousGrade && (
            <div className="flex items-center justify-center gap-6 mb-4 py-3">
              <div className="text-center">
                <p className="text-[10px] text-gray-400 mb-1">上季</p>
                <GradeBadge grade={data.report.previousGrade} size="lg" />
              </div>
              <span className="text-2xl text-gray-300">→</span>
              <div className="text-center">
                <p className="text-[10px] text-gray-400 mb-1">本季</p>
                <GradeBadge grade={data.report.currentGrade} size="lg" />
              </div>
            </div>
          )}

          {/* 指標對比 */}
          <div className="space-y-2 mb-4">
            {data.report.comparisons
              .filter(c => c.current != null || c.previous != null)
              .map((item, i) => (
                <ComparisonRow key={i} item={item} />
              ))}
          </div>

          {/* 血檢前後對比 */}
          {data.report.labComparisons.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-700 mb-2">🔬 血檢前後對比</p>
              <div className="space-y-1.5">
                {data.report.labComparisons.map((lab, i) => (
                  <div key={i} className="flex items-center justify-between bg-gray-50 rounded-xl px-3 py-2">
                    <span className="text-xs text-gray-700 font-medium">{lab.testName}</span>
                    <div className="flex items-center gap-2">
                      {lab.previous && (
                        <span className="text-xs text-gray-400">
                          {lab.previous.value} →
                        </span>
                      )}
                      {lab.current && (
                        <span className={`text-xs font-bold ${
                          lab.current.status === 'normal' ? 'text-green-600'
                            : lab.current.status === 'attention' ? 'text-amber-600'
                              : 'text-red-600'
                        }`}>
                          {lab.current.value} {lab.unit}
                        </span>
                      )}
                      {lab.improved === true && <span className="text-xs">✅</span>}
                      {lab.improved === false && <span className="text-xs">⚠️</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!hasReport && (
            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 text-center">
              <p className="text-sm text-gray-500">
                📊 第一季數據收集中，下季開始後即可看到對比報告
              </p>
            </div>
          )}
        </div>
      )}

      {/* ===== 微營養素目標 ===== */}
      {activeTab === 'micro' && (
        <div>
          <p className="text-[10px] text-gray-400 mb-3">
            健康模式每日微營養素建議攝取量（基於最新運動營養研究）
          </p>
          <div className="space-y-2">
            {MICRO_TARGETS.map((micro) => (
              <div key={micro.key} className="bg-gray-50 rounded-2xl p-3">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-base">{micro.icon}</span>
                    <span className="text-sm font-medium text-gray-900">{micro.label}</span>
                  </div>
                  <span className="text-sm font-bold text-emerald-700">{micro.target}</span>
                </div>
                <p className="text-[10px] text-gray-400 ml-7">{micro.tip}</p>
              </div>
            ))}
          </div>
          <div className="mt-3 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
            <p className="text-[10px] text-emerald-700">
              💡 這些目標會根據你的血檢結果自動調整。缺鎂 → 鎂目標提高；CRP 高 → Omega-3 目標提高。
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

// ── 子組件 ──

function LabAdviceCard({ advice }: { advice: LabAdvice }) {
  const [expanded, setExpanded] = useState(false)
  const bgColor = advice.severity === 'high'
    ? 'bg-red-50 border-red-200'
    : 'bg-amber-50 border-amber-200'
  const textColor = advice.severity === 'high' ? 'text-red-700' : 'text-amber-700'

  return (
    <div className={`${bgColor} border rounded-2xl p-4`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">{advice.icon}</span>
            <div>
              <p className={`text-sm font-bold ${textColor}`}>{advice.title}</p>
              <p className="text-[10px] text-gray-500">
                {advice.labMarker} {advice.currentValue}{advice.unit}（目標：{advice.targetRange}）
              </p>
            </div>
          </div>
          <span className="text-gray-400 text-xs">{expanded ? '▲' : '▼'}</span>
        </div>
      </button>

      {expanded && (
        <div className="mt-3 space-y-3">
          {/* 飲食調整 */}
          <div>
            <p className="text-[10px] font-bold text-gray-700 mb-1">📋 飲食調整</p>
            <ul className="space-y-1">
              {advice.dietaryChanges.map((change, i) => (
                <li key={i} className="text-[11px] text-gray-700 flex gap-1">
                  <span className="text-gray-400">•</span>
                  <span>{change}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* 多吃 */}
          {advice.foodsToIncrease.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-green-700 mb-1">✅ 建議多吃</p>
              <div className="flex flex-wrap gap-1.5">
                {advice.foodsToIncrease.map((food, i) => (
                  <span key={i} className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                    {food}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 少吃 */}
          {advice.foodsToReduce.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-red-700 mb-1">⚠️ 建議減少</p>
              <div className="flex flex-wrap gap-1.5">
                {advice.foodsToReduce.map((food, i) => (
                  <span key={i} className="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                    {food}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 巨量營養素調整 */}
          {advice.macroAdjustment && (
            <div className="bg-white bg-opacity-70 rounded-xl p-2.5">
              <p className="text-[10px] font-bold text-blue-700 mb-0.5">
                🔧 {advice.macroAdjustment.nutrient}調整
              </p>
              <p className="text-[10px] text-blue-600">{advice.macroAdjustment.detail}</p>
            </div>
          )}

          {advice.caveat && (
            <div className="bg-gray-100 rounded-xl p-2.5">
              <p className="text-[10px] font-bold text-gray-600 mb-0.5">⚠️ 判讀提醒</p>
              <p className="text-[10px] text-gray-500">{advice.caveat}</p>
            </div>
          )}

          {advice.references && advice.references.length > 0 && (
            <div className="border-t border-gray-200 pt-2">
              <p className="text-[10px] font-bold text-gray-400 mb-1">📚 文獻依據</p>
              <ul className="space-y-0.5">
                {advice.references.map((ref, i) => (
                  <li key={i} className="text-[9px] text-gray-400">{ref}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function GradeBadge({ grade, size = 'sm' }: { grade: string; size?: 'sm' | 'lg' }) {
  const colors: Record<string, string> = {
    A: 'bg-emerald-100 text-emerald-700 border-emerald-300',
    B: 'bg-blue-100 text-blue-700 border-blue-300',
    C: 'bg-amber-100 text-amber-700 border-amber-300',
    D: 'bg-red-100 text-red-700 border-red-300',
  }
  const sizeClass = size === 'lg' ? 'text-3xl w-14 h-14' : 'text-lg w-8 h-8'
  return (
    <div className={`${colors[grade] || colors.C} border-2 rounded-full ${sizeClass} flex items-center justify-center font-black`}>
      {grade}
    </div>
  )
}

function ComparisonRow({ item }: { item: ComparisonItem }) {
  const delta = typeof item.current === 'number' && typeof item.previous === 'number'
    ? item.current - item.previous
    : null

  return (
    <div className="flex items-center justify-between bg-gray-50 rounded-xl px-3 py-2.5">
      <div className="flex items-center gap-2">
        <span className="text-base">{item.icon}</span>
        <span className="text-xs font-medium text-gray-700">{item.label}</span>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-xs text-gray-400">
          {item.previous != null ? `${item.previous}` : '-'}
        </span>
        <span className="text-gray-300">→</span>
        <span className="text-xs font-bold text-gray-900">
          {item.current != null ? `${item.current}${item.unit}` : '-'}
        </span>
        {delta != null && (
          <span className={`text-[10px] font-bold ${
            item.improved === true ? 'text-green-600' : item.improved === false ? 'text-red-600' : 'text-gray-400'
          }`}>
            {item.improved === true ? '↑' : item.improved === false ? '↓' : '→'}
          </span>
        )}
      </div>
    </div>
  )
}
