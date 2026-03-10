import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminSession } from '@/lib/auth-middleware'
import { createServiceSupabase } from '@/lib/supabase'
import { createLogger } from '@/lib/logger'

const logger = createLogger('admin-dashboard')

export const dynamic = 'force-dynamic'

const supabase = createServiceSupabase()

export async function GET(request: NextRequest) {
  try {
    // 1. 驗證 admin session
    const sessionToken = request.cookies.get('admin_session')?.value
    if (!sessionToken || !verifyAdminSession(sessionToken)) {
      return NextResponse.json({ error: '未授權' }, { status: 401 })
    }

    // 2. 計算日期範圍
    const today = new Date().toISOString().split('T')[0]
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0]
    const fourteenDaysAgo = new Date()
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14)
    const fourteenDaysAgoStr = fourteenDaysAgo.toISOString().split('T')[0]

    // 3. 平行查詢所有資料
    const [
      clientsResult,
      supplementLogsResult,
      supplementsResult,
      todayWellnessResult,
      todayLogsResult,
      todayTrainingResult,
      todayNutritionResult,
      todayBodyResult,
      recentBodyResult,
      recentNutritionResult,
      recentWellnessResult,
      recentTrainingRPEResult,
    ] = await Promise.all([
      // 所有學員，按建立時間倒序（只選必要欄位）
      supabase
        .from('clients')
        .select('id, unique_code, name, gender, status, is_active, expires_at, subscription_tier, competition_enabled, health_mode_enabled, body_composition_enabled, nutrition_enabled, wellness_enabled, training_enabled, supplement_enabled, lab_enabled, ai_chat_enabled, simple_mode, goal_type, prep_phase, coach_last_viewed_at, coach_weekly_note, created_at, line_user_id')
        .order('created_at', { ascending: false }),

      // 最近 7 天的補品打卡記錄
      supabase
        .from('supplement_logs')
        .select('client_id, supplement_id, date, completed')
        .gte('date', sevenDaysAgoStr),

      // 所有補品（只取 client_id）
      supabase
        .from('supplements')
        .select('client_id'),

      // 今天的每日感受（只取 client_id）
      supabase
        .from('daily_wellness')
        .select('client_id')
        .eq('date', today),

      // 今天已完成的補品打卡（只取 client_id）
      supabase
        .from('supplement_logs')
        .select('client_id')
        .eq('date', today)
        .eq('completed', true),

      // 今天的訓練記錄
      supabase
        .from('training_logs')
        .select('client_id, training_type')
        .eq('date', today),

      // 今天的飲食記錄
      supabase
        .from('nutrition_logs')
        .select('client_id, compliant')
        .eq('date', today),

      // 今天的體組成記錄（只取 client_id）
      supabase
        .from('body_composition')
        .select('client_id')
        .eq('date', today),

      // 近 14 天體重（用於停滯偵測）
      supabase
        .from('body_composition')
        .select('client_id, date, weight')
        .gte('date', fourteenDaysAgoStr)
        .not('weight', 'is', null)
        .order('date', { ascending: true }),

      // 近 14 天飲食合規（用於合規率警告）
      supabase
        .from('nutrition_logs')
        .select('client_id, date, compliant')
        .gte('date', fourteenDaysAgoStr)
        .order('date', { ascending: true }),

      // 近 7 天 Wellness 能量（用於連續下滑偵測）
      supabase
        .from('daily_wellness')
        .select('client_id, date, energy_level')
        .gte('date', sevenDaysAgoStr)
        .not('energy_level', 'is', null)
        .order('date', { ascending: true }),

      // 近 7 天訓練 RPE（用於過度訓練偵測）
      supabase
        .from('training_logs')
        .select('client_id, date, rpe')
        .gte('date', sevenDaysAgoStr)
        .not('rpe', 'is', null)
        .order('date', { ascending: true }),
    ])

    // 4. 檢查錯誤（僅 log，不阻擋回應）
    const queries = [
      { name: 'clients', result: clientsResult },
      { name: 'supplementLogs', result: supplementLogsResult },
      { name: 'supplements', result: supplementsResult },
      { name: 'todayWellness', result: todayWellnessResult },
      { name: 'todayLogs', result: todayLogsResult },
      { name: 'todayTraining', result: todayTrainingResult },
      { name: 'todayNutrition', result: todayNutritionResult },
      { name: 'todayBody', result: todayBodyResult },
      { name: 'recentBody', result: recentBodyResult },
      { name: 'recentNutrition', result: recentNutritionResult },
      { name: 'recentWellness', result: recentWellnessResult },
      { name: 'recentTrainingRPE', result: recentTrainingRPEResult },
    ]
    for (const q of queries) {
      if (q.result.error) {
        logger.warn(`查詢 ${q.name} 失敗`, { error: q.result.error })
      }
    }

    // 5. 回傳資料
    return NextResponse.json({
      clients: clientsResult.data || [],
      supplementLogs: supplementLogsResult.data || [],
      supplements: supplementsResult.data || [],
      todayWellness: todayWellnessResult.data || [],
      todayLogs: todayLogsResult.data || [],
      todayTraining: todayTrainingResult.data || [],
      todayNutrition: todayNutritionResult.data || [],
      todayBody: todayBodyResult.data || [],
      recentBody: recentBodyResult.data || [],
      recentNutrition: recentNutritionResult.data || [],
      recentWellness: recentWellnessResult.data || [],
      recentTrainingRPE: recentTrainingRPEResult.data || [],
    })
  } catch (error) {
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 })
  }
}
