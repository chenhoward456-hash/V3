/**
 * Weekly skip review — 抓引擎默默放棄的 coached/protocol 客戶並推 LINE 給教練
 *
 * 對每個學員跑 trajectory-adjust，依 skipCategory 分流：
 *   - cooldown / on_track / too_small / 正常 shouldAdjust → 跳過（健康狀態）
 *   - no_target / no_calories / no_body_data / trend_reversed → 推一則 LINE + 對應一鍵動作
 *
 * 排程：vercel.json 設成每週一台灣 08:00 (00:00 UTC)
 * Auth: CRON_SECRET header 或 admin session
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase'
import { pushMessage } from '@/lib/line'
import { verifyAdminSession } from '@/lib/auth-middleware'
import { computeTrajectoryAdjustment, type MacroBounds, type SkipCategory } from '@/lib/trajectory-adjust'

export const maxDuration = 60

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://howard456.vercel.app'

function verifyAuth(request: NextRequest): boolean {
  const cronSecret = request.headers.get('authorization')
  if (cronSecret === `Bearer ${process.env.CRON_SECRET}`) return true
  const token = request.cookies.get('admin_session')?.value
  return !!token && verifyAdminSession(token)
}

type Problem = {
  clientId: string
  name: string
  category: Exclude<SkipCategory, 'cooldown' | 'on_track' | 'too_small'>
  reason: string
  daysToComp: number | null
  lastAdjustAt: string | null
  clientLineId: string | null
  weighsLast14d: number
}

const CATEGORY_LABELS: Record<Problem['category'], string> = {
  no_target: '缺目標欄位（target_weight / target_date）',
  no_calories: '缺 calories_target',
  no_body_data: '體重資料不足 2 週',
  trend_reversed: '趨勢反轉（1 週 vs 4 週方向相反）',
}

export async function GET(request: NextRequest) {
  if (!verifyAuth(request)) {
    return NextResponse.json({ error: '未授權' }, { status: 401 })
  }

  const supabase = createServiceSupabase()
  const today = new Date()

  const { data: clients } = await supabase
    .from('clients')
    .select('id, name, gender, goal_type, target_weight, target_date, competition_date, calories_target, protein_target, carbs_target, fat_target, carbs_training_day, carbs_rest_day, last_auto_adjust_at, macro_bounds, coach_macro_override, subscription_tier, line_user_id')
    .in('subscription_tier', ['coached', 'protocol'])
    .is('coach_macro_override', null)

  const fourteenDaysAgo = new Date(); fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14)
  const fourteenStr = fourteenDaysAgo.toISOString().split('T')[0]

  const problems: Problem[] = []

  for (const c of (clients ?? [])) {
    const { data: bodyData } = await supabase
      .from('body_composition')
      .select('date, weight')
      .eq('client_id', c.id)
      .order('date', { ascending: true })
      .limit(180)

    const traj = computeTrajectoryAdjustment({
      bodyDataEntries: (bodyData ?? []).map((b: any) => ({ date: b.date, weight: b.weight })),
      goalType: c.goal_type as 'cut' | 'bulk' | 'recomp',
      targetWeight: c.target_weight ? Number(c.target_weight) : null,
      targetDate: c.competition_date || c.target_date,
      currentCalories: c.calories_target ? Number(c.calories_target) : null,
      currentProtein: c.protein_target ? Number(c.protein_target) : null,
      currentFat: c.fat_target ? Number(c.fat_target) : null,
      currentCarbs: c.carbs_target ? Number(c.carbs_target) : null,
      currentCarbsTrainingDay: c.carbs_training_day ? Number(c.carbs_training_day) : null,
      currentCarbsRestDay: c.carbs_rest_day ? Number(c.carbs_rest_day) : null,
      gender: c.gender,
      bounds: (c.macro_bounds as MacroBounds | null) ?? null,
      lastAdjustAt: c.last_auto_adjust_at,
    })

    // healthy / cron 自然會處理 → 跳過
    if (traj.shouldAdjust) continue
    if (!traj.skipCategory) continue
    if (traj.skipCategory === 'cooldown' || traj.skipCategory === 'on_track' || traj.skipCategory === 'too_small') continue

    const compDate = c.competition_date || c.target_date
    const daysToComp = compDate
      ? Math.floor((new Date(compDate).getTime() - today.getTime()) / 86_400_000)
      : null

    const weighsLast14d = (bodyData ?? []).filter((b: any) => b.date >= fourteenStr && b.weight != null).length

    problems.push({
      clientId: c.id,
      name: c.name,
      category: traj.skipCategory as Problem['category'],
      reason: traj.reason,
      daysToComp,
      lastAdjustAt: c.last_auto_adjust_at,
      clientLineId: c.line_user_id || null,
      weighsLast14d,
    })
  }

  const coachLineId = process.env.ADMIN_LINE_USER_ID
  if (!coachLineId) {
    return NextResponse.json({ ok: true, problems, pushed: false, reason: 'no admin LINE id' })
  }

  if (problems.length === 0) {
    await pushMessage(coachLineId, [{
      type: 'text',
      text: '✅ 引擎週報：全員健康，沒有需要處理的學員',
    }]).catch(() => {})
    return NextResponse.json({ ok: true, problems: [], pushed: true })
  }

  // 1. 摘要訊息
  const summary = `🔍 引擎週掃描：${problems.length} 位學員需要處理\n\n（每位下面會單獨推一則含一鍵動作）`
  await pushMessage(coachLineId, [{ type: 'text', text: summary }]).catch(() => {})

  // 2. 每位 problematic client 一則訊息 + 對應按鈕
  for (const p of problems) {
    const daysLine = p.daysToComp != null ? `${p.daysToComp} 天比賽` : '無比賽日'
    const lastLine = p.lastAdjustAt
      ? `上次調整：${p.lastAdjustAt.split('T')[0]}`
      : '從未被調整'
    const text = `🟡 ${p.name}（${daysLine}）\n\n原因：${CATEGORY_LABELS[p.category]}\n${lastLine}`

    const items: any[] = []
    if (p.category === 'no_target' || p.category === 'no_calories') {
      items.push({ type: 'action', action: { type: 'uri', label: '⚙️ 開後台補', uri: `${SITE_URL}/admin/clients/${p.clientId}` } })
    }
    if (p.category === 'no_body_data') {
      items.push({ type: 'action', action: { type: 'postback', label: '📲 推學員量體重', data: `coach_action:nudge_weight:${p.clientId}`, displayText: `推 ${p.name} 量體重` } })
      items.push({ type: 'action', action: { type: 'uri', label: '⚙️ 開後台看', uri: `${SITE_URL}/admin/clients/${p.clientId}` } })
    }
    if (p.category === 'trend_reversed') {
      items.push({ type: 'action', action: { type: 'postback', label: '▶ 強制重算', data: `coach_action:force_recalc:${p.clientId}`, displayText: `強制重算 ${p.name}` } })
      items.push({ type: 'action', action: { type: 'uri', label: '⚙️ 開後台看趨勢', uri: `${SITE_URL}/admin/clients/${p.clientId}/overview` } })
    }

    await pushMessage(coachLineId, [{
      type: 'text', text,
      ...(items.length > 0 ? { quickReply: { items } } : {}),
    } as any]).catch(() => {})
  }

  // 3. 自動 nudge 學員（no_body_data 才推；其他類別需要教練判斷不直接推）
  const clientNudged: string[] = []
  for (const p of problems) {
    if (p.category !== 'no_body_data') continue
    if (!p.clientLineId) continue
    const compLine = p.daysToComp != null ? `\n\n📅 距離比賽 ${p.daysToComp} 天` : ''
    const text = `Hi ${p.name}，過去 14 天我只看到你量了 ${p.weighsLast14d} 次體重 👀\n\n系統需要連續 3 週的記錄才能幫你計算趨勢、自動微調營養素。沒記錄 = 我猜不到你進度，吃法就只能停在現在這組。\n\n抓緊每天早上起床上完廁所量一下，連續一週就能開始看到變化曲線了 💪${compLine}`
    await pushMessage(p.clientLineId, [{ type: 'text', text }]).catch(() => {})
    clientNudged.push(p.name)
  }

  return NextResponse.json({ ok: true, problems, pushed: true, clientNudged })
}
