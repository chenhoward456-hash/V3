import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase'
import { generateNutritionSuggestion, NutritionInput } from '@/lib/nutrition-engine'
import { isWeightTraining } from '@/components/client/types'
import { verifyAdminSession } from '@/lib/auth-middleware'

const supabase = createServiceSupabase()

function getAdminSession(request: NextRequest): boolean {
  const token = request.cookies.get('admin_session')?.value
  return !!token && verifyAdminSession(token)
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const clientId = searchParams.get('clientId')
  const code = searchParams.get('code')
  if (!clientId) {
    return NextResponse.json({ error: '缺少 clientId' }, { status: 400 })
  }

  // autoApply: goal-driven 模式允許客戶端自動套用（與 body-composition 路由一致）
  // 其他模式仍需 admin 權限
  const isAdmin = getAdminSession(request)
  const wantsAutoApply = searchParams.get('autoApply') === 'true'

  // 驗證權限：admin session 或提供正確的 unique_code
  if (!isAdmin && !code) {
    return NextResponse.json({ error: '未授權' }, { status: 401 })
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

    // 非 admin 需驗證 unique_code 匹配
    if (!isAdmin && client.unique_code !== code) {
      return NextResponse.json({ error: '未授權' }, { status: 401 })
    }

    // 2. 取得近 30 天體組成數據
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const sinceDate = thirtyDaysAgo.toISOString().split('T')[0]

    // 近 7 天（Refeed 監控用）
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const sevenDaysStr = sevenDaysAgo.toISOString().split('T')[0]

    const [bodyRes, nutritionRes, trainingRes, wellnessRes] = await Promise.all([
      supabase
        .from('body_composition')
        .select('date, weight, height, body_fat')
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
        .select('date, training_type, rpe')
        .eq('client_id', clientId)
        .gte('date', sinceDate)
        .order('date', { ascending: true }),
      supabase
        .from('daily_wellness')
        .select('date, sleep_quality, energy_level, mood, cognitive_clarity, stress_level, training_drive, period_start, device_recovery_score, resting_hr, hrv, wearable_sleep_score, respiratory_rate')
        .eq('client_id', clientId)
        .gte('date', sinceDate)
        .order('date', { ascending: true }),
    ])

    const bodyData = bodyRes.data || []
    const nutritionLogs = nutritionRes.data || []
    const trainingLogs = trainingRes.data || []
    const wellnessLogs = wellnessRes.data || []

    // 2.5 查詢最近一次經期標記（60 天內，用於月經週期判斷）
    let lastPeriodDate: string | null = null
    if (client.gender === '女性') {
      const sixtyDaysAgo = new Date()
      sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60)
      const { data: periodData } = await supabase
        .from('daily_wellness')
        .select('date')
        .eq('client_id', clientId)
        .eq('period_start', true)
        .gte('date', sixtyDaysAgo.toISOString().split('T')[0])
        .order('date', { ascending: false })
        .limit(1)
      if (periodData && periodData.length > 0) {
        lastPeriodDate = periodData[0].date
      }
    }

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

    // 4. 計算飲食合規率 (近 14 天，含今天)
    const fourteenDayWindowStart = new Date()
    fourteenDayWindowStart.setDate(fourteenDayWindowStart.getDate() - 13) // 往前推 13 天 + 今天 = 14 天
    const fourteenStr = fourteenDayWindowStart.toISOString().split('T')[0]
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
    const recentTraining = trainingLogs.filter((l: any) => l.date >= fourteenStr && l.date <= todayStr && isWeightTraining(l.training_type))
    const trainingDaysPerWeek = Math.round(recentTraining.length / 2)  // 14 天 ÷ 2

    // 7. 當前體重 + 身體組成 (最新紀錄)
    const latestWeight = bodyData.length > 0 ? bodyData[bodyData.length - 1].weight : null
    // 取最新有值的身高和體脂率（不一定每筆都有）
    const latestHeight = [...bodyData].reverse().find((b: any) => b.height != null)?.height ?? null
    const latestBodyFat = [...bodyData].reverse().find((b: any) => b.body_fat != null)?.body_fat ?? null

    if (!latestWeight) {
      return NextResponse.json({
        suggestion: {
          status: 'insufficient_data',
          statusLabel: '開始記錄',
          statusEmoji: '👋',
          message: '記錄第一筆體重後，系統就能立即為你計算個人化營養目標。只需 30 秒！',
          warnings: [],
        }
      })
    }

    // 新用戶友善提示：有體重但營養記錄不足 14 天
    const isNewUser = recentNutrition.length < 7

    // 8. 組裝引擎輸入
    const engineInput: NutritionInput = {
      gender: client.gender || '男性',
      bodyWeight: latestWeight,
      goalType: client.goal_type || 'cut',
      dietStartDate: client.diet_start_date || null,
      height: latestHeight,
      bodyFatPct: latestBodyFat,
      targetWeight: client.target_weight || null,
      targetBodyFatPct: client.body_fat_target || null,
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
      activityProfile: (client.activity_profile as 'sedentary' | 'high_energy_flux') || undefined,
      recentWellness: wellnessLogs.map((w: any) => ({
        date: w.date,
        energy_level: w.energy_level ?? null,
        training_drive: w.training_drive ?? null,
        device_recovery_score: w.device_recovery_score ?? null,
        resting_hr: w.resting_hr ?? null,
        hrv: w.hrv ?? null,
        wearable_sleep_score: w.wearable_sleep_score ?? null,
        respiratory_rate: w.respiratory_rate ?? null,
      })),
      recentTrainingLogs: trainingLogs
        .filter((t: any) => t.date >= sevenDaysStr)
        .map((t: any) => ({
          date: t.date,
          rpe: t.rpe ?? null,
        })),
      recentCarbsPerDay: nutritionLogs
        .filter((n: any) => n.date >= sevenDaysStr)
        .map((n: any) => ({
          date: n.date,
          carbs: n.carbs_grams ?? null,
        })),
      lastPeriodDate,
    }

    // 9. 執行引擎
    const suggestion = generateNutritionSuggestion(engineInput)

    // 10. 自動套用：如果引擎說 autoApply 且有調整
    // goal-driven 模式允許客戶端自動套用（備賽選手需即時同步）
    // self_managed 訂閱用戶也允許自動套用（499 自主管理）
    // 其他模式仍需 admin 權限
    let applied = false
    const isSelfManaged = client.subscription_tier === 'self_managed'
    const canAutoApply = wantsAutoApply && suggestion.autoApply && (isAdmin || suggestion.status === 'goal_driven' || isSelfManaged)
    if (canAutoApply) {
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

    // 新用戶附加鼓勵訊息
    if (isNewUser && suggestion.status !== 'insufficient_data') {
      suggestion.message = `${suggestion.message}\n\n💡 你目前有 ${recentNutrition.length} 天的飲食紀錄。持續記錄 7 天以上，系統會給出更精準的調整建議。`
    }

    return NextResponse.json({
      suggestion,
      applied,
      isNewUser,
      meta: {
        latestWeight,
        weeklyWeights,
        nutritionCompliance,
        avgDailyCalories,
        trainingDaysPerWeek,
        goalType: client.goal_type || 'cut',
        dietStartDate: client.diet_start_date || null,
        targetWeight: client.target_weight || null,
        targetDate: client.competition_date || client.target_date || null,
      }
    })
  } catch {
    return NextResponse.json({ error: '分析失敗' }, { status: 500 })
  }
}
