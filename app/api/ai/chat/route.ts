import { NextRequest, NextResponse } from 'next/server'
import { askClaude, ChatMessage } from '@/lib/claude'
import { rateLimit, getClientIP } from '@/lib/auth-middleware'
import { createServiceSupabase } from '@/lib/supabase'
import { createLogger } from '@/lib/logger'

const logger = createLogger('ai-chat')

export const maxDuration = 60

const supabase = createServiceSupabase()

export async function POST(request: NextRequest) {
  const ip = getClientIP(request)
  const { allowed } = rateLimit(`ai-chat:${ip}`, 10, 60_000)
  if (!allowed) {
    return NextResponse.json({ error: '請求過於頻繁，請稍後再試' }, { status: 429 })
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    logger.error('ANTHROPIC_API_KEY not set')
    return NextResponse.json({ error: 'AI 服務未設定，請聯繫管理員' }, { status: 500 })
  }

  try {
    const body = await request.json()
    const { messages, systemPrompt: clientContext, clientId, image } = body as {
      messages: ChatMessage[]
      systemPrompt?: string
      clientId?: string
      /** Base64 JPEG image to attach to the latest user message */
      image?: string
    }

    // Validate image size (≤ 2MB ≈ 2.67M base64 chars)
    if (image && image.length > 2_670_000) {
      return NextResponse.json({ error: '圖片過大，請壓縮後再試（上限 2MB）' }, { status: 400 })
    }

    // Validate messages
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: '缺少 messages' }, { status: 400 })
    }
    for (const msg of messages) {
      if (msg.role !== 'user' && msg.role !== 'assistant') {
        return NextResponse.json({ error: '無效的 message role' }, { status: 400 })
      }
      if (typeof msg.content !== 'string' || msg.content.length > 10000) {
        return NextResponse.json({ error: '訊息內容過長（上限 10000 字元）' }, { status: 400 })
      }
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

    // 每日用量上限（防止 API 費用被灌爆）
    const todayStr = new Date().toISOString().split('T')[0]
    const { count: dailyCount } = await supabase
      .from('ai_chat_usage')
      .select('*', { count: 'exact', head: true })
      .eq('client_id', client.id)
      .gte('created_at', todayStr)

    if ((dailyCount ?? 0) >= 30) {
      return NextResponse.json({ error: '今日 AI 對話次數已達上限（30 次），明天再來吧', daily_limit: true }, { status: 429 })
    }

    // AI 未開放的用戶：每月允許 1 次免費體驗，由後端計數
    let isFreeQuotaUse = false
    if (!client.ai_chat_enabled) {
      const now = new Date()
      const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`

      // 先檢查本月是否已有使用記錄
      const { count } = await supabase
        .from('ai_chat_usage')
        .select('*', { count: 'exact', head: true })
        .eq('client_id', client.id)
        .gte('created_at', monthStart)

      if ((count ?? 0) >= 1) {
        return NextResponse.json({ error: '本月免費次數已用完，請升級方案', quota_exceeded: true }, { status: 403 })
      }

      // 標記為免費額度使用，AI 回覆成功後才記錄
      isFreeQuotaUse = true
    }

    // 限制對話長度避免 token 爆炸
    const trimmedMessages = messages.slice(-20)

    let reply: string | null = null
    let lastErr: unknown = null
    const MAX_RETRIES = 5

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        reply = await askClaude(trimmedMessages, clientContext)
        break
      } catch (e: unknown) {
        lastErr = e
        const errObj = e as Record<string, unknown> | undefined
        const code = errObj?.status || errObj?.statusCode
        // Retry on 529 (overloaded), 500 (internal server error), or 429 (rate limited)
        if ((code === 529 || code === 500 || code === 429) && attempt < MAX_RETRIES - 1) {
          const delay = Math.min(2000 * Math.pow(2, attempt), 16000) // 2s, 4s, 8s, 16s
          logger.info(`Retry attempt ${attempt + 1}/${MAX_RETRIES - 1} after ${delay}ms`, { status: code })
          await new Promise(r => setTimeout(r, delay))
          continue
        }
        throw e
      }
    }

    if (reply === null) throw lastErr

    // 所有成功的 AI 回覆都記錄用量（用於每日上限 + 免費額度計數）
    await supabase.from('ai_chat_usage').insert({ client_id: client.id }).then(({ error: insertError }) => {
      if (insertError) logger.error('插入使用記錄失敗', insertError)
    })

    return NextResponse.json({ reply })
  } catch (err: unknown) {
    const errObj = err as Record<string, unknown> | undefined
    const errError = errObj?.error as Record<string, unknown> | undefined
    const errErrorInner = errError?.error as Record<string, unknown> | undefined
    const status = errObj?.status || errObj?.statusCode
    const errorMessage = (errErrorInner?.message || errError?.message || (err instanceof Error ? err.message : null) || String(err)) as string
    const errorType = (errErrorInner?.type || errError?.type || errObj?.type || 'unknown') as string
    logger.error('AI Chat Error', err, {
      status,
      type: errorType,
      message: errorMessage,
    })

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
      return NextResponse.json({ error: 'AI 請求錯誤' }, { status: 400 })
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
      { error: 'AI 回覆失敗，請稍後再試' },
      { status: 500 }
    )
  }
}
