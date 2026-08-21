import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminSession } from '@/lib/auth-middleware'
import { createServiceSupabase } from '@/lib/supabase'
import { parseRoster, buildCard, sortCards } from '@/lib/coach-roster'

export const dynamic = 'force-dynamic'

const COACH = 'howard'   // ⚠️ 多教練上線後從 session 取，欄位已經留好

function auth(request: NextRequest): boolean {
  const s = request.cookies.get('admin_session')?.value
  return !!s && verifyAdminSession(s)
}

/** GET：今天的名單（含上次重點、提示） */
export async function GET(request: NextRequest) {
  if (!auth(request)) return NextResponse.json({ error: '未授權' }, { status: 401 })

  const supabase = createServiceSupabase()
  const { data: students, error } = await supabase
    .from('coach_students')
    .select('id, name, goal, goal_kind, created_at, goal_checked_at')
    .eq('coach_id', COACH)
    .is('archived_at', null)
    .order('created_at')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!students?.length) return NextResponse.json({ success: true, cards: [] })

  const { data: sessions } = await supabase
    .from('coach_sessions')
    .select('student_id, date, note')
    .in('student_id', students.map(s => s.id))
    .order('date')

  const byStudent = new Map<string, { date: string; note: string | null }[]>()
  for (const s of sessions ?? []) {
    const arr = byStudent.get(s.student_id) ?? []
    arr.push({ date: s.date, note: s.note })
    byStudent.set(s.student_id, arr)
  }

  const cards = sortCards(students.map(s => buildCard(s, byStudent.get(s.id) ?? [])))
  return NextResponse.json({ success: true, cards })
}

/** POST：批次建檔（貼上文字） */
export async function POST(request: NextRequest) {
  if (!auth(request)) return NextResponse.json({ error: '未授權' }, { status: 401 })

  let body: { raw?: string }
  try { body = await request.json() } catch { return NextResponse.json({ error: '格式錯誤' }, { status: 400 }) }
  if (!body.raw?.trim()) return NextResponse.json({ error: '沒有內容' }, { status: 400 })

  const parsed = parseRoster(body.raw)
  if (parsed.length === 0) return NextResponse.json({ error: '讀不出任何學生' }, { status: 422 })
  if (parsed.length > 50) return NextResponse.json({ error: '一次最多 50 個' }, { status: 400 })

  const supabase = createServiceSupabase()
  // 已存在的同名學生更新標的，不重複建立
  const { data: existing } = await supabase
    .from('coach_students')
    .select('id, name')
    .eq('coach_id', COACH)
    .is('archived_at', null)

  const existingByName = new Map((existing ?? []).map(e => [e.name, e.id]))
  const toInsert = parsed.filter(p => !existingByName.has(p.name))
  const toUpdate = parsed.filter(p => existingByName.has(p.name) && p.goal)

  if (toInsert.length > 0) {
    const { error } = await supabase.from('coach_students').insert(
      toInsert.map(p => ({ coach_id: COACH, name: p.name, goal: p.goal })),
    )
    if (error) return NextResponse.json({ error: '建立失敗: ' + error.message }, { status: 500 })
  }
  for (const p of toUpdate) {
    await supabase.from('coach_students')
      .update({ goal: p.goal, goal_checked_at: new Date().toISOString() })
      .eq('id', existingByName.get(p.name)!)
  }

  return NextResponse.json({
    success: true,
    added: toInsert.length,
    updated: toUpdate.length,
  })
}

/** DELETE：封存一個學生（?id=） */
export async function DELETE(request: NextRequest) {
  if (!auth(request)) return NextResponse.json({ error: '未授權' }, { status: 401 })
  const id = new URL(request.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: '缺少 id' }, { status: 400 })

  const supabase = createServiceSupabase()
  const { error } = await supabase
    .from('coach_students')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', id).eq('coach_id', COACH)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
