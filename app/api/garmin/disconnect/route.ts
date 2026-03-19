/**
 * 解除 Garmin 連線
 * POST /api/garmin/disconnect
 * Body: { clientId: string }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createLogger } from '@/lib/logger'
import { createServiceSupabase } from '@/lib/supabase'
import { rateLimit, getClientIP } from '@/lib/auth-middleware'

const logger = createLogger('api-garmin-disconnect')
const supabaseAdmin = createServiceSupabase()

export async function POST(request: NextRequest) {
  const ip = getClientIP(request)
  const { allowed } = await rateLimit(`garmin-disconnect:${ip}`, 5, 60_000)
  if (!allowed) {
    return NextResponse.json({ error: '請求過於頻繁' }, { status: 429 })
  }

  try {
    const { clientId } = await request.json()
    if (!clientId) {
      return NextResponse.json({ error: '缺少 clientId' }, { status: 400 })
    }

    const { data: client } = await supabaseAdmin
      .from('clients')
      .select('id')
      .eq('unique_code', clientId)
      .single()

    if (!client) {
      return NextResponse.json({ error: '找不到客戶' }, { status: 404 })
    }

    await supabaseAdmin
      .from('garmin_connections')
      .delete()
      .eq('client_id', client.id)

    return NextResponse.json({
      success: true,
      message: '已解除 Garmin 連線',
    })
  } catch (error) {
    logger.error('POST /api/garmin/disconnect unexpected error', error)
    return NextResponse.json({ error: '操作失敗' }, { status: 500 })
  }
}
