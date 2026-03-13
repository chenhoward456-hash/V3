/**
 * Garmin 數據同步
 * POST /api/garmin/sync
 * Body: { clientId: string, days?: number }
 *
 * 使用已儲存的 Access Token 從 Garmin API 拉取健康數據
 * 寫入 daily_wellness 表（只更新穿戴裝置欄位，保留手動感受）
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase'
import { rateLimit, getClientIP } from '@/lib/auth-middleware'
import { fetchGarminDailies } from '@/lib/garmin-api'

const supabaseAdmin = createServiceSupabase()

export async function POST(request: NextRequest) {
  const ip = getClientIP(request)
  const { allowed } = rateLimit(`garmin-sync:${ip}`, 3, 60_000)
  if (!allowed) {
    return NextResponse.json({ error: '請求過於頻繁，請稍後再試' }, { status: 429 })
  }

  try {
    const { clientId, days = 30 } = await request.json()
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

    // 取得 Garmin connection
    const { data: connection, error: connError } = await supabaseAdmin
      .from('garmin_connections')
      .select('access_token, access_token_secret')
      .eq('client_id', client.id)
      .single()

    if (connError || !connection) {
      return NextResponse.json({ error: '尚未連線 Garmin，請先完成授權' }, { status: 404 })
    }

    // 限制最多拉取 90 天
    const syncDays = Math.min(Math.max(1, days), 90)

    // 從 Garmin API 拉取數據
    const dailies = await fetchGarminDailies(
      {
        accessToken: connection.access_token,
        accessTokenSecret: connection.access_token_secret,
      },
      syncDays
    )

    if (dailies.length === 0) {
      // 更新 last_sync_at
      await supabaseAdmin
        .from('garmin_connections')
        .update({ last_sync_at: new Date().toISOString() })
        .eq('client_id', client.id)

      return NextResponse.json({
        success: true,
        message: '沒有找到新的 Garmin 數據',
        imported: 0,
        total: 0,
      })
    }

    // 查詢現有 daily_wellness（保留手動數據）
    const dates = dailies.map(d => d.date)
    const { data: existingRecords } = await supabaseAdmin
      .from('daily_wellness')
      .select('date, sleep_quality, energy_level, mood, training_drive, cognitive_clarity, stress_level, period_start, note')
      .eq('client_id', client.id)
      .in('date', dates)

    const existingMap = new Map<string, any>()
    for (const rec of existingRecords || []) {
      existingMap.set(rec.date, rec)
    }

    // 批量 upsert
    let imported = 0
    const batchSize = 50

    for (let i = 0; i < dailies.length; i += batchSize) {
      const batch = dailies.slice(i, i + batchSize)
      const upsertData = batch.map(row => {
        const existing = existingMap.get(row.date)
        return {
          client_id: client.id,
          date: row.date,
          // 保留手動感受
          sleep_quality: existing?.sleep_quality ?? null,
          energy_level: existing?.energy_level ?? null,
          mood: existing?.mood ?? null,
          training_drive: existing?.training_drive ?? null,
          cognitive_clarity: existing?.cognitive_clarity ?? null,
          stress_level: existing?.stress_level ?? null,
          period_start: existing?.period_start ?? false,
          note: existing?.note ?? null,
          // 穿戴裝置數據
          device_recovery_score: row.device_recovery_score,
          resting_hr: row.resting_hr,
          hrv: row.hrv,
          wearable_sleep_score: row.wearable_sleep_score,
          respiratory_rate: row.respiratory_rate,
        }
      })

      const { error: upsertError } = await supabaseAdmin
        .from('daily_wellness')
        .upsert(upsertData, { onConflict: 'client_id,date' })

      if (!upsertError) {
        imported += batch.length
      }
    }

    // 更新 last_sync_at
    await supabaseAdmin
      .from('garmin_connections')
      .update({ last_sync_at: new Date().toISOString() })
      .eq('client_id', client.id)

    return NextResponse.json({
      success: true,
      message: `成功同步 ${imported} 天的 Garmin 數據`,
      imported,
      total: dailies.length,
    })
  } catch (error: unknown) {
    console.error('Garmin sync error:', error)

    // Token 失效的話提示重新授權
    const errorMessage = error instanceof Error ? error.message : String(error)
    if (errorMessage.includes('401') || errorMessage.includes('403')) {
      return NextResponse.json({
        error: 'Garmin 授權已過期，請重新連線',
        needReconnect: true,
      }, { status: 401 })
    }

    return NextResponse.json({ error: '同步失敗，請稍後再試' }, { status: 500 })
  }
}
