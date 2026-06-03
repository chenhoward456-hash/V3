import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminSession } from '@/lib/auth-middleware'
import { createServiceSupabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
const supabase = createServiceSupabase()

function checkAuth(request: NextRequest): boolean {
  const token = request.cookies.get('admin_session')?.value
  return !!token && verifyAdminSession(token)
}

// GET ?clientId=xxx
export async function GET(request: NextRequest) {
  if (!checkAuth(request)) return NextResponse.json({ error: '未授權' }, { status: 401 })

  const clientId = new URL(request.url).searchParams.get('clientId')
  if (!clientId) return NextResponse.json({ error: 'clientId required' }, { status: 400 })

  const { data, error } = await supabase
    .from('personal_notes')
    .select('id, category, note, weight, relevant_until, added_at, added_by')
    .eq('client_id', clientId)
    .order('weight', { ascending: false })
    .order('added_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, data: data ?? [] })
}

// POST  body: { clientId, category, note, weight, relevant_until? }
export async function POST(request: NextRequest) {
  if (!checkAuth(request)) return NextResponse.json({ error: '未授權' }, { status: 401 })

  const body = await request.json()
  const { clientId, category, note, weight, relevant_until } = body

  if (!clientId || !category || !note || weight == null) {
    return NextResponse.json({ error: '缺少必要欄位' }, { status: 400 })
  }
  if (weight < 1 || weight > 10) {
    return NextResponse.json({ error: 'weight 必須在 1-10' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('personal_notes')
    .insert({
      client_id: clientId,
      added_by: 'coach',
      category, note,
      weight,
      relevant_until: relevant_until || null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, data })
}

// PATCH ?id=xxx body: { category?, note?, weight?, relevant_until? }
export async function PATCH(request: NextRequest) {
  if (!checkAuth(request)) return NextResponse.json({ error: '未授權' }, { status: 401 })

  const id = new URL(request.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const body = await request.json()
  const updates: Record<string, any> = {}
  if (body.category) updates.category = body.category
  if (body.note) updates.note = body.note
  if (body.weight != null) {
    if (body.weight < 1 || body.weight > 10) {
      return NextResponse.json({ error: 'weight 必須在 1-10' }, { status: 400 })
    }
    updates.weight = body.weight
  }
  if ('relevant_until' in body) updates.relevant_until = body.relevant_until || null

  const { error } = await supabase.from('personal_notes').update(updates).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

// DELETE ?id=xxx
export async function DELETE(request: NextRequest) {
  if (!checkAuth(request)) return NextResponse.json({ error: '未授權' }, { status: 401 })

  const id = new URL(request.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { error } = await supabase.from('personal_notes').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
