/**
 * 學員 client context snapshot — for AI chat 自動載入。
 *
 * 從 DB 拉學員「目前狀態」濃縮成 markdown 字串：
 *   - 基本資料（性別 / 年齡 / mode / tier / 比賽日 / 下次抽血）
 *   - 最新血檢摘要（最近一筆 panel_date + 前 5 個 critical/attention findings）
 *   - 最新教練筆記（summary + priorities，最多 800 字）
 *   - 目前在吃補品（最多 10 個）
 *   - 最新體組成 / wellness（1 筆）
 *
 * 大概 1500-2000 tokens。配合 prompt caching 節省成本。
 */

import { createServiceSupabase } from './supabase'
import { analyzeLabs, type LabResultRow } from './lab-trend-analyzer'

const supabase = createServiceSupabase()

interface ClientRow {
  id: string
  name: string
  age: number | null
  gender: string | null
  client_mode: string | null
  subscription_tier: string | null
  competition_date: string | null
  next_checkup_date: string | null
  health_goals: string | null
}

export async function buildClientContextSnapshot(clientInternalId: string): Promise<string> {
  try {
    // 平行拉所有需要的資料
    const [
      { data: client },
      { data: labs },
      { data: panelNote },
      { data: supplements },
      { data: body },
      { data: wellness },
    ] = await Promise.all([
      supabase
        .from('clients')
        .select('id, name, age, gender, client_mode, subscription_tier, competition_date, next_checkup_date, health_goals')
        .eq('id', clientInternalId)
        .maybeSingle<ClientRow>(),
      supabase
        .from('lab_results')
        .select('test_name, value, unit, date, status')
        .eq('client_id', clientInternalId)
        .gte('date', new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10))
        .order('date', { ascending: true }),
      supabase
        .from('lab_panel_notes')
        .select('panel_date, summary, priorities, next_review_date')
        .eq('client_id', clientInternalId)
        .order('panel_date', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('supplements')
        .select('name, dosage, timing, why, coach_rationale, started_at')
        .eq('client_id', clientInternalId)
        .is('archived_at', null)
        .order('sort_order', { ascending: true })
        .limit(15),
      supabase
        .from('body_composition')
        .select('date, weight, body_fat, muscle_mass, bmi')
        .eq('client_id', clientInternalId)
        .order('date', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('daily_wellness')
        .select('date, sleep_quality, mood, hrv, resting_hr, device_recovery_score, wearable_sleep_score, energy_level')
        .eq('client_id', clientInternalId)
        .order('date', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])

    if (!client) return ''

    const lines: string[] = ['# 學員當前狀態']

    // 基本資料
    lines.push(`**${client.name}**（${client.age ?? '?'} 歲${client.gender ? ` · ${client.gender}` : ''}）`)
    if (client.client_mode) lines.push(`mode: ${client.client_mode}${client.subscription_tier ? ` · tier: ${client.subscription_tier}` : ''}`)
    if (client.competition_date) {
      const days = Math.floor((new Date(client.competition_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      lines.push(`比賽日：${client.competition_date}${days > 0 ? `（${days} 天後）` : days === 0 ? '（今天）' : `（已過 ${Math.abs(days)} 天）`}`)
    }
    if (client.next_checkup_date) lines.push(`下次抽血：${client.next_checkup_date}`)
    if (client.health_goals) lines.push(`健康目標：${client.health_goals.replace(/\n/g, '; ')}`)
    lines.push('')

    // 血檢摘要（用 trend analyzer 找重點）
    if (labs && labs.length > 0) {
      const gender = client.gender === '男性' || client.gender === '女性' ? client.gender : undefined
      const findings = analyzeLabs(labs as LabResultRow[], { gender })
      const latestDate = labs.reduce((max, r) => (r.date > max ? r.date : max), labs[0].date as string)
      lines.push(`## 最新血檢（${latestDate}）`)

      const critical = findings.filter(f => f.severity === 'critical').slice(0, 5)
      const attention = findings.filter(f => f.severity === 'attention').slice(0, 5)
      const optimal = findings.filter(f => f.severity === 'optimal').slice(0, 5)

      if (critical.length > 0) {
        lines.push('### 🚨 Critical')
        critical.forEach(f => lines.push(`- ${f.autoLabel}`))
      }
      if (attention.length > 0) {
        lines.push('### ⚠️ Attention')
        attention.forEach(f => lines.push(`- ${f.autoLabel}`))
      }
      if (optimal.length > 0) {
        lines.push('### ✅ 已達最佳')
        lines.push(optimal.map(f => f.testName).join('、'))
      }
      lines.push('')
    }

    // 教練筆記
    if (panelNote && (panelNote.summary || panelNote.priorities)) {
      lines.push(`## 教練最新觀察筆記（${panelNote.panel_date}）`)
      if (panelNote.summary) {
        const s = panelNote.summary.slice(0, 600)
        lines.push(`**摘要**：${s}${panelNote.summary.length > 600 ? '...' : ''}`)
      }
      if (panelNote.priorities) {
        const p = panelNote.priorities.slice(0, 600)
        lines.push(`**優先處理**：${p}${panelNote.priorities.length > 600 ? '...' : ''}`)
      }
      if (panelNote.next_review_date) {
        lines.push(`**下次追蹤**：${panelNote.next_review_date}`)
      }
      lines.push('')
    }

    // 補品
    if (supplements && supplements.length > 0) {
      lines.push(`## 目前在吃補品（${supplements.length} 項）`)
      supplements.forEach((s: { name: string; dosage: string; timing: string; coach_rationale: string | null; why: string | null }) => {
        const rationale = s.coach_rationale || s.why
        lines.push(`- **${s.name}** ${s.dosage} (${s.timing})${rationale ? ` — ${rationale.slice(0, 80)}` : ''}`)
      })
      lines.push('')
    }

    // 體組成
    if (body) {
      const parts: string[] = []
      if (body.weight) parts.push(`體重 ${body.weight}kg`)
      if (body.body_fat) parts.push(`體脂 ${body.body_fat}%`)
      if (body.muscle_mass) parts.push(`肌肉 ${body.muscle_mass}kg`)
      if (parts.length > 0) {
        lines.push(`## 最新體組成（${body.date}）：${parts.join(' · ')}`)
        lines.push('')
      }
    }

    // 睡眠 / 恢復
    if (wellness) {
      const parts: string[] = []
      if (wellness.sleep_quality) parts.push(`睡眠品質 ${wellness.sleep_quality}/10`)
      if (wellness.energy_level) parts.push(`活力 ${wellness.energy_level}/10`)
      if (wellness.mood) parts.push(`心情 ${wellness.mood}/10`)
      if (wellness.hrv) parts.push(`HRV ${wellness.hrv}ms`)
      if (wellness.resting_hr) parts.push(`RHR ${wellness.resting_hr}`)
      if (wellness.device_recovery_score) parts.push(`恢復 ${wellness.device_recovery_score}/100`)
      if (wellness.wearable_sleep_score) parts.push(`睡眠分 ${wellness.wearable_sleep_score}/100`)
      if (parts.length > 0) {
        lines.push(`## 最新 wellness（${wellness.date}）：${parts.join(' · ')}`)
      }
    }

    return lines.join('\n')
  } catch (err) {
    console.error('[client-context] error:', err)
    return ''
  }
}
