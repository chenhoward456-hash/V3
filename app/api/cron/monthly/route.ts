/**
 * Monthly Cron Job — 每月成果報告
 *
 * 功能：每月 1 號生成上月成果報告，透過 LINE 推播給學員
 *
 * 排程：Vercel Cron — 每月 1 號 00:00 UTC (台灣 08:00)
 * 驗證：CRON_SECRET header 或 admin session
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase'
import { pushMessage, LineMessage } from '@/lib/line'
import { verifyAdminSession } from '@/lib/auth-middleware'
import { isWeightTraining } from '@/components/client/types'
import { createLogger } from '@/lib/logger'

export const maxDuration = 300

const logger = createLogger('cron-monthly')

function verifyCronAuth(request: NextRequest): boolean {
  const cronSecret = request.headers.get('authorization')
  if (cronSecret === `Bearer ${process.env.CRON_SECRET}`) return true

  const token = request.cookies.get('admin_session')?.value
  return !!token && verifyAdminSession(token)
}

export async function GET(request: NextRequest) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: '未授權' }, { status: 401 })
  }

  const supabase = createServiceSupabase()
  const now = new Date()

  // 計算上個月的日期範圍
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const monthStart = lastMonth.toISOString().split('T')[0]
  const monthEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0]
  const monthName = lastMonth.toLocaleDateString('zh-TW', { year: 'numeric', month: 'long' })

  // 取得所有已綁定 LINE 的活躍付費學員
  const { data: clients, error } = await supabase
    .from('clients')
    .select('id, name, line_user_id, unique_code, subscription_tier, goal_type')
    .eq('is_active', true)
    .not('line_user_id', 'is', null)
    .neq('subscription_tier', 'free')

  if (error || !clients) {
    return NextResponse.json({ error: '無法取得學員', detail: error?.message }, { status: 500 })
  }

  // 批量查詢上月所有數據
  const [bodyRes, nutritionRes, trainingRes, wellnessRes] = await Promise.all([
    supabase
      .from('body_composition')
      .select('client_id, date, weight, body_fat')
      .gte('date', monthStart)
      .lte('date', monthEnd)
      .not('weight', 'is', null)
      .order('date', { ascending: true }),
    supabase
      .from('nutrition_logs')
      .select('client_id, date, compliant, calories, protein_grams')
      .gte('date', monthStart)
      .lte('date', monthEnd),
    supabase
      .from('training_logs')
      .select('client_id, date, training_type, duration')
      .gte('date', monthStart)
      .lte('date', monthEnd),
    supabase
      .from('daily_wellness')
      .select('client_id, date, energy_level, sleep_quality, mood')
      .gte('date', monthStart)
      .lte('date', monthEnd),
  ])

  const allBody = bodyRes.data || []
  const allNutrition = nutritionRes.data || []
  const allTraining = trainingRes.data || []
  const allWellness = wellnessRes.data || []

  let reportsSent = 0
  const errors: string[] = []
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://howard456.vercel.app'

  for (const client of clients) {
    const clientBody = allBody.filter((b: { client_id: string }) => b.client_id === client.id)
    const clientNutrition = allNutrition.filter((n: { client_id: string }) => n.client_id === client.id)
    const clientTraining = allTraining.filter((t: { client_id: string }) => t.client_id === client.id)
    const clientWellness = allWellness.filter((w: { client_id: string }) => w.client_id === client.id)

    // 如果整個月沒有任何數據，跳過
    if (clientBody.length === 0 && clientNutrition.length === 0 && clientTraining.length === 0) continue

    const lines: string[] = [`📊 ${client.name}｜${monthName}成果報告\n`]

    // ── 體重變化 ──
    if (clientBody.length >= 2) {
      const firstWeight = clientBody[0].weight
      const lastWeight = clientBody[clientBody.length - 1].weight
      const diff = lastWeight - firstWeight
      const sign = diff > 0 ? '+' : ''
      lines.push(`⚖️ 體重：${firstWeight}kg → ${lastWeight}kg（${sign}${diff.toFixed(1)}kg）`)

      // 體脂變化
      const bodyFats = clientBody.filter((b: { body_fat: number | null }) => b.body_fat != null)
      if (bodyFats.length >= 2) {
        const firstBf = bodyFats[0].body_fat
        const lastBf = bodyFats[bodyFats.length - 1].body_fat
        const bfDiff = lastBf - firstBf
        const bfSign = bfDiff > 0 ? '+' : ''
        lines.push(`📉 體脂：${firstBf}% → ${lastBf}%（${bfSign}${bfDiff.toFixed(1)}%）`)
      }
    } else if (clientBody.length === 1) {
      lines.push(`⚖️ 體重：${clientBody[0].weight}kg（本月僅 1 筆記錄）`)
    }

    // ── 飲食合規 ──
    if (clientNutrition.length > 0) {
      const compliant = clientNutrition.filter((n: { compliant: boolean | null }) => n.compliant).length
      const rate = Math.round((compliant / clientNutrition.length) * 100)
      lines.push(`🍽️ 飲食合規：${compliant}/${clientNutrition.length} 天（${rate}%）`)

      const withCalories = clientNutrition.filter((n: { calories: number | null }) => n.calories != null)
      if (withCalories.length > 0) {
        const avgCal = Math.round(withCalories.reduce((s: number, n: { calories: number | null }) => s + (n.calories ?? 0), 0) / withCalories.length)
        lines.push(`🔥 平均熱量：${avgCal} kcal/天`)
      }

      const withProtein = clientNutrition.filter((n: { protein_grams: number | null }) => n.protein_grams != null)
      if (withProtein.length > 0) {
        const avgProtein = Math.round(withProtein.reduce((s: number, n: { protein_grams: number | null }) => s + (n.protein_grams ?? 0), 0) / withProtein.length)
        lines.push(`🥩 平均蛋白質：${avgProtein}g/天`)
      }
    }

    // ── 訓練統計 ──
    if (clientTraining.length > 0) {
      const weightDays = clientTraining.filter((t: { training_type: string }) => isWeightTraining(t.training_type)).length
      const totalDays = new Set(clientTraining.map((t: { date: string }) => t.date)).size
      lines.push(`🏋️ 訓練天數：${totalDays} 天（重訓 ${weightDays} 天）`)

      const withDuration = clientTraining.filter((t: { duration: number | null }) => t.duration != null)
      if (withDuration.length > 0) {
        const totalMin = withDuration.reduce((s: number, t: { duration: number | null }) => s + (t.duration ?? 0), 0)
        lines.push(`⏱️ 總訓練時間：${Math.round(totalMin / 60)} 小時 ${totalMin % 60} 分鐘`)
      }
    }

    // ── 身心狀態平均 ──
    if (clientWellness.length > 0) {
      const avgEnergy = clientWellness.filter((w: { energy_level: number | null }) => w.energy_level != null)
      const avgSleep = clientWellness.filter((w: { sleep_quality: number | null }) => w.sleep_quality != null)
      const avgMood = clientWellness.filter((w: { mood: number | null }) => w.mood != null)

      const wellnessParts: string[] = []
      if (avgEnergy.length > 0) {
        wellnessParts.push(`精力 ${(avgEnergy.reduce((s: number, w: { energy_level: number | null }) => s + (w.energy_level ?? 0), 0) / avgEnergy.length).toFixed(1)}/5`)
      }
      if (avgSleep.length > 0) {
        wellnessParts.push(`睡眠 ${(avgSleep.reduce((s: number, w: { sleep_quality: number | null }) => s + (w.sleep_quality ?? 0), 0) / avgSleep.length).toFixed(1)}/5`)
      }
      if (avgMood.length > 0) {
        wellnessParts.push(`心情 ${(avgMood.reduce((s: number, w: { mood: number | null }) => s + (w.mood ?? 0), 0) / avgMood.length).toFixed(1)}/5`)
      }
      if (wellnessParts.length > 0) {
        lines.push(`😊 平均身心：${wellnessParts.join('、')}`)
      }
    }

    // ── 記錄天數統計 ──
    const totalRecordDays = new Set([
      ...clientBody.map((b: { date: string }) => b.date),
      ...clientNutrition.map((n: { date: string }) => n.date),
      ...clientTraining.map((t: { date: string }) => t.date),
      ...clientWellness.map((w: { date: string }) => w.date),
    ]).size

    // 計算月份天數
    const daysInMonth = new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 0).getDate()
    lines.push(`\n📅 活躍天數：${totalRecordDays}/${daysInMonth} 天`)

    // ── 小結語 ──
    if (clientBody.length >= 2) {
      const diff = clientBody[clientBody.length - 1].weight - clientBody[0].weight
      const goalType = client.goal_type
      if (goalType === 'cut' && diff < 0) {
        lines.push(`\n✨ 減脂方向正確，繼續保持！`)
      } else if (goalType === 'bulk' && diff > 0) {
        lines.push(`\n✨ 增肌進展順利，繼續加油！`)
      } else if (totalRecordDays >= 20) {
        lines.push(`\n✨ 記錄非常勤勞，數據越完整，調整越精準！`)
      }
    }

    lines.push(`\n📱 查看完整數據：${siteUrl}/c/${client.unique_code}`)

    try {
      const msg: LineMessage = { type: 'text', text: lines.join('\n') }
      await pushMessage(client.line_user_id, [msg])
      reportsSent++
    } catch (err: unknown) {
      errors.push(`${client.name}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  return NextResponse.json({
    success: errors.length === 0,
    monthName,
    reportsSent,
    totalClients: clients.length,
    errors,
  })
}
