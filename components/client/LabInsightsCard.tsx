'use client'

import { useState } from 'react'
import {
  detectLabCrossPatterns,
  generateRetestReminders,
  generateLabChangeReport,
  type LabCrossAnalysis,
  type LabRetestReminder,
  type LabChangeReport,
} from '@/lib/lab-nutrition-advisor'

interface LabInsightsCardProps {
  labResults: Array<{
    test_name: string
    value: number | null
    unit: string
    status: 'normal' | 'attention' | 'alert'
    date: string
  }>
  gender?: '男性' | '女性'
  bodyFatPct?: number | null
}

export default function LabInsightsCard({ labResults, gender, bodyFatPct }: LabInsightsCardProps) {
  const crossPatterns = detectLabCrossPatterns(labResults, { gender, bodyFatPct })
  const retestReminders = generateRetestReminders(labResults, { gender })
  const changeReports = generateLabChangeReport(labResults, { gender })

  // 沒有任何資料就不渲染
  if (crossPatterns.length === 0 && retestReminders.length === 0 && changeReports.length === 0) {
    return null
  }

  return (
    <div className="bg-white rounded-3xl shadow-sm p-6 mb-6">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-2xl">🔬</span>
        <div>
          <h2 className="text-lg font-bold text-gray-900">血檢深度分析</h2>
          <p className="text-[10px] text-gray-400">交叉比對多項指標，偵測系統性風險與追蹤改善趨勢</p>
        </div>
      </div>

      <div className="space-y-5">
        {/* 交叉分析 */}
        {crossPatterns.length > 0 && (
          <CrossAnalysisSection patterns={crossPatterns} />
        )}

        {/* 變化追蹤 */}
        {changeReports.length > 0 && (
          <ChangeReportSection reports={changeReports} />
        )}

        {/* 複檢提醒 */}
        {retestReminders.length > 0 && (
          <RetestReminderSection reminders={retestReminders} />
        )}
      </div>
    </div>
  )
}

// ── 交叉分析區塊 ──
function CrossAnalysisSection({ patterns }: { patterns: LabCrossAnalysis[] }) {
  return (
    <div>
      <p className="text-xs font-bold text-gray-700 mb-2">🧩 多指標交叉分析</p>
      <div className="space-y-3">
        {patterns.map((p, i) => (
          <CrossPatternItem key={i} pattern={p} />
        ))}
      </div>
    </div>
  )
}

function CrossPatternItem({ pattern }: { pattern: LabCrossAnalysis }) {
  const [expanded, setExpanded] = useState(false)
  const bgColor = pattern.severity === 'critical'
    ? 'bg-red-50 border-red-300'
    : pattern.severity === 'high'
    ? 'bg-red-50 border-red-200'
    : 'bg-amber-50 border-amber-200'
  const titleColor = pattern.severity === 'critical' || pattern.severity === 'high'
    ? 'text-red-700'
    : 'text-amber-700'
  const severityLabel = pattern.severity === 'critical' ? '嚴重' : pattern.severity === 'high' ? '高風險' : '注意'

  return (
    <div className={`${bgColor} border rounded-2xl p-4`}>
      <button onClick={() => setExpanded(!expanded)} className="w-full text-left">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">{pattern.icon}</span>
            <div>
              <div className="flex items-center gap-1.5">
                <p className={`text-sm font-bold ${titleColor}`}>{pattern.title}</p>
                <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${
                  pattern.severity === 'critical' ? 'bg-red-200 text-red-800' :
                  pattern.severity === 'high' ? 'bg-red-100 text-red-700' :
                  'bg-amber-100 text-amber-700'
                }`}>{severityLabel}</span>
              </div>
              <p className="text-[10px] text-gray-500 mt-0.5">
                {pattern.triggeredMarkers.map(m => m.name).join('、')}
              </p>
            </div>
          </div>
          <span className="text-gray-400 text-xs">{expanded ? '▲' : '▼'}</span>
        </div>
      </button>

      {expanded && (
        <div className="mt-3 space-y-3">
          <p className="text-[11px] text-gray-700">{pattern.description}</p>

          {/* 觸發指標 */}
          <div className="flex flex-wrap gap-1.5">
            {pattern.triggeredMarkers.map((m, i) => (
              <span key={i} className="text-[10px] bg-white bg-opacity-70 text-gray-700 px-2 py-0.5 rounded-full border border-gray-200">
                {m.name} {m.value} {m.unit}
              </span>
            ))}
          </div>

          {/* 建議行動 */}
          <div>
            <p className="text-[10px] font-bold text-gray-700 mb-1">📋 建議行動</p>
            <ul className="space-y-1">
              {pattern.actionItems.map((item, i) => (
                <li key={i} className="text-[11px] text-gray-700 flex gap-1">
                  <span className="text-gray-400">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* 文獻 */}
          {pattern.references.length > 0 && (
            <div className="border-t border-gray-200 pt-2">
              <p className="text-[10px] font-bold text-gray-400 mb-1">📚 文獻依據</p>
              <ul className="space-y-0.5">
                {pattern.references.map((ref, i) => (
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

// ── 變化追蹤區塊 ──
function ChangeReportSection({ reports }: { reports: LabChangeReport[] }) {
  const [showAll, setShowAll] = useState(false)
  const displayed = showAll ? reports : reports.slice(0, 5)

  return (
    <div>
      <p className="text-xs font-bold text-gray-700 mb-2">📊 指標變化追蹤</p>
      <div className="space-y-2">
        {displayed.map((r, i) => (
          <div key={i} className={`rounded-xl p-3 border ${
            r.direction === 'improved' ? 'bg-green-50 border-green-200' :
            r.direction === 'worsened' ? 'bg-red-50 border-red-200' :
            'bg-gray-50 border-gray-200'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm">
                  {r.direction === 'improved' ? '✅' : r.direction === 'worsened' ? '⚠️' : '➖'}
                </span>
                <div>
                  <p className="text-[11px] font-bold text-gray-800">{r.testName}</p>
                  <p className="text-[10px] text-gray-500">
                    {r.previousValue} → {r.currentValue} {r.unit}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className={`text-[11px] font-bold ${
                  r.direction === 'improved' ? 'text-green-700' :
                  r.direction === 'worsened' ? 'text-red-700' :
                  'text-gray-500'
                }`}>
                  {r.changeAbsolute > 0 ? '+' : ''}{r.changeAbsolute} {r.unit}
                </p>
                <p className="text-[9px] text-gray-400">
                  {r.previousDate} → {r.currentDate}
                </p>
              </div>
            </div>
            <p className="text-[10px] text-gray-600 mt-1">{r.interpretation}</p>
          </div>
        ))}
      </div>
      {reports.length > 5 && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="text-[10px] text-blue-600 mt-2 underline"
        >
          {showAll ? '收起' : `查看全部 ${reports.length} 項`}
        </button>
      )}
    </div>
  )
}

// ── 複檢提醒區塊 ──
function RetestReminderSection({ reminders }: { reminders: LabRetestReminder[] }) {
  return (
    <div>
      <p className="text-xs font-bold text-gray-700 mb-2">🗓️ 複檢提醒</p>
      <div className="space-y-2">
        {reminders.map((r, i) => {
          const isOverdue = r.isOverdue
          return (
            <div key={i} className={`rounded-xl p-3 border ${
              isOverdue ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-200'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm">{isOverdue ? '🔴' : '🔵'}</span>
                  <div>
                    <p className="text-[11px] font-bold text-gray-800">{r.testName}</p>
                    <p className="text-[10px] text-gray-500">
                      上次：{r.lastValue} {r.unit}（{r.lastDate}）
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-[11px] font-bold ${isOverdue ? 'text-red-700' : 'text-blue-700'}`}>
                    {isOverdue ? '已逾期' : `建議 ${r.suggestedRetestDate}`}
                  </p>
                  <p className="text-[9px] text-gray-400">
                    間隔 {r.suggestedRetestWeeks} 週
                  </p>
                </div>
              </div>
              <p className="text-[10px] text-gray-600 mt-1">{r.reason}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
