import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { generateNutritionSuggestion, NutritionInput } from '@/lib/nutrition-engine'
import { verifyAdminSession } from '@/lib/auth-middleware'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

function getAdminSession(request: NextRequest): boolean {
  const token = request.cookies.get('admin_session')?.value
  return !!token && verifyAdminSession(token)
}

export async function GET(request: NextRequest) {
  if (!getAdminSession(request)) {
    return NextResponse.json({ error: '未授權' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const clientId = searchParams.get('clientId')
  if (!clientId) {
    return NextResponse.json({ error: '缺少 clientId' }, { status: 400 })
  }

  try {
    // 1. 取得學員資料
    const { data: client, error: clientErr } = await supabase
      .from('clients')
      .select('*')
      .eq('id', clientId)
      .single()

    if (clientErr || !client) {
      return NextResponse.json({ error: '找不到學員' }, { status: 404 })
    }

    // 2. 取得近 30 天體組成數據
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const sinceDate = thirtyDaysAgo.toISOString().split('T')[0]

    const [bodyRes, nutritionRes, trainingRes] = await Promise.all([
      supabase
        .from('body_composition')
        .select('date, weight')
        .eq('client_id', clientId)
        .gte('date', sinceDate)
        .not('weight', 'is', null)
        .order('date', { ascending: true }),
      supabase
        .from('nutrition_logs')
        .select('date, compliant, calories, protein_grams, carbs_grams, fat_grams')
        .eq('client_id', clientId)
        .gte('date', sinceDate)
        .order('date', { ascending: true }),
      supabase
        .from('training_logs')
        .select('date, training_type')
        .eq('client_id', clientId)
        .gte('date', sinceDate)
        .order('date', { ascending: true }),
    ])

    const bodyData = bodyRes.data || []
    const nutritionLogs = nutritionRes.data || []
    const trainingLogs = trainingRes.data || []

    // 3. 計算週均體重 (最多 4 週)
    const today = new Date()
    const weeklyWeights: { week: number; avgWeight: number }[] = []

    for (let w = 0; w < 4; w++) {
      const weekEnd = new Date(today)
      weekEnd.setDate(today.getDate() - w * 7)
      const weekStart = new Date(weekEnd)
      weekStart.setDate(weekEnd.getDate() - 6)
      const startStr = weekStart.toISOString().split('T')[0]
      const endStr = weekEnd.toISOString().split('T')[0]

      const weekWeights = bodyData
        .filter((b: any) => b.date >= startStr && b.date <= endStr && b.weight != null)
        .map((b: any) => b.weight)

      if (weekWeights.length > 0) {
        const avg = weekWeights.reduce((a: number, b: number) => a + b, 0) / weekWeights.length
        weeklyWeights.push({ week: w, avgWeight: Math.round(avg * 100) / 100 })
      }
    }

    // 4. 計算飲食合規率 (近 14 天)
    const fourteenDaysAgo = new Date()
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 13)
    const fourteenStr = fourteenDaysAgo.toISOString().split('T')[0]
    const todayStr = today.toISOString().split('T')[0]

    const recentNutrition = nutritionLogs.filter((l: any) => l.date >= fourteenStr && l.date <= todayStr)
    const compliantCount = recentNutrition.filter((l: any) => l.compliant).length
    const nutritionCompliance = recentNutrition.length > 0
      ? Math.round((compliantCount / recentNutrition.length) * 100)
      : 0

    // 5. 計算平均每日攝取熱量 (近 14 天有記錄的日子)
    const recentWithCalories = recentNutrition.filter((l: any) => l.calories != null)
    const avgDailyCalories = recentWithCalories.length > 0
      ? Math.round(recentWithCalories.reduce((s: number, l: any) => s + l.calories, 0) / recentWithCalories.length)
      : null

    // 6. 計算每週訓練天數 (近 14 天)
    const recentTraining = trainingLogs.filter((l: any) => l.date >= fourteenStr && l.date <= todayStr && l.training_type !== 'rest')
    const trainingDaysPerWeek = Math.round(recentTraining.length / 2)  // 14 天 ÷ 2

    // 7. 當前體重 (最新紀錄)
    const latestWeight = bodyData.length > 0 ? bodyData[bodyData.length - 1].weight : null

    if (!latestWeight) {
      return NextResponse.json({
        suggestion: {
          status: 'insufficient_data',
          statusLabel: '數據不足',
          statusEmoji: '📊',
          message: '找不到體重紀錄，請讓學員先記錄體重。',
          warnings: [],
        }
      })
    }

    // 8. 組裝引擎輸入
    const engineInput: NutritionInput = {
      gender: client.gender || '男性',
      bodyWeight: latestWeight,
      goalType: client.goal_type || 'cut',
      dietStartDate: client.diet_start_date || null,
      targetWeight: client.target_weight || null,
      targetDate: client.competition_date || null,
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
    }

    // 9. 執行引擎
    const suggestion = generateNutritionSuggestion(engineInput)

    // 10. 自動套用：如果引擎說 autoApply 且有調整
    const autoApply = searchParams.get('autoApply') === 'true'
    let applied = false
    if (autoApply && suggestion.autoApply) {
      const updates: Record<string, any> = {}
      if (suggestion.suggestedCalories != null) updates.calories_target = suggestion.suggestedCalories
      if (suggestion.suggestedProtein != null) updates.protein_target = suggestion.suggestedProtein
      if (suggestion.suggestedCarbs != null) updates.carbs_target = suggestion.suggestedCarbs
      if (suggestion.suggestedFat != null) updates.fat_target = suggestion.suggestedFat
      if (suggestion.suggestedCarbsTrainingDay != null) updates.carbs_training_day = suggestion.suggestedCarbsTrainingDay
      if (suggestion.suggestedCarbsRestDay != null) updates.carbs_rest_day = suggestion.suggestedCarbsRestDay

      if (Object.keys(updates).length > 0) {
        const { error: updateErr } = await supabase
          .from('clients')
          .update(updates)
          .eq('id', clientId)

        if (!updateErr) {
          applied = true
        }
      }
    }

    return NextResponse.json({
      suggestion,
      applied,
      meta: {
        latestWeight,
        weeklyWeights,
        nutritionCompliance,
        avgDailyCalories,
        trainingDaysPerWeek,
        goalType: client.goal_type || 'cut',
        dietStartDate: client.diet_start_date || null,
        targetWeight: client.target_weight || null,
        targetDate: client.competition_date || null,
      }
    })
  } catch (err) {
    console.error('Nutrition suggestion error:', err)
    return NextResponse.json({ error: '分析失敗' }, { status: 500 })
  }
}
