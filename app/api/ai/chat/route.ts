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

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('[AI Chat Error] ANTHROPIC_API_KEY not set')
    return NextResponse.json({ error: 'AI 服務未設定，請聯繫管理員' }, { status: 500 })
  }

  try {
    const body = await request.json()
    const { messages, systemPrompt, clientId, image } = body as {
      messages: ChatMessage[]
      systemPrompt?: string
      clientId?: string
      /** Base64 JPEG image to attach to the latest user message */
      image?: string
    }

    // Attach image to the last user message if provided
    if (image && messages.length > 0) {
      const lastMsg = messages[messages.length - 1]
      if (lastMsg.role === 'user') {
        lastMsg.image = image
      }
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

    // AI 未開放的用戶：每月允許 1 次免費體驗，由後端計數
    if (!client.ai_chat_enabled) {
      const now = new Date()
      const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
      const { count } = await supabase
        .from('ai_chat_usage')
        .select('*', { count: 'exact', head: true })
        .eq('client_id', client.id)
        .gte('created_at', monthStart)

      if ((count ?? 0) >= 1) {
        return NextResponse.json({ error: '本月免費次數已用完，請升級方案', quota_exceeded: true }, { status: 403 })
      }

      // 記錄本次使用
      await supabase.from('ai_chat_usage').insert({ client_id: client.id })
    }

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: '缺少 messages' }, { status: 400 })
    }

    // 限制對話長度避免 token 爆炸
    const trimmedMessages = messages.slice(-20)

    let reply: string | null = null
    let lastErr: any = null

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        reply = await askClaude(trimmedMessages, systemPrompt)
        break
      } catch (e: any) {
        lastErr = e
        const code = e?.status || e?.statusCode
        // Only retry on 529 (overloaded) or 500 (internal server error)
        if ((code === 529 || code === 500) && attempt < 2) {
          await new Promise(r => setTimeout(r, (attempt + 1) * 2000)) // 2s, 4s
          continue
        }
        throw e
      }
    }

    if (reply === null) throw lastErr

    return NextResponse.json({ reply })
  } catch (err: any) {
    const status = err?.status || err?.statusCode
    const errorMessage = err?.error?.error?.message || err?.error?.message || err?.message || String(err)
    const errorType = err?.error?.error?.type || err?.error?.type || err?.type || 'unknown'
    console.error('[AI Chat Error]', JSON.stringify({
      status,
      type: errorType,
      message: errorMessage,
      raw: err?.error || err?.message || String(err),
    }))

    if (status === 401) {
      return NextResponse.json({ error: 'API Key 無效，請檢查 ANTHROPIC_API_KEY 設定' }, { status: 500 })
    }
    if (status === 429) {
      return NextResponse.json({ error: 'AI 服務額度已滿，請稍後再試' }, { status: 429 })
    }
    if (status === 400) {
      // Anthropic 在餘額不足時回傳 400，特別處理
      if (errorMessage.includes('credit balance is too low')) {
        return NextResponse.json({ error: 'AI 服務餘額不足，請聯繫管理員充值' }, { status: 503 })
      }
      return NextResponse.json({ error: `AI 請求錯誤：${errorMessage}` }, { status: 400 })
    }
    if (status === 403) {
      return NextResponse.json({ error: 'API 權限不足，請確認帳戶已啟用且有餘額' }, { status: 500 })
    }
    if (status === 404) {
      return NextResponse.json({ error: '模型不存在，請確認 API 方案支援此模型' }, { status: 500 })
    }
    if (status === 529) {
      return NextResponse.json({ error: 'Anthropic API 過載中，請稍後再試' }, { status: 503 })
    }

    return NextResponse.json(
      { error: `AI 回覆失敗（${errorType}: ${errorMessage}）` },
      { status: 500 }
    )
  }
}
