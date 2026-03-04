/**
 * Weekly Cron Job — 每週自動執行
 *
 * 功能：
 * 1. Health Mode 90 天季度自動重置
 * 2. 為所有活躍學員生成本週營養分析摘要
 * 3. 產生教練端通知（alerts 彙整）
 *
 * 排程：Vercel Cron — 每週日 08:00 UTC (台灣時間 16:00)
 * 驗證：CRON_SECRET header 或 admin session
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase'
import { generateNutritionSuggestion, NutritionInput } from '@/lib/nutrition-engine'
import { verifyAdminSession } from '@/lib/auth-middleware'

const supabase = createServiceSupabase()

function verifyCronAuth(request: NextRequest): boolean {
  // Vercel Cron 會帶 CRON_SECRET header
  const cronSecret = request.headers.get('authorization')
  if (cronSecret === `Bearer ${process.env.CRON_SECRET}`) return true

  // 也允許 admin session 手動觸發
  const token = request.cookies.get('admin_session')?.value
  return !!token && verifyAdminSession(token)
}

export async function GET(request: NextRequest) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: '未授權' }, { status: 401 })
  }

  const results = {
    quarterlyResets: 0,
    analysisGenerated: 0,
    alertsGenerated: 0,
    errors: [] as string[],
  }

  try {
    // ── 1. 取得所有活躍學員 ──
    const { data: clients, error: clientErr } = await supabase
      .from('clients')
      .select('*')
      .eq('is_active', true)

    if (clientErr || !clients) {
      return NextResponse.json({ error: '無法取得學員資料', detail: clientErr?.message }, { status: 500 })
    }

    const today = new Date()
    const todayStr = today.toISOString().split('T')[0]

    // ── 2. Health Mode 90 天季度自動重置 ──
    for (const client of clients) {
      if (!client.health_mode_enabled || !client.quarterly_cycle_start) continue

      const start = new Date(client.quarterly_cycle_start)
      const elapsed = Math.floor((today.getTime() - start.getTime()) / 86400000)

      if (elapsed >= 90) {
        // 重置到今天，開始新的 90 天週期
        const { error } = await supabase
          .from('clients')
          .update({ quarterly_cycle_start: todayStr })
          .eq('id', client.id)

        if (error) {
          results.errors.push(`季度重置失敗 [${client.name}]: ${error.message}`)
        } else {
          results.quarterlyResets++
        }
      }
    }

    // ── 3. 為每位活躍學員生成本週營養分析摘要 ──
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(today.getDate() - 30)
    const sinceDate = thirtyDaysAgo.toISOString().split('T')[0]
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(today.getDate() - 7)
    const sevenDaysStr = sevenDaysAgo.toISOString().split('T')[0]
    const fourteenDaysAgo = new Date()
    fourteenDaysAgo.setDate(today.getDate() - 14)
    const fourteenStr = fourteenDaysAgo.toISOString().split('T')[0]

    // 批量查詢所有數據
    const [bodyRes, nutritionRes, trainingRes, wellnessRes] = await Promise.all([
      supabase
        .from('body_composition')
        .select('client_id, date, weight, height, body_fat')
        .gte('date', sinceDate)
        .not('weight', 'is', null)
        .order('date', { ascending: true }),
      supabase
        .from('nutrition_logs')
        .select('client_id, date, compliant, calories, protein_grams, carbs_grams, fat_grams')
        .gte('date', sinceDate)
        .order('date', { ascending: true }),
      supabase
        .from('training_logs')
        .select('client_id, date, training_type, rpe')
        .gte('date', sinceDate)
        .order('date', { ascending: true }),
      supabase
        .from('daily_wellness')
        .select('client_id, date, energy_level, training_drive, period_start, device_recovery_score, resting_hr, hrv, wearable_sleep_score, respiratory_rate')
        .gte('date', sinceDate)
        .order('date', { ascending: true }),
    ])

    const allBody = bodyRes.data || []
    const allNutrition = nutritionRes.data || []
    const allTraining = trainingRes.data || []
    const allWellness = wellnessRes.data || []

    // 查詢女性學員的經期記錄
    const femaleIds = clients.filter(c => c.gender === '女性').map(c => c.id)
    let periodMap: Record<string, string> = {}
    if (femaleIds.length > 0) {
      const sixtyDaysAgo = new Date()
      sixtyDaysAgo.setDate(today.getDate() - 60)
      const { data: periodData } = await supabase
        .from('daily_wellness')
        .select('client_id, date')
        .eq('period_start', true)
        .gte('date', sixtyDaysAgo.toISOString().split('T')[0])
        .in('client_id', femaleIds)
        .order('date', { ascending: false })

      if (periodData) {
        for (const p of periodData) {
          if (!periodMap[p.client_id]) periodMap[p.client_id] = p.date
        }
      }
    }

    const summaries: Array<{
      client_id: string
      week_of: string
      status: string
      summary: string
      suggested_calories: number | null
      suggested_protein: number | null
      suggested_carbs: number | null
      suggested_fat: number | null
      weekly_weight_change_rate: number | null
      refeed_suggested: boolean
      warnings: string[]
    }> = []

    for (const client of clients) {
      if (!client.nutrition_enabled && !client.body_composition_enabled) continue

      const clientBody = allBody.filter((b: any) => b.client_id === client.id)
      const clientNutrition = allNutrition.filter((n: any) => n.client_id === client.id)
      const clientTraining = allTraining.filter((t: any) => t.client_id === client.id)
      const clientWellness = allWellness.filter((w: any) => w.client_id === client.id)

      // 計算週均體重
      const weeklyWeights: { week: number; avgWeight: number }[] = []
      for (let w = 0; w < 4; w++) {
        const weekEnd = new Date(today)
        weekEnd.setDate(today.getDate() - w * 7)
        const weekStart = new Date(weekEnd)
        weekStart.setDate(weekEnd.getDate() - 6)
        const startStr = weekStart.toISOString().split('T')[0]
        const endStr = weekEnd.toISOString().split('T')[0]
        const weekWeights = clientBody
          .filter((b: any) => b.date >= startStr && b.date <= endStr)
          .map((b: any) => b.weight)
        if (weekWeights.length > 0) {
          const avg = weekWeights.reduce((a: number, b: number) => a + b, 0) / weekWeights.length
          weeklyWeights.push({ week: w, avgWeight: Math.round(avg * 100) / 100 })
        }
      }

      const latestWeight = clientBody.length > 0 ? clientBody[clientBody.length - 1].weight : null
      if (!latestWeight) continue

      const latestHeight = [...clientBody].reverse().find((b: any) => b.height != null)?.height ?? null
      const latestBodyFat = [...clientBody].reverse().find((b: any) => b.body_fat != null)?.body_fat ?? null

      // 飲食合規率
      const recentNutrition = clientNutrition.filter((l: any) => l.date >= fourteenStr && l.date <= todayStr)
      const compliantCount = recentNutrition.filter((l: any) => l.compliant).length
      const nutritionCompliance = recentNutrition.length > 0
        ? Math.round((compliantCount / recentNutrition.length) * 100) : 0

      const recentWithCalories = recentNutrition.filter((l: any) => l.calories != null)
      const avgDailyCalories = recentWithCalories.length > 0
        ? Math.round(recentWithCalories.reduce((s: number, l: any) => s + l.calories, 0) / recentWithCalories.length)
        : null

      const recentTraining = clientTraining.filter((l: any) => l.date >= fourteenStr && l.date <= todayStr && l.training_type !== 'rest')
      const trainingDaysPerWeek = Math.round(recentTraining.length / 2)

      try {
        const engineInput: NutritionInput = {
          gender: client.gender || '男性',
          bodyWeight: latestWeight,
          goalType: client.goal_type || 'cut',
          dietStartDate: client.diet_start_date || null,
          height: latestHeight,
          bodyFatPct: latestBodyFat,
          targetWeight: client.target_weight || null,
          targetDate: client.competition_date || client.target_date || null,
          currentCalories: client.calories_target || null,
          currentProtein: client.protein_target || null,
          currentCarbs: client.carbs_target || null,
          currentFat: client.fat_target || null,
          currentCarbsTrainingDay: client.carbs_training_day || null,
          currentCarbsRestDay: client.carbs_rest_day || null,
          carbsCyclingEnabled: !!(client.carbs_training_day && client.carbs_rest_day),
          weeklyWeights,
          nutritionCompliance,
          avgDailyCalories,
          trainingDaysPerWeek,
          prepPhase: client.prep_phase || undefined,
          activityProfile: client.activity_profile || undefined,
          recentWellness: clientWellness.map((w: any) => ({
            date: w.date,
            energy_level: w.energy_level ?? null,
            training_drive: w.training_drive ?? null,
            device_recovery_score: w.device_recovery_score ?? null,
            resting_hr: w.resting_hr ?? null,
            hrv: w.hrv ?? null,
            wearable_sleep_score: w.wearable_sleep_score ?? null,
            respiratory_rate: w.respiratory_rate ?? null,
          })),
          recentTrainingLogs: clientTraining
            .filter((t: any) => t.date >= sevenDaysStr)
            .map((t: any) => ({ date: t.date, rpe: t.rpe ?? null })),
          recentCarbsPerDay: clientNutrition
            .filter((n: any) => n.date >= sevenDaysStr)
            .map((n: any) => ({ date: n.date, carbs: n.carbs_grams ?? null })),
          lastPeriodDate: periodMap[client.id] || null,
        }

        const suggestion = generateNutritionSuggestion(engineInput)

        summaries.push({
          client_id: client.id,
          week_of: todayStr,
          status: suggestion.status,
          summary: suggestion.message,
          suggested_calories: suggestion.suggestedCalories ?? null,
          suggested_protein: suggestion.suggestedProtein ?? null,
          suggested_carbs: suggestion.suggestedCarbs ?? null,
          suggested_fat: suggestion.suggestedFat ?? null,
          weekly_weight_change_rate: suggestion.weeklyWeightChangeRate ?? null,
          refeed_suggested: suggestion.refeedSuggested,
          warnings: suggestion.warnings || [],
        })

        results.analysisGenerated++
      } catch (err: any) {
        results.errors.push(`分析失敗 [${client.name}]: ${err.message}`)
      }
    }

    // 批量寫入 weekly_summaries 表（如果存在）
    if (summaries.length > 0) {
      const { error: insertErr } = await supabase
        .from('weekly_summaries')
        .upsert(summaries, { onConflict: 'client_id,week_of' })

      if (insertErr) {
        console.warn('[cron/weekly] weekly_summaries 寫入失敗:', insertErr.message)
        results.errors.push(`weekly_summaries 寫入失敗: ${insertErr.message}`)
      }
    }

    // ── 4. 產生教練端通知摘要 ──
    const alertItems: string[] = []

    for (const client of clients) {
      // 體重停滯
      const bodyLogs = allBody.filter((b: any) => b.client_id === client.id && b.date >= fourteenStr)
      if (bodyLogs.length >= 4) {
        const weights = bodyLogs.map((b: any) => b.weight)
        if (Math.max(...weights) - Math.min(...weights) < 0.5) {
          alertItems.push(`${client.name}：體重近 14 天停滯`)
        }
      }

      // 飲食合規率低
      const nutLogs = allNutrition.filter((n: any) => n.client_id === client.id && n.date >= fourteenStr)
      const validNutLogs = nutLogs.filter((n: any) => n.compliant !== null)
      if (validNutLogs.length >= 5) {
        const rate = Math.round((validNutLogs.filter((n: any) => n.compliant).length / validNutLogs.length) * 100)
        if (rate < 60) alertItems.push(`${client.name}：飲食合規率僅 ${rate}%`)
      }

      // 能量連續偏低
      const wLogs = allWellness
        .filter((w: any) => w.client_id === client.id)
        .sort((a: any, b: any) => b.date.localeCompare(a.date))
        .slice(0, 3)
      if (wLogs.length >= 3 && wLogs.every((w: any) => w.energy_level <= 2)) {
        alertItems.push(`${client.name}：連續 3 天能量指數低`)
      }

      // Refeed 建議
      const summary = summaries.find(s => s.client_id === client.id)
      if (summary?.refeed_suggested) {
        alertItems.push(`${client.name}：建議安排 Refeed`)
      }

      // 季度週期到期
      if (client.health_mode_enabled && client.quarterly_cycle_start) {
        const elapsed = Math.floor((today.getTime() - new Date(client.quarterly_cycle_start).getTime()) / 86400000)
        if (elapsed >= 80 && elapsed < 90) {
          alertItems.push(`${client.name}：季度週期剩餘 ${90 - elapsed} 天，提醒安排血檢`)
        }
      }
    }

    results.alertsGenerated = alertItems.length

    // 寫入 coach_notifications 表（如果存在）
    if (alertItems.length > 0) {
      const { error: notifErr } = await supabase
        .from('coach_notifications')
        .insert({
          date: todayStr,
          type: 'weekly_digest',
          title: `每週摘要 — ${alertItems.length} 項需注意`,
          content: JSON.stringify(alertItems),
          read: false,
        })

      if (notifErr) {
        console.warn('[cron/weekly] coach_notifications 寫入失敗:', notifErr.message)
        results.errors.push(`coach_notifications 寫入失敗: ${notifErr.message}`)
      }
    }

    return NextResponse.json({
      success: results.errors.length === 0,
      timestamp: today.toISOString(),
      results,
      alerts: alertItems,
    })
  } catch (err: any) {
    console.error('[cron/weekly] 錯誤:', err)
    return NextResponse.json({ error: '執行失敗', detail: err.message }, { status: 500 })
  }
}
