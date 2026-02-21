import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyAdminSession } from '@/lib/auth-middleware'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// 驗證 admin session
function getAdminSession(request: NextRequest): boolean {
  const token = request.cookies.get('admin_session')?.value
  return !!token && verifyAdminSession(token)
}

// GET: 取得單一學員（含 lab_results + supplements）
export async function GET(request: NextRequest) {
  if (!getAdminSession(request)) {
    return NextResponse.json({ error: '未授權' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const clientId = searchParams.get('id')
  if (!clientId) {
    return NextResponse.json({ error: '缺少 id' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('clients')
    .select('*, lab_results(*), supplements(*)')
    .eq('id', clientId)
    .single()

  if (error) {
    return NextResponse.json({ error: '載入失敗' }, { status: 500 })
  }

  return NextResponse.json(data)
}

// POST: 新增學員
export async function POST(request: NextRequest) {
  if (!getAdminSession(request)) {
    return NextResponse.json({ error: '未授權' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { clientData, labResults, supplements } = body

    const { data: newClient, error: clientError } = await supabase
      .from('clients')
      .insert(clientData)
      .select()
      .single()

    if (clientError) {
      console.error('Insert client error:', clientError)
      return NextResponse.json({ error: '新增學員失敗', detail: clientError.message }, { status: 500 })
    }

    // 新增血檢
    if (labResults?.length > 0) {
      const withId = labResults.map((r: any) => ({ ...r, client_id: newClient.id }))
      const { error: labError } = await supabase.from('lab_results').insert(withId)
      if (labError) console.error('Insert lab error:', labError)
    }

    // 新增補品
    if (supplements?.length > 0) {
      const withId = supplements.map((s: any) => ({ ...s, client_id: newClient.id }))
      const { error: supError } = await supabase.from('supplements').insert(withId)
      if (supError) console.error('Insert supplement error:', supError)
    }

    return NextResponse.json({ success: true, id: newClient.id })
  } catch (err) {
    console.error('POST error:', err)
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 })
  }
}

// PUT: 更新學員
export async function PUT(request: NextRequest) {
  if (!getAdminSession(request)) {
    return NextResponse.json({ error: '未授權' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { clientId, clientData, labResults, supplements } = body

    if (!clientId) {
      return NextResponse.json({ error: '缺少 clientId' }, { status: 400 })
    }

    // 先更新血檢（會觸發 trigger 覆蓋 status）
    if (labResults) {
      for (const result of labResults) {
        if (result.id) {
          await supabase.from('lab_results').update(result).eq('id', result.id)
        } else {
          await supabase.from('lab_results').insert({ ...result, client_id: clientId })
        }
      }
    }

    // 再更新補品
    if (supplements) {
      for (const supplement of supplements) {
        if (supplement.id) {
          await supabase.from('supplements').update(supplement).eq('id', supplement.id)
        } else {
          await supabase.from('supplements').insert({ ...supplement, client_id: clientId })
        }
      }
    }

    // 最後更新 client（教練設的 status 不會被 trigger 覆蓋）
    const { error: clientError } = await supabase
      .from('clients')
      .update(clientData)
      .eq('id', clientId)

    if (clientError) {
      console.error('Update client error:', clientError)
      return NextResponse.json({ error: `更新學員失敗: ${clientError.message}`, detail: clientError.message, code: clientError.code }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('PUT error:', err)
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 })
  }
}
