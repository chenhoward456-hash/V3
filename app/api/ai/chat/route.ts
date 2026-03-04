import { NextRequest, NextResponse } from 'next/server'
import { askClaude, ChatMessage } from '@/lib/claude'
import { rateLimit } from '@/lib/auth-middleware'

export async function POST(request: NextRequest) {
  // Rate limit: 每分鐘 10 次
  const ip = request.headers.get('x-forwarded-for') || 'unknown'
  const { allowed } = rateLimit(`ai-chat:${ip}`, 10, 60_000)
  if (!allowed) {
    return NextResponse.json({ error: '請求過於頻繁，請稍後再試' }, { status: 429 })
  }

  try {
    const body = await request.json()
    const { messages, systemPrompt } = body as {
      messages: ChatMessage[]
      systemPrompt?: string
    }

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: '缺少 messages' }, { status: 400 })
    }

    // 限制對話長度避免 token 爆炸
    const trimmedMessages = messages.slice(-20)

    const reply = await askClaude(trimmedMessages, systemPrompt)

    return NextResponse.json({ reply })
  } catch (err: any) {
    if (err?.status === 401) {
      return NextResponse.json({ error: 'API Key 無效' }, { status: 500 })
    }

    return NextResponse.json({ error: 'AI 回覆失敗' }, { status: 500 })
  }
}
