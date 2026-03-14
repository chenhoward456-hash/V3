'use client'

import { useState, useEffect, useMemo } from 'react'
import { useParams } from 'next/navigation'
import { generateSupplementSuggestions, type SupplementSuggestion } from '@/lib/supplement-engine'
import { getLabAdvice, TRAINING_TYPES } from '@/components/client/types'
import { calculateHealthScore } from '@/lib/health-score-engine'
import {
  detectLabCrossPatterns,
  generateLabOptimizationTips,
  generateLabChangeReport,
} from '@/lib/lab-nutrition-advisor'

const MTHFR_LABELS: Record<string, string> = {
  normal: '正常（野生型）',
  heterozygous: '雜合突變（C677T 或 A1298C）',
  homozygous: '純合突變（C677T）',
}

const APOE_LABELS: Record<string, string> = {
  'e2/e2': 'e2/e2 — 心血管低風險',
  'e2/e3': 'e2/e3 — 低風險',
  'e3/e3': 'e3/e3 — 一般（最常見）',
  'e3/e4': 'e3/e4 — 心血管 / 阿茲海默中等風險',
  'e4/e4': 'e4/e4 — 心血管 / 阿茲海默高風險',
}

const SEROTONIN_LABELS: Record<string, string> = {
  LL: 'LL（長/長）— 低風險',
  SL: 'SL（短/長）— 中等風險',
  SS: 'SS（短/短）— 高風險',
  low: '低風險',
  moderate: '中等風險',
  high: '高風險',
}

export default function HealthReportPage() {
  const { clientId } = useParams()
  const [loading, setLoading] = useState(true)
  const [client, setClient] = useState<any>(null)
  const [supplements, setSupplements] = useState<any[]>([])
  const [supplementLogs, setSupplementLogs] = useState<any[]>([])
  const [bodyData, setBodyData] = useState<any[]>([])
  const [labResults, setLabResults] = useState<any[]>([])
  const [wellness, setWellness] = useState<any[]>([])
  const [trainingLogs, setTrainingLogs] = useState<any[]>([])
  const [nutritionLogs, setNutritionLogs] = useState<any[]>([])

  useEffect(() => {
    fetch(`/api/client-overview?clientId=${clientId}`)
      .then(r => r.json())
      .then(data => {
        setClient(data.client)
        setSupplements(data.supplements || [])
        setSupplementLogs(data.supplementLogs || [])
        setBodyData(data.bodyData || [])
        setLabResults(data.labResults || [])
        setWellness(data.wellness || [])
        setTrainingLogs(data.trainingLogs || [])
        setNutritionLogs(data.nutritionLogs || [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [clientId])

  // Latest lab values (deduplicated by test name)
  const latestLabs = useMemo(() => {
    const byName = new Map<string, any>()
    for (const r of labResults) {
      const existing = byName.get(r.test_name)
      if (!existing || new Date(r.date) > new Date(existing.date)) {
        byName.set(r.test_name, r)
      }
    }
    return [...byName.values()].sort((a, b) => a.test_name.localeCompare(b.test_name))
  }, [labResults])

  // Supplement suggestions
  const suggestions = useMemo(() => {
    if (!latestLabs.length || !client) return []
    return generateSupplementSuggestions(latestLabs, {
      gender: client.gender,
      isCompetitionPrep: !!client.competition_enabled,
      hasHighRPE: false,
      goalType: client.goal_type || null,
      isHealthMode: !!client.health_mode_enabled,
      genetics: {
        mthfr: client.gene_mthfr,
        apoe: client.gene_apoe,
        serotonin: client.gene_depression_risk,
        depressionRisk: client.gene_depression_risk,
      },
      prepPhase: client.prep_phase || null,
    })
  }, [latestLabs, client])

  // Supplement compliance (30 days)
  const compliance = useMemo(() => {
    if (!supplements.length) return null
    const total = supplements.length
    const today = new Date()
    const thirtyDaysAgo = new Date(today)
    thirtyDaysAgo.setDate(today.getDate() - 29)
    const sinceStr = thirtyDaysAgo.toISOString().split('T')[0]
    const todayStr = today.toISOString().split('T')[0]
    const logs = supplementLogs.filter(l => l.date >= sinceStr && l.date <= todayStr && l.completed)
    const daysWithData = new Set(supplementLogs.filter(l => l.date >= sinceStr && l.date <= todayStr).map(l => l.date)).size
    if (!daysWithData) return null
    return Math.round((logs.length / (total * daysWithData)) * 100)
  }, [supplements, supplementLogs])

  // Latest body data
  const latestBody = bodyData[0] || null
  const bmi = latestBody?.weight && latestBody?.height
    ? (latestBody.weight / ((latestBody.height / 100) ** 2)).toFixed(1)
    : null

  // Weight trend (30 days)
  const weightTrend = useMemo(() => {
    const recent = bodyData.filter(b => b.weight != null).slice(0, 30)
    if (recent.length < 2) return null
    const oldest = recent[recent.length - 1].weight
    const newest = recent[0].weight
    return { change: (newest - oldest).toFixed(1), from: oldest, to: newest, days: recent.length }
  }, [bodyData])

  // Body fat trend (30 days)
  const bodyFatTrend = useMemo(() => {
    const recent = bodyData.filter(b => b.body_fat != null).slice(0, 30)
    if (recent.length < 2) return null
    const oldest = recent[recent.length - 1].body_fat
    const newest = recent[0].body_fat
    return { change: (newest - oldest).toFixed(1), from: oldest, to: newest, days: recent.length }
  }, [bodyData])

  // ── Health Score (5 pillars) ──
  const healthScore = useMemo(() => {
    if (!client) return null
    const last7Wellness = wellness.slice(0, 7)
    const last7Nutrition = nutritionLogs.slice(0, 7)
    const last7Training = trainingLogs.slice(0, 7)
    if (!last7Wellness.length && !last7Nutrition.length && !last7Training.length) return null
    return calculateHealthScore({
      wellnessLast7: last7Wellness,
      nutritionLast7: last7Nutrition,
      trainingLast7: last7Training,
      supplementComplianceRate: compliance != null ? compliance / 100 : 0,
      labResults: latestLabs,
      quarterlyStart: client.quarterly_cycle_start || null,
    })
  }, [client, wellness, nutritionLogs, trainingLogs, compliance, latestLabs])

  // ── Lab Cross-Analysis ──
  const crossPatterns = useMemo(() => {
    if (!latestLabs.length) return []
    return detectLabCrossPatterns(labResults, {
      gender: client?.gender,
      bodyFatPct: bodyData[0]?.body_fat ?? null,
    })
  }, [labResults, client, bodyData, latestLabs])

  // ── Lab Optimization Tips ──
  const optimizationTips = useMemo(() => {
    if (!latestLabs.length) return []
    return generateLabOptimizationTips(labResults, { gender: client?.gender })
  }, [labResults, client, latestLabs])

  // ── Lab Change Report ──
  const changeReports = useMemo(() => {
    if (!labResults.length) return []
    return generateLabChangeReport(labResults, { gender: client?.gender })
  }, [labResults, client])

  // ── Training × Recovery Cross-Analysis ──
  const recoveryAnalysis = useMemo(() => {
    if (!trainingLogs.length || !wellness.length) return []
    const wellnessMap: Record<string, any> = {}
    for (const w of wellness) wellnessMap[w.date] = w
    const nextDay = (dateStr: string) => {
      const d = new Date(dateStr); d.setDate(d.getDate() + 1)
      return d.toISOString().split('T')[0]
    }
    const typeStats: Record<string, { count: number; energy: number[]; sleep: number[] }> = {}
    for (const log of trainingLogs.filter(l => l.training_type !== 'rest')) {
      const t = log.training_type
      if (!typeStats[t]) typeStats[t] = { count: 0, energy: [], sleep: [] }
      typeStats[t].count++
      const nextW = wellnessMap[nextDay(log.date)]
      if (nextW) {
        if (nextW.energy_level != null) typeStats[t].energy.push(nextW.energy_level)
        if (nextW.sleep_quality != null) typeStats[t].sleep.push(nextW.sleep_quality)
      }
    }
    const avg = (arr: number[]) => arr.length > 0 ? (arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1) : null
    return Object.entries(typeStats).map(([type, s]) => ({
      type: TRAINING_TYPES.find(t => t.value === type)?.label || type,
      count: s.count,
      avgEnergy: avg(s.energy),
      avgSleep: avg(s.sleep),
    })).filter(r => r.avgEnergy || r.avgSleep).sort((a, b) => b.count - a.count)
  }, [trainingLogs, wellness])

  const today = new Date().toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' })
  const statusLabel = (s: string) => s === 'normal' ? '正常' : s === 'attention' ? '需注意' : '異常'

  const hasGenetics = client?.gene_mthfr || client?.gene_apoe || client?.gene_depression_risk

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">載入中...</p>
      </div>
    )
  }

  if (!client) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-red-500">找不到學員資料</p>
      </div>
    )
  }

  return (
    <>
      {/* Print button — hidden when printing */}
      <div className="no-print fixed top-4 right-4 z-50 flex gap-2">
        <button
          onClick={() => window.print()}
          className="bg-gray-900 text-white px-6 py-2.5 rounded-xl font-medium hover:bg-gray-800 transition-colors shadow-lg"
        >
          列印 / 存 PDF
        </button>
        <button
          onClick={() => window.close()}
          className="bg-gray-200 text-gray-700 px-4 py-2.5 rounded-xl font-medium hover:bg-gray-300 transition-colors shadow-lg"
        >
          關閉
        </button>
      </div>

      {/* Report content */}
      <div className="report-page">
        {/* ── Header ── */}
        <header className="report-header">
          <h1>{client.name} 健康追蹤報告</h1>
          <div className="report-meta">
            <span>{client.age} 歲 · {client.gender}</span>
            <span>報告日期：{today}</span>
          </div>
        </header>

        {/* ── Coach Summary ── */}
        {client.coach_summary && (
          <section className="report-section">
            <h2>教練健康摘要</h2>
            <p className="report-text">{client.coach_summary}</p>
          </section>
        )}

        {/* ── Body Composition ── */}
        <section className="report-section">
          <h2>身體組成</h2>
          {latestBody ? (
            <table className="report-table">
              <tbody>
                {latestBody.weight != null && (
                  <tr>
                    <td>體重</td>
                    <td>{latestBody.weight} kg{weightTrend ? ` （近 ${weightTrend.days} 天 ${Number(weightTrend.change) > 0 ? '+' : ''}${weightTrend.change} kg）` : ''}</td>
                  </tr>
                )}
                {latestBody.body_fat != null && (
                  <tr>
                    <td>體脂率</td>
                    <td>{latestBody.body_fat}%{bodyFatTrend ? ` （近 ${bodyFatTrend.days} 天 ${Number(bodyFatTrend.change) > 0 ? '+' : ''}${bodyFatTrend.change}%）` : ''}</td>
                  </tr>
                )}
                {bmi && <tr><td>BMI</td><td>{bmi}</td></tr>}
                {latestBody.muscle_mass != null && <tr><td>肌肉量</td><td>{latestBody.muscle_mass} kg</td></tr>}
                {latestBody.height != null && <tr><td>身高</td><td>{latestBody.height} cm</td></tr>}
                {latestBody.waist != null && <tr><td>腰圍</td><td>{latestBody.waist} cm</td></tr>}
              </tbody>
            </table>
          ) : (
            <p className="report-empty">尚無身體數據</p>
          )}
        </section>

        {/* ── Blood Work ── */}
        {latestLabs.length > 0 && (
          <section className="report-section page-break-before">
            <h2>血檢指標</h2>
            <table className="report-table report-table-full">
              <thead>
                <tr>
                  <th>指標</th>
                  <th>數值</th>
                  <th>參考範圍</th>
                  <th>狀態</th>
                  <th>建議</th>
                </tr>
              </thead>
              <tbody>
                {latestLabs.map((r: any) => (
                  <tr key={r.id} className={r.status === 'alert' ? 'row-alert' : r.status === 'attention' ? 'row-attention' : ''}>
                    <td>{r.test_name}</td>
                    <td className="text-mono">{r.value} {r.unit}</td>
                    <td>{r.custom_target || r.reference_range || '-'}</td>
                    <td>
                      <span className={`status-badge ${r.status}`}>{statusLabel(r.status)}</span>
                    </td>
                    <td>{r.custom_advice || getLabAdvice(r.test_name, r.value) || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="report-note">檢驗日期：{latestLabs[0]?.date || '-'}</p>
          </section>
        )}

        {/* ── System Analysis (the unique value) ── */}
        {(healthScore || crossPatterns.length > 0 || optimizationTips.length > 0 || changeReports.length > 0 || recoveryAnalysis.length > 0) && (
          <section className="report-section page-break-before">
            <h2>系統綜合分析</h2>
            <p className="report-note" style={{ marginTop: 0, marginBottom: 16 }}>
              以下分析由系統根據血檢、訓練、睡眠、飲食、補品等多維度數據交叉比對自動產出
            </p>

            {/* Health Score */}
            {healthScore && (
              <div className="analysis-block">
                <h3>健康總評分</h3>
                <div className="score-header">
                  <span className={`score-grade grade-${healthScore.grade}`}>{healthScore.grade}</span>
                  <span className="score-total">{healthScore.total} / 100</span>
                </div>
                <table className="report-table report-table-full">
                  <thead>
                    <tr><th>支柱</th><th>分數</th><th>權重</th><th>說明</th></tr>
                  </thead>
                  <tbody>
                    {healthScore.pillars.map((p) => {
                      const weightMap: Record<string, number> = { sleep: 20, wellness: 25, nutrition: 20, training: 20, supplement: 15 }
                      return (
                        <tr key={p.pillar}>
                          <td className="font-semibold">{p.emoji} {p.label}</td>
                          <td className="text-mono">{p.score} / 100</td>
                          <td>{weightMap[p.pillar] ?? '-'}%</td>
                          <td className="text-small">{p.detail || '-'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                {(healthScore.labPenalty !== 0 || healthScore.labBonus !== 0) && (
                  <p className="report-note">
                    血檢修正：{healthScore.labPenalty !== 0 ? `扣分 ${healthScore.labPenalty}` : ''}{healthScore.labBonus !== 0 ? ` 加分 +${healthScore.labBonus}` : ''}
                  </p>
                )}
              </div>
            )}

            {/* Lab Change Report */}
            {changeReports.length > 0 && (
              <div className="analysis-block">
                <h3>血檢指標變化追蹤</h3>
                <table className="report-table report-table-full">
                  <thead>
                    <tr><th>指標</th><th>前次</th><th>本次</th><th>變化</th><th>趨勢</th><th>解讀</th></tr>
                  </thead>
                  <tbody>
                    {changeReports.map((r, i) => (
                      <tr key={i} className={r.direction === 'worsened' ? 'row-attention' : ''}>
                        <td className="font-semibold">{r.testName}</td>
                        <td className="text-mono">{r.previousValue} {r.unit}<br/><span className="text-tiny">{r.previousDate}</span></td>
                        <td className="text-mono">{r.currentValue} {r.unit}<br/><span className="text-tiny">{r.currentDate}</span></td>
                        <td className="text-mono">{r.changeAbsolute > 0 ? '+' : ''}{r.changeAbsolute.toFixed(1)}</td>
                        <td>
                          <span className={`status-badge ${r.direction === 'improved' ? 'normal' : r.direction === 'worsened' ? 'attention' : ''}`}>
                            {r.direction === 'improved' ? '改善' : r.direction === 'worsened' ? '惡化' : '穩定'}
                          </span>
                        </td>
                        <td className="text-small">{r.interpretation}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Cross-Analysis */}
            {crossPatterns.length > 0 && (
              <div className="analysis-block">
                <h3>多指標交叉分析</h3>
                {crossPatterns.map((p, i) => (
                  <div key={i} className={`cross-pattern severity-${p.severity}`}>
                    <div className="cross-pattern-header">
                      <span>{p.icon} <strong>{p.title}</strong></span>
                      <span className={`status-badge ${p.severity === 'critical' ? 'alert' : p.severity === 'high' ? 'alert' : 'attention'}`}>
                        {p.severity === 'critical' ? '嚴重' : p.severity === 'high' ? '高風險' : '注意'}
                      </span>
                    </div>
                    <p className="text-small">{p.description}</p>
                    <div className="cross-pattern-markers">
                      {p.triggeredMarkers.map((m, j) => (
                        <span key={j} className="marker-tag">{m.name} {m.value} {m.unit}</span>
                      ))}
                    </div>
                    {p.actionItems.length > 0 && (
                      <ul className="action-list">
                        {p.actionItems.map((item, j) => <li key={j}>{item}</li>)}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Optimization Tips */}
            {optimizationTips.length > 0 && (
              <div className="analysis-block">
                <h3>正常範圍內的優化空間</h3>
                <table className="report-table report-table-full">
                  <thead>
                    <tr><th>指標</th><th>目前</th><th>最佳範圍</th><th>優化建議</th></tr>
                  </thead>
                  <tbody>
                    {optimizationTips.map((tip, i) => (
                      <tr key={i}>
                        <td className="font-semibold">{tip.icon} {tip.title}</td>
                        <td className="text-mono">{tip.currentValue} {tip.unit}</td>
                        <td>{tip.optimalRange}</td>
                        <td className="text-small">{tip.tips.join('；')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Training × Recovery */}
            {recoveryAnalysis.length > 0 && (
              <div className="analysis-block">
                <h3>訓練 × 恢復交叉分析</h3>
                <p className="report-note" style={{ marginTop: 0, marginBottom: 8 }}>
                  統計各訓練類型隔天的睡眠品質與精力（1-5 分），數值越低代表該類訓練對恢復壓力越大
                </p>
                <table className="report-table report-table-full">
                  <thead>
                    <tr><th>訓練類型</th><th>次數</th><th>隔天睡眠</th><th>隔天精力</th></tr>
                  </thead>
                  <tbody>
                    {recoveryAnalysis.map((r, i) => (
                      <tr key={i} className={r.avgSleep && Number(r.avgSleep) < 3 ? 'row-attention' : ''}>
                        <td className="font-semibold">{r.type}</td>
                        <td>{r.count} 次</td>
                        <td className="text-mono">{r.avgSleep ?? '-'} / 5</td>
                        <td className="text-mono">{r.avgEnergy ?? '-'} / 5</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {/* ── Genetic Profile ── */}
        {hasGenetics && (
          <section className="report-section">
            <h2>基因檢測摘要</h2>
            <table className="report-table">
              <tbody>
                {client.gene_mthfr && (
                  <tr>
                    <td>MTHFR</td>
                    <td>{MTHFR_LABELS[client.gene_mthfr] || client.gene_mthfr}</td>
                  </tr>
                )}
                {client.gene_apoe && (
                  <tr>
                    <td>APOE</td>
                    <td>{APOE_LABELS[client.gene_apoe] || client.gene_apoe}</td>
                  </tr>
                )}
                {client.gene_depression_risk && (
                  <tr>
                    <td>5-HTTLPR（血清素）</td>
                    <td>{SEROTONIN_LABELS[client.gene_depression_risk] || client.gene_depression_risk}</td>
                  </tr>
                )}
              </tbody>
            </table>
            {client.gene_notes && <p className="report-note">{client.gene_notes}</p>}
          </section>
        )}

        {/* ── Current Supplement Protocol ── */}
        {supplements.length > 0 && (
          <section className="report-section page-break-before">
            <h2>目前補品方案</h2>
            <table className="report-table report-table-full">
              <thead>
                <tr>
                  <th>名稱</th>
                  <th>劑量</th>
                  <th>服用時機</th>
                </tr>
              </thead>
              <tbody>
                {supplements.map((s: any) => (
                  <tr key={s.id}>
                    <td>{s.name}</td>
                    <td>{s.dosage || '-'}</td>
                    <td>{s.timing || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {compliance != null && (
              <p className="report-note">近 30 天補品服從率：{compliance}%</p>
            )}
          </section>
        )}

        {/* ── AI Supplement Suggestions ── */}
        {suggestions.length > 0 && (
          <section className="report-section">
            <h2>系統補品建議（依血檢 + 基因分析）</h2>
            <table className="report-table report-table-full">
              <thead>
                <tr>
                  <th>補品</th>
                  <th>優先級</th>
                  <th>建議劑量</th>
                  <th>服用時機</th>
                  <th>原因</th>
                </tr>
              </thead>
              <tbody>
                {suggestions.map((s: SupplementSuggestion, i: number) => (
                  <tr key={i}>
                    <td className="font-semibold">{s.name}</td>
                    <td>
                      <span className={`priority-badge ${s.priority}`}>
                        {s.priority === 'high' ? '強烈建議' : s.priority === 'medium' ? '建議' : '可考慮'}
                      </span>
                    </td>
                    <td>{s.dosage}</td>
                    <td>{s.timing}</td>
                    <td className="text-small">{s.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="report-disclaimer">
              以上建議由系統依據血檢數值、訓練狀態及基因資料自動產出，僅供參考，不構成醫療建議。請諮詢醫師後再行使用。
            </p>
          </section>
        )}

        {/* ── Health Goals ── */}
        {(client.health_goals || client.next_checkup_date) && (
          <section className="report-section">
            <h2>健康計畫</h2>
            <table className="report-table">
              <tbody>
                {client.health_goals && <tr><td>健康目標</td><td>{client.health_goals}</td></tr>}
                {client.next_checkup_date && (
                  <tr><td>下次回檢</td><td>{new Date(client.next_checkup_date).toLocaleDateString('zh-TW')}</td></tr>
                )}
              </tbody>
            </table>
          </section>
        )}

        {/* ── Footer ── */}
        <footer className="report-footer">
          <p>Howard Protocol 健康管理系統 — 此報告由系統自動產生，供醫療諮詢參考使用</p>
          <p>產出日期：{today}</p>
        </footer>
      </div>

      {/* ── Print Styles ── */}
      <style jsx global>{`
        .report-page {
          max-width: 800px;
          margin: 0 auto;
          padding: 40px 32px;
          font-family: 'Noto Serif TC', 'Georgia', serif;
          color: #1a1a1a;
          line-height: 1.7;
        }

        .report-header {
          text-align: center;
          border-bottom: 2px solid #1a1a1a;
          padding-bottom: 16px;
          margin-bottom: 32px;
        }

        .report-header h1 {
          font-size: 24px;
          font-weight: 700;
          margin: 0;
        }

        .report-meta {
          display: flex;
          justify-content: center;
          gap: 24px;
          margin-top: 8px;
          font-size: 14px;
          color: #666;
        }

        .report-section {
          margin-bottom: 28px;
        }

        .report-section h2 {
          font-size: 16px;
          font-weight: 700;
          border-bottom: 1px solid #ddd;
          padding-bottom: 6px;
          margin-bottom: 12px;
        }

        .report-text {
          font-size: 14px;
          white-space: pre-line;
        }

        .report-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
        }

        .report-table th,
        .report-table td {
          padding: 8px 10px;
          border: 1px solid #ddd;
          text-align: left;
          vertical-align: top;
        }

        .report-table th {
          background: #f5f5f5;
          font-weight: 600;
          font-size: 12px;
          white-space: nowrap;
        }

        .report-table tbody tr:nth-child(even) {
          background: #fafafa;
        }

        .report-table:not(.report-table-full) {
          max-width: 500px;
        }

        .report-table:not(.report-table-full) td:first-child {
          width: 120px;
          font-weight: 600;
          background: #f9f9f9;
        }

        .text-mono {
          font-family: 'SF Mono', 'Menlo', monospace;
          font-size: 12px;
        }

        .text-small {
          font-size: 11px;
          line-height: 1.5;
        }

        .font-semibold {
          font-weight: 600;
        }

        .row-alert {
          background: #fef2f2 !important;
        }

        .row-attention {
          background: #fffbeb !important;
        }

        .status-badge {
          display: inline-block;
          padding: 1px 8px;
          border-radius: 10px;
          font-size: 11px;
          font-weight: 600;
        }

        .status-badge.normal { background: #dcfce7; color: #166534; }
        .status-badge.attention { background: #fef3c7; color: #92400e; }
        .status-badge.alert { background: #fecaca; color: #991b1b; }

        .priority-badge {
          display: inline-block;
          padding: 1px 8px;
          border-radius: 10px;
          font-size: 11px;
          font-weight: 600;
          white-space: nowrap;
        }

        .priority-badge.high { background: #fecaca; color: #991b1b; }
        .priority-badge.medium { background: #fef3c7; color: #92400e; }
        .priority-badge.low { background: #e5e7eb; color: #374151; }

        .report-note {
          font-size: 12px;
          color: #888;
          margin-top: 8px;
        }

        .report-disclaimer {
          font-size: 11px;
          color: #999;
          margin-top: 12px;
          padding: 8px 12px;
          background: #f9f9f9;
          border-left: 3px solid #ddd;
        }

        .report-empty {
          font-size: 13px;
          color: #999;
        }

        /* ── Analysis Blocks ── */
        .analysis-block {
          margin-bottom: 24px;
          padding-bottom: 20px;
          border-bottom: 1px dashed #e5e5e5;
        }

        .analysis-block:last-child {
          border-bottom: none;
          margin-bottom: 0;
        }

        .analysis-block h3 {
          font-size: 14px;
          font-weight: 700;
          margin: 0 0 10px 0;
          color: #333;
        }

        .score-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 12px;
        }

        .score-grade {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 40px;
          height: 40px;
          border-radius: 10px;
          font-size: 20px;
          font-weight: 800;
          color: white;
        }

        .grade-A { background: #16a34a; }
        .grade-B { background: #2563eb; }
        .grade-C { background: #d97706; }
        .grade-D { background: #dc2626; }

        .score-total {
          font-size: 24px;
          font-weight: 700;
          color: #1a1a1a;
        }

        .cross-pattern {
          border: 1px solid #ddd;
          border-radius: 8px;
          padding: 12px 14px;
          margin-bottom: 10px;
        }

        .severity-critical, .severity-high { border-color: #fca5a5; background: #fef2f2; }
        .severity-medium { border-color: #fcd34d; background: #fffbeb; }

        .cross-pattern-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 6px;
          font-size: 13px;
        }

        .cross-pattern-markers {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin: 8px 0;
        }

        .marker-tag {
          display: inline-block;
          padding: 2px 8px;
          font-size: 11px;
          border: 1px solid #ddd;
          border-radius: 12px;
          background: white;
          color: #555;
        }

        .action-list {
          margin: 6px 0 0 0;
          padding-left: 18px;
          font-size: 12px;
          color: #444;
        }

        .action-list li { margin-bottom: 2px; }

        .text-tiny {
          font-size: 10px;
          color: #aaa;
        }

        .report-footer {
          margin-top: 48px;
          padding-top: 16px;
          border-top: 1px solid #ddd;
          text-align: center;
          font-size: 11px;
          color: #aaa;
        }

        .report-footer p {
          margin: 2px 0;
        }

        /* ── Print ── */
        @media print {
          .no-print { display: none !important; }

          body { margin: 0; }

          .report-page {
            padding: 20px 24px;
            max-width: none;
          }

          .report-header h1 { font-size: 20px; }
          .report-section h2 { font-size: 14px; }

          .page-break-before { page-break-before: always; }

          .report-table th,
          .report-table td {
            padding: 5px 8px;
            font-size: 11px;
          }

          .text-small { font-size: 10px; }
        }
      `}</style>
    </>
  )
}
