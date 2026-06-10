/**
 * 通用 endpoint：把任意文字訊息陣列推到 admin LINE
 * 用途：Claude / Howard 寫好文案，推到 admin LINE 讓 Howard copy-paste 到私 LINE
 *
 * Auth: CRON_SECRET header 或 admin session
 * Usage: POST /api/admin/push-to-admin  Body: { messages: string[] }
 */

import { NextRequest, NextResponse } from 'next/server'
import { pushMessage } from '@/lib/line'
import { verifyAdminSession } from '@/lib/auth-middleware'

export const maxDuration = 30

function verifyAuth(request: NextRequest): boolean {
  const cronSecret = request.headers.get('authorization')
  if (cronSecret === `Bearer ${process.env.CRON_SECRET}`) return true
  const token = request.cookies.get('admin_session')?.value
  return !!token && verifyAdminSession(token)
}

export async function POST(request: NextRequest) {
  if (!verifyAuth(request)) return NextResponse.json({ error: '未授權' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const messages = body.messages as string[] | undefined
  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: '缺 messages 陣列' }, { status: 400 })
  }

  const adminLineId = process.env.ADMIN_LINE_USER_ID
  if (!adminLineId) return NextResponse.json({ error: '無 admin LINE id' }, { status: 500 })

  let pushed = 0
  for (const text of messages) {
    if (!text || typeof text !== 'string') continue
    if (text.length > 4800) continue  // LINE 上限 5000
    await pushMessage(adminLineId, [{ type: 'text', text }]).catch(() => {})
    await new Promise(r => setTimeout(r, 400))
    pushed++
  }

  return NextResponse.json({ ok: true, pushed })
}
