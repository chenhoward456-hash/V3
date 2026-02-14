import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyAdminSession } from '@/lib/auth-middleware'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

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
    ] = await Promise.all([
      // 所有學員，按建立時間倒序
      supabase
        .from('clients')
        .select('*')
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
    ]
    for (const q of queries) {
      if (q.result.error) {
        console.warn(`[admin/dashboard] 查詢 ${q.name} 失敗:`, q.result.error)
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
    })
  } catch (error) {
    console.error('[admin/dashboard] 伺服器錯誤:', error)
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 })
  }
}
