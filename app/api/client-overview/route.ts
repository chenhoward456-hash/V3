import { NextRequest, NextResponse } from 'next/server'
import { verifyCoachAuth } from '@/lib/auth-middleware'
import { createServiceSupabase } from '@/lib/supabase'

const supabase = createServiceSupabase()

export async function GET(request: NextRequest) {
  const { authorized } = await verifyCoachAuth(request)

  const { searchParams } = new URL(request.url)
  const clientId = searchParams.get('clientId')

  if (!clientId) {
    return NextResponse.json({ error: 'clientId is required' }, { status: 400 })
  }

  try {
    // 支援 UUID 和 unique_code 兩種查詢方式
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clientId)
    // 教練可用 id 或 code 查任何人；非教練（學員自助看自己的報告）只能用「自己的 unique_code」查，
    // 用 UUID 查一律需教練權限（避免枚舉他人 id）。code 本身就是 bearer，與學員 dashboard 同一安全模型。
    if (!authorized && isUUID) {
      return NextResponse.json({ error: '未授權' }, { status: 401 })
    }
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

    // 只有教練查看才更新 last viewed（學員自助看報告不算教練看過）
    if (authorized) {
      supabase.from('clients').update({ coach_last_viewed_at: new Date().toISOString() }).eq('id', realId).then(() => {})
    }

    const today = new Date().toISOString().split('T')[0]
    const [suppRes, logsRes, wellRes, trainRes, bodyRes, labRes, nutritionRes, trainingSetsRes, notesRes] = await Promise.all([
      supabase.from('supplements').select('*').eq('client_id', realId).is('archived_at', null),
      supabase.from('supplement_logs').select('id, supplement_id, client_id, date, completed').eq('client_id', realId).gte('date', sinceDate).order('date', { ascending: true }),
      supabase.from('daily_wellness').select('*').eq('client_id', realId).gte('date', sinceDate).order('date', { ascending: true }),
      supabase.from('training_logs').select('id, client_id, date, training_type, rpe, duration, note').eq('client_id', realId).gte('date', sinceDate).order('date', { ascending: true }),
      supabase.from('body_composition').select('id, client_id, date, weight, height, body_fat').eq('client_id', realId).order('date', { ascending: true }).limit(365),
      supabase.from('lab_results').select('*').eq('client_id', realId).order('date', { ascending: false }),
      supabase.from('nutrition_logs').select('*').eq('client_id', realId).gte('date', sinceDate).order('date', { ascending: true }),
      supabase.from('training_sets').select('id, client_id, date, exercise_name, muscle_group, set_number, weight, reps, rpe, is_main_lift').eq('client_id', realId).gte('date', sinceDate90).order('date', { ascending: true }),
      // personal_notes weight ≥ 7 + 還在有效期內 — 給「動態調整建議」做個人化保護
      supabase.from('personal_notes').select('id, category, note, weight, relevant_until').eq('client_id', realId).gte('weight', 7).or(`relevant_until.is.null,relevant_until.gte.${today}`).order('weight', { ascending: false }),
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
      personalNotes: notesRes.data || [],
    })
  } catch (err) {
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 })
  }
}
