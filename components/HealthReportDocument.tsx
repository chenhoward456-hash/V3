'use client'

import { useEffect, useState, useMemo } from 'react'
import { getLabAdvice } from '@/components/client/types'
import { generateSupplementSuggestions, type SupplementSuggestion } from '@/lib/supplement-engine'
import { analyzeLabs } from '@/lib/lab-trend-analyzer'
import { isCompetitionMode, isHealthMode } from '@/lib/client-mode'

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
  client_mode?: string
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

// 白話對照：給「本次重點」摘要用，把專業項目名翻成一般人看得懂的「這是什麼、為什麼要看」。
// 比對用 test_name 做關鍵字 includes（大小寫不敏感），找不到就只顯示項目名。
const PLAIN_WHY: { match: string[]; why: string }[] = [
  { match: ['尿酸', 'uric'], why: '偏高和痛風、結石有關，多喝水、少內臟/海鮮/酒' },
  { match: ['肌酸酐', 'creatinine'], why: '腎功能指標' },
  { match: ['egfr', '腎絲球'], why: '腎臟過濾效率，越高越好' },
  { match: ['白血球', 'wbc', '白細胞'], why: '免疫力相關，偏低可能是訓練壓力或微量元素不足' },
  { match: ['同半胱胺酸', 'homocyst'], why: '偏高和心血管風險有關，B 群/葉酸可改善' },
  { match: ['lp(a)', 'lpa', '脂蛋白'], why: '基因型膽固醇，心血管風險指標（基因決定，難靠飲食大改）' },
  { match: ['ldl', '低密度'], why: '壞膽固醇，心血管風險' },
  { match: ['apob', 'apo b'], why: '壞膽固醇顆粒數，心血管風險更準的指標' },
  { match: ['hdl', '高密度'], why: '好膽固醇，越高越好' },
  { match: ['三酸甘油', 'triglyc', 'tg'], why: '血脂，和糖/酒攝取有關' },
  { match: ['空腹血糖', 'glucose', '飯前血糖'], why: '血糖控制' },
  { match: ['hba1c', '糖化'], why: '近 3 個月平均血糖' },
  { match: ['睪固酮', 'testosterone'], why: '男性荷爾蒙，影響肌肉、精力、情緒' },
  { match: ['shbg'], why: '會綁住睪固酮，太高會降低可用的游離睪固酮' },
  { match: ['alt', 'ast', 'ggt', '肝'], why: '肝指標' },
  { match: ['鐵蛋白', 'ferritin'], why: '體內鐵儲存量' },
  { match: ['維生素d', 'vitamin d', '25-oh'], why: '免疫、骨骼、荷爾蒙都需要' },
  { match: ['crp', '發炎'], why: '身體發炎程度' },
]
function plainWhy(testName: string): string | null {
  const n = testName.toLowerCase()
  for (const e of PLAIN_WHY) if (e.match.some(m => n.includes(m))) return e.why
  return null
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

// 共用健康報告文件：admin（教練）與 /c/[code]（學員）共用同一份，唯一差別是 mode。
// mode='client' 時隱藏對學員是雜訊的學術文獻欄；其餘完全相同 → 一份來源，不分叉。
export default function HealthReportDocument({ clientId, mode = 'coach' }: { clientId: string; mode?: 'coach' | 'client' }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [client, setClient] = useState<ClientData | null>(null)
  const [supplements, setSupplements] = useState<Supplement[]>([])
  const [supplementLogs, setSupplementLogs] = useState<SupplementLog[]>([])
  const [bodyData, setBodyData] = useState<BodyDataEntry[]>([])
  const [labResults, setLabResults] = useState<LabResult[]>([])
  const [trainingLogs, setTrainingLogs] = useState<any[]>([])
  const [wellness, setWellness] = useState<any[]>([])

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
        setWellness(data.wellness || [])
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

  // 趨勢 + 藍標最佳：用 analyzeLabs 算每項的 前次→現在 / 變化% / 最佳區
  const findingByName = useMemo(() => {
    const g = client?.gender === '女性' ? '女性' : client?.gender === '男性' ? '男性' : undefined
    const m = new Map<string, ReturnType<typeof analyzeLabs>[number]>()
    for (const f of analyzeLabs(labResults as never, { gender: g })) m.set(f.testName, f)
    return m
  }, [labResults, client?.gender])

  // 恢復與訓練摘要：訓練天數、平均 RPE、HRV / RHR、睡眠 / 精力
  const recoverySummary = useMemo(() => {
    const now = Date.now()
    const d = (n: number) => new Date(now - n * 86400000).toISOString().slice(0, 10)
    const t7 = d(7), t30 = d(30)
    const train = trainingLogs.filter((t) => t.training_type && t.training_type !== 'rest')
    const days7 = new Set(train.filter((t) => t.date >= t7).map((t) => t.date)).size
    const days30 = new Set(train.filter((t) => t.date >= t30).map((t) => t.date)).size
    const rpe7 = train.filter((t) => t.date >= t7 && t.rpe != null).map((t) => Number(t.rpe))
    const avgRpe = rpe7.length ? rpe7.reduce((a, b) => a + b, 0) / rpe7.length : null
    const wSorted = [...wellness].sort((a, b) => (a.date < b.date ? 1 : -1))
    const latestHrv = wSorted.find((w) => w.hrv != null)?.hrv ?? null
    const latestRhr = wSorted.find((w) => w.resting_hr != null)?.resting_hr ?? null
    const w7 = wellness.filter((w) => w.date >= t7)
    const avg = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null)
    const avgSleep = avg(w7.map((w) => w.sleep_quality).filter((v: unknown): v is number => typeof v === 'number'))
    const avgEnergy = avg(w7.map((w) => w.energy_level).filter((v: unknown): v is number => typeof v === 'number'))
    const has = days30 > 0 || latestHrv != null || latestRhr != null || avgSleep != null
    return { days7, days30, avgRpe, latestHrv, latestRhr, avgSleep, avgEnergy, has }
  }, [trainingLogs, wellness])

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
      isCompetitionPrep: isCompetitionMode(client.client_mode),
      hasHighRPE,
      goalType: (client.goal_type as 'cut' | 'bulk' | null) || null,
      isHealthMode: isHealthMode(client.client_mode),
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

        {/* ── 本次重點（白話摘要，放最上面，讓非專業的學員 10 秒看懂）── */}
        {latestLabs.length > 0 && (() => {
          const improving = latestLabs
            .filter(r => findingByName.get(r.test_name)?.trend === 'improving')
            .map(r => {
              const f = findingByName.get(r.test_name)
              const pct = f?.changePercent != null ? `（${f.changePercent > 0 ? '+' : ''}${f.changePercent.toFixed(0)}%）` : ''
              return `${r.test_name}${pct}`
            })
          const flagged = latestLabs.filter(r => {
            const s = findingByName.get(r.test_name)?.latestStatus ?? r.status
            return s === 'alert' || s === 'attention'
          })
          // 正常但「低於最佳 + 明顯往壞方向（變化 ≥20%）」也抓進要追蹤，
          // 否則整條軸線下滑（如睪固酮 -35~44%）卻因 normal 下限訂得寬而全被當「正常」漏掉。
          const slipping = latestLabs.filter(r => {
            const f = findingByName.get(r.test_name)
            if (!f) return false
            const s = f.latestStatus ?? r.status
            if (s === 'alert' || s === 'attention') return false // 已在上面 flagged
            return f.trend === 'declining' && f.inOptimal === false && f.changePercent != null && Math.abs(f.changePercent) >= 20
          })
          if (improving.length === 0 && flagged.length === 0 && slipping.length === 0) return null
          return (
            <section className="report-section" style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '16px 18px' }}>
              <h2 style={{ marginTop: 0 }}>本次重點</h2>
              {improving.length > 0 && (
                <p className="report-text" style={{ margin: '0 0 10px' }}>
                  <strong style={{ color: '#15803d' }}>✅ 往好的方向：</strong>{improving.join('、')}
                </p>
              )}
              {(flagged.length > 0 || slipping.length > 0) && (
                <div style={{ margin: '0 0 4px' }}>
                  <strong style={{ color: '#b45309' }}>⚠️ 要追蹤的項目：</strong>
                  <ul style={{ margin: '6px 0 0', paddingLeft: 20 }}>
                    {flagged.map(r => {
                      const s = findingByName.get(r.test_name)?.latestStatus ?? r.status
                      const why = plainWhy(r.test_name)
                      return (
                        <li key={r.id} className="report-text" style={{ marginBottom: 3 }}>
                          <strong>{r.test_name}</strong>（{STATUS_LABELS[s] || s}）{why ? `— ${why}` : ''}
                        </li>
                      )
                    })}
                    {slipping.map(r => {
                      const f = findingByName.get(r.test_name)
                      const why = plainWhy(r.test_name)
                      const pct = f?.changePercent != null ? `${f.changePercent > 0 ? '+' : ''}${f.changePercent.toFixed(0)}%` : ''
                      return (
                        <li key={r.id} className="report-text" style={{ marginBottom: 3 }}>
                          <strong>{r.test_name}</strong>（正常但下滑 {pct}、低於最佳）{why ? `— ${why}` : ''}
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )}
              <p className="report-note" style={{ marginTop: 10, marginBottom: 0 }}>
                綠燈項目都正常，詳細數值見下方血檢表。具體該怎麼做，看下面「教練重點」。
              </p>
            </section>
          )
        })()}

        {/* ── 教練重點（開場總結，挪到最上面）── */}
        {client.coach_summary && (
          <section className="report-section" style={{ borderLeft: '3px solid #1a1a1a', paddingLeft: 18 }}>
            <h2>教練重點</h2>
            <p className="report-text" style={{ whiteSpace: 'pre-line' }}>{client.coach_summary}</p>
          </section>
        )}

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

        {/* ── 恢復與訓練摘要 ── */}
        {recoverySummary.has && (
          <section className="report-section">
            <h2>恢復與訓練</h2>
            <table className="report-table">
              <tbody>
                <tr><td>近 7 天訓練</td><td>{recoverySummary.days7} 天{recoverySummary.avgRpe != null ? `（平均 RPE ${recoverySummary.avgRpe.toFixed(1)}）` : ''}</td></tr>
                <tr><td>近 30 天訓練</td><td>{recoverySummary.days30} 天</td></tr>
                {recoverySummary.latestHrv != null && (
                  <tr><td>HRV（最新）</td><td>{recoverySummary.latestHrv} ms</td></tr>
                )}
                {recoverySummary.latestRhr != null && (
                  <tr><td>靜息心率（最新）</td><td>{recoverySummary.latestRhr} bpm</td></tr>
                )}
                {recoverySummary.avgSleep != null && (
                  <tr><td>平均睡眠（7 天）</td><td>{recoverySummary.avgSleep.toFixed(1)} / 5</td></tr>
                )}
                {recoverySummary.avgEnergy != null && (
                  <tr><td>平均精力（7 天）</td><td>{recoverySummary.avgEnergy.toFixed(1)} / 5</td></tr>
                )}
              </tbody>
            </table>
          </section>
        )}

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
                  const f = findingByName.get(r.test_name)
                  const trendLabel = f?.trend === 'improving' ? '↗ 進步' : f?.trend === 'declining' ? '↘ 退步' : ''
                  // 徽章狀態用 calculateLabStatus 即時重算（analyzeLabs 已含，且性別感知、會跳過非數值列），
                  // 不直接信 DB 的 lab_results.status（可能過期/過嚴，如維生素D 59 被標紅）。非數值/未分析列才回退 DB status。
                  const status = f?.latestStatus ?? r.status
                  return (
                    <tr
                      key={r.id}
                      className={status === 'alert' ? 'row-alert' : status === 'attention' ? 'row-attention' : ''}
                    >
                      <td className="font-semibold">{r.test_name}</td>
                      <td className="text-mono">
                        {r.value} {r.unit}
                        {f?.previousValue != null && (
                          <div className="text-small" style={{ color: '#888', marginTop: 2 }}>
                            前次 {f.previousValue}{f.changePercent != null ? `（${f.changePercent > 0 ? '+' : ''}${f.changePercent.toFixed(0)}%）` : ''} {trendLabel}
                          </div>
                        )}
                      </td>
                      <td>
                        {r.custom_target || r.reference_range || '-'}
                        {f?.optimalText && (
                          <div className="text-small" style={{ color: '#2563eb', marginTop: 2 }}>最佳 {f.optimalText}</div>
                        )}
                      </td>
                      <td>
                        <span className={`status-badge ${status}`}>
                          {STATUS_LABELS[status] || status}
                        </span>
                      </td>
                      <td className="text-small" style={{ whiteSpace: 'pre-line' }}>{advice.replace(/\\n/g, '\n')}</td>
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
                  {mode === 'coach' && <th>文獻依據</th>}
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
                    {mode === 'coach' && <td className="text-small text-muted">{s.evidence}</td>}
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
            <p className="report-disclaimer">
              報告中標示的「最佳」數值為長壽／最佳化參考目標（依 Peter Attia「Outlive」與功能醫學派），非醫學診斷標準；醫院檢驗單的「正常」範圍才是疾病門檻。
            </p>
          </section>
        )}

        {/* ────────────────────────────────────────────────
            Section 7: Health Goals & Next Checkup
        ──────────────────────────────────────────────── */}
        {(client.health_goals || client.next_checkup_date) && (
          <section className="report-section">
            <h2>健康計畫與追蹤</h2>
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

        {/* ── 建議下次回診追蹤項目（依本次數據自動整理；只挑需追蹤的，穩定/基因型不重驗）── */}
        {latestLabs.length > 0 && (() => {
          // 基因型指標一次檢測即可、終生不太變，不列入重驗（如 Lp(a)/APOE/MTHFR）
          const GENETIC_ONCE = ['lp(a)', 'lpa', '脂蛋白', 'apoe', 'mthfr']
          const retest = latestLabs.map(r => {
            const f = findingByName.get(r.test_name)
            if (!f) return null
            const nameL = r.test_name.toLowerCase()
            if (GENETIC_ONCE.some(g => nameL.includes(g))) return null
            const s = f.latestStatus ?? r.status
            if (s === 'alert' || s === 'attention') return { name: r.test_name, reason: '追蹤這次數值的變化趨勢' }
            if (f.trend === 'declining' && f.inOptimal === false && f.changePercent != null && Math.abs(f.changePercent) >= 20) {
              return { name: r.test_name, reason: '確認是否止跌、回到較佳範圍' }
            }
            return null
          }).filter(Boolean) as { name: string; reason: string }[]
          if (retest.length === 0) return null
          return (
            <section className="report-section">
              <h2>建議下次回診重新檢測</h2>
              <p className="report-note" style={{ marginTop: 0, marginBottom: 8 }}>
                以下依本次數據整理，建議回診時重新檢測，追蹤變化趨勢、讓後續判讀更精準。供與醫師討論，非醫療診斷或處方。
              </p>
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                {retest.map((x, i) => (
                  <li key={i} className="report-text" style={{ marginBottom: 3 }}>
                    <strong>{x.name}</strong> — {x.reason}
                  </li>
                ))}
              </ul>
              <p className="report-note" style={{ marginTop: 8, marginBottom: 0 }}>
                數值正常且穩定的項目（如血脂、血糖）與基因型指標（檢測一次即可）不列入，避免重複檢測、節省花費。
              </p>
            </section>
          )
        })()}

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

          /* globals.css 有一條 body * { visibility:hidden } 只露 .print-report；本頁用 .report-page，
             所以要主動把報告樹露出來，否則列印整頁空白（class 名不符的歷史遺留）。 */
          .report-page, .report-page * {
            visibility: visible !important;
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
