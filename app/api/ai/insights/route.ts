/**
 * AI 洞察 API
 * GET /api/ai/insights?clientId={unique_code}&type={type}
 *
 * type:
 *   - weekly-report: AI 每週週報
 *   - dietary-patterns: 飲食模式洞察
 *   - trend-prediction: AI 趨勢預測
 *   - training-advice: 訓練量建議
 *   - meal-suggestion: AI 菜單建議
 *   - lab-comparison: 血檢趨勢對比
 *   - smart-alerts: 智能警示
 *   - all: 所有非 AI 洞察（patterns + prediction + training + alerts）
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase'
import { rateLimit, getClientIP } from '@/lib/auth-middleware'
import {
  generateWeeklyAIReport,
  analyzeDietaryPatterns,
  predictTrend,
  getTrainingAdvice,
  generateMealSuggestion,
  compareLabResults,
  generateLabComparisonSummary,
  generateSmartAlerts,
  type InsightData,
  type ClientProfile,
} from '@/lib/ai-insights'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const ip = getClientIP(request)
  const { allowed } = rateLimit(`ai-insights:${ip}`, 20, 60_000)
  if (!allowed) {
    return NextResponse.json({ error: '請求過於頻繁，請稍後再試' }, { status: 429 })
  }

  const { searchParams } = new URL(request.url)
  const clientId = searchParams.get('clientId')
  const type = searchParams.get('type') || 'all'

  if (!clientId) {
    return NextResponse.json({ error: '缺少 clientId' }, { status: 400 })
  }

  const supabase = createServiceSupabase()

  // 驗證客戶
  const { data: client, error: clientErr } = await supabase
    .from('clients')
    .select('id, name, gender, goal_type, target_weight, is_active, expires_at, ai_chat_enabled, calories_target, protein_target, carbs_target, fat_target, water_target')
    .eq('unique_code', clientId)
    .single()

  if (clientErr || !client) {
    return NextResponse.json({ error: '無效的客戶 ID' }, { status: 401 })
  }

  if (!client.is_active) {
    return NextResponse.json({ error: '帳號已暫停' }, { status: 403 })
  }

  if (client.expires_at && new Date(client.expires_at) < new Date()) {
    return NextResponse.json({ error: '帳號已過期' }, { status: 403 })
  }

  try {
    // 取得數據（最近 30 天）
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const sinceDate = thirtyDaysAgo.toISOString().split('T')[0]

    const [nutritionRes, wellnessRes, trainingRes, bodyRes, labRes, wearableRes, suppRes] = await Promise.all([
      supabase.from('nutrition_logs').select('date, calories, protein_grams, carbs_grams, fat_grams, water_ml, compliant')
        .eq('client_id', client.id).gte('date', sinceDate).order('date'),
      supabase.from('daily_wellness').select('date, mood, energy_level, sleep_quality, hunger, stress, digestion')
        .eq('client_id', client.id).gte('date', sinceDate).order('date'),
      supabase.from('training_logs').select('date, training_type, duration_minutes, rpe, note')
        .eq('client_id', client.id).gte('date', sinceDate).order('date'),
      supabase.from('body_composition').select('date, weight, body_fat')
        .eq('client_id', client.id).gte('date', sinceDate).not('weight', 'is', null).order('date'),
      supabase.from('lab_results').select('date, test_name, value, unit, status')
        .eq('client_id', client.id).order('date'),
      supabase.from('daily_wellness').select('date, hrv, resting_hr, device_recovery_score, wearable_sleep_score')
        .eq('client_id', client.id).gte('date', sinceDate).not('hrv', 'is', null).order('date'),
      supabase.from('supplements').select('name, dosage, timing').eq('client_id', client.id),
    ])

    const nutritionLogs = nutritionRes.data || []
    const wellnessLogs = wellnessRes.data || []
    const trainingLogs = trainingRes.data || []
    const bodyLogs = bodyRes.data || []
    const labResults = (labRes.data || []) as any[]
    const wearableData = wearableRes.data || []

    const latestBody = bodyLogs.length > 0 ? bodyLogs[bodyLogs.length - 1] : null

    const clientProfile: ClientProfile = {
      name: client.name,
      gender: client.gender,
      goalType: client.goal_type,
      currentWeight: latestBody?.weight ?? null,
      currentBodyFat: latestBody?.body_fat ?? null,
      targetWeight: client.target_weight,
      caloriesTarget: client.calories_target,
      proteinTarget: client.protein_target,
      carbsTarget: client.carbs_target,
      fatTarget: client.fat_target,
    }

    const insightData: InsightData = {
      client: clientProfile,
      nutritionLogs,
      wellnessLogs,
      trainingLogs,
      bodyLogs,
      labResults,
      wearableData,
      supplements: suppRes.data || [],
    }

    const result: Record<string, any> = {}

    // 非 AI 功能（不耗 API）— 即時計算
    if (type === 'all' || type === 'dietary-patterns') {
      result.dietaryPatterns = analyzeDietaryPatterns(nutritionLogs, {
        calories: client.calories_target,
        protein: client.protein_target,
        carbs: client.carbs_target,
        fat: client.fat_target,
        water: client.water_target,
      })
    }

    if (type === 'all' || type === 'trend-prediction') {
      result.trendPrediction = predictTrend(bodyLogs, client.target_weight, client.goal_type)
    }

    if (type === 'all' || type === 'training-advice') {
      result.trainingAdvice = getTrainingAdvice(wellnessLogs, trainingLogs, wearableData)
    }

    if (type === 'all' || type === 'smart-alerts') {
      result.smartAlerts = generateSmartAlerts(insightData)
    }

    if (type === 'all' || type === 'lab-comparison') {
      result.labComparisons = compareLabResults(labResults)
    }

    // AI 功能（耗 API call）— 僅在指定時才觸發
    if (type === 'weekly-report') {
      if (!process.env.ANTHROPIC_API_KEY) {
        return NextResponse.json({ error: 'AI 服務未設定' }, { status: 500 })
      }
      result.weeklyReport = await generateWeeklyAIReport(insightData)
    }

    if (type === 'lab-comparison-summary') {
      if (!process.env.ANTHROPIC_API_KEY) {
        return NextResponse.json({ error: 'AI 服務未設定' }, { status: 500 })
      }
      const comparisons = compareLabResults(labResults)
      result.labComparisons = comparisons
      result.labSummary = await generateLabComparisonSummary(comparisons)
    }

    if (type === 'meal-suggestion') {
      if (!process.env.ANTHROPIC_API_KEY) {
        return NextResponse.json({ error: 'AI 服務未設定' }, { status: 500 })
      }
      const mealType = (searchParams.get('meal') as any) || undefined
      const isTrainingDay = searchParams.get('training') === '1'

      // 計算今日剩餘
      const today = new Date().toISOString().split('T')[0]
      const todayNutrition = nutritionLogs.find(n => n.date === today)
      const remaining = {
        calories: Math.max(0, (client.calories_target ?? 2000) - (todayNutrition?.calories ?? 0)),
        protein: Math.max(0, (client.protein_target ?? 150) - (todayNutrition?.protein_grams ?? 0)),
        carbs: Math.max(0, (client.carbs_target ?? 200) - (todayNutrition?.carbs_grams ?? 0)),
        fat: Math.max(0, (client.fat_target ?? 60) - (todayNutrition?.fat_grams ?? 0)),
      }

      result.mealSuggestion = await generateMealSuggestion(remaining, { isTrainingDay, mealType })
    }

    return NextResponse.json(result)
  } catch (err: any) {
    console.error('[AI Insights Error]', err.message || err)
    return NextResponse.json({ error: 'AI 分析失敗' }, { status: 500 })
  }
}
