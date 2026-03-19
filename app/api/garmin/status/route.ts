/**
 * Garmin 連線狀態查詢
 * GET /api/garmin/status?clientId=xxx
 */

import { NextRequest, NextResponse } from 'next/server'
import { createLogger } from '@/lib/logger'
import { createServiceSupabase } from '@/lib/supabase'

const logger = createLogger('api-garmin-status')
const supabaseAdmin = createServiceSupabase()

export async function GET(request: NextRequest) {
  try {
    const clientId = request.nextUrl.searchParams.get('clientId')
    if (!clientId) {
      return NextResponse.json({ error: '缺少 clientId' }, { status: 400 })
    }

    // 驗證客戶
    const { data: client } = await supabaseAdmin
      .from('clients')
      .select('id')
      .eq('unique_code', clientId)
      .single()

    if (!client) {
      return NextResponse.json({ error: '找不到客戶' }, { status: 404 })
    }

    // 查詢連線狀態
    const { data: connection } = await supabaseAdmin
      .from('garmin_connections')
      .select('last_sync_at, created_at')
      .eq('client_id', client.id)
      .single()

    // 檢查 Garmin API 是否有設定
    const garminConfigured = !!(process.env.GARMIN_CONSUMER_KEY && process.env.GARMIN_CONSUMER_SECRET)

    return NextResponse.json({
      configured: garminConfigured,
      connected: !!connection,
      lastSyncAt: connection?.last_sync_at || null,
      connectedAt: connection?.created_at || null,
    })
  } catch (error) {
    logger.error('GET /api/garmin/status unexpected error', error)
    return NextResponse.json({ error: '查詢失敗' }, { status: 500 })
  }
}
