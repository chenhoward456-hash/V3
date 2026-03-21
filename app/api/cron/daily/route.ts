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
import type { BodyComposition, NutritionLog, TrainingLog, DailyWellness } from '@/types'
import { createServiceSupabase } from '@/lib/supabase'
import { pushMessage, unlinkRichMenuFromUser } from '@/lib/line'
import { sendRoutineReminder } from '@/lib/notify'
import { sendPushNotification } from '@/lib/web-push'
import { verifyAdminSession } from '@/lib/auth-middleware'
import { generateSmartAlerts, type InsightData, type ClientProfile } from '@/lib/ai-insights'
import { createLogger } from '@/lib/logger'
import { daysUntilDateTW, DAY_MS } from '@/lib/date-utils'
import {
  sendDay3Email,
  sendDay7Email,
  sendDay14Email,
  sendExpiryWarningEmail,
  sendWinBackEmail,
} from '@/lib/email'
import { getDefaultFeatures } from '@/lib/tier-defaults'
import { startCronRun, completeCronRun, failCronRun } from '@/lib/cron-utils'

export const maxDuration = 300

const logger = createLogger('cron-daily')

function verifyCronAuth(request: NextRequest): boolean {
  const cronSecret = request.headers.get('authorization')
  if (cronSecret === `Bearer ${process.env.CRON_SECRET}`) return true

  const token = request.cookies.get('admin_session')?.value
  return !!token && verifyAdminSession(token)
}

/** 僅 Web Push，不 fallback LINE（用於低優先度日常提醒如量體重） */
async function sendWebPushOnly(
  clientId: string,
  message: { title: string; body: string; url?: string }
): Promise<boolean> {
  const supabase = createServiceSupabase()
  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('client_id', clientId)

  if (!subs || subs.length === 0) return false

  for (const sub of subs) {
    const ok = await sendPushNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      message
    )
    if (ok) return true
  }
  return false
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
  const isMorningRun = hour >= 5 && hour < 12
  const cronJobType = isMorningRun ? 'daily_morning' as const : 'daily_evening' as const

  // Cron runs 冪等性檢查
  const { runId, alreadyRan } = await startCronRun(cronJobType, today)
  if (alreadyRan) {
    return NextResponse.json({ success: true, skipped: true, reason: '今日已執行過' })
  }

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
  let webPushUsed = 0
  let linePushUsed = 0
  const errors: string[] = []

  // 判斷早上或晚上
  const isMorning = isMorningRun
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://howard456.vercel.app'

  if (isMorning) {
    // ── 早上提醒：量體重（僅 Web Push，不消耗 LINE 額度）──
    const { data: todayWeights } = await supabase
      .from('body_composition')
      .select('client_id')
      .eq('date', today)

    const hasWeight = new Set((todayWeights || []).map((w: { client_id: string }) => w.client_id))
    const morningTargets = clients.filter(c => c.body_composition_enabled && !hasWeight.has(c.id))

    // 批次發送（每批 5 個，僅 Web Push）
    for (let i = 0; i < morningTargets.length; i += 5) {
      const batch = morningTargets.slice(i, i + 5)
      const results = await Promise.allSettled(
        batch.map(client =>
          sendWebPushOnly(client.id, {
            title: `☀️ 早安 ${client.name}！`,
            body: '別忘了量體重喔',
            url: `${siteUrl}/dashboard`,
          })
        )
      )
      results.forEach((result, idx) => {
        if (result.status === 'fulfilled' && result.value) {
          sent++
          webPushUsed++
        } else if (result.status === 'rejected') {
          errors.push(`${batch[idx].name}: ${result.reason?.message || 'unknown'}`)
        }
      })
    }

    // ── 教練晨間摘要：推送昨日學員狀態到教練 LINE ──
    const coachLineId = process.env.COACH_LINE_USER_ID
    if (coachLineId) {
      try {
        const yesterday = new Date()
        yesterday.setDate(yesterday.getDate() - 1)
        const yesterdayStr = yesterday.toISOString().split('T')[0]

        // Query yesterday's data
        const [yWeightRes, yNutritionRes, yTrainingRes, yWellnessRes] = await Promise.all([
          supabase.from('body_composition').select('client_id, weight').eq('date', yesterdayStr),
          supabase.from('nutrition_logs').select('client_id').eq('date', yesterdayStr),
          supabase.from('training_logs').select('client_id, rpe').eq('date', yesterdayStr),
          supabase.from('daily_wellness').select('client_id, energy_level').eq('date', yesterdayStr),
        ])

        const hadWeight = new Set((yWeightRes.data || []).map((w: { client_id: string }) => w.client_id))
        const hadNutrition = new Set((yNutritionRes.data || []).map((n: { client_id: string }) => n.client_id))
        const hadTraining = new Set((yTrainingRes.data || []).map((t: { client_id: string }) => t.client_id))
        const hadWellness = new Set((yWellnessRes.data || []).map((w: { client_id: string }) => w.client_id))

        const digestLines: string[] = []

        // 1. Clients who missed records yesterday
        const missedClients = clients.filter(c => {
          const missed: string[] = []
          if (c.body_composition_enabled && !hadWeight.has(c.id)) missed.push('體重')
          if (c.nutrition_enabled && !hadNutrition.has(c.id)) missed.push('飲食')
          if (c.training_enabled && !hadTraining.has(c.id)) missed.push('訓練')
          if (c.wellness_enabled && !hadWellness.has(c.id)) missed.push('感受')
          return missed.length > 0
        })
        if (missedClients.length > 0) {
          digestLines.push('📋 昨日未記錄：')
          for (const mc of missedClients.slice(0, 10)) {
            const missed: string[] = []
            if (mc.body_composition_enabled && !hadWeight.has(mc.id)) missed.push('體重')
            if (mc.nutrition_enabled && !hadNutrition.has(mc.id)) missed.push('飲食')
            if (mc.training_enabled && !hadTraining.has(mc.id)) missed.push('訓練')
            if (mc.wellness_enabled && !hadWellness.has(mc.id)) missed.push('感受')
            digestLines.push(`  • ${mc.name}：${missed.join('、')}`)
          }
        }

        // 2. Low energy or high RPE
        const lowEnergy = (yWellnessRes.data || []).filter((w: { client_id: string; energy_level: number | null }) => w.energy_level != null && w.energy_level <= 2)
        const highRPE = (yTrainingRes.data || []).filter((t: { client_id: string; rpe: number | null }) => t.rpe != null && t.rpe >= 9)
        if (lowEnergy.length > 0 || highRPE.length > 0) {
          digestLines.push('')
          digestLines.push('⚠️ 需關注：')
          for (const w of lowEnergy) {
            const name = clients.find(c => c.id === w.client_id)?.name || '未知'
            digestLines.push(`  • ${name}：精力 ${w.energy_level}/5`)
          }
          for (const t of highRPE) {
            const name = clients.find(c => c.id === t.client_id)?.name || '未知'
            digestLines.push(`  • ${name}：RPE ${t.rpe}`)
          }
        }

        // 3. Weight plateau alerts (>7 days no change ±0.2kg)
        const recentWeightsRes = await supabase
          .from('body_composition')
          .select('client_id, weight, date')
          .gte('date', new Date(Date.now() - 10 * DAY_MS).toISOString().split('T')[0])
          .order('date', { ascending: false })
        const weightsByClient: Record<string, number[]> = {}
        for (const w of (recentWeightsRes.data || [])) {
          if (w.weight == null) continue
          if (!weightsByClient[w.client_id]) weightsByClient[w.client_id] = []
          weightsByClient[w.client_id].push(w.weight)
        }
        const plateauClients: string[] = []
        for (const [cid, weights] of Object.entries(weightsByClient)) {
          if (weights.length >= 7) {
            const range = Math.max(...weights) - Math.min(...weights)
            if (range <= 0.2) {
              const name = clients.find(c => c.id === cid)?.name || '未知'
              plateauClients.push(name)
            }
          }
        }
        if (plateauClients.length > 0) {
          digestLines.push('')
          digestLines.push('📊 體重停滯（>7天 ±0.2kg）：')
          plateauClients.forEach(name => digestLines.push(`  • ${name}`))
        }

        // 4. Competition countdowns (<30 days)
        const { data: compClients } = await supabase
          .from('clients')
          .select('name, competition_date')
          .eq('is_active', true)
          .in('client_mode', ['bodybuilding', 'athletic'])
          .not('competition_date', 'is', null)
        const urgentComp = (compClients || []).filter((c: { name: string; competition_date: string }) => {
          const days = daysUntilDateTW(c.competition_date)
          return days > 0 && days <= 30
        })
        if (urgentComp.length > 0) {
          digestLines.push('')
          digestLines.push('🏆 備賽倒數：')
          for (const cc of urgentComp) {
            const days = daysUntilDateTW(cc.competition_date)
            digestLines.push(`  • ${cc.name}：${days} 天`)
          }
        }

        // Only send if there are actionable items
        if (digestLines.length > 0) {
          const header = `☀️ 教練晨報 ${today}\n\n`
          const digestText = header + digestLines.join('\n')
          await pushMessage(coachLineId, [{ type: 'text', text: digestText }])
          logger.info(`Coach digest sent: ${digestLines.length} lines`)
        }
      } catch (err) {
        logger.error('Coach digest error:', err)
        errors.push(`Coach digest: ${(err as Error).message || 'unknown'}`)
      }
    }
  } else {
    // ── 晚上提醒：填寫今日紀錄（Web Push 優先）──
    const [wellnessRes, nutritionRes, trainingRes] = await Promise.all([
      supabase.from('daily_wellness').select('client_id').eq('date', today),
      supabase.from('nutrition_logs').select('client_id').eq('date', today),
      supabase.from('training_logs').select('client_id').eq('date', today),
    ])

    const hasWellness = new Set((wellnessRes.data || []).map((w: { client_id: string }) => w.client_id))
    const hasNutrition = new Set((nutritionRes.data || []).map((n: { client_id: string }) => n.client_id))
    const hasTraining = new Set((trainingRes.data || []).map((t: { client_id: string }) => t.client_id))

    const eveningTargets: { client: typeof clients[0]; missing: string[]; missingShort: string[] }[] = []
    for (const client of clients) {
      const missing: string[] = []
      const missingShort: string[] = []
      if (client.wellness_enabled && !hasWellness.has(client.id)) {
        missing.push('• 身心狀態 → 輸入「身心 4 3 4」')
        missingShort.push('身心狀態')
      }
      if (client.nutrition_enabled && !hasNutrition.has(client.id)) {
        missing.push('• 飲食紀錄 → 輸入「達標」或「未達標」')
        missingShort.push('飲食紀錄')
      }
      if (client.training_enabled && !hasTraining.has(client.id)) {
        missing.push('• 訓練紀錄 → 輸入「訓練 推 60分鐘」')
        missingShort.push('訓練紀錄')
      }
      if (missing.length > 0) eveningTargets.push({ client, missing, missingShort })
    }

    for (let i = 0; i < eveningTargets.length; i += 5) {
      const batch = eveningTargets.slice(i, i + 5)
      const results = await Promise.allSettled(
        batch.map(({ client, missing, missingShort }) =>
          sendRoutineReminder(client.id, client.line_user_id, {
            title: `🌙 還有 ${missing.length} 項沒記錄`,
            body: `缺少：${missingShort.join('、')}`,
            lineText: [
              `🌙 ${client.name}，今天還有 ${missing.length} 項沒記錄：\n`,
              ...missing,
              '\n回覆指令就能快速完成 ✌️',
            ].join('\n'),
            url: `${siteUrl}/dashboard`,
          })
        )
      )
      results.forEach((result, idx) => {
        if (result.status === 'fulfilled') {
          const r = result.value
          if (r.success) {
            sent++
            if (r.method === 'web_push') webPushUsed++
            else linePushUsed++
          }
        } else {
          errors.push(`${batch[idx].client.name}: ${result.reason?.message || 'unknown'}`)
        }
      })
    }
  }

  // ===== 到期提醒（每日檢查，早上執行一次就好）=====
  // 到期前 7/3/1 天 + 到期當天 → LINE 通知自動扣款時間
  let expiryReminders = 0
  if (isMorning) {
    const { data: allClients } = await supabase
      .from('clients')
      .select('id, name, line_user_id, unique_code, expires_at, subscription_tier')
      .eq('is_active', true)
      .not('line_user_id', 'is', null)
      .not('expires_at', 'is', null)

    if (allClients) {
      const now = new Date()

      for (const c of allClients) {
        if (!c.expires_at || c.subscription_tier === 'free') continue
        const expiresAt = new Date(c.expires_at)
        const daysLeft = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

        if (daysLeft === 7 || daysLeft === 3 || daysLeft === 1 || daysLeft === 0) {
          try {
            const expiryMsg = daysLeft === 0
              ? `${c.name}，你的方案今天自動續訂扣款。\n\n扣款成功後會自動延長一個月，無需手動操作。\n\n如需取消，請至儀表板設定頁面操作。`
              : `${c.name}，你的方案將在 ${daysLeft} 天後自動續訂。\n\n系統會自動從信用卡扣款，不需手動操作。\n如需取消自動扣款，請至儀表板右上角設定。`
            await pushMessage(c.line_user_id, [{ type: 'text', text: expiryMsg }])
            expiryReminders++
          } catch (err: unknown) {
            errors.push(`expiry_${c.name}: ${err instanceof Error ? err.message : String(err)}`)
          }
        }
      }
    }
  }

  // ===== 免費用戶里程碑推播（第 3/7/14 天）=====
  let milestonesSent = 0
  if (isMorning) {
    const { data: freeClients } = await supabase
      .from('clients')
      .select('id, name, line_user_id, created_at, subscription_tier')
      .eq('is_active', true)
      .eq('subscription_tier', 'free')
      .not('line_user_id', 'is', null)

    if (freeClients) {
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://howard456.vercel.app'
      const now = new Date()

      for (const c of freeClients) {
        const daysSinceJoin = Math.floor((now.getTime() - new Date(c.created_at).getTime()) / (1000 * 60 * 60 * 24))

        let milestoneMsg: string | null = null

        if (daysSinceJoin === 3) {
          milestoneMsg = `${c.name}，你已經記錄 3 天了 👍\n\n持續記錄的人，減脂成功率是沒記錄的 2 倍——你已經在對的路上了。\n\n💡 每天量完體重直接輸入「體重 XX」就好，10 秒搞定。`
        } else if (daysSinceJoin === 7) {
          milestoneMsg = `${c.name}，一週了！你的數據已經開始有趨勢了 📈\n\n你目前用的是免費版，已經可以追蹤體重和飲食。\n\n不過如果你想知道「我的進度到底正不正常」「該不該調整」，升級後 AI 會根據你這一週的真實數據幫你判斷，不是給你網路上的通用建議。\n\n👉 看看差在哪：${siteUrl}/upgrade?from=free`
        } else if (daysSinceJoin === 14) {
          milestoneMsg = `${c.name}，兩週了，你的數據量已經蠻有參考價值了 📊\n\n如果你有時候會不確定自己的方向對不對——升級後可以直接問 AI，它看得到你所有的紀錄，會根據趨勢給你具體建議。\n\n👉 ${siteUrl}/upgrade?from=free\n\n有問題也可以直接問我！`
        }

        if (milestoneMsg) {
          try {
            await pushMessage(c.line_user_id, [{ type: 'text', text: milestoneMsg }])
            milestonesSent++
          } catch (err: unknown) {
            errors.push(`milestone_${c.name}: ${err instanceof Error ? err.message : String(err)}`)
          }
        }
      }
    }
  }

  // ===== Email Drip Sequence（早上執行）=====
  // Day 3 / Day 7 / Day 14（免費用戶）/ Win-back / Expiry warning emails
  let emailDripSent = 0
  let emailDripFailed = 0
  if (isMorning) {
    const now = new Date()

    // Helper: get email for a client from subscription_purchases (most recent completed)
    const getClientEmail = async (clientId: string): Promise<string | null> => {
      const { data } = await supabase
        .from('subscription_purchases')
        .select('email')
        .eq('client_id', clientId)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      return data?.email || null
    }

    // Helper: compute days since a date (integer, floor)
    const daysSince = (dateStr: string): number => {
      return Math.floor((now.getTime() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24))
    }

    // Helper: compute days until a date (integer, ceil)
    const daysUntil = (dateStr: string): number => {
      return Math.ceil((new Date(dateStr).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    }

    // ── a) Day 3 email: active clients created exactly 3 days ago ──
    {
      const { data: day3Clients } = await supabase
        .from('clients')
        .select('id, name, unique_code, created_at')
        .eq('is_active', true)

      if (day3Clients) {
        for (const c of day3Clients) {
          if (daysSince(c.created_at) !== 3) continue
          try {
            const email = await getClientEmail(c.id)
            if (!email) continue
            const result = await sendDay3Email({ to: email, name: c.name, uniqueCode: c.unique_code })
            if (result.success) emailDripSent++
            else emailDripFailed++
          } catch (err: unknown) {
            emailDripFailed++
            errors.push(`email_day3_${c.name}: ${err instanceof Error ? err.message : String(err)}`)
          }
        }
      }
    }

    // ── b) Day 7 email: active clients created exactly 7 days ago ──
    {
      const { data: day7Clients } = await supabase
        .from('clients')
        .select('id, name, unique_code, created_at')
        .eq('is_active', true)

      if (day7Clients) {
        for (const c of day7Clients) {
          if (daysSince(c.created_at) !== 7) continue
          try {
            const email = await getClientEmail(c.id)
            if (!email) continue
            const result = await sendDay7Email({ to: email, name: c.name, uniqueCode: c.unique_code })
            if (result.success) emailDripSent++
            else emailDripFailed++
          } catch (err: unknown) {
            emailDripFailed++
            errors.push(`email_day7_${c.name}: ${err instanceof Error ? err.message : String(err)}`)
          }
        }
      }
    }

    // ── c) Day 14 email: free users at day 14 who haven't upgraded ──
    {
      const { data: day14Clients } = await supabase
        .from('clients')
        .select('id, name, unique_code, created_at, subscription_tier')
        .eq('is_active', true)
        .eq('subscription_tier', 'free')

      if (day14Clients) {
        for (const c of day14Clients) {
          if (daysSince(c.created_at) !== 14) continue
          try {
            const email = await getClientEmail(c.id)
            if (!email) continue
            const result = await sendDay14Email({ to: email, name: c.name, uniqueCode: c.unique_code })
            if (result.success) emailDripSent++
            else emailDripFailed++
          } catch (err: unknown) {
            emailDripFailed++
            errors.push(`email_day14_${c.name}: ${err instanceof Error ? err.message : String(err)}`)
          }
        }
      }
    }

    // ── d) Win-back email: inactive clients whose expires_at was exactly 7 days ago ──
    {
      const { data: churnedClients } = await supabase
        .from('clients')
        .select('id, name, expires_at')
        .eq('is_active', false)
        .not('expires_at', 'is', null)

      if (churnedClients) {
        for (const c of churnedClients) {
          if (!c.expires_at || daysSince(c.expires_at) !== 7) continue
          try {
            const email = await getClientEmail(c.id)
            if (!email) continue
            const result = await sendWinBackEmail({ to: email, name: c.name })
            if (result.success) emailDripSent++
            else emailDripFailed++
          } catch (err: unknown) {
            emailDripFailed++
            errors.push(`email_winback_${c.name}: ${err instanceof Error ? err.message : String(err)}`)
          }
        }
      }
    }

    // ── e) Expiry warning email: paid clients expiring in 7/3/1 days ──
    {
      const { data: paidClients } = await supabase
        .from('clients')
        .select('id, name, subscription_tier, expires_at')
        .eq('is_active', true)
        .not('subscription_tier', 'eq', 'free')
        .not('expires_at', 'is', null)

      if (paidClients) {
        for (const c of paidClients) {
          if (!c.expires_at) continue
          const dl = daysUntil(c.expires_at)
          if (dl !== 7 && dl !== 3 && dl !== 1) continue
          try {
            const email = await getClientEmail(c.id)
            if (!email) continue
            const result = await sendExpiryWarningEmail({
              to: email,
              name: c.name,
              daysLeft: dl,
              tier: c.subscription_tier,
            })
            if (result.success) emailDripSent++
            else emailDripFailed++
          } catch (err: unknown) {
            emailDripFailed++
            errors.push(`email_expiry_${c.name}: ${err instanceof Error ? err.message : String(err)}`)
          }
        }
      }
    }

    logger.info('Email drip sequence completed', { sent: emailDripSent, failed: emailDripFailed })
  }

  // ===== Referral Reward Automation（早上執行）=====
  let referralsCompleted = 0
  let referralsExpired = 0
  if (isMorning) {
    const now = new Date()
    const sevenDaysAgoDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const thirtyDaysAgoDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    // Find all pending referrals created 7+ days ago
    const { data: pendingReferrals } = await supabase
      .from('referrals')
      .select('id, referrer_id, referee_id, created_at')
      .eq('status', 'pending')
      .lte('created_at', sevenDaysAgoDate.toISOString())

    if (pendingReferrals) {
      const sevenDaysAgoStr = sevenDaysAgoDate.toISOString().split('T')[0]

      for (const ref of pendingReferrals) {
        try {
          // Check if referee has been active: at least 3 records in body_data OR nutrition_logs in past 7 days
          const [bodyRes, nutritionRes] = await Promise.all([
            supabase
              .from('body_composition')
              .select('id', { count: 'exact', head: true })
              .eq('client_id', ref.referee_id)
              .gte('date', sevenDaysAgoStr),
            supabase
              .from('nutrition_logs')
              .select('id', { count: 'exact', head: true })
              .eq('client_id', ref.referee_id)
              .gte('date', sevenDaysAgoStr),
          ])

          const totalActivity = (bodyRes.count || 0) + (nutritionRes.count || 0)

          if (totalActivity >= 3) {
            // Referee is active — complete the referral and reward the referrer
            const { error: updateErr } = await supabase
              .from('referrals')
              .update({
                status: 'completed',
                completed_at: now.toISOString(),
                reward_applied: true,
              })
              .eq('id', ref.id)

            if (!updateErr) {
              // Extend referrer's expires_at by 7 days
              const { data: referrer } = await supabase
                .from('clients')
                .select('expires_at')
                .eq('id', ref.referrer_id)
                .single()

              let newExpiry: Date
              if (referrer?.expires_at && new Date(referrer.expires_at) > now) {
                // Extend from current expiry
                newExpiry = new Date(new Date(referrer.expires_at).getTime() + 7 * 24 * 60 * 60 * 1000)
              } else {
                // Set to now + 7 days if null or already past
                newExpiry = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
              }

              await supabase
                .from('clients')
                .update({ expires_at: newExpiry.toISOString() })
                .eq('id', ref.referrer_id)

              referralsCompleted++
              logger.info('Referral completed, reward applied', {
                referralId: ref.id,
                referrerId: ref.referrer_id,
                newExpiry: newExpiry.toISOString(),
              })
            }
          } else {
            // Check if 30+ days have passed since referral creation — expire it
            const referralCreatedAt = new Date(ref.created_at)
            if (referralCreatedAt <= thirtyDaysAgoDate) {
              await supabase
                .from('referrals')
                .update({ status: 'expired' })
                .eq('id', ref.id)

              referralsExpired++
              logger.info('Referral expired (inactive referee)', {
                referralId: ref.id,
                refereeId: ref.referee_id,
              })
            }
          }
        } catch (err: unknown) {
          errors.push(`referral_${ref.id}: ${err instanceof Error ? err.message : String(err)}`)
        }
      }
    }

    logger.info('Referral automation completed', { completed: referralsCompleted, expired: referralsExpired })
  }

  // ===== 智能警示推播（晚上執行）=====
  let smartAlertsSent = 0
  if (!isMorning) {
    // 取得過去 7 天數據做智能分析
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const sevenDaysStr = sevenDaysAgo.toISOString().split('T')[0]

    const [nutRes, wellRes, trainRes, bodyRes] = await Promise.all([
      supabase.from('nutrition_logs').select('client_id, date, calories, protein_grams, carbs_grams, fat_grams, compliant')
        .gte('date', sevenDaysStr).order('date'),
      supabase.from('daily_wellness').select('client_id, date, mood, energy_level, sleep_quality, hunger, stress_level')
        .gte('date', sevenDaysStr).order('date'),
      supabase.from('training_logs').select('client_id, date, training_type, duration, rpe')
        .gte('date', sevenDaysStr).order('date'),
      supabase.from('body_composition').select('client_id, date, weight, body_fat')
        .gte('date', sevenDaysStr).not('weight', 'is', null).order('date'),
    ])

    const allNut = nutRes.data || []
    const allWell = wellRes.data || []
    const allTrain = trainRes.data || []
    const allBody = bodyRes.data || []

    // 取得學員的目標設定
    const { data: allClientsFull } = await supabase
      .from('clients')
      .select('id, name, line_user_id, calories_target, protein_target, carbs_target, fat_target, goal_type, target_weight, gender')
      .eq('is_active', true)
      .not('line_user_id', 'is', null)

    if (allClientsFull) {
      for (const c of allClientsFull) {
        const clientProfile: ClientProfile = {
          name: c.name,
          gender: c.gender,
          goalType: c.goal_type,
          currentWeight: null,
          currentBodyFat: null,
          targetWeight: c.target_weight,
          caloriesTarget: c.calories_target,
          proteinTarget: c.protein_target,
          carbsTarget: c.carbs_target,
          fatTarget: c.fat_target,
        }

        const insightData: InsightData = {
          client: clientProfile,
          nutritionLogs: allNut.filter((n: { client_id: string }) => n.client_id === c.id),
          wellnessLogs: allWell.filter((w: { client_id: string }) => w.client_id === c.id),
          trainingLogs: allTrain.filter((t: { client_id: string }) => t.client_id === c.id),
          bodyLogs: allBody.filter((b: { client_id: string }) => b.client_id === c.id),
        }

        const alerts = generateSmartAlerts(insightData)
        // 只推送 warning 級別的警示，避免打擾
        const warnings = alerts.filter(a => a.severity === 'warning')

        if (warnings.length > 0) {
          const alertMsg = [
            `${c.name}，系統偵測到以下需注意事項：\n`,
            ...warnings.map(a => `${a.icon} ${a.title}\n${a.message}`),
          ].join('\n\n')

          try {
            await pushMessage(c.line_user_id, [{ type: 'text', text: alertMsg }])
            smartAlertsSent++
          } catch (err: unknown) {
            errors.push(`alert_${c.name}: ${err instanceof Error ? err.message : String(err)}`)
          }
        }
      }
    }
  }

  // ===== 付費帳號到期自動降級（早上執行）=====
  let downgradedCount = 0
  if (isMorning) {
    const { data: expiredClients } = await supabase
      .from('clients')
      .select('id, name, line_user_id, subscription_tier, expires_at')
      .eq('is_active', true)
      .not('subscription_tier', 'eq', 'free')
      .not('expires_at', 'is', null)

    if (expiredClients) {
      const now = new Date()
      for (const c of expiredClients) {
        if (!c.expires_at) continue
        const expiresAt = new Date(c.expires_at)
        if (expiresAt < now) {
          // 降級為免費方案
          const freeFeatures = getDefaultFeatures('free')
          const { error: downgradeErr } = await supabase
            .from('clients')
            .update({
              subscription_tier: 'free',
              ...freeFeatures,
            })
            .eq('id', c.id)

          if (downgradeErr) {
            errors.push(`降級失敗 [${c.name}]: ${downgradeErr.message}`)
          } else {
            downgradedCount++
            logger.info('帳號已降級為免費', { clientName: c.name, previousTier: c.subscription_tier })

            // 通知用戶 + 切回行銷版 Rich Menu
            if (c.line_user_id) {
              const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://howard456.vercel.app'
              try {
                await unlinkRichMenuFromUser(c.line_user_id)
                await pushMessage(c.line_user_id, [{
                  type: 'text',
                  text: `${c.name}，你的方案已到期，帳號已切換為免費版。\n\n免費版仍可使用體重追蹤和飲食達標紀錄。\n\n想繼續使用完整功能？\n👉 ${siteUrl}/remote\n\n你之前的數據都完整保留，重新訂閱後立即恢復。`,
                }])
              } catch (err: unknown) {
                errors.push(`降級通知失敗 [${c.name}]: ${err instanceof Error ? err.message : String(err)}`)
              }
            }
          }
        }
      }
    }
  }

  // ===== 沉默用戶偵測 + 再喚醒（晚上執行）=====
  let reengagementSent = 0
  if (!isMorning) {
    const threeDaysAgo = new Date()
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)
    const threeDaysStr = threeDaysAgo.toISOString().split('T')[0]

    // 取得所有活躍且有 LINE 的學員
    const { data: activeClients } = await supabase
      .from('clients')
      .select('id, name, line_user_id, subscription_tier')
      .eq('is_active', true)
      .not('line_user_id', 'is', null)

    if (activeClients) {
      // 查詢過去 3 天所有紀錄
      const [recentBody, recentNutrition, recentWellness] = await Promise.all([
        supabase.from('body_composition').select('client_id').gte('date', threeDaysStr),
        supabase.from('nutrition_logs').select('client_id').gte('date', threeDaysStr),
        supabase.from('daily_wellness').select('client_id').gte('date', threeDaysStr),
      ])

      const activeClientIds = new Set([
        ...(recentBody.data || []).map((r: { client_id: string }) => r.client_id),
        ...(recentNutrition.data || []).map((r: { client_id: string }) => r.client_id),
        ...(recentWellness.data || []).map((r: { client_id: string }) => r.client_id),
      ])

      const silentClients = activeClients.filter(c => !activeClientIds.has(c.id))

      for (const c of silentClients) {
        try {
          await pushMessage(c.line_user_id, [{
            type: 'text',
            text: `${c.name}，好幾天沒看到你了 👋\n\n不需要完美，只要持續記錄。\n今天花 10 秒記一筆體重就好：\n\n輸入「體重 XX.X」即可 ✌️`,
          }])
          reengagementSent++
        } catch (err: unknown) {
          errors.push(`再喚醒失敗 [${c.name}]: ${err instanceof Error ? err.message : String(err)}`)
        }
      }
    }
  }

  // ===== Garmin OAuth 狀態清理（早上執行）=====
  let garminStatesCleared = 0
  if (isMorning) {
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
      const { error: cleanupErr } = await supabase
        .from('garmin_oauth_states')
        .delete()
        .lt('created_at', oneHourAgo)
      if (!cleanupErr) {
        logger.info('Cleaned up expired Garmin OAuth states')
      }
    } catch (err) {
      errors.push(`garmin_cleanup: ${(err as Error).message || 'unknown'}`)
    }
  }

  const responseData = {
    success: errors.length === 0,
    type: isMorning ? 'morning' : 'evening',
    sent,
    webPushUsed,
    linePushUsed,
    expiryReminders,
    milestonesSent,
    emailDripSent,
    emailDripFailed,
    referralsCompleted,
    referralsExpired,
    smartAlertsSent,
    downgradedCount,
    reengagementSent,
    garminStatesCleared,
    errors,
  }

  // 通知教練 cron 錯誤
  if (errors.length > 0) {
    const coachLineId = process.env.COACH_LINE_USER_ID
    if (coachLineId) {
      const errorSummary = [
        `⚠️ 排程執行有 ${errors.length} 個錯誤：`,
        '',
        ...errors.slice(0, 5).map(e => `• ${e}`),
        ...(errors.length > 5 ? [`...還有 ${errors.length - 5} 個錯誤`] : []),
      ].join('\n')
      pushMessage(coachLineId, [{ type: 'text', text: errorSummary }]).catch(err => {
        logger.error('Failed to notify coach about cron errors', err)
      })
    }
  }

  // 寫入 cron_runs
  if (errors.length === 0) {
    await completeCronRun(runId, responseData)
  } else {
    await failCronRun(runId, errors.join('; '), responseData)
  }

  return NextResponse.json(responseData)
}
