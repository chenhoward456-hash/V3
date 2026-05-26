import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminSession } from '@/lib/auth-middleware'
import { runAgent } from '@/lib/agent-runner'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

function checkAuth(request: NextRequest): boolean {
  const token = request.cookies.get('admin_session')?.value
  return !!token && verifyAdminSession(token)
}

export async function POST(request: NextRequest) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: '未授權' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { userMessage, contextHint, conversationHistory } = body

    if (!userMessage) return NextResponse.json({ error: '缺少 userMessage' }, { status: 400 })

    const result = await runAgent({
      userMessage,
      contextHint,
      conversationHistory: conversationHistory ?? [],
      maxTurns: 6,
    })

    return NextResponse.json({ success: true, ...result })
  } catch (err) {
    console.error('[agent-run] error:', err)
    return NextResponse.json({ error: (err as Error).message || 'agent run failed' }, { status: 500 })
  }
}
