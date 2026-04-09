'use client'

import { useState } from 'react'
import { useToast } from '@/components/ui/Toast'

interface ExportAiSummaryProps {
  client: any
  bodyData: any[]
  nutritionLogs: any[]
  wellness: any[]
  trainingLogs: any[]
  labResults: any[]
  suggestion: any
}

export default function ExportAiSummary({ client, bodyData, nutritionLogs, wellness, trainingLogs, labResults, suggestion }: ExportAiSummaryProps) {
  const [copied, setCopied] = useState(false)
  const { showToast } = useToast()

  const generate = () => {
    const c = client
    const lines: string[] = []
    const today = new Date().toISOString().split('T')[0]

    // Header
    lines.push(`【我的健康數據摘要】更新日期：${today}`)
    lines.push('')

    // 基本資料
    lines.push('■ 基本資料')
    const parts = [c.age ? `${c.age}歲` : null, c.gender, bodyData[0]?.weight ? `${bodyData[0].weight}kg` : null].filter(Boolean)
    if (bodyData[0]?.body_fat) parts.push(`體脂 ${bodyData[0].body_fat}%`)
    if (c.target_weight) parts.push(`目標 ${c.target_weight}kg`)
    if (c.competition_date) {
      const days = Math.floor((new Date(c.competition_date).getTime() - Date.now()) / (86400000))
      if (days > 0) parts.push(`${c.competition_date} 比賽（${days}天後）`)
    }
    lines.push(parts.join(' / '))
    lines.push('')

    // 近 14 天營養
    const recent14 = nutritionLogs.filter((l: any) => {
      const d = new Date(l.date)
      const ago = new Date(); ago.setDate(ago.getDate() - 14)
      return d >= ago
    })
    if (recent14.length > 0) {
      lines.push('■ 近 14 天營養攝取')
      const avg = (field: string) => {
        const vals = recent14.filter((l: any) => l[field] != null).map((l: any) => l[field])
        return vals.length > 0 ? Math.round(vals.reduce((a: number, b: number) => a + b, 0) / vals.length) : null
      }
      const avgCal = avg('calories')
      const avgPro = avg('protein_grams')
      const avgCarb = avg('carbs_grams')
      const avgFat = avg('fat_grams')
      if (avgCal != null) lines.push(`  熱量 ${avgCal} kcal${c.calories_target ? `（目標 ${c.calories_target}）` : ''}`)
      if (avgPro != null) {
        const diff = c.protein_target ? Math.round(((avgPro - c.protein_target) / c.protein_target) * 100) : null
        lines.push(`  蛋白質 ${avgPro}g${c.protein_target ? `（目標 ${c.protein_target}g${diff != null ? `，偏差 ${diff > 0 ? '+' : ''}${diff}%` : ''}）` : ''}${diff != null && diff <= -15 ? ' ⚠️' : ''}`)
      }
      if (avgCarb != null) lines.push(`  碳水 ${avgCarb}g${c.carbs_target ? `（目標 ${c.carbs_target}g）` : ''}`)
      if (avgFat != null) lines.push(`  脂肪 ${avgFat}g${c.fat_target ? `（目標 ${c.fat_target}g）` : ''}`)
      const compliant = recent14.filter((l: any) => l.compliant).length
      lines.push(`  飲食合規 ${Math.round((compliant / recent14.length) * 100)}%（${compliant}/${recent14.length} 天達標）`)
      lines.push('')
    }

    // 體重趨勢
    const recentBody = bodyData.filter((b: any) => b.weight != null).slice(0, 14)
    if (recentBody.length >= 2) {
      lines.push('■ 體重趨勢（近 14 天）')
      const latest = recentBody[0]
      const oldest = recentBody[recentBody.length - 1]
      const change = (latest.weight - oldest.weight).toFixed(1)
      const pct = ((Number(change) / latest.weight) * 100).toFixed(1)
      lines.push(`  最新 ${latest.weight}kg（${latest.date}）`)
      lines.push(`  變化 ${Number(change) > 0 ? '+' : ''}${change}kg（${Number(pct) > 0 ? '+' : ''}${pct}%）`)
      if (latest.body_fat) lines.push(`  體脂 ${latest.body_fat}%`)
      lines.push('')
    }

    // 訓練
    const recent14Training = trainingLogs.filter((l: any) => {
      const d = new Date(l.date)
      const ago = new Date(); ago.setDate(ago.getDate() - 14)
      return d >= ago && l.training_type !== 'rest'
    })
    if (recent14Training.length > 0) {
      lines.push('■ 訓練概況（近 14 天）')
      lines.push(`  訓練 ${recent14Training.length} 天`)
      const typeCounts: Record<string, number> = {}
      let totalRpe = 0, rpeCount = 0
      for (const t of recent14Training) {
        typeCounts[t.training_type] = (typeCounts[t.training_type] || 0) + 1
        if (t.rpe) { totalRpe += t.rpe; rpeCount++ }
      }
      const types = Object.entries(typeCounts).map(([t, c]) => `${t}×${c}`).join('、')
      lines.push(`  類型：${types}`)
      if (rpeCount > 0) lines.push(`  平均 RPE ${(totalRpe / rpeCount).toFixed(1)}`)
      lines.push('')
    }

    // 身心狀態
    const recent7Wellness = wellness.filter((w: any) => {
      const d = new Date(w.date)
      const ago = new Date(); ago.setDate(ago.getDate() - 7)
      return d >= ago
    })
    if (recent7Wellness.length > 0) {
      lines.push('■ 身心狀態（近 7 天平均）')
      const avgW = (field: string) => {
        const vals = recent7Wellness.filter((w: any) => w[field] != null).map((w: any) => w[field])
        return vals.length > 0 ? (vals.reduce((a: number, b: number) => a + b, 0) / vals.length).toFixed(1) : null
      }
      const parts = []
      const sleep = avgW('sleep_quality'); if (sleep) parts.push(`睡眠 ${sleep}/5`)
      const energy = avgW('energy_level'); if (energy) parts.push(`精力 ${energy}/5`)
      const mood = avgW('mood'); if (mood) parts.push(`心情 ${mood}/5`)
      if (parts.length > 0) lines.push(`  ${parts.join(' / ')}`)
      const hrv = avgW('hrv'); if (hrv) lines.push(`  HRV ${hrv}ms`)
      const rhr = avgW('resting_hr'); if (rhr) lines.push(`  靜息心率 ${rhr} bpm`)
      lines.push('')
    }

    // 血檢
    if (labResults.length > 0) {
      lines.push('■ 血檢指標')
      const seen = new Set<string>()
      const sortedLabs = [...labResults].sort((a: any, b: any) => (b.date || '').localeCompare(a.date || ''))
      for (const lab of sortedLabs) {
        if (seen.has(lab.test_name)) continue
        seen.add(lab.test_name)
        const statusLabel = lab.status === 'alert' ? ' ⚠️' : lab.status === 'attention' ? ' ⚡' : ''
        lines.push(`  ${lab.test_name}: ${lab.value} ${lab.unit || ''}${statusLabel}（${lab.date}）`)
      }
      lines.push('')
    }

    // 系統建議摘要
    if (suggestion) {
      lines.push('■ 系統目前建議')
      if (suggestion.suggestedCalories) lines.push(`  每日熱量目標 ${suggestion.suggestedCalories} kcal`)
      if (suggestion.suggestedProtein) lines.push(`  蛋白質 ${suggestion.suggestedProtein}g`)
      if (suggestion.suggestedCarbsTrainingDay && suggestion.suggestedCarbsRestDay) {
        lines.push(`  碳循環：訓練日 ${suggestion.suggestedCarbsTrainingDay}g / 休息日 ${suggestion.suggestedCarbsRestDay}g`)
      }
      if (suggestion.message) lines.push(`  狀態：${suggestion.statusLabel || suggestion.status}`)
      lines.push('')
    }

    lines.push('---')
    lines.push('此數據由 Howard Protocol 系統自動產出，可直接貼到 AI 聊天室進行討論。')

    return lines.join('\n')
  }

  const handleCopy = () => {
    const text = generate()
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      showToast('已複製！貼到 ChatGPT 或 Claude 開始討論', 'success')
      setTimeout(() => setCopied(false), 3000)
    })
  }

  return (
    <div className="bg-gradient-to-r from-violet-50 to-purple-50 border border-violet-200 rounded-2xl p-4 mb-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-violet-800">🤖 帶著你的數據問 AI</p>
          <p className="text-[11px] text-violet-600 mt-0.5">一鍵匯出你的健康摘要，貼到 ChatGPT / Claude 討論</p>
        </div>
        <button
          onClick={handleCopy}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
            copied ? 'bg-green-500 text-white' : 'bg-violet-600 text-white hover:bg-violet-700'
          }`}
        >
          {copied ? '已複製 ✓' : '複製摘要'}
        </button>
      </div>
    </div>
  )
}
