'use client'

import { useEffect, useState, useMemo } from 'react'
import { useParams } from 'next/navigation'
import { getLabAdvice } from '@/components/client/types'
import { generateSupplementSuggestions, type SupplementSuggestion } from '@/lib/supplement-engine'

// ---------------------------------------------------------------------------
// Types (inline for standalone page)
// ---------------------------------------------------------------------------

interface ClientData {
  id: string
  name: string
  age: number
  gender: string
  unique_code: string
  subscription_tier: string
  coach_summary?: string
  health_goals?: string
  next_checkup_date?: string
  gene_mthfr?: 'normal' | 'heterozygous' | 'homozygous' | null
  gene_apoe?: 'e2/e2' | 'e2/e3' | 'e3/e3' | 'e3/e4' | 'e4/e4' | null
  gene_depression_risk?: 'LL' | 'SL' | 'SS' | null
  gene_notes?: string
  competition_enabled?: boolean
  prep_phase?: string
  goal_type?: string
  health_mode_enabled?: boolean
  [key: string]: unknown
}

interface Supplement {
  id: string
  name: string
  dosage: string
  timing: string
  why?: string
}

interface SupplementLog {
  id: string
  date: string
  supplement_id: string
  taken?: boolean
  completed?: boolean
}

interface BodyDataEntry {
  id: string
  date: string
  weight: number | null
  body_fat: number | null
  muscle_mass: number | null
  height: number | null
  visceral_fat: number | null
}

interface LabResult {
  id: string
  test_name: string
  value: number
  unit: string
  reference_range: string
  status: 'normal' | 'attention' | 'alert'
  date: string
  custom_advice?: string
  custom_target?: string
}

// ---------------------------------------------------------------------------
// Label maps
// ---------------------------------------------------------------------------

const STATUS_LABELS: Record<string, string> = {
  normal: '正常',
  attention: '需注意',
  alert: '異常',
}

const PRIORITY_LABELS: Record<string, string> = {
  high: '高',
  medium: '中',
  low: '低',
}

const MTHFR_LABELS: Record<string, { label: string; note: string }> = {
  normal: {
    label: '正常（野生型）',
    note: '葉酸代謝正常，無特殊補充需求。',
  },
  heterozygous: {
    label: '雜合型（C677T 或 A1298C）',
    note: '葉酸轉化效率降低約 35%，建議使用活性葉酸（5-MTHF）形式補充，並留意同半胱胺酸水平。',
  },
  homozygous: {
    label: '純合型（C677T）',
    note: '葉酸轉化效率降低約 70%，需補充活性葉酸（5-MTHF）及甲基 B12，密切追蹤同半胱胺酸。',
  },
}

const APOE_LABELS: Record<string, { label: string; note: string }> = {
  'e2/e2': { label: 'e2/e2', note: '心血管風險較低，但需留意三酸甘油酯代謝。' },
  'e2/e3': { label: 'e2/e3', note: '心血管風險低於平均。' },
  'e3/e3': { label: 'e3/e3', note: '最常見基因型，心血管風險為一般水平。' },
  'e3/e4': { label: 'e3/e4', note: '心血管及阿茲海默風險中等偏高，建議強化 DHA 攝取並控制飽和脂肪。' },
  'e4/e4': { label: 'e4/e4', note: '心血管及阿茲海默風險顯著升高，建議嚴控飽和脂肪攝取，強化 DHA/EPA 補充並定期追蹤血脂。' },
}

const SEROTONIN_LABELS: Record<string, { label: string; note: string }> = {
  LL: { label: 'LL（長/長）', note: '血清素轉運體功能正常，情緒調節基因風險低。' },
  SL: { label: 'SL（短/長）', note: '血清素代謝效率中等，壓力情境下情緒波動風險略增，建議維持充足維生素 D 與 Omega-3 攝取。' },
  SS: { label: 'SS（短/短）', note: '血清素代謝效率較低，壓力情境下憂鬱及焦慮風險較高，建議積極補充維生素 D、Omega-3 EPA 及鎂，並留意睡眠品質。' },
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function HealthReportPage() {
  const { clientId } = useParams()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [client, setClient] = useState<ClientData | null>(null)
  const [supplements, setSupplements] = useState<Supplement[]>([])
  const [supplementLogs, setSupplementLogs] = useState<SupplementLog[]>([])
  const [bodyData, setBodyData] = useState<BodyDataEntry[]>([])
  const [labResults, setLabResults] = useState<LabResult[]>([])
  const [trainingLogs, setTrainingLogs] = useState<any[]>([])

  // ── Fetch data ──
  useEffect(() => {
    if (!clientId) return
    fetch(`/api/client-overview?clientId=${clientId}`)
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status} ${r.statusText}`)
        return r.json()
      })
      .then((data) => {
        if (data.error) throw new Error(data.error)
        setClient(data.client)
        setSupplements(data.supplements || [])
        setSupplementLogs(data.supplementLogs || [])
        setBodyData(data.bodyData || [])
        setLabResults(data.labResults || [])
        setTrainingLogs(data.trainingLogs || [])
      })
      .catch((err) => setError(err.message || '無法載入資料'))
      .finally(() => setLoading(false))
  }, [clientId])

  // ── Latest lab results (deduplicated by test_name, newest wins) ──
  const latestLabs = useMemo(() => {
    const byName = new Map<string, LabResult>()
    for (const r of labResults) {
      const existing = byName.get(r.test_name)
      if (!existing || new Date(r.date) > new Date(existing.date)) {
        byName.set(r.test_name, r)
      }
    }
    return [...byName.values()].sort((a, b) => a.test_name.localeCompare(b.test_name))
  }, [labResults])

  // ── Latest body composition ──
  const latestBody = bodyData.length ? bodyData[bodyData.length - 1] : null

  const bmi = useMemo(() => {
    if (!latestBody?.weight || !latestBody?.height) return null
    return (latestBody.weight / (latestBody.height / 100) ** 2).toFixed(1)
  }, [latestBody])

  // ── Weight trend (last 30 days) ──
  const weightTrend = useMemo(() => {
    const withWeight = bodyData.filter((b) => b.weight != null)
    if (withWeight.length < 2) return null
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const sinceStr = thirtyDaysAgo.toISOString().split('T')[0]
    const recent = withWeight.filter((b) => b.date >= sinceStr)
    if (recent.length < 2) return null
    const oldest = recent[0].weight!
    const newest = recent[recent.length - 1].weight!
    const change = newest - oldest
    return { from: oldest, to: newest, change: change.toFixed(1) }
  }, [bodyData])

  // ── Supplement compliance (last 30 days) ──
  const compliance = useMemo(() => {
    if (!supplements.length) return null
    const today = new Date()
    const thirtyDaysAgo = new Date(today)
    thirtyDaysAgo.setDate(today.getDate() - 29)
    const sinceStr = thirtyDaysAgo.toISOString().split('T')[0]
    const todayStr = today.toISOString().split('T')[0]

    const recentLogs = supplementLogs.filter((l) => l.date >= sinceStr && l.date <= todayStr)
    const daysWithData = new Set(recentLogs.map((l) => l.date)).size
    if (!daysWithData) return null

    const takenCount = recentLogs.filter((l) => l.taken || l.completed).length
    const expectedCount = supplements.length * daysWithData
    return Math.round((takenCount / expectedCount) * 100)
  }, [supplements, supplementLogs])

  // ── AI supplement suggestions ──
  const hasHighRPE = useMemo(() => {
    const recent = trainingLogs.slice(-7)
    return recent.some((l) => l.rpe != null && l.rpe >= 9)
  }, [trainingLogs])

  const suggestions = useMemo(() => {
    if (!client) return []
    return generateSupplementSuggestions(latestLabs, {
      gender: client.gender as '男性' | '女性',
      isCompetitionPrep: !!client.competition_enabled,
      hasHighRPE,
      goalType: (client.goal_type as 'cut' | 'bulk' | null) || null,
      isHealthMode: !!client.health_mode_enabled,
      genetics: {
        mthfr: client.gene_mthfr,
        apoe: client.gene_apoe,
        serotonin: client.gene_depression_risk,
      },
      prepPhase: (client.prep_phase as any) || null,
    })
  }, [latestLabs, client, hasHighRPE])

  // ── Derived values ──
  const hasGenetics = !!(client?.gene_mthfr || client?.gene_apoe || client?.gene_depression_risk)
  const reportDate = new Date().toLocaleDateString('zh-TW', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
  const reportTimestamp = new Date().toLocaleString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })

  // ── Loading state ──
  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 36, height: 36, border: '3px solid #e5e7eb', borderTopColor: '#1a1a1a',
            borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px',
          }} />
          <p style={{ color: '#888', fontSize: 14, fontFamily: "'Noto Serif TC', Georgia, serif" }}>
            載入報告資料中...
          </p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  // ── Error state ──
  if (error || !client) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff' }}>
        <div style={{ textAlign: 'center', fontFamily: "'Noto Serif TC', Georgia, serif" }}>
          <p style={{ color: '#dc2626', fontSize: 16, marginBottom: 8 }}>
            {error || '找不到學員資料'}
          </p>
          <p style={{ color: '#888', fontSize: 13 }}>
            請確認網址正確，並重新嘗試。
          </p>
        </div>
      </div>
    )
  }

  return (
    <>
      {/* Print button — hidden when printing */}
      <div className="no-print" style={{
        position: 'fixed', top: 20, right: 20, zIndex: 50,
        display: 'flex', gap: 8,
      }}>
        <button
          onClick={() => window.print()}
          style={{
            background: '#1a1a1a', color: '#fff', border: 'none',
            padding: '10px 24px', borderRadius: 8, fontSize: 14,
            fontWeight: 600, cursor: 'pointer', fontFamily: "'Noto Serif TC', Georgia, serif",
          }}
        >
          列印報告
        </button>
      </div>

      {/* Report document */}
      <div className="report-page">

        {/* ────────────────────────────────────────────────
            Section 1: Header
        ──────────────────────────────────────────────── */}
        <header className="report-header">
          <h1>{client.name} 健康追蹤報告</h1>
          <div className="report-meta">
            <span>報告日期：{reportDate}</span>
            {client.age != null && <span>{client.age} 歲</span>}
            {client.gender && <span>{client.gender}</span>}
            <span>教練：Howard Protocol</span>
          </div>
        </header>

        {/* ────────────────────────────────────────────────
            Section 2: Body Composition
        ──────────────────────────────────────────────── */}
        <section className="report-section">
          <h2>身體組成（最新）</h2>
          {latestBody ? (
            <>
              <table className="report-table">
                <tbody>
                  {latestBody.weight != null && (
                    <tr><td>體重</td><td>{latestBody.weight} kg</td></tr>
                  )}
                  {latestBody.body_fat != null && (
                    <tr><td>體脂率</td><td>{latestBody.body_fat}%</td></tr>
                  )}
                  {latestBody.muscle_mass != null && (
                    <tr><td>肌肉量</td><td>{latestBody.muscle_mass} kg</td></tr>
                  )}
                  {bmi && (
                    <tr><td>BMI</td><td>{bmi}</td></tr>
                  )}
                  {latestBody.height != null && (
                    <tr><td>身高</td><td>{latestBody.height} cm</td></tr>
                  )}
                  {latestBody.visceral_fat != null && (
                    <tr><td>內臟脂肪</td><td>{latestBody.visceral_fat}</td></tr>
                  )}
                </tbody>
              </table>
              {weightTrend && (
                <p className="report-note">
                  30天變化：{weightTrend.from} &rarr; {weightTrend.to} kg，{Number(weightTrend.change) > 0 ? '+' : ''}{weightTrend.change} kg
                </p>
              )}
            </>
          ) : (
            <p className="report-empty">尚無身體數據</p>
          )}
        </section>

        {/* ────────────────────────────────────────────────
            Section 3: Blood Work
        ──────────────────────────────────────────────── */}
        {latestLabs.length > 0 && (
          <section className="report-section">
            <h2>血檢指標</h2>
            <table className="report-table report-table-full">
              <thead>
                <tr>
                  <th>檢驗項目</th>
                  <th>數值</th>
                  <th>參考範圍</th>
                  <th>狀態</th>
                  <th>建議</th>
                </tr>
              </thead>
              <tbody>
                {latestLabs.map((r) => {
                  const advice = getLabAdvice(r.test_name, r.value) || r.custom_advice || '-'
                  return (
                    <tr
                      key={r.id}
                      className={r.status === 'alert' ? 'row-alert' : r.status === 'attention' ? 'row-attention' : ''}
                    >
                      <td className="font-semibold">{r.test_name}</td>
                      <td className="text-mono">{r.value} {r.unit}</td>
                      <td>{r.custom_target || r.reference_range || '-'}</td>
                      <td>
                        <span className={`status-badge ${r.status}`}>
                          {STATUS_LABELS[r.status] || r.status}
                        </span>
                      </td>
                      <td className="text-small">{advice}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <p className="report-note">
              最近檢驗日期：{latestLabs.reduce((latest, r) => (r.date > latest ? r.date : latest), latestLabs[0]?.date || '-')}
            </p>
          </section>
        )}

        {/* ────────────────────────────────────────────────
            Section 4: Genetic Profile
        ──────────────────────────────────────────────── */}
        {hasGenetics && (
          <section className="report-section">
            <h2>基因檢測摘要</h2>
            <table className="report-table report-table-full">
              <thead>
                <tr>
                  <th style={{ width: 140 }}>基因標記</th>
                  <th style={{ width: 180 }}>結果</th>
                  <th>臨床意義</th>
                </tr>
              </thead>
              <tbody>
                {client.gene_mthfr && (() => {
                  const info = MTHFR_LABELS[client.gene_mthfr!]
                  return (
                    <tr>
                      <td className="font-semibold">MTHFR</td>
                      <td>{info?.label || client.gene_mthfr}</td>
                      <td className="text-small">{info?.note || ''}</td>
                    </tr>
                  )
                })()}
                {client.gene_apoe && (() => {
                  const info = APOE_LABELS[client.gene_apoe!]
                  return (
                    <tr>
                      <td className="font-semibold">APOE</td>
                      <td>{info?.label || client.gene_apoe}</td>
                      <td className="text-small">{info?.note || ''}</td>
                    </tr>
                  )
                })()}
                {client.gene_depression_risk && (() => {
                  const info = SEROTONIN_LABELS[client.gene_depression_risk!]
                  return (
                    <tr>
                      <td className="font-semibold">5-HTTLPR</td>
                      <td>{info?.label || client.gene_depression_risk}</td>
                      <td className="text-small">{info?.note || ''}</td>
                    </tr>
                  )
                })()}
              </tbody>
            </table>
          </section>
        )}

        {/* ────────────────────────────────────────────────
            Section 5: Current Supplement Protocol
        ──────────────────────────────────────────────── */}
        {supplements.length > 0 && (
          <section className="report-section">
            <h2>目前補品方案</h2>
            <table className="report-table report-table-full">
              <thead>
                <tr>
                  <th>名稱</th>
                  <th>劑量</th>
                  <th>服用時機</th>
                  <th>原因</th>
                </tr>
              </thead>
              <tbody>
                {supplements.map((s) => (
                  <tr key={s.id}>
                    <td className="font-semibold">{s.name}</td>
                    <td>{s.dosage || '-'}</td>
                    <td>{s.timing || '-'}</td>
                    <td className="text-small">{s.why || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {compliance != null && (
              <p className="report-note">近30天服從率：{compliance}%</p>
            )}
          </section>
        )}

        {/* ────────────────────────────────────────────────
            Section 6: AI Supplement Suggestions
        ──────────────────────────────────────────────── */}
        {suggestions.length > 0 && (
          <section className="report-section">
            <h2>系統補品建議（依血檢與基因分析）</h2>
            <table className="report-table report-table-full">
              <thead>
                <tr>
                  <th>補品</th>
                  <th>建議劑量</th>
                  <th>服用時機</th>
                  <th>原因</th>
                  <th>文獻依據</th>
                  <th>優先級</th>
                </tr>
              </thead>
              <tbody>
                {suggestions.map((s: SupplementSuggestion, i: number) => (
                  <tr key={i}>
                    <td className="font-semibold">{s.name}</td>
                    <td>{s.dosage}</td>
                    <td>{s.timing}</td>
                    <td className="text-small">{s.reason}</td>
                    <td className="text-small text-muted">{s.evidence}</td>
                    <td>
                      <span className={`priority-badge ${s.priority}`}>
                        {PRIORITY_LABELS[s.priority] || s.priority}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="report-disclaimer">
              以上建議由系統依據血檢數值、訓練狀態及基因資料自動產出，僅供參考，不構成醫療建議。請諮詢醫師後再行使用。
            </p>
          </section>
        )}

        {/* ────────────────────────────────────────────────
            Section 7: Health Goals & Next Checkup
        ──────────────────────────────────────────────── */}
        {(client.coach_summary || client.health_goals || client.next_checkup_date) && (
          <section className="report-section">
            <h2>健康計畫與追蹤</h2>
            {client.coach_summary && (
              <div style={{ marginBottom: 16 }}>
                <h3 className="report-sub-heading">教練摘要</h3>
                <p className="report-text">{client.coach_summary}</p>
              </div>
            )}
            <table className="report-table">
              <tbody>
                {client.health_goals && (
                  <tr>
                    <td>健康目標</td>
                    <td>{client.health_goals}</td>
                  </tr>
                )}
                {client.next_checkup_date && (
                  <tr>
                    <td>下次回檢日期</td>
                    <td>{new Date(client.next_checkup_date).toLocaleDateString('zh-TW')}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>
        )}

        {/* ────────────────────────────────────────────────
            Section 8: Footer
        ──────────────────────────────────────────────── */}
        <footer className="report-footer">
          <p>Howard Protocol 健康管理系統 — 此報告由系統自動產生，僅供參考</p>
          <p>報告產出時間：{reportTimestamp}</p>
        </footer>
      </div>

      {/* ── Embedded styles ── */}
      <style jsx global>{`
        /* ── Base reset for standalone page ── */
        html, body {
          margin: 0;
          padding: 0;
          background: #f5f5f5;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }

        /* ── Report container ── */
        .report-page {
          max-width: 800px;
          margin: 0 auto;
          padding: 48px 40px;
          background: #fff;
          min-height: 100vh;
          font-family: 'Noto Serif TC', 'Georgia', 'Times New Roman', serif;
          color: #1a1a1a;
          line-height: 1.75;
          font-size: 14px;
        }

        /* ── Header ── */
        .report-header {
          text-align: center;
          border-bottom: 2px solid #1a1a1a;
          padding-bottom: 20px;
          margin-bottom: 36px;
        }

        .report-header h1 {
          font-size: 26px;
          font-weight: 700;
          margin: 0 0 8px 0;
          letter-spacing: 0.5px;
        }

        .report-meta {
          display: flex;
          justify-content: center;
          flex-wrap: wrap;
          gap: 20px;
          font-size: 13px;
          color: #666;
        }

        /* ── Sections ── */
        .report-section {
          margin-bottom: 32px;
          page-break-inside: avoid;
        }

        .report-section h2 {
          font-size: 17px;
          font-weight: 700;
          border-bottom: 1px solid #d4d4d4;
          padding-bottom: 6px;
          margin: 0 0 14px 0;
          color: #111;
        }

        .report-sub-heading {
          font-size: 14px;
          font-weight: 600;
          margin: 0 0 6px 0;
          color: #333;
        }

        .report-text {
          font-size: 14px;
          white-space: pre-line;
          margin: 0;
          line-height: 1.8;
        }

        /* ── Tables ── */
        .report-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
          margin-bottom: 4px;
        }

        .report-table th,
        .report-table td {
          padding: 8px 10px;
          border: 1px solid #d4d4d4;
          text-align: left;
          vertical-align: top;
        }

        .report-table th {
          background: #f5f5f5;
          font-weight: 600;
          font-size: 12px;
          white-space: nowrap;
          color: #333;
        }

        .report-table tbody tr:nth-child(even) {
          background: #fafafa;
        }

        /* Key-value tables (2-column) */
        .report-table:not(.report-table-full) {
          max-width: 520px;
        }

        .report-table:not(.report-table-full) td:first-child {
          width: 130px;
          font-weight: 600;
          background: #f9f9f9;
          white-space: nowrap;
        }

        /* ── Text utilities ── */
        .text-mono {
          font-family: 'SF Mono', 'Menlo', 'Consolas', monospace;
          font-size: 12px;
        }

        .text-small {
          font-size: 11.5px;
          line-height: 1.55;
        }

        .text-muted {
          color: #777;
        }

        .font-semibold {
          font-weight: 600;
        }

        /* ── Row highlights ── */
        .row-alert {
          background: #fef2f2 !important;
        }

        .row-attention {
          background: #fffbeb !important;
        }

        /* ── Status badges ── */
        .status-badge {
          display: inline-block;
          padding: 2px 10px;
          border-radius: 10px;
          font-size: 11px;
          font-weight: 600;
          white-space: nowrap;
        }

        .status-badge.normal { background: #dcfce7; color: #166534; }
        .status-badge.attention { background: #fef3c7; color: #92400e; }
        .status-badge.alert { background: #fecaca; color: #991b1b; }

        /* ── Priority badges ── */
        .priority-badge {
          display: inline-block;
          padding: 2px 10px;
          border-radius: 10px;
          font-size: 11px;
          font-weight: 600;
          white-space: nowrap;
        }

        .priority-badge.high { background: #fecaca; color: #991b1b; }
        .priority-badge.medium { background: #fef3c7; color: #92400e; }
        .priority-badge.low { background: #e5e7eb; color: #374151; }

        /* ── Notes & disclaimers ── */
        .report-note {
          font-size: 12px;
          color: #888;
          margin: 8px 0 0 0;
        }

        .report-disclaimer {
          font-size: 11px;
          color: #999;
          margin-top: 12px;
          padding: 8px 14px;
          background: #f9f9f9;
          border-left: 3px solid #d4d4d4;
          line-height: 1.6;
        }

        .report-empty {
          font-size: 13px;
          color: #999;
          margin: 0;
        }

        /* ── Footer ── */
        .report-footer {
          margin-top: 48px;
          padding-top: 16px;
          border-top: 1px solid #d4d4d4;
          text-align: center;
          font-size: 11px;
          color: #aaa;
        }

        .report-footer p {
          margin: 2px 0;
        }

        /* ── Print styles ── */
        @media print {
          @page {
            size: A4;
            margin: 15mm;
          }

          html, body {
            background: #fff;
          }

          .no-print {
            display: none !important;
          }

          .report-page {
            padding: 0;
            max-width: none;
            min-height: auto;
            background: #fff;
          }

          .report-header h1 {
            font-size: 22px;
          }

          .report-section {
            page-break-inside: avoid;
          }

          .report-section h2 {
            font-size: 15px;
          }

          .report-table th,
          .report-table td {
            padding: 5px 8px;
            font-size: 11px;
          }

          .report-table th {
            font-size: 10px;
          }

          .text-small {
            font-size: 10px;
          }

          .text-mono {
            font-size: 10px;
          }

          .report-footer {
            margin-top: 32px;
          }

          /* Force black text for printing */
          .status-badge, .priority-badge {
            border: 1px solid #999;
          }
        }
      `}</style>
    </>
  )
}
