/**
 * 穿戴裝置數據批量匯入 API
 *
 * POST /api/wearable-import
 * Body: { clientId, format: 'garmin' | 'apple' | 'json', data: string }
 *
 * 將 Garmin Connect / Apple Health 匯出的 CSV/JSON 解析後批量寫入 daily_wellness
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase'
import { rateLimit, getClientIP } from '@/lib/auth-middleware'
import { parseGarminCSV, parseAppleHealthCSV, parseWearableJSON, WearableRow } from '@/lib/wearable-parser'

const supabaseAdmin = createServiceSupabase()

export async function POST(request: NextRequest) {
  const ip = getClientIP(request)
  const { allowed } = await rateLimit(`wearable-import:${ip}`, 5, 60_000)
  if (!allowed) {
    return NextResponse.json({ error: '請求過於頻繁，請稍後再試' }, { status: 429 })
  }

  try {
    const body = await request.json()
    const { clientId, format, data } = body

    if (!clientId || !format || !data) {
      return NextResponse.json({ error: '缺少必要參數（clientId, format, data）' }, { status: 400 })
    }

    if (!['garmin', 'apple', 'json'].includes(format)) {
      return NextResponse.json({ error: '不支援的格式，請使用 garmin / apple / json' }, { status: 400 })
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
    if (client.expires_at && new Date(client.expires_at) < new Date()) {
      return NextResponse.json({ error: '帳號已過期' }, { status: 403 })
    }

    // 解析數據
    let rows: WearableRow[]
    try {
      switch (format) {
        case 'garmin':
          rows = parseGarminCSV(data)
          break
        case 'apple':
          rows = parseAppleHealthCSV(data)
          break
        case 'json':
          rows = parseWearableJSON(data)
          break
        default:
          rows = []
      }
    } catch (parseError: unknown) {
      return NextResponse.json({
        error: '檔案解析失敗',
        detail: '請確認檔案格式為支援的穿戴裝置匯出格式',
      }, { status: 400 })
    }

    if (rows.length === 0) {
      return NextResponse.json({
        error: '沒有找到有效的穿戴裝置數據，請確認檔案格式正確',
      }, { status: 400 })
    }

    // 限制一次最多匯入 365 天
    if (rows.length > 365) {
      rows = rows.slice(-365)
    }

    // 查詢現有的 daily_wellness 記錄
    const dates = rows.map(r => r.date)
    const { data: existingRecords } = await supabaseAdmin
      .from('daily_wellness')
      .select('date, sleep_quality, energy_level, mood, training_drive, cognitive_clarity, stress_level, period_start, note')
      .eq('client_id', client.id)
      .in('date', dates)

    const existingMap = new Map<string, any>()
    for (const rec of existingRecords || []) {
      existingMap.set(rec.date, rec)
    }

    // 批量 upsert — 只更新穿戴裝置欄位，保留手動填寫的感受數據
    let imported = 0
    let skipped = 0
    const errors: string[] = []

    // 分批處理，每批 50 筆
    const batchSize = 50
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize)
      const upsertData = batch.map(row => {
        const existing = existingMap.get(row.date)
        return {
          client_id: client.id,
          date: row.date,
          // 保留既有的手動感受數據
          sleep_quality: existing?.sleep_quality ?? null,
          energy_level: existing?.energy_level ?? null,
          mood: existing?.mood ?? null,
          training_drive: existing?.training_drive ?? null,
          cognitive_clarity: existing?.cognitive_clarity ?? null,
          stress_level: existing?.stress_level ?? null,
          period_start: existing?.period_start ?? false,
          note: existing?.note ?? null,
          // 穿戴裝置數據（新數據覆蓋）
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

      if (upsertError) {
        console.error('[wearable-import] Upsert batch failed:', { batch: Math.floor(i / batchSize) + 1, error: upsertError.message })
        errors.push(`批次 ${Math.floor(i / batchSize) + 1} 匯入失敗`)
        skipped += batch.length
      } else {
        imported += batch.length
      }
    }

    return NextResponse.json({
      success: true,
      message: `成功匯入 ${imported} 天的穿戴裝置數據`,
      imported,
      skipped,
      total: rows.length,
      ...(errors.length > 0 && { errors }),
    })
  } catch (error: unknown) {
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 })
  }
}
