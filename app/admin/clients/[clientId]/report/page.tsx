'use client'

import { useState, useEffect, useMemo } from 'react'
import { useParams } from 'next/navigation'
import { generateSupplementSuggestions, type SupplementSuggestion } from '@/lib/supplement-engine'
import { getLabAdvice } from '@/components/client/types'

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

  useEffect(() => {
    fetch(`/api/client-overview?clientId=${clientId}`)
      .then(r => r.json())
      .then(data => {
        setClient(data.client)
        setSupplements(data.supplements || [])
        setSupplementLogs(data.supplementLogs || [])
        setBodyData(data.bodyData || [])
        setLabResults(data.labResults || [])
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
                {latestBody.body_fat != null && <tr><td>體脂率</td><td>{latestBody.body_fat}%</td></tr>}
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
