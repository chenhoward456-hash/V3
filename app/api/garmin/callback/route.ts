/**
 * Garmin OAuth 1.0a - Step 2: 授權回調
 * GET /api/garmin/callback?oauth_token=xxx&oauth_verifier=yyy
 *
 * Garmin 授權後重導回此 URL，用 verifier 換取 Access Token
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase'
import { getAccessToken } from '@/lib/garmin-api'

const supabaseAdmin = createServiceSupabase()

export async function GET(request: NextRequest) {
  try {
    const oauthToken = request.nextUrl.searchParams.get('oauth_token')
    const oauthVerifier = request.nextUrl.searchParams.get('oauth_verifier')

    if (!oauthToken || !oauthVerifier) {
      return redirectWithMessage(request, 'error', '授權參數不完整')
    }

    // 查找對應的 OAuth state
    const { data: state, error: stateError } = await supabaseAdmin
      .from('garmin_oauth_states')
      .select('*')
      .eq('oauth_token', oauthToken)
      .single()

    if (stateError || !state) {
      return redirectWithMessage(request, 'error', '授權已過期，請重新連線')
    }

    // 檢查是否超過 10 分鐘
    const createdAt = new Date(state.created_at).getTime()
    if (Date.now() - createdAt > 10 * 60 * 1000) {
      await supabaseAdmin.from('garmin_oauth_states').delete().eq('id', state.id)
      return redirectWithMessage(request, 'error', '授權已過期，請重新連線')
    }

    // 換取 Access Token
    const { accessToken, accessTokenSecret } = await getAccessToken(
      oauthToken,
      state.oauth_token_secret,
      oauthVerifier
    )

    // 儲存 Access Token（upsert by client_id）
    const { error: upsertError } = await supabaseAdmin
      .from('garmin_connections')
      .upsert({
        client_id: state.client_id,
        access_token: accessToken,
        access_token_secret: accessTokenSecret,
        last_sync_at: null,
      }, { onConflict: 'client_id' })

    if (upsertError) {
      console.error('Save Garmin token error:', upsertError)
      return redirectWithMessage(request, 'error', '儲存連線資訊失敗')
    }

    // 清除 OAuth state
    await supabaseAdmin.from('garmin_oauth_states').delete().eq('id', state.id)

    return redirectWithMessage(request, 'success', 'Garmin 連線成功！')
  } catch (error: any) {
    console.error('Garmin callback error:', error)
    return redirectWithMessage(request, 'error', '授權失敗，請重新連線')
  }
}

function redirectWithMessage(request: NextRequest, status: string, message: string) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://howard456.vercel.app'
  const url = new URL(siteUrl)
  url.searchParams.set('garmin_status', status)
  url.searchParams.set('garmin_message', message)
  return NextResponse.redirect(url.toString())
}
