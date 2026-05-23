'use client'

import { useMemo, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useClientData } from '@/hooks/useClientData'
import {
  calculateLabStatus,
  isInOptimalRange,
  getOptimalRangeText,
  LAB_THRESHOLDS,
} from '@/utils/labStatus'
import { calculateHealthScore } from '@/lib/health-score-engine'

interface LabRow {
  test_name: string
  value: number
  unit: string | null
  date: string
}

interface PanelNote {
  panel_date: string
  summary: string | null
  priorities: string | null
}

// Highlight 卡 — 用來秀「醫院標準 vs Howard 標準」對照
const HIGHLIGHT_STORIES: Array<{ test: string; medical: string; howardOptimal: string; why: string }> = [
  {
    test: 'ApoB',
    medical: '< 130 mg/dL',
    howardOptimal: '< 50 mg/dL',
    why: '心血管真正風險預測指標。國際長壽研究指出 < 50 才是低風險最佳區，比醫院 <130「沒病」嚴格很多。',
  },
  {
    test: '空腹胰島素',
    medical: '< 25 µIU/mL',
    howardOptimal: '< 2.5 µIU/mL',
    why: '代謝病最早信號，比血糖早 10-20 年顯示問題。長壽優化目標 < 2.5。',
  },
  {
    test: 'hs-CRP',
    medical: '< 3 mg/L',
    howardOptimal: '< 0.5 mg/L',
    why: '系統性發炎是所有慢性病共通底層 — 心血管 / 失智 / 癌症。越低越好。',
  },
]

export default function ShowcasePage() {
  const params = useParams()
  const clientId = (params?.clientId as string) ?? ''
  const { data, isLoading } = useClientData(clientId)
  const [panelNote, setPanelNote] = useState<PanelNote | null>(null)

  // 拉最新一筆 panel note
  useEffect(() => {
    if (!clientId) return
    fetch(`/api/lab-panel-notes?clientId=${encodeURIComponent(clientId)}`)
      .then(r => r.json())
      .then(j => {
        if (j?.success && Array.isArray(j.data) && j.data.length > 0) {
          setPanelNote(j.data[0] as PanelNote)
        }
      })
      .catch(() => {})
  }, [clientId])

  const client = data?.client
  const gender = client?.gender === '男性' || client?.gender === '女性' ? client.gender : undefined

  const labs = useMemo<LabRow[]>(() => (client?.lab_results ?? []) as LabRow[], [client?.lab_results])

  // Health score
  const healthScore = useMemo(() => {
    if (!data) return null
    try {
      return calculateHealthScore({
        wellnessLast7: (data.wellness || []).slice(-7) as Array<{
          sleep_quality: number | null; energy_level: number | null; mood: number | null
        }>,
        nutritionLast7: (data.nutritionLogs || []).slice(-7) as Array<{ compliant: boolean | null }>,
        trainingLast7: (data.trainingLogs || []).slice(-7) as Array<{ training_type: string; rpe?: number | null }>,
        supplementComplianceRate: 0.85,
        labResults: labs.map(l => ({ status: 'normal' as const })),
        quarterlyStart: (client?.quarterly_cycle_start as string) ?? null,
      })
    } catch { return null }
  }, [data, labs, client?.quarterly_cycle_start])

  // 找 3 個「最佳」指標當 hero stats — 從 LAB_THRESHOLDS 裡找 + 是 isInOptimalRange
  const topOptimalStats = useMemo(() => {
    if (labs.length === 0) return []
    const byTest = new Map<string, LabRow>()
    // 每個指標取最新
    for (const r of labs) {
      const existing = byTest.get(r.test_name)
      if (!existing || r.date > existing.date) byTest.set(r.test_name, r)
    }
    const candidates: Array<{ row: LabRow; optimalText: string }> = []
    for (const [testName, row] of byTest.entries()) {
      if (!(testName in LAB_THRESHOLDS) && !(`${testName}_female` in LAB_THRESHOLDS)) continue
      if (!isInOptimalRange(testName, row.value, gender)) continue
      const optimalText = getOptimalRangeText(testName, gender)
      if (!optimalText) continue
      candidates.push({ row, optimalText })
    }
    // 優先選大家認得的指標
    const priority = ['ApoB', 'Lp(a)', '空腹胰島素', '三酸甘油酯', 'hs-CRP', '同半胱胺酸', '維生素D', 'HDL-C']
    candidates.sort((a, b) => {
      const aRank = priority.indexOf(a.row.test_name)
      const bRank = priority.indexOf(b.row.test_name)
      const aScore = aRank < 0 ? 999 : aRank
      const bScore = bRank < 0 ? 999 : bRank
      return aScore - bScore
    })
    return candidates.slice(0, 3)
  }, [labs, gender])

  if (isLoading || !client) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-blue-50 flex items-center justify-center">
        <div className="text-gray-500 text-sm">載入中...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-blue-50">
      {/* Hero */}
      <section className="px-5 pt-12 pb-8 max-w-md mx-auto text-center">
        <div className="text-5xl mb-3">🧬</div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Howard Protocol
        </h1>
        <p className="text-sm text-gray-600 leading-relaxed">
          連續追蹤健檢數據 + AI 教練筆記
          <br />
          台灣第一個用功能醫學標準的長壽優化系統
        </p>
      </section>

      {/* Health Score */}
      {healthScore && (
        <section className="px-5 max-w-md mx-auto mb-6">
          <div className="bg-white rounded-3xl p-6 shadow-lg border border-gray-100 text-center">
            <div className="text-xs font-medium text-indigo-700 mb-1">{client.name} 的健康總分</div>
            <div className="flex items-baseline justify-center gap-1 mb-2">
              <div className="text-7xl font-bold text-gray-900 leading-none">
                {Math.round(healthScore.total)}
              </div>
              <div className="text-lg font-medium text-gray-400">/ 100</div>
            </div>
            <div className={`inline-block text-xs font-semibold px-3 py-1 rounded-full ${
              healthScore.grade === 'A' ? 'bg-emerald-100 text-emerald-800' :
              healthScore.grade === 'B' ? 'bg-blue-100 text-blue-800' :
              healthScore.grade === 'C' ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'
            }`}>
              Grade {healthScore.grade}
            </div>
            <div className="grid grid-cols-5 gap-2 mt-5">
              {healthScore.pillars.map(p => (
                <div key={p.pillar} className="text-center">
                  <div className="text-xl">{p.emoji}</div>
                  <div className="text-[9px] text-gray-500 mt-0.5">{p.label}</div>
                  <div className={`text-sm font-bold mt-0.5 ${
                    p.score >= 80 ? 'text-emerald-700' :
                    p.score >= 65 ? 'text-blue-700' :
                    p.score >= 50 ? 'text-amber-700' : 'text-rose-700'
                  }`}>
                    {Math.round(p.score)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 3 Hero Stats — 最佳指標 */}
      {topOptimalStats.length > 0 && (
        <section className="px-5 max-w-md mx-auto mb-6">
          <div className="text-center mb-3">
            <div className="text-xs text-gray-500 mb-1">超越功能醫學最佳目標</div>
            <div className="text-base font-semibold text-gray-900">3 個指標都贏</div>
          </div>
          <div className="space-y-2">
            {topOptimalStats.map(({ row, optimalText }) => (
              <div key={row.test_name} className="bg-white rounded-2xl p-4 shadow-sm border border-emerald-200 flex items-center justify-between">
                <div>
                  <div className="text-sm text-gray-500">{row.test_name}</div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold text-emerald-700">{row.value}</span>
                    <span className="text-xs text-gray-400">{row.unit}</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-emerald-700 font-medium">Howard 標準</div>
                  <div className="text-sm text-gray-600">{optimalText}</div>
                  <div className="text-[10px] text-emerald-700 font-bold mt-1">✓ 超越</div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Highlight: 醫院 vs Howard 標準對照 */}
      <section className="px-5 max-w-md mx-auto mb-6">
        <div className="text-center mb-3">
          <div className="text-xs text-gray-500 mb-1">為什麼這套系統不一樣</div>
          <div className="text-base font-semibold text-gray-900">兩套標準，不只是「沒病」</div>
        </div>
        <div className="space-y-3">
          {HIGHLIGHT_STORIES.map(s => (
            <div key={s.test} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <div className="font-semibold text-gray-900 mb-2">{s.test}</div>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <div className="bg-gray-50 rounded-lg p-2 text-center">
                  <div className="text-[10px] text-gray-500 mb-0.5">一般醫院</div>
                  <div className="text-sm font-medium text-gray-700">{s.medical}</div>
                  <div className="text-[10px] text-gray-400 mt-1">「沒病」門檻</div>
                </div>
                <div className="bg-emerald-50 rounded-lg p-2 text-center border border-emerald-200">
                  <div className="text-[10px] text-emerald-700 mb-0.5">Howard 標準</div>
                  <div className="text-sm font-bold text-emerald-800">{s.howardOptimal}</div>
                  <div className="text-[10px] text-emerald-600 mt-1">長壽優化</div>
                </div>
              </div>
              <p className="text-[11px] text-gray-600 leading-relaxed">{s.why}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Coach Note Preview */}
      {panelNote && (panelNote.summary || panelNote.priorities) && (
        <section className="px-5 max-w-md mx-auto mb-6">
          <div className="text-center mb-3">
            <div className="text-xs text-gray-500 mb-1">教練解讀（{panelNote.panel_date}）</div>
            <div className="text-base font-semibold text-gray-900">Howard 為你寫的觀察筆記</div>
          </div>
          <div className="bg-gradient-to-br from-amber-50 to-emerald-50 rounded-2xl p-4 shadow-sm border border-amber-200">
            {panelNote.summary && (
              <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap mb-2">
                {panelNote.summary.slice(0, 300)}
                {panelNote.summary.length > 300 && '...'}
              </p>
            )}
            {panelNote.priorities && (
              <div className="mt-3 pt-3 border-t border-amber-200">
                <div className="text-[11px] font-medium text-amber-800 mb-1">優先處理</div>
                <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">
                  {panelNote.priorities.slice(0, 250)}
                  {panelNote.priorities.length > 250 && '...'}
                </p>
              </div>
            )}
          </div>
          <p className="text-[11px] text-gray-500 text-center mt-2">
            每次抽血都有完整觀察 + 建議
          </p>
        </section>
      )}

      {/* 系統能做什麼（feature pills）*/}
      <section className="px-5 max-w-md mx-auto mb-6">
        <div className="text-center mb-3">
          <div className="text-base font-semibold text-gray-900">這套系統能幫你</div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {[
            { emoji: '📥', t: '健檢報告', d: '拍照丟系統 AI 自動萃取' },
            { emoji: '📊', t: '連續追蹤', d: '6 大類指標趨勢視覺化' },
            { emoji: '🧬', t: 'AI 教練筆記', d: '每次抽血自動生成深度觀察' },
            { emoji: '💊', t: '補品 Protocol', d: '為什麼開、為什麼停都記錄' },
            { emoji: '🩸', t: '抽血提醒', d: '季度自動排程 + 必驗清單' },
            { emoji: '💬', t: 'LINE 整合', d: '教練即時通知 + AI 對話' },
          ].map(f => (
            <div key={f.t} className="bg-white rounded-xl p-3 shadow-sm border border-gray-100">
              <div className="text-xl mb-1">{f.emoji}</div>
              <div className="text-sm font-semibold text-gray-900">{f.t}</div>
              <div className="text-[10px] text-gray-500 mt-0.5 leading-tight">{f.d}</div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="px-5 max-w-md mx-auto mb-8">
        <div className="bg-gray-900 rounded-3xl p-6 text-center text-white shadow-xl">
          <div className="text-2xl mb-2">🎯</div>
          <div className="text-lg font-semibold mb-2">想要這套系統追蹤你的健康？</div>
          <p className="text-xs text-gray-300 mb-5 leading-relaxed">
            目前限收 5 位 Beta 客戶，月費 NT$4,999<br />
            含 AI 教練筆記 / 連續追蹤 / 補品 protocol / LINE 即時通知
          </p>
          <a
            href="https://line.me/R/ti/p/@howard"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block bg-emerald-500 hover:bg-emerald-600 text-white font-medium px-6 py-3 rounded-full text-sm transition-colors"
          >
            💬 加 LINE 聊聊
          </a>
          <div className="mt-3 text-[10px] text-gray-400">
            或直接傳訊息給 Howard
          </div>
        </div>
      </section>

      {/* 跳到完整 dashboard */}
      <section className="px-5 max-w-md mx-auto pb-8 text-center">
        <Link
          href={`/c/${clientId}/health/timeline`}
          className="text-xs text-gray-500 hover:text-emerald-700 underline"
        >
          看 Howard 完整健康儀表板 →
        </Link>
      </section>

      {/* 免責 */}
      <section className="px-5 max-w-md mx-auto pb-12">
        <p className="text-[10px] text-gray-400 text-center leading-relaxed">
          本頁為示範用途，所有數據為 Howard 本人真實數據。系統提供的數值範圍與教練筆記僅供生活方式調整參考，不構成醫療診斷或處方建議。指標異常請諮詢您的醫師。
        </p>
      </section>
    </div>
  )
}
