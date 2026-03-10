import { NextRequest, NextResponse } from 'next/server'
import { verifyCoachAuth } from '@/lib/auth-middleware'
import { createServiceSupabase } from '@/lib/supabase'

const supabase = createServiceSupabase()

export async function GET(request: NextRequest) {
  // 需要教練權限才能查看學員全覽
  const { authorized } = await verifyCoachAuth(request)
  if (!authorized) {
    return NextResponse.json({ error: '未授權' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const clientId = searchParams.get('clientId')

  if (!clientId) {
    return NextResponse.json({ error: 'clientId is required' }, { status: 400 })
  }

  try {
    // 支援 UUID 和 unique_code 兩種查詢方式
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clientId)
    const clientFields = 'id, unique_code, name, age, gender, status, is_active, expires_at, subscription_tier, competition_enabled, health_mode_enabled, body_composition_enabled, nutrition_enabled, wellness_enabled, training_enabled, supplement_enabled, lab_enabled, ai_chat_enabled, simple_mode, calories_target, protein_target, carbs_target, fat_target, carbs_training_day, carbs_rest_day, water_target, target_weight, target_body_fat, target_date, goal_type, activity_profile, competition_date, prep_phase, coach_last_viewed_at, coach_weekly_note, coach_summary, next_checkup_date, health_goals, quarterly_cycle_start, diet_start_date, gene_mthfr, gene_apoe, gene_depression_risk, gene_notes, line_user_id, created_at, height, coach_macro_override'
    const clientRes = isUUID
      ? await supabase.from('clients').select(clientFields).eq('id', clientId).single()
      : await supabase.from('clients').select(clientFields).eq('unique_code', clientId).single()

    if (!clientRes.data) {
      return NextResponse.json({ error: '找不到學員資料' }, { status: 404 })
    }

    const realId = clientRes.data.id
    const sixtyDaysAgo = new Date()
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60)
    const sinceDate = sixtyDaysAgo.toISOString().split('T')[0]

    // 教練查看時，更新 last viewed 時間戳（fire-and-forget）
    supabase.from('clients').update({ coach_last_viewed_at: new Date().toISOString() }).eq('id', realId).then(() => {})

    const [suppRes, logsRes, wellRes, trainRes, bodyRes, labRes, nutritionRes] = await Promise.all([
      supabase.from('supplements').select('*').eq('client_id', realId),
      supabase.from('supplement_logs').select('*').eq('client_id', realId).gte('date', sinceDate).order('date', { ascending: true }),
      supabase.from('daily_wellness').select('*').eq('client_id', realId).gte('date', sinceDate).order('date', { ascending: true }),
      supabase.from('training_logs').select('*').eq('client_id', realId).gte('date', sinceDate).order('date', { ascending: true }),
      supabase.from('body_composition').select('id, client_id, date, weight, height, body_fat, muscle_mass, waist, hip, chest, arm, thigh, visceral_fat').eq('client_id', realId).order('date', { ascending: true }).limit(365),
      supabase.from('lab_results').select('*').eq('client_id', realId).order('date', { ascending: false }),
      supabase.from('nutrition_logs').select('*').eq('client_id', realId).gte('date', sinceDate).order('date', { ascending: true }),
    ])

    return NextResponse.json({
      client: clientRes.data,
      supplements: suppRes.data || [],
      supplementLogs: logsRes.data || [],
      wellness: wellRes.data || [],
      trainingLogs: trainRes.data || [],
      bodyData: bodyRes.data || [],
      labResults: labRes.data || [],
      nutritionLogs: nutritionRes.data || [],
    })
  } catch (err) {
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 })
  }
}
