import { NextRequest, NextResponse } from 'next/server'
import { createLogger } from '@/lib/logger'
import { createServiceSupabase } from '@/lib/supabase'
import { generateNutritionSuggestion, NutritionInput } from '@/lib/nutrition-engine'
import { isWeightTraining } from '@/components/client/types'
import { verifyAdminSession } from '@/lib/auth-middleware'
import { isCompetitionMode } from '@/lib/client-mode'

const logger = createLogger('api-nutrition-suggestions')

export const maxDuration = 60

const supabase = createServiceSupabase()

// DB 欄位 gene_depression_risk 可能是新格式 (LL/SL/SS) 或舊格式 (low/moderate/high)
function parseSerotoninField(value: string | null): { serotonin?: 'LL' | 'SL' | 'SS'; depressionRisk?: 'low' | 'moderate' | 'high' } {
  if (!value) return {}
  if (value === 'LL' || value === 'SL' || value === 'SS') return { serotonin: value }
  if (value === 'low' || value === 'moderate' || value === 'high') return { depressionRisk: value }
  return {}
}

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
      .eq('unique_code', clientId)
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

    // 月經週期查詢（女性用戶）— 合併到主查詢批次
    const sixtyDaysAgo = new Date()
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60)
    const sixtyDaysStr = sixtyDaysAgo.toISOString().split('T')[0]

    // 2.6 查詢補品依從率（近 8 週）
    const eightWeeksAgo = new Date()
    eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 56)
    const eightWeeksStr = eightWeeksAgo.toISOString().split('T')[0]

    // 所有查詢合併到一個 Promise.all，避免序列等待
    const [bodyRes, nutritionRes, trainingRes, wellnessRes, labRes, periodRes, suppLogsRes, suppListRes] = await Promise.all([
      supabase
        .from('body_composition')
        .select('date, weight, height, body_fat')
        .eq('client_id', client.id)
        .gte('date', sinceDate)
        .not('weight', 'is', null)
        .order('date', { ascending: true }),
      supabase
        .from('nutrition_logs')
        .select('date, compliant, calories, protein_grams, carbs_grams, fat_grams')
        .eq('client_id', client.id)
        .gte('date', sinceDate)
        .order('date', { ascending: true }),
      supabase
        .from('training_logs')
        .select('date, training_type, rpe, duration')
        .eq('client_id', client.id)
        .gte('date', sinceDate)
        .order('date', { ascending: true }),
      supabase
        .from('daily_wellness')
        .select('date, sleep_quality, energy_level, mood, cognitive_clarity, stress_level, training_drive, period_start, device_recovery_score, resting_hr, hrv, wearable_sleep_score, respiratory_rate')
        .eq('client_id', client.id)
        .gte('date', sinceDate)
        .order('date', { ascending: true }),
      supabase
        .from('lab_results')
        .select('test_name, value, unit, status, date')
        .eq('client_id', client.id)
        .order('date', { ascending: false })
        .limit(50),
      client.gender === '女性'
        ? supabase
            .from('daily_wellness')
            .select('date')
            .eq('client_id', client.id)
            .eq('period_start', true)
            .gte('date', sixtyDaysStr)
            .order('date', { ascending: false })
            .limit(1)
        : Promise.resolve({ data: null, error: null }),
      supabase
        .from('supplement_logs')
        .select('date, completed')
        .eq('client_id', client.id)
        .gte('date', eightWeeksStr),
      supabase
        .from('supplements')
        .select('name')
        .eq('client_id', client.id),
    ])

    const bodyData = bodyRes.data || []
    const nutritionLogs = nutritionRes.data || []
    const trainingLogs = trainingRes.data || []
    const wellnessLogs = wellnessRes.data || []
    const labResults = labRes.data || []

    let lastPeriodDate: string | null = null
    if (periodRes.data && periodRes.data.length > 0) {
      lastPeriodDate = (periodRes.data[0] as any).date
    }

    const suppLogs = suppLogsRes.data || []
    const suppList = suppListRes.data || []
    const suppComplianceRate = suppLogs.length > 0
      ? suppLogs.filter((s: { completed: boolean | null }) => s.completed).length / suppLogs.length
      : 0
    // 計算持續使用週數：從最早有打卡記錄的日期算起
    const suppDates = suppLogs.map((s: { date: string }) => s.date).sort()
    const suppWeeksDuration = suppDates.length > 0
      ? Math.floor((new Date().getTime() - new Date(suppDates[0]).getTime()) / (7 * 24 * 60 * 60 * 1000))
      : 0

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
        .filter((b: { date: string; weight: number | null }) => b.date >= startStr && b.date <= endStr && b.weight != null)
        .map((b: { weight: number | null }) => b.weight as number)

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

    const recentNutrition = nutritionLogs.filter((l: { date: string }) => l.date >= fourteenStr && l.date <= todayStr)
    const compliantCount = recentNutrition.filter((l: { compliant: boolean | null }) => l.compliant).length
    // 合規率以 14 天為分母，沒記錄的天數視為未合規
    // 這樣只記了 3 天全合規 = 21%，不會被當成 100% 合規
    const nutritionCompliance = Math.round((compliantCount / 14) * 100)

    // 5. 計算平均每日攝取熱量 (近 14 天)
    // 重要：只平均「有記錄的天數」會高估稀疏記錄者的攝取量
    // 例如只記了 3 天的 2000kcal，平均是 2000，但真實 14 天平均可能差很多
    // 解法：記錄率 < 50%（少於 7 天/14 天）→ 不信任 adaptive TDEE
    const recentWithCalories = recentNutrition.filter((l: { calories: number | null }) => l.calories != null)
    const loggingRate = recentWithCalories.length / 14  // 0~1，14 天中有幾天有記錄
    const avgDailyCalories = recentWithCalories.length >= 7  // 至少 7 天才算
      ? Math.round(recentWithCalories.reduce((s: number, l: { calories: number | null }) => s + (l.calories ?? 0), 0) / recentWithCalories.length)
      : null

    // 6. 計算每週訓練天數 (近 14 天)
    const recentTraining = trainingLogs.filter((l: { date: string; training_type: string }) => l.date >= fourteenStr && l.date <= todayStr && isWeightTraining(l.training_type))
    const trainingDaysPerWeek = Math.round(recentTraining.length / 2)  // 14 天 ÷ 2

    // 7. 當前體重 + 身體組成 (最新紀錄)
    const latestWeight = bodyData.length > 0 ? bodyData[bodyData.length - 1].weight : null
    // 取最新有值的身高和體脂率（不一定每筆都有）
    const latestHeight = [...bodyData].reverse().find((b: { height: number | null }) => b.height != null)?.height ?? null
    const latestBodyFat = [...bodyData].reverse().find((b: { body_fat: number | null }) => b.body_fat != null)?.body_fat ?? null

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

    // 7b. 計算訓練量數據（RPE × duration × frequency → 影響 TDEE）
    const recentTrainingWithRPE = trainingLogs.filter((t: { date: string; training_type: string }) => t.date >= sevenDaysStr && isWeightTraining(t.training_type))
    const avgRPE = recentTrainingWithRPE.length > 0
      ? recentTrainingWithRPE.reduce((s: number, t: { rpe: number | null }) => s + (t.rpe ?? 6), 0) / recentTrainingWithRPE.length
      : null
    const avgDurationMin = recentTrainingWithRPE.length > 0
      ? recentTrainingWithRPE.reduce((s: number, t: { duration: number | null }) => s + (t.duration ?? 45), 0) / recentTrainingWithRPE.length
      : null

    // 8. 組裝引擎輸入
    const engineInput: NutritionInput = {
      gender: client.gender || '男性',
      bodyWeight: latestWeight,
      goalType: client.goal_type || 'cut',
      dietStartDate: client.diet_start_date || null,
      height: latestHeight,
      bodyFatPct: latestBodyFat,
      targetWeight: client.target_weight ?? null,
      targetBodyFatPct: (client.target_body_fat as number) ?? null,
      targetDate: client.competition_date || client.target_date || null,
      currentCalories: client.calories_target ?? null,
      currentProtein: client.protein_target ?? null,
      currentCarbs: client.carbs_target ?? null,
      currentFat: client.fat_target ?? null,
      currentCarbsTrainingDay: client.carbs_training_day ?? null,
      currentCarbsRestDay: client.carbs_rest_day ?? null,
      carbsCyclingEnabled: !!(client.carbs_training_day && client.carbs_rest_day) || (isCompetitionMode(client.client_mode) && client.goal_type === 'cut'),
      weeklyWeights,
      nutritionCompliance,
      avgDailyCalories,
      trainingDaysPerWeek,
      prepPhase: client.prep_phase || undefined,
      clientMode: (client.client_mode as 'standard' | 'health' | 'bodybuilding' | 'athletic') || undefined,
      weighInGapHours: (client as any).weigh_in_gap_hours ?? undefined,
      activityProfile: (client.activity_profile as 'sedentary' | 'high_energy_flux') || undefined,
      cuttingGateOverride: !!client.cutting_gate_override,
      recentWellness: wellnessLogs.map((w: { date: string; sleep_quality: number | null; energy_level: number | null; training_drive: number | null; device_recovery_score: number | null; resting_hr: number | null; hrv: number | null; wearable_sleep_score: number | null; respiratory_rate: number | null }) => ({
        date: w.date,
        energy_level: w.energy_level ?? null,
        training_drive: w.training_drive ?? null,
        sleep_quality: w.sleep_quality ?? null,
        device_recovery_score: w.device_recovery_score ?? null,
        resting_hr: w.resting_hr ?? null,
        hrv: w.hrv ?? null,
        wearable_sleep_score: w.wearable_sleep_score ?? null,
        respiratory_rate: w.respiratory_rate ?? null,
      })),
      recentTrainingLogs: trainingLogs
        .filter((t: { date: string }) => t.date >= sevenDaysStr)
        .map((t: { date: string; rpe: number | null }) => ({
          date: t.date,
          rpe: t.rpe ?? null,
        })),
      recentCarbsPerDay: nutritionLogs
        .filter((n: { date: string }) => n.date >= sevenDaysStr)
        .map((n: { date: string; carbs_grams: number | null }) => ({
          date: n.date,
          carbs: n.carbs_grams ?? null,
        })),
      lastPeriodDate,
      labResults: labResults.map((l: { test_name: string; value: number; unit: string; status: string; date: string }) => ({
        test_name: l.test_name,
        value: l.value,
        unit: l.unit,
        status: l.status as 'normal' | 'attention' | 'alert',
        date: l.date,
      })),
      recentTrainingVolume: recentTrainingWithRPE.length > 0 ? {
        avgRPE,
        avgDurationMin,
        sessionsPerWeek: recentTrainingWithRPE.length,
      } : undefined,
      supplementCompliance: suppLogs.length > 0 ? {
        rate: suppComplianceRate,
        weeksDuration: suppWeeksDuration,
        supplements: suppList.map((s: { name: string }) => s.name),
      } : undefined,
      geneticProfile: (client.gene_mthfr || client.gene_apoe || client.gene_depression_risk) ? {
        mthfr: client.gene_mthfr || undefined,
        apoe: client.gene_apoe || undefined,
        ...parseSerotoninField(client.gene_depression_risk),
      } : undefined,
      // Peak Week 每日體重（碳水溢出回饋機制）
      peakWeekDailyWeights: client.competition_date
        ? (() => {
            const compD = new Date(client.competition_date)
            const peakStart = new Date(compD)
            peakStart.setDate(compD.getDate() - 7)
            const peakStartStr = peakStart.toISOString().split('T')[0]
            const filtered = bodyData
              .filter((b: { date: string; weight: number | null }) => b.date >= peakStartStr && b.weight != null)
              .map((b: { date: string; weight: number }) => ({ date: b.date, weight: b.weight }))
            return filtered.length > 0 ? filtered : undefined
          })()
        : undefined,
    }

    // 9. 執行引擎
    const suggestion = generateNutritionSuggestion(engineInput)

    // 10. 自動套用：如果引擎說 autoApply 且有調整
    // 允許自動套用的條件（OR）：
    //   - admin 操作
    //   - goal_driven 模式（有目標體重+日期）
    //   - 備賽選手（competition_enabled，不論有無目標體重）
    //   - self_managed 訂閱用戶（499 自主管理）
    let applied = false
    let coachLocked = false
    const isSelfManaged = client.subscription_tier === 'self_managed'
    const isCompetitionClient = isCompetitionMode(client.client_mode)
    // autoApply 模式（頁面自動觸發）不受 TDEE 異常限制 — 引擎已有安全上下限保護
    // TDEE 異常警告仍保留在 warnings 中供教練參考
    // insufficient_data 除外（數據不足不應自動套用）
    const effectiveAutoApply = wantsAutoApply
      ? (suggestion.status !== 'insufficient_data')
      : suggestion.autoApply
    // coached 用戶的目標由教練手動管理，不自動覆蓋（除非 admin 操作）
    const isCoached = client.subscription_tier === 'coached'
    const canAutoApply = wantsAutoApply && effectiveAutoApply && (isAdmin || ((!isCoached) && (suggestion.status === 'goal_driven' || isCompetitionClient || isSelfManaged || !!client.nutrition_enabled)))

    // 教練覆寫鎖定：教練手動調整過營養目標
    // Timed Coach Override: 覆寫期間（含 autoApply）都鎖定，確保教練設定值不被覆蓋
    let coachOverride = client.coach_macro_override as {
      locked_at: string
      expires_at?: string | null
      locked_fields: string[]
      override_values?: Record<string, number | null>
      previous_values?: Record<string, number | null>
      reason?: string | null
    } | null

    // Check if coach override has expired
    if (coachOverride && coachOverride.expires_at) {
      const now = new Date()
      if (new Date(coachOverride.expires_at) <= now) {
        // Override expired — clear it (fire-and-forget)
        supabase.from('clients').update({ coach_macro_override: null }).eq('id', client.id).then(() => {})
        coachOverride = null
      }
    }

    if (coachOverride && !isAdmin) {
      coachLocked = true
      suggestion.message += '\n\n🔒 教練已手動設定你的營養目標，系統建議僅供參考，不會自動調整。'
    }

    const coachOverrideInfo = coachOverride ? {
      expiresAt: coachOverride.expires_at || null,
      reason: coachOverride.reason || null,
      daysRemaining: coachOverride.expires_at
        ? Math.max(0, Math.ceil((new Date(coachOverride.expires_at).getTime() - Date.now()) / 86400000))
        : null,
      overrideValues: coachOverride.override_values || null,
    } : null

    if (canAutoApply && !coachLocked) {
      const updates: Record<string, number | null> = {}
      if (suggestion.suggestedCalories != null) updates.calories_target = suggestion.suggestedCalories
      if (suggestion.suggestedProtein != null) updates.protein_target = suggestion.suggestedProtein
      if (suggestion.suggestedCarbs != null) updates.carbs_target = suggestion.suggestedCarbs
      if (suggestion.suggestedFat != null) updates.fat_target = suggestion.suggestedFat
      // 碳水循環：不論引擎回傳 null 或數值，都需同步 DB（避免舊值殘留造成顯示不一致）
      updates.carbs_training_day = suggestion.suggestedCarbsTrainingDay ?? null
      updates.carbs_rest_day = suggestion.suggestedCarbsRestDay ?? null

      // Peak Week 期間：每日營養素不同，清掉碳水循環值讓 NutritionLog 使用 carbs_target
      // 否則 NutritionLog 會優先顯示舊的 carbs_training_day / carbs_rest_day
      if (suggestion.status === 'peak_week') {
        updates.carbs_training_day = null
        updates.carbs_rest_day = null
        // 同步更新 water_target（Peak Week 每日水量不同）
        const todayPlan = suggestion.peakWeekPlan?.find((d: { date: string }) => {
          const nowMs = Date.now() + 8 * 60 * 60 * 1000
          const todayStr = new Date(nowMs).toISOString().split('T')[0]
          return d.date === todayStr
        })
        // 如果今天沒匹配到，fallback 用最近的一天
        const effectivePlan = todayPlan || suggestion.peakWeekPlan?.[0]
        if (effectivePlan?.water) {
          updates.water_target = effectivePlan.water
        }
        if (effectivePlan?.sodiumMg != null) {
          updates.sodium_target = effectivePlan.sodiumMg
        }
      }

      // 賽後恢復期：重設 water_target 為正常值（Peak Week 可能留下極端值如 800ml）
      // 同時清除碳循環值（恢復期不需要碳循環）
      if (suggestion.postCompetitionRecovery) {
        updates.carbs_training_day = null
        updates.carbs_rest_day = null
        updates.sodium_target = null
        if (suggestion.recoveryWater) {
          updates.water_target = suggestion.recoveryWater
        }
      }

      // 非 Peak Week 時：如果 water_target 殘留極端值（<1500ml），重設為正常水量
      // 防止跳過恢復期直接進入下一輪減脂時，水量卡在 Peak Week 的 800ml
      // 但如果恢復期已透過 recoveryWater 設定水量，不要覆蓋
      if (!suggestion.recoveryWater && suggestion.status !== 'peak_week' && client.water_target && client.water_target < 1500) {
        const normalWater = Math.round(latestWeight * 35)  // 35ml/kg 正常水量
        updates.water_target = normalWater
      }

      if (Object.keys(updates).length > 0) {
        const { error: updateErr } = await supabase
          .from('clients')
          .update(updates)
          .eq('id', client.id)

        if (!updateErr) {
          applied = true
        } else {
          console.error('[AutoNutrition] DB 更新失敗:', updateErr.message, 'clientId:', client.id, 'updates:', updates)
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
      coachLocked,
      coachOverrideInfo,
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
  } catch (error) {
    logger.error('GET /api/nutrition-suggestions unexpected error', error)
    return NextResponse.json({ error: '分析失敗' }, { status: 500 })
  }
}
