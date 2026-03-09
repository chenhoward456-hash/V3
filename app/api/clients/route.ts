import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase'
import crypto from 'crypto'
import { validateDate } from '@/utils/validation'
import { verifyAuth, isCoach, createErrorResponse, createSuccessResponse, rateLimit, getClientIP } from '@/lib/auth-middleware'
import { calculateInitialTargets } from '@/lib/nutrition-engine'
import { createLogger } from '@/lib/logger'

const logger = createLogger('api-clients')

const supabase = createServiceSupabase()

export async function GET(request: NextRequest) {
  try {
    // Rate limit: 每分鐘 30 次（公開端點）
    const ip = getClientIP(request)
    const { allowed } = rateLimit(`clients-get:${ip}`, 30, 60_000)
    if (!allowed) {
      return createErrorResponse('請求過於頻繁，請稍後再試', 429)
    }

    // 獲取請求參數
    const { searchParams } = new URL(request.url)
    const clientId = searchParams.get('clientId')

    if (!clientId) {
      return createErrorResponse('缺少客戶 ID', 400)
    }

    // 驗證 clientId 格式（允許英數字、連字號、底線，最長 20 字）
    if (!/^[a-zA-Z0-9_-]{1,20}$/.test(clientId)) {
      return createErrorResponse('無效的客戶 ID 格式', 400)
    }

    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select(`
        *,
        lab_results (*),
        supplements (*)
      `)
      .eq('unique_code', clientId)
      .single()
    
    if (clientError) {
      return createErrorResponse('找不到客戶資料', 404)
    }

    if (!client) {
      return createErrorResponse('客戶資料不存在', 404)
    }
    
    // 檢查是否停用
    if (client.is_active === false) {
      return createErrorResponse('此帳號已暫停，請聯繫教練', 403)
    }

    // 檢查是否過期（expires_at 為 NULL 代表永不過期）
    if (client.expires_at && new Date(client.expires_at) < new Date()) {
      return createErrorResponse('客戶資料已過期', 403)
    }
    
    // 根據已開啟功能平行查詢資料
    const today = new Date().toISOString().split('T')[0]
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0]

    // 建立需要執行的查詢（用 async 包裝確保回傳 Promise）
    interface SupabaseQueryResult {
      data: Record<string, unknown>[] | null
      error: { message: string; code?: string } | null
    }

    const queryEntries: { key: string; query: Promise<SupabaseQueryResult> }[] = []

    const wrap = (q: PromiseLike<SupabaseQueryResult>) => new Promise<SupabaseQueryResult>((resolve) => q.then(resolve))

    // 補品相關（supplement_enabled）
    if (client.supplement_enabled) {
      queryEntries.push({
        key: 'todayLogs',
        query: wrap(supabase.from('supplement_logs').select('*').eq('client_id', client.id).eq('date', today)),
      })
      queryEntries.push({
        key: 'recentLogs',
        query: wrap(supabase.from('supplement_logs').select('*').eq('client_id', client.id).gte('date', thirtyDaysAgoStr).order('date', { ascending: false })),
      })
    }

    // 體組成（body_composition_enabled）
    if (client.body_composition_enabled) {
      queryEntries.push({
        key: 'bodyData',
        query: wrap(supabase.from('body_composition').select('*').eq('client_id', client.id).order('date', { ascending: false }).limit(90)),
      })
    }

    // 每日感受（wellness_enabled）
    if (client.wellness_enabled) {
      queryEntries.push({
        key: 'wellness',
        query: wrap(supabase.from('daily_wellness').select('*').eq('client_id', client.id).gte('date', thirtyDaysAgoStr).order('date', { ascending: false })),
      })
    }

    // 訓練（training_enabled）
    if (client.training_enabled) {
      queryEntries.push({
        key: 'trainingLogs',
        query: wrap(supabase.from('training_logs').select('*').eq('client_id', client.id).gte('date', thirtyDaysAgoStr).order('date', { ascending: false })),
      })
    }

    // 飲食（nutrition_enabled）
    if (client.nutrition_enabled) {
      queryEntries.push({
        key: 'nutritionLogs',
        query: wrap(supabase.from('nutrition_logs').select('*').eq('client_id', client.id).gte('date', thirtyDaysAgoStr).order('date', { ascending: false })),
      })
    }

    // 平行執行所有查詢
    const results = await Promise.all(queryEntries.map(e => e.query))
    const resolved: Record<string, Record<string, unknown>[]> = {}
    for (let i = 0; i < queryEntries.length; i++) {
      const { data, error } = results[i]
      if (error) logger.warn(`查詢 ${queryEntries[i].key} 失敗`, { error })
      resolved[queryEntries[i].key] = data || []
    }

    return createSuccessResponse({
      client,
      todayLogs: resolved.todayLogs || [],
      bodyData: resolved.bodyData || [],
      wellness: resolved.wellness || [],
      recentLogs: resolved.recentLogs || [],
      trainingLogs: resolved.trainingLogs || [],
      nutritionLogs: resolved.nutritionLogs || [],
    })
    
  } catch {
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    // 1. 驗證身份
    const { user, error: authError } = await verifyAuth(request)
    if (authError || !user) {
      return createErrorResponse(authError || '身份驗證失敗', 401)
    }

    // 2. 檢查權限（目前只有教練可以存取）
    if (!isCoach(user)) {
      return createErrorResponse('權限不足，需要教練角色', 403)
    }

    // 3. 獲取請求內容
    const body = await request.json()
    const { name, age, gender } = body
    
    // 驗證輸入
    if (!name || typeof name !== 'string' || name.length < 1 || name.length > 100) {
      return createErrorResponse('無效的姓名', 400)
    }
    
    if (!age || typeof age !== 'number' || age < 0 || age > 150) {
      return createErrorResponse('無效的年齡', 400)
    }
    
    if (!gender || !['男性', '女性', '其他'].includes(gender)) {
      return createErrorResponse('無效的性別', 400)
    }
    
    // 生成唯一代碼（密碼學安全隨機）
    const uniqueCode = crypto.randomBytes(5).toString('hex').substring(0, 9)
    
    const { data, error } = await supabase
      .from('clients')
      .insert({
        unique_code: uniqueCode,
        name,
        age,
        gender,
        expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString() // 90天後過期
      })
      .select()
      .single()
    
    if (error) {
      return createErrorResponse('建立客戶失敗', 500)
    }
    
    return createSuccessResponse(data)
    
  } catch {
    return createErrorResponse('伺服器錯誤', 500)
  }
}

// PATCH: 自主管理用戶 Onboarding — 設定目標 + InBody 數據 → 即時算出初始營養目標
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { clientId, simple_mode, goal_type, activity_profile, gender, height, body_weight, body_fat_pct, training_days_per_week, target_weight, target_body_fat, target_date } = body

    if (!clientId || typeof clientId !== 'string') {
      return createErrorResponse('缺少客戶 ID', 400)
    }

    // 驗證 unique_code 存在
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id, gender, subscription_tier, is_active')
      .eq('unique_code', clientId)
      .single()

    if (clientError || !client) {
      return createErrorResponse('找不到客戶', 404)
    }

    if (client.is_active === false) {
      return createErrorResponse('帳號已暫停', 403)
    }

    // simple_mode 切換：所有方案用戶皆可使用
    if (typeof simple_mode === 'boolean') {
      const { error: updateErr } = await supabase
        .from('clients')
        .update({ simple_mode })
        .eq('id', client.id)
      if (updateErr) {
        return createErrorResponse('更新失敗', 500)
      }
      return createSuccessResponse({ updated: { simple_mode } })
    }

    // 以下為 Onboarding 功能，僅限 self_managed / free
    if (client.subscription_tier !== 'self_managed' && client.subscription_tier !== 'free') {
      return createErrorResponse('此功能僅限自主管理 / 免費方案', 403)
    }

    // 白名單：只允許更新這些欄位
    const updates: Record<string, string | number | boolean | null> = {}

    if (goal_type && ['cut', 'bulk', 'recomp'].includes(goal_type)) {
      updates.goal_type = goal_type
      updates.diet_start_date = new Date().toISOString().split('T')[0]
    }

    if (activity_profile && ['sedentary', 'high_energy_flux'].includes(activity_profile)) {
      updates.activity_profile = activity_profile
    }

    if (gender && ['男性', '女性'].includes(gender)) {
      updates.gender = gender
    }

    // height 存在 body_composition 表，不在 clients 表
    const validHeight = (height && typeof height === 'number' && height > 100 && height < 250) ? height : null

    // 目標體重 + 目標日期（自主管理用戶設定期限）
    if (target_weight && typeof target_weight === 'number' && target_weight > 30 && target_weight < 300) {
      updates.target_weight = target_weight
    }
    if (target_body_fat && typeof target_body_fat === 'number' && target_body_fat > 3 && target_body_fat < 60) {
      updates.target_body_fat = target_body_fat
    }
    if (target_date && typeof target_date === 'string') {
      const parsedDate = new Date(target_date)
      if (!isNaN(parsedDate.getTime()) && parsedDate > new Date()) {
        updates.target_date = target_date
      }
    }

    // InBody 數據 → 建立 body_composition 紀錄 + 計算初始營養目標
    const hasBodyData = body_weight && typeof body_weight === 'number' && body_weight > 30 && body_weight < 300
    const validGoalType = goal_type && ['cut', 'bulk', 'recomp'].includes(goal_type) ? goal_type : null
    const resolvedGender = gender || client.gender || '男性'

    if (hasBodyData) {
      // 寫入 body_composition 紀錄
      const today = new Date().toISOString().split('T')[0]
      const bodyCompRecord: Record<string, string | number | null> = {
        client_id: client.id,
        date: today,
        weight: body_weight,
      }
      if (body_fat_pct && typeof body_fat_pct === 'number' && body_fat_pct > 3 && body_fat_pct < 60) {
        bodyCompRecord.body_fat = body_fat_pct
      }
      if (validHeight) {
        bodyCompRecord.height = validHeight
      }

      // upsert by client_id + date
      await supabase
        .from('body_composition')
        .upsert(bodyCompRecord, { onConflict: 'client_id,date' })

      // 有體重 + 目標類型 → 計算初始營養目標
      if (validGoalType) {
        const targets = calculateInitialTargets({
          gender: resolvedGender,
          bodyWeight: body_weight,
          height: validHeight,
          bodyFatPct: (bodyCompRecord.body_fat as number) || null,
          goalType: validGoalType as 'cut' | 'bulk' | 'recomp',
          activityProfile: (activity_profile as 'sedentary' | 'high_energy_flux') || 'sedentary',
          trainingDaysPerWeek: training_days_per_week || 3,
        })

        // 寫入 client 的營養目標
        updates.calories_target = targets.calories
        updates.protein_target = targets.protein
        updates.carbs_target = targets.carbs
        updates.fat_target = targets.fat
        // 同時啟用 nutrition 和 body_composition 功能
        updates.nutrition_enabled = true
        updates.body_composition_enabled = true
      }
    }

    if (Object.keys(updates).length === 0) {
      return createErrorResponse('沒有有效的更新欄位', 400)
    }

    const { error: updateError } = await supabase
      .from('clients')
      .update(updates)
      .eq('id', client.id)

    if (updateError) {
      return createErrorResponse('更新失敗', 500)
    }

    return createSuccessResponse({ updated: true })
  } catch {
    return createErrorResponse('伺服器錯誤', 500)
  }
}
