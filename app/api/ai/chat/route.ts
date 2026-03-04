import { NextRequest, NextResponse } from 'next/server'
import { askClaude, ChatMessage } from '@/lib/claude'
import { rateLimit, getClientIP } from '@/lib/auth-middleware'
import { createServiceSupabase } from '@/lib/supabase'

const supabase = createServiceSupabase()

export async function POST(request: NextRequest) {
  const ip = getClientIP(request)
  const { allowed } = rateLimit(`ai-chat:${ip}`, 10, 60_000)
  if (!allowed) {
    return NextResponse.json({ error: '請求過於頻繁，請稍後再試' }, { status: 429 })
  }

  try {
    const body = await request.json()
    const { messages, systemPrompt, clientId } = body as {
      messages: ChatMessage[]
      systemPrompt?: string
      clientId?: string
    }

    // 驗證身份：必須提供有效的 clientId（unique_code）
    if (!clientId || typeof clientId !== 'string') {
      return NextResponse.json({ error: '缺少客戶身份驗證' }, { status: 401 })
    }

    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id, is_active, expires_at, ai_chat_enabled')
      .eq('unique_code', clientId)
      .single()

    if (clientError || !client) {
      return NextResponse.json({ error: '無效的客戶 ID' }, { status: 401 })
    }

    if (!client.is_active) {
      return NextResponse.json({ error: '帳號已暫停' }, { status: 403 })
    }

    if (client.expires_at && new Date(client.expires_at) < new Date()) {
      return NextResponse.json({ error: '帳號已過期' }, { status: 403 })
    }

    if (client.ai_chat_enabled === false) {
      return NextResponse.json({ error: 'AI 聊天功能未啟用' }, { status: 403 })
    }

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: '缺少 messages' }, { status: 400 })
    }

    // 限制對話長度避免 token 爆炸
    const trimmedMessages = messages.slice(-20)

    const reply = await askClaude(trimmedMessages, systemPrompt)

    return NextResponse.json({ reply })
  } catch (err: any) {
    console.error('[AI Chat Error]', err?.status, err?.message || err)

    if (err?.status === 401) {
      return NextResponse.json({ error: 'API Key 無效' }, { status: 500 })
    }
    if (err?.status === 429) {
      return NextResponse.json({ error: 'AI 服務額度已滿，請稍後再試' }, { status: 429 })
    }
    if (err?.status === 400) {
      return NextResponse.json({ error: 'AI 請求格式錯誤' }, { status: 400 })
    }

    return NextResponse.json({ error: 'AI 回覆失敗，請稍後再試' }, { status: 500 })
  }
}
