/**
 * Daily Cron Job — 每日提醒推播
 *
 * 功能：
 * 1. 早上提醒量體重
 * 2. 晚上提醒填寫今日紀錄（僅推送還沒填的項目）
 *
 * 排程：Vercel Cron
 * - 早上提醒：每日 22:00 UTC (台灣 06:00) → type=morning
 * - 晚上提醒：每日 14:00 UTC (台灣 22:00) → type=evening
 *
 * 驗證：CRON_SECRET header 或 admin session
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase'
import { pushMessage } from '@/lib/line'
import { verifyAdminSession } from '@/lib/auth-middleware'

function verifyCronAuth(request: NextRequest): boolean {
  const cronSecret = request.headers.get('authorization')
  if (cronSecret === `Bearer ${process.env.CRON_SECRET}`) return true

  const token = request.cookies.get('admin_session')?.value
  return !!token && verifyAdminSession(token)
}

function getTaiwanDate(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' })
}

function getTaiwanHour(): number {
  return parseInt(new Date().toLocaleString('en-US', { timeZone: 'Asia/Taipei', hour: 'numeric', hour12: false }))
}

export async function GET(request: NextRequest) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: '未授權' }, { status: 401 })
  }

  const supabase = createServiceSupabase()
  const hour = getTaiwanHour()
  const today = getTaiwanDate()

  // 取得所有已綁定 LINE 的活躍學員
  const { data: clients, error } = await supabase
    .from('clients')
    .select('id, name, line_user_id, body_composition_enabled, nutrition_enabled, training_enabled, wellness_enabled')
    .eq('is_active', true)
    .not('line_user_id', 'is', null)

  if (error || !clients) {
    return NextResponse.json({ error: '無法取得學員', detail: error?.message }, { status: 500 })
  }

  let sent = 0
  const errors: string[] = []

  // 判斷早上或晚上
  const isMorning = hour >= 5 && hour < 12

  if (isMorning) {
    // ── 早上提醒：量體重 ──
    // 先查哪些人今天還沒量體重
    const { data: todayWeights } = await supabase
      .from('body_composition')
      .select('client_id')
      .eq('date', today)

    const hasWeight = new Set((todayWeights || []).map((w: any) => w.client_id))

    for (const client of clients) {
      if (!client.body_composition_enabled) continue
      if (hasWeight.has(client.id)) continue // 已經量了

      try {
        await pushMessage(client.line_user_id, [
          {
            type: 'text',
            text: `☀️ 早安 ${client.name}！\n\n別忘了量體重喔\n💡 直接輸入「體重 72.5」就能記錄`,
          },
        ])
        sent++
      } catch (err: any) {
        errors.push(`${client.name}: ${err.message}`)
      }
    }
  } else {
    // ── 晚上提醒：填寫今日紀錄 ──
    // 批量查詢今日所有紀錄
    const [wellnessRes, nutritionRes, trainingRes] = await Promise.all([
      supabase.from('daily_wellness').select('client_id').eq('date', today),
      supabase.from('nutrition_logs').select('client_id').eq('date', today),
      supabase.from('training_logs').select('client_id').eq('date', today),
    ])

    const hasWellness = new Set((wellnessRes.data || []).map((w: any) => w.client_id))
    const hasNutrition = new Set((nutritionRes.data || []).map((n: any) => n.client_id))
    const hasTraining = new Set((trainingRes.data || []).map((t: any) => t.client_id))

    for (const client of clients) {
      const missing: string[] = []

      if (client.wellness_enabled && !hasWellness.has(client.id)) {
        missing.push('• 身心狀態 → 輸入「身心 4 3 4」')
      }
      if (client.nutrition_enabled && !hasNutrition.has(client.id)) {
        missing.push('• 飲食紀錄 → 輸入「達標」或「未達標」')
      }
      if (client.training_enabled && !hasTraining.has(client.id)) {
        missing.push('• 訓練紀錄 → 輸入「訓練 推 60分鐘」')
      }

      if (missing.length === 0) continue // 都填了，不打擾

      try {
        await pushMessage(client.line_user_id, [
          {
            type: 'text',
            text: [
              `🌙 ${client.name}，今天還有 ${missing.length} 項沒記錄：\n`,
              ...missing,
              '\n回覆指令就能快速完成 ✌️',
            ].join('\n'),
          },
        ])
        sent++
      } catch (err: any) {
        errors.push(`${client.name}: ${err.message}`)
      }
    }
  }

  return NextResponse.json({
    success: errors.length === 0,
    type: isMorning ? 'morning' : 'evening',
    sent,
    errors,
  })
}
