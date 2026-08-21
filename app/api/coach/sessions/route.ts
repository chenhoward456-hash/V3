import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminSession } from '@/lib/auth-middleware'
import { createServiceSupabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

/**
 * 上課紀錄：教練按「上完了」就是一筆。
 * note（記一句）選填 —— 不寫就沿用上一次的，這是刻意的：
 * 一天六堂課的人不會每堂都寫，但**每堂都按一下**是做得到的。
 */
export async function POST(request: NextRequest) {
  const s = request.cookies.get('admin_session')?.value
  if (!s || !verifyAdminSession(s)) return NextResponse.json({ error: '未授權' }, { status: 401 })

  let body: { studentId?: string; note?: string; date?: string; undo?: boolean }
  try { body = await request.json() } catch { return NextResponse.json({ error: '格式錯誤' }, { status: 400 }) }
  if (!body.studentId) return NextResponse.json({ error: '缺少 studentId' }, { status: 400 })

  const supabase = createServiceSupabase()
  const date = body.date ?? new Date().toISOString().slice(0, 10)

  if (body.undo) {
    await supabase.from('coach_sessions').delete().eq('student_id', body.studentId).eq('date', date)
    return NextResponse.json({ success: true, undone: true })
  }

  // 同一天重按只更新 note，不重複建立（UNIQUE(student_id, date)）
  const { error } = await supabase
    .from('coach_sessions')
    .upsert(
      { student_id: body.studentId, date, note: body.note?.trim() || null },
      { onConflict: 'student_id,date' },
    )
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 有寫 note 代表教練剛回顧過這個人 → 順便更新標的檢查時間
  if (body.note?.trim()) {
    await supabase.from('coach_students')
      .update({ goal_checked_at: new Date().toISOString() })
      .eq('id', body.studentId)
  }

  return NextResponse.json({ success: true })
}
