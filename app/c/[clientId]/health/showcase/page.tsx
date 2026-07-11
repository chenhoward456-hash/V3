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
    why: '心血管真正風險預測指標。國際研究指出 < 50 進入較低風險區間，比醫院 <130「沒病門檻」嚴格。',
  },
  {
    test: '空腹胰島素',
    medical: '< 25 µIU/mL',
    howardOptimal: '< 2.5 µIU/mL',
    why: '代謝健康早期信號，比血糖更早顯示代謝壓力。進階追蹤範圍 < 2.5。',
  },
  {
    test: 'hs-CRP',
    medical: '< 3 mg/L',
    howardOptimal: '< 0.5 mg/L',
    why: '系統性發炎與長期健康、老化速度密切相關，是值得長期追蹤的指標。越低越好。',
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
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-gray-500 text-sm">載入中...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Hero */}
      <section className="px-5 pt-12 pb-8 max-w-md mx-auto text-center">
        <div className="text-5xl mb-3">🧬</div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Howard Protocol
        </h1>
        <p className="text-sm text-gray-600 leading-relaxed">
          連續追蹤健檢數據 + AI 教練筆記
          <br />
          CSCS 教練諮詢 + 個人化數據儀表板
        </p>
      </section>

      {/* Health Score */}
      {healthScore && (
        <section className="px-5 max-w-md mx-auto mb-6">
          <div className="bg-white rounded-2xl p-5 border border-slate-200 text-center">
            <div className="text-xs font-medium text-slate-600 mb-1">{client.name} 的健康總分</div>
            <div className="flex items-baseline justify-center gap-1 mb-2">
              <div className="text-7xl font-bold text-gray-900 leading-none tabular-nums">
                {Math.round(healthScore.total)}
              </div>
              <div className="text-lg font-medium text-gray-400">/ 100</div>
            </div>
            <div className={`inline-block text-xs font-semibold px-3 py-1 rounded-full ${
              healthScore.grade === 'A' ? 'bg-emerald-100 text-emerald-800' :
              healthScore.grade === 'B' ? 'bg-primary-100 text-primary-800' :
              healthScore.grade === 'C' ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'
            }`}>
              Grade {healthScore.grade}
            </div>
            <div className="grid grid-cols-5 gap-2 mt-5">
              {healthScore.pillars.map(p => (
                <div key={p.pillar} className="text-center">
                  <div className="text-xl">{p.emoji}</div>
                  <div className="text-[11px] text-gray-500 mt-0.5">{p.label}</div>
                  <div className={`text-sm font-bold mt-0.5 ${
                    p.score >= 80 ? 'text-emerald-700' :
                    p.score >= 65 ? 'text-primary-700' :
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
            <div className="text-xs text-gray-500 mb-1">數據追蹤亮點</div>
            <div className="text-base font-semibold text-gray-900">3 項已達進階追蹤範圍</div>
          </div>
          <div className="space-y-2">
            {topOptimalStats.map(({ row, optimalText }) => (
              <div key={row.test_name} className="bg-white rounded-2xl p-4 border border-emerald-200 flex items-center justify-between">
                <div>
                  <div className="text-sm text-gray-500">{row.test_name}</div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold text-emerald-700 tabular-nums">{row.value}</span>
                    <span className="text-xs text-gray-400">{row.unit}</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[11px] text-emerald-700 font-medium">進階追蹤範圍</div>
                  <div className="text-sm text-gray-600">{optimalText}</div>
                  <div className="text-[11px] text-emerald-700 font-bold mt-1">✓ 已達</div>
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
            <div key={s.test} className="bg-white rounded-2xl p-4 border border-slate-200">
              <div className="font-semibold text-gray-900 mb-2">{s.test}</div>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <div className="bg-gray-50 rounded-lg p-2 text-center">
                  <div className="text-[11px] text-gray-500 mb-0.5">一般醫院</div>
                  <div className="text-sm font-medium text-gray-700">{s.medical}</div>
                  <div className="text-[11px] text-gray-400 mt-1">「沒病」門檻</div>
                </div>
                <div className="bg-emerald-50 rounded-lg p-2 text-center border border-emerald-200">
                  <div className="text-[11px] text-emerald-700 mb-0.5">進階追蹤範圍</div>
                  <div className="text-sm font-bold text-emerald-800">{s.howardOptimal}</div>
                  <div className="text-[11px] text-emerald-600 mt-1">參考國際研究</div>
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
          <div className="bg-white rounded-2xl p-4 border border-slate-200">
            {panelNote.summary && (
              <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap mb-2">
                {panelNote.summary.slice(0, 300)}
                {panelNote.summary.length > 300 && '...'}
              </p>
            )}
            {panelNote.priorities && (
              <div className="mt-3 pt-3 border-t border-slate-200">
                <div className="text-[11px] font-medium text-slate-600 mb-1">優先處理</div>
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
            { emoji: '💊', t: '補品紀錄', d: '飲食輔助方案歷史紀錄' },
            { emoji: '🩸', t: '抽血提醒', d: '季度自動排程 + 必驗清單' },
            { emoji: '💬', t: 'LINE 整合', d: '教練即時通知 + AI 對話' },
          ].map(f => (
            <div key={f.t} className="bg-white rounded-xl p-3 border border-slate-200">
              <div className="text-xl mb-1">{f.emoji}</div>
              <div className="text-sm font-semibold text-gray-900">{f.t}</div>
              <div className="text-[11px] text-gray-500 mt-0.5 leading-tight">{f.d}</div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="px-5 max-w-md mx-auto mb-8">
        <div className="bg-gray-900 rounded-2xl p-6 text-center text-white">
          <div className="text-2xl mb-2">🎯</div>
          <div className="text-lg font-semibold mb-2">想試試這套追蹤系統？</div>
          <p className="text-xs text-gray-300 mb-5 leading-relaxed">
            CSCS 教練諮詢 + 數據追蹤工具<br />
            月費 NT$4,999（首批限 5 位）<br />
            含教練觀察筆記 / AI 對話 / LINE 即時通知
          </p>
          <a
            href="https://line.me/R/ti/p/@howard"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block bg-primary-600 hover:bg-primary-700 text-white font-medium px-6 py-3 rounded-full text-sm transition-colors"
          >
            💬 加 LINE 聊聊
          </a>
          <div className="mt-3 text-[11px] text-gray-400 leading-relaxed">
            本服務為健康管理諮詢 + 工具，<br />
            不構成醫療診斷或治療
          </div>
        </div>
      </section>

      {/* 跳到完整 dashboard */}
      <section className="px-5 max-w-md mx-auto pb-8 text-center">
        <Link
          href={`/c/${clientId}/health/timeline`}
          className="text-xs text-gray-500 hover:text-primary-700 underline"
        >
          看 Howard 完整健康儀表板 →
        </Link>
      </section>

      {/* 免責 */}
      <section className="px-5 max-w-md mx-auto pb-12">
        <p className="text-[11px] text-gray-400 text-center leading-relaxed">
          本頁為示範用途，所有數據為 Howard 本人真實數據。「進階追蹤範圍／最佳」為長壽最佳化參考目標（依 Peter Attia「Outlive」與功能醫學派），非醫學診斷標準；醫院「正常」範圍才是疾病門檻。系統提供的數值範圍與教練筆記僅供生活方式調整參考，不構成醫療診斷或處方建議。指標異常請諮詢您的醫師。
        </p>
      </section>
    </div>
  )
}
