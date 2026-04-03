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
    const clientFields = '*'
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

    const ninetyDaysAgo = new Date()
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
    const sinceDate90 = ninetyDaysAgo.toISOString().split('T')[0]

    // 教練查看時，更新 last viewed 時間戳（fire-and-forget）
    supabase.from('clients').update({ coach_last_viewed_at: new Date().toISOString() }).eq('id', realId).then(() => {})

    const [suppRes, logsRes, wellRes, trainRes, bodyRes, labRes, nutritionRes, trainingSetsRes] = await Promise.all([
      supabase.from('supplements').select('*').eq('client_id', realId),
      supabase.from('supplement_logs').select('id, supplement_id, client_id, date, completed').eq('client_id', realId).gte('date', sinceDate).order('date', { ascending: true }),
      supabase.from('daily_wellness').select('*').eq('client_id', realId).gte('date', sinceDate).order('date', { ascending: true }),
      supabase.from('training_logs').select('id, client_id, date, training_type, rpe').eq('client_id', realId).gte('date', sinceDate).order('date', { ascending: true }),
      supabase.from('body_composition').select('id, client_id, date, weight, height, body_fat').eq('client_id', realId).order('date', { ascending: true }).limit(365),
      supabase.from('lab_results').select('*').eq('client_id', realId).order('date', { ascending: false }),
      supabase.from('nutrition_logs').select('*').eq('client_id', realId).gte('date', sinceDate).order('date', { ascending: true }),
      supabase.from('training_sets').select('id, client_id, date, exercise_name, muscle_group, set_number, weight, reps, rpe, is_main_lift').eq('client_id', realId).gte('date', sinceDate90).order('date', { ascending: true }),
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
      trainingSets: trainingSetsRes.data || [],
    })
  } catch (err) {
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 })
  }
}
