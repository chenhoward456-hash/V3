import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing required environment variables for Supabase')
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const clientId = searchParams.get('clientId')

  if (!clientId) {
    return NextResponse.json({ error: 'clientId is required' }, { status: 400 })
  }

  try {
    // 只允許 unique_code 查詢，不允許 raw id 查詢
    const clientRes = await supabase.from('clients').select('*').eq('unique_code', clientId).single()

    if (!clientRes.data) {
      return NextResponse.json({ error: '找不到學員資料' }, { status: 404 })
    }

    const realId = clientRes.data.id
    const sixtyDaysAgo = new Date()
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60)
    const sinceDate = sixtyDaysAgo.toISOString().split('T')[0]

    const [suppRes, logsRes, wellRes, trainRes, bodyRes, labRes, nutritionRes] = await Promise.all([
      supabase.from('supplements').select('*').eq('client_id', realId),
      supabase.from('supplement_logs').select('*').eq('client_id', realId).gte('date', sinceDate).order('date', { ascending: true }),
      supabase.from('daily_wellness').select('*').eq('client_id', realId).gte('date', sinceDate).order('date', { ascending: true }),
      supabase.from('training_logs').select('*').eq('client_id', realId).gte('date', sinceDate).order('date', { ascending: true }),
      supabase.from('body_composition').select('*').eq('client_id', realId).order('date', { ascending: true }),
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
