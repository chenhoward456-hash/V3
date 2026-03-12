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
import { pushMessage, unlinkRichMenuFromUser } from '@/lib/line'
import { sendRoutineReminder } from '@/lib/notify'
import { sendPushNotification } from '@/lib/web-push'
import { verifyAdminSession } from '@/lib/auth-middleware'
import { generateSmartAlerts, type InsightData, type ClientProfile } from '@/lib/ai-insights'
import { createLogger } from '@/lib/logger'
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
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://howardprotocol.com'

  if (isMorning) {
    // ── 早上提醒：量體重（僅 Web Push，不消耗 LINE 額度）──
    const { data: todayWeights } = await supabase
      .from('body_composition')
      .select('client_id')
      .eq('date', today)

    const hasWeight = new Set((todayWeights || []).map((w: any) => w.client_id))
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
  } else {
    // ── 晚上提醒：填寫今日紀錄（Web Push 優先）──
    const [wellnessRes, nutritionRes, trainingRes] = await Promise.all([
      supabase.from('daily_wellness').select('client_id').eq('date', today),
      supabase.from('nutrition_logs').select('client_id').eq('date', today),
      supabase.from('training_logs').select('client_id').eq('date', today),
    ])

    const hasWellness = new Set((wellnessRes.data || []).map((w: any) => w.client_id))
    const hasNutrition = new Set((nutritionRes.data || []).map((n: any) => n.client_id))
    const hasTraining = new Set((trainingRes.data || []).map((t: any) => t.client_id))

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
          } catch (err: any) {
            errors.push(`expiry_${c.name}: ${err.message}`)
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
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://howardprotocol.com'
      const now = new Date()

      for (const c of freeClients) {
        const daysSinceJoin = Math.floor((now.getTime() - new Date(c.created_at).getTime()) / (1000 * 60 * 60 * 24))

        let milestoneMsg: string | null = null

        if (daysSinceJoin === 3) {
          milestoneMsg = `👋 ${c.name}，加入 3 天了！\n\n你知道嗎？持續記錄體重的人，減脂成功率提高 2 倍。\n\n💡 每天花 10 秒量體重，輸入「體重 XX」就能記錄。\n\n想要更完整的追蹤？\n👉 ${siteUrl}/join`
        } else if (daysSinceJoin === 7) {
          milestoneMsg = `🎯 ${c.name}，已經一週了！\n\n免費版可以追蹤體重和基本營養，但付費方案還能解鎖：\n• AI 飲食顧問（無限次）\n• 訓練紀錄追蹤\n• 身心狀態分析\n• 每週自動報告\n\n🔥 現在升級：${siteUrl}/join`
        } else if (daysSinceJoin === 14) {
          milestoneMsg = `📊 ${c.name}，兩週了！\n\n如果你覺得記錄有幫助，升級方案可以讓教練幫你看數據、調整計畫。\n\n很多學員在這個階段升級後，進步速度明顯加快 💪\n\n👉 了解方案：${siteUrl}/join\n\n有任何問題都可以直接問我！`
        }

        if (milestoneMsg) {
          try {
            await pushMessage(c.line_user_id, [{ type: 'text', text: milestoneMsg }])
            milestonesSent++
          } catch (err: any) {
            errors.push(`milestone_${c.name}: ${err.message}`)
          }
        }
      }
    }
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
          nutritionLogs: allNut.filter((n: any) => n.client_id === c.id),
          wellnessLogs: allWell.filter((w: any) => w.client_id === c.id),
          trainingLogs: allTrain.filter((t: any) => t.client_id === c.id),
          bodyLogs: allBody.filter((b: any) => b.client_id === c.id),
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
          } catch (err: any) {
            errors.push(`alert_${c.name}: ${err.message}`)
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
              const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://howardprotocol.com'
              try {
                await unlinkRichMenuFromUser(c.line_user_id)
                await pushMessage(c.line_user_id, [{
                  type: 'text',
                  text: `${c.name}，你的方案已到期，帳號已切換為免費版。\n\n免費版仍可使用體重追蹤和飲食達標紀錄。\n\n想繼續使用完整功能？\n👉 ${siteUrl}/remote\n\n你之前的數據都完整保留，重新訂閱後立即恢復。`,
                }])
              } catch (err: any) {
                errors.push(`降級通知失敗 [${c.name}]: ${err.message}`)
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
        ...(recentBody.data || []).map((r: any) => r.client_id),
        ...(recentNutrition.data || []).map((r: any) => r.client_id),
        ...(recentWellness.data || []).map((r: any) => r.client_id),
      ])

      const silentClients = activeClients.filter(c => !activeClientIds.has(c.id))

      for (const c of silentClients) {
        try {
          await pushMessage(c.line_user_id, [{
            type: 'text',
            text: `${c.name}，好幾天沒看到你了 👋\n\n不需要完美，只要持續記錄。\n今天花 10 秒記一筆體重就好：\n\n輸入「體重 XX.X」即可 ✌️`,
          }])
          reengagementSent++
        } catch (err: any) {
          errors.push(`再喚醒失敗 [${c.name}]: ${err.message}`)
        }
      }
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
    smartAlertsSent,
    downgradedCount,
    reengagementSent,
    errors,
  }

  // 寫入 cron_runs
  if (errors.length === 0) {
    await completeCronRun(runId, responseData)
  } else {
    await failCronRun(runId, errors.join('; '), responseData)
  }

  return NextResponse.json(responseData)
}
