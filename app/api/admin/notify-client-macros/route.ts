/**
 * 把當前 DB 裡的 macros 直接推給學員 LINE — 給「現在到比賽日」的吃法摘要。
 * 不算新 macros、不寫 DB，只是把現狀整理成人話訊息推給客戶。
 *
 * Auth: CRON_SECRET header 或 admin session
 * Usage: GET /api/admin/notify-client-macros?clientId=<uuid>
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase'
import { pushMessage } from '@/lib/line'
import { verifyAdminSession } from '@/lib/auth-middleware'

function verifyAuth(request: NextRequest): boolean {
  const cronSecret = request.headers.get('authorization')
  if (cronSecret === `Bearer ${process.env.CRON_SECRET}`) return true
  const token = request.cookies.get('admin_session')?.value
  return !!token && verifyAdminSession(token)
}

export async function GET(request: NextRequest) {
  if (!verifyAuth(request)) {
    return NextResponse.json({ error: '未授權' }, { status: 401 })
  }

  const clientId = request.nextUrl.searchParams.get('clientId')
  if (!clientId) return NextResponse.json({ error: '缺少 clientId' }, { status: 400 })

  const supabase = createServiceSupabase()

  const { data: c, error } = await supabase
    .from('clients')
    .select('id, name, line_user_id, goal_type, target_weight, target_date, competition_date, calories_target, protein_target, fat_target, carbs_target, carbs_training_day, carbs_rest_day, cardio_minutes_per_day')
    .eq('id', clientId)
    .maybeSingle()
  if (error || !c) return NextResponse.json({ error: '找不到學員' }, { status: 404 })
  if (!c.line_user_id) return NextResponse.json({ error: `${c.name} 沒綁 LINE` }, { status: 400 })
  if (!c.calories_target) return NextResponse.json({ error: `${c.name} 沒設 calories_target` }, { status: 400 })

  const compDate = c.competition_date || c.target_date
  const daysToComp = compDate
    ? Math.floor((new Date(compDate).getTime() - Date.now()) / 86_400_000)
    : null

  const isRevision = request.nextUrl.searchParams.get('revision') === '1'
  const lines: string[] = []
  if (isRevision) {
    lines.push(`🔁 修正版 — 請以這份為準（上一則作廢）`)
    lines.push('')
  }
  lines.push(`Hi ${c.name}，幫你整理一下從現在到比賽的吃法 💪`)
  lines.push('')
  if (daysToComp != null) {
    lines.push(`📅 距離比賽：${daysToComp} 天 (${compDate})`)
  }
  if (c.target_weight) {
    lines.push(`🎯 目標體重：${c.target_weight} kg`)
  }
  lines.push('')
  lines.push(`━━━ 每日營養素 ━━━`)
  lines.push(`🔥 熱量：${c.calories_target} kcal`)
  if (c.protein_target) lines.push(`🥩 蛋白質：${c.protein_target} g`)
  if (c.fat_target) lines.push(`🥑 脂肪：${c.fat_target} g`)
  if (c.carbs_training_day && c.carbs_rest_day) {
    lines.push(`🍚 訓練日碳水：${c.carbs_training_day} g`)
    lines.push(`🍚 非訓練日碳水：${c.carbs_rest_day} g`)
  } else if (c.carbs_target) {
    lines.push(`🍚 碳水：${c.carbs_target} g`)
  }
  if (c.cardio_minutes_per_day) {
    lines.push(``)
    lines.push(`🏃 每日有氧：${c.cardio_minutes_per_day} min`)
  }
  lines.push('')
  lines.push(`━━━ 重點提醒 ━━━`)
  lines.push(`1. 這套是「現在到比賽前」的基礎吃法`)
  lines.push(`2. 體重請每天早上量完上完廁所量一次，連續記錄 → 系統會自動依進度幫你微調`)
  lines.push(`3. 訓練日多吃 100g 碳水給足肝糖；非訓練日少吃，保留比賽前的脂肪窗口`)
  lines.push(`4. 任何不舒服（睡不好、暴躁、抽筋）來 LINE 跟 Howard 講`)

  const text = lines.join('\n')

  await pushMessage(c.line_user_id, [{ type: 'text', text }]).catch((e) => {
    console.error('push to client failed', e)
  })

  return NextResponse.json({
    ok: true,
    pushed_to: c.name,
    days_to_comp: daysToComp,
    macros: {
      calories: c.calories_target,
      protein: c.protein_target,
      fat: c.fat_target,
      carbs_training: c.carbs_training_day,
      carbs_rest: c.carbs_rest_day,
      carbs: c.carbs_target,
    },
  })
}
