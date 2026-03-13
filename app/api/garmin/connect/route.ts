/**
 * Garmin OAuth 1.0a - Step 1: 發起連線
 * POST /api/garmin/connect
 * Body: { clientId: string }
 *
 * 回傳 Garmin 授權頁面 URL，前端導向用戶去授權
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase'
import { rateLimit, getClientIP } from '@/lib/auth-middleware'
import { getRequestToken } from '@/lib/garmin-api'

const supabaseAdmin = createServiceSupabase()

export async function POST(request: NextRequest) {
  const ip = getClientIP(request)
  const { allowed } = rateLimit(`garmin-connect:${ip}`, 5, 60_000)
  if (!allowed) {
    return NextResponse.json({ error: '請求過於頻繁，請稍後再試' }, { status: 429 })
  }

  try {
    const { clientId } = await request.json()
    if (!clientId) {
      return NextResponse.json({ error: '缺少 clientId' }, { status: 400 })
    }

    // 驗證客戶
    const { data: client, error: clientError } = await supabaseAdmin
      .from('clients')
      .select('id, is_active, expires_at')
      .eq('unique_code', clientId)
      .single()

    if (clientError || !client) {
      return NextResponse.json({ error: '找不到客戶' }, { status: 404 })
    }
    if (client.is_active === false) {
      return NextResponse.json({ error: '帳號已暫停' }, { status: 403 })
    }

    // 建立 callback URL
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://howard456.vercel.app'
    const callbackUrl = `${siteUrl}/api/garmin/callback`

    // 取得 Garmin Request Token
    const { oauthToken, oauthTokenSecret, authorizeUrl } = await getRequestToken(callbackUrl)

    // 清除舊的 OAuth state
    await supabaseAdmin
      .from('garmin_oauth_states')
      .delete()
      .eq('client_id', client.id)

    // 儲存 OAuth state（供 callback 使用）
    await supabaseAdmin
      .from('garmin_oauth_states')
      .insert({
        client_id: client.id,
        oauth_token: oauthToken,
        oauth_token_secret: oauthTokenSecret,
      })

    return NextResponse.json({
      authorizeUrl,
      message: '請前往 Garmin 授權頁面完成連線',
    })
  } catch (error: unknown) {
    console.error('Garmin connect error:', error)

    if (error instanceof Error && error.message?.includes('尚未設定')) {
      return NextResponse.json({ error: 'Garmin API 尚未設定，請聯繫管理員' }, { status: 501 })
    }

    return NextResponse.json({ error: '連線 Garmin 失敗，請稍後再試' }, { status: 500 })
  }
}
