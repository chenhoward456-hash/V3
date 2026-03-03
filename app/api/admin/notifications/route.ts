/**
 * 教練通知 API
 *
 * GET  /api/admin/notifications — 取得未讀通知
 * POST /api/admin/notifications — 標記已讀 { notificationId: string }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase'
import { verifyAdminSession } from '@/lib/auth-middleware'

const supabase = createServiceSupabase()

function checkAuth(request: NextRequest): boolean {
  const token = request.cookies.get('admin_session')?.value
  return !!token && verifyAdminSession(token)
}

export async function GET(request: NextRequest) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: '未授權' }, { status: 401 })
  }

  try {
    const { data, error } = await supabase
      .from('coach_notifications')
      .select('*')
      .order('date', { ascending: false })
      .limit(20)

    if (error) {
      // 表不存在時返回空陣列
      return NextResponse.json({ notifications: [] })
    }

    return NextResponse.json({ notifications: data || [] })
  } catch {
    return NextResponse.json({ notifications: [] })
  }
}

export async function POST(request: NextRequest) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: '未授權' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { notificationId } = body

    if (notificationId === 'all') {
      await supabase
        .from('coach_notifications')
        .update({ read: true })
        .eq('read', false)
    } else if (notificationId) {
      await supabase
        .from('coach_notifications')
        .update({ read: true })
        .eq('id', notificationId)
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: '操作失敗' }, { status: 500 })
  }
}
