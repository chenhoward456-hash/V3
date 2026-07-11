'use client'

import { useState, useMemo } from 'react'
import {
  detectLabCrossPatterns,
  generateRetestReminders,
  generateLabChangeReport,
  generateLabOptimizationTips,
  type LabCrossAnalysis,
  type LabRetestReminder,
  type LabChangeReport,
  type LabOptimizationTip,
} from '@/lib/lab-nutrition-advisor'
import { deepDegrade } from '@/lib/compliance-scrub'

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
  /**
   * 'client'（預設）= 學員看，輸出過合規降級；'coach' = 教練後台，保留完整臨床用語。
   * 目前只有 /admin 在 render 這張卡（學員頁那顆 2026-06-12 起用 `false &&` 暫藏），
   * 但 default 給安全值：哪天有人把學員頁那行的 false 拿掉，也不會直接把病名印給學員。
   */
  mode?: 'client' | 'coach'
}

export default function LabInsightsCard({ labResults, gender, bodyFatPct, mode = 'client' }: LabInsightsCardProps) {
  // 合規 backstop：引擎若寫出病名/診斷句，學員版換成安全句（實際發生過：交叉分析
  // title「代謝症候群風險」+ description「符合代謝症候群模式」）。源頭文字已清乾淨，
  // 這層是防回歸。教練版不降級——Howard 需要看到完整臨床語言才判讀得了。
  const { crossPatterns, retestReminders, changeReports, optimizationTips } = useMemo(() => {
    const raw = {
      crossPatterns: detectLabCrossPatterns(labResults, { gender, bodyFatPct }),
      retestReminders: generateRetestReminders(labResults, { gender }),
      changeReports: generateLabChangeReport(labResults, { gender }),
      optimizationTips: generateLabOptimizationTips(labResults, { gender }),
    }
    if (mode === 'coach') return raw

    // 文獻引用是書目，不是對學員下的宣稱。期刊名/論文標題常含病名
    //（"Diabetes Care"、"IDF/AHA Joint Interim Statement on metabolic syndrome"），
    // 一起降級的話，畫面上的參考文獻會變成一句罐頭句。先抽走、降級完再放回去。
    const refs = {
      cross: raw.crossPatterns.map(p => p.references),
      tips: raw.optimizationTips.map(t => t.references),
    }
    const { value, hits } = deepDegrade({
      ...raw,
      crossPatterns: raw.crossPatterns.map(p => ({ ...p, references: [] as string[] })),
      optimizationTips: raw.optimizationTips.map(t => ({ ...t, references: [] as string[] })),
    })
    value.crossPatterns.forEach((p, i) => { p.references = refs.cross[i] ?? [] })
    value.optimizationTips.forEach((t, i) => { t.references = refs.tips[i] ?? [] })

    if (hits.length > 0) {
      console.warn('[LabInsightsCard] 合規降級', hits.map(h => h.term))
    }
    return value
  }, [labResults, gender, bodyFatPct, mode])

  // 沒有任何資料就不渲染
  if (crossPatterns.length === 0 && retestReminders.length === 0 && changeReports.length === 0 && optimizationTips.length === 0) {
    return null
  }

  return (
    <div className="bg-white rounded-3xl shadow-sm p-6 mb-6">
      <div className="flex items-center gap-2 mb-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900">血檢深度分析</h2>
          <p className="text-[11px] text-gray-400">交叉比對多項指標，偵測系統性風險與追蹤改善趨勢</p>
        </div>
      </div>

      <div className="space-y-5">
        {/* 優化建議 */}
        {optimizationTips.length > 0 && (
          <OptimizationSection tips={optimizationTips} />
        )}

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
      <p className="text-xs font-bold text-gray-700 mb-2">多指標交叉分析</p>
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
            <div>
              <div className="flex items-center gap-1.5">
                <p className={`text-sm font-bold ${titleColor}`}>{pattern.title}</p>
                <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-bold ${
                  pattern.severity === 'critical' ? 'bg-red-200 text-red-800' :
                  pattern.severity === 'high' ? 'bg-red-100 text-red-700' :
                  'bg-amber-100 text-amber-700'
                }`}>{severityLabel}</span>
              </div>
              <p className="text-[11px] text-gray-500 mt-0.5">
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
              <span key={i} className="text-[11px] bg-white bg-opacity-70 text-gray-700 px-2 py-0.5 rounded-full border border-gray-200">
                {m.name} {m.value} {m.unit}
              </span>
            ))}
          </div>

          {/* 建議行動 */}
          <div>
            <p className="text-[11px] font-bold text-gray-700 mb-1">建議行動</p>
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
              <p className="text-[11px] font-bold text-gray-400 mb-1">文獻依據</p>
              <ul className="space-y-0.5">
                {pattern.references.map((ref, i) => (
                  <li key={i} className="text-[11px] text-gray-400">{ref}</li>
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
      <p className="text-xs font-bold text-gray-700 mb-2">指標變化追蹤</p>
      <div className="space-y-2">
        {displayed.map((r, i) => (
          <div key={i} className={`rounded-xl p-3 border ${
            r.direction === 'improved' ? 'bg-green-50 border-green-200' :
            r.direction === 'worsened' ? 'bg-red-50 border-red-200' :
            'bg-gray-50 border-gray-200'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${
                  r.direction === 'improved' ? 'bg-emerald-500' : r.direction === 'worsened' ? 'bg-rose-500' : 'bg-slate-300'
                }`} />
                <div>
                  <p className="text-[11px] font-bold text-gray-800">{r.testName}</p>
                  <p className="text-[11px] text-gray-500">
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
                <p className="text-[11px] text-gray-400">
                  {r.previousDate} → {r.currentDate}
                </p>
              </div>
            </div>
            <p className="text-[11px] text-gray-600 mt-1">{r.interpretation}</p>
          </div>
        ))}
      </div>
      {reports.length > 5 && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="text-[11px] text-blue-600 mt-2 underline"
        >
          {showAll ? '收起' : `查看全部 ${reports.length} 項`}
        </button>
      )}
    </div>
  )
}

// ── 優化建議區塊 ──
function OptimizationSection({ tips }: { tips: LabOptimizationTip[] }) {
  return (
    <div>
      <p className="text-xs font-bold text-gray-700 mb-2">正常範圍內的優化空間</p>
      <p className="text-[11px] text-gray-400 mb-3">以下指標在正常範圍內，但尚未達到最佳區間，可進一步優化</p>
      <p className="text-[11px] text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 mb-3">
        補品建議僅供參考，不構成醫療建議。使用前請諮詢醫師或營養師，特別是正在服藥者。
      </p>
      <div className="space-y-3">
        {tips.map((tip, i) => (
          <OptimizationTipItem key={i} tip={tip} />
        ))}
      </div>
    </div>
  )
}

function OptimizationTipItem({ tip }: { tip: LabOptimizationTip }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
      <button onClick={() => setExpanded(!expanded)} className="w-full text-left">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div>
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-bold text-blue-700">{tip.title}</p>
                <span className="text-[11px] px-1.5 py-0.5 rounded-full font-bold bg-blue-100 text-blue-700">可優化</span>
              </div>
              <p className="text-[11px] text-gray-500 mt-0.5">
                目前 {tip.currentValue} {tip.unit}｜最佳 {tip.optimalRange}
              </p>
            </div>
          </div>
          <span className="text-gray-400 text-xs">{expanded ? '▲' : '▼'}</span>
        </div>
      </button>

      {expanded && (
        <div className="mt-3 space-y-3">
          <div className="flex items-center gap-2 text-[11px] text-gray-500">
            <span className="bg-white px-2 py-0.5 rounded-full border border-gray-200">正常範圍：{tip.currentRange}</span>
            <span className="bg-blue-100 px-2 py-0.5 rounded-full border border-blue-200 text-blue-700">最佳目標：{tip.optimalRange}</span>
          </div>

          {/* 優化建議 */}
          <div>
            <p className="text-[11px] font-bold text-gray-700 mb-1">優化建議</p>
            <ul className="space-y-1">
              {tip.tips.map((item, i) => (
                <li key={i} className="text-[11px] text-gray-700 flex gap-1">
                  <span className="text-blue-400">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* 補品建議 */}
          {tip.supplements && tip.supplements.length > 0 && (
            <div>
              <p className="text-[11px] font-bold text-gray-700 mb-1">補品建議</p>
              <div className="space-y-1.5">
                {tip.supplements.map((s, i) => (
                  <div key={i} className="bg-white bg-opacity-70 border border-blue-100 rounded-xl p-2.5">
                    <div className="flex items-start justify-between">
                      <p className="text-[11px] font-bold text-blue-800">{s.name}</p>
                    </div>
                    <p className="text-[11px] text-gray-600 mt-0.5">
                      {s.dosage}{s.timing ? ` · ${s.timing}` : ''}
                    </p>
                    {s.note && (
                      <p className="text-[11px] text-gray-400 mt-0.5">{s.note}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 文獻 */}
          {tip.references.length > 0 && (
            <div className="border-t border-blue-100 pt-2">
              <p className="text-[11px] font-bold text-gray-400 mb-1">文獻依據</p>
              <ul className="space-y-0.5">
                {tip.references.map((ref, i) => (
                  <li key={i} className="text-[11px] text-gray-400">{ref}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── 複檢提醒區塊 ──
function RetestReminderSection({ reminders }: { reminders: LabRetestReminder[] }) {
  return (
    <div>
      <p className="text-xs font-bold text-gray-700 mb-2">複檢提醒</p>
      <div className="space-y-2">
        {reminders.map((r, i) => {
          const isOverdue = r.isOverdue
          return (
            <div key={i} className={`rounded-xl p-3 border ${
              isOverdue ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-200'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${isOverdue ? 'bg-rose-500' : 'bg-blue-500'}`} />
                  <div>
                    <p className="text-[11px] font-bold text-gray-800">{r.testName}</p>
                    <p className="text-[11px] text-gray-500">
                      上次：{r.lastValue} {r.unit}（{r.lastDate}）
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-[11px] font-bold ${isOverdue ? 'text-red-700' : 'text-blue-700'}`}>
                    {isOverdue ? '已逾期' : `建議 ${r.suggestedRetestDate}`}
                  </p>
                  <p className="text-[11px] text-gray-400">
                    間隔 {r.suggestedRetestWeeks} 週
                  </p>
                </div>
              </div>
              <p className="text-[11px] text-gray-600 mt-1">{r.reason}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
