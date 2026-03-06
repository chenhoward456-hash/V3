import { NextRequest, NextResponse } from 'next/server'
import { verifyLineSignature, replyMessage } from '@/lib/line'
import { createServiceSupabase } from '@/lib/supabase'
import { createLogger } from '@/lib/logger'

const log = createLogger('LINE-Webhook')

export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    const signature = request.headers.get('x-line-signature')

    if (!signature || !verifyLineSignature(body, signature)) {
      log.warn('Invalid LINE signature')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 403 })
    }

    const data = JSON.parse(body)
    const events = data.events || []

    for (const event of events) {
      await handleEvent(event)
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    log.error('Webhook error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

async function handleEvent(event: any) {
  const userId = event.source?.userId
  if (!userId) return

  const supabase = createServiceSupabase()

  // 更新最後活動時間（不論事件類型）
  await supabase
    .from('clients')
    .update({ last_line_activity: new Date().toISOString() })
    .eq('line_user_id', userId)

  switch (event.type) {
    case 'follow':
      // 用戶加入好友
      log.info(`New follower: ${userId}`)
      await replyMessage(event.replyToken, [
        {
          type: 'text',
          text: '歡迎加入 Howard Protocol！\n\n請輸入你的學員代碼（8碼）來綁定帳號，例如：\n綁定 k8f3m2n5',
        },
      ])
      break

    case 'message':
      if (event.message?.type === 'text') {
        await handleTextMessage(event, userId, supabase)
      }
      break

    case 'unfollow':
      log.info(`Unfollowed: ${userId}`)
      // 清除 LINE 綁定
      await supabase
        .from('clients')
        .update({ line_user_id: null, last_line_activity: null })
        .eq('line_user_id', userId)
      break
  }
}

async function handleTextMessage(event: any, userId: string, supabase: any) {
  const text = (event.message.text || '').trim()

  // 綁定指令：「綁定 xxxxx」
  const bindMatch = text.match(/^綁定\s+([a-zA-Z0-9]+)$/i)
  if (bindMatch) {
    const code = bindMatch[1]
    await handleBind(event.replyToken, userId, code, supabase)
    return
  }

  // 查詢狀態
  if (text === '狀態' || text === '今天狀態') {
    await handleStatusQuery(event.replyToken, userId, supabase)
    return
  }

  // 預設回覆
  await replyMessage(event.replyToken, [
    {
      type: 'text',
      text: '指令列表：\n• 綁定 [學員代碼] — 綁定你的帳號\n• 狀態 — 查看今天的健康狀態',
    },
  ])
}

async function handleBind(replyToken: string, lineUserId: string, code: string, supabase: any) {
  // 檢查是否已經綁定
  const { data: existing } = await supabase
    .from('clients')
    .select('id, name')
    .eq('line_user_id', lineUserId)
    .single()

  if (existing) {
    await replyMessage(replyToken, [
      { type: 'text', text: `你已經綁定帳號「${existing.name}」了！` },
    ])
    return
  }

  // 查詢學員代碼
  const { data: client } = await supabase
    .from('clients')
    .select('id, name, line_user_id')
    .eq('unique_code', code)
    .single()

  if (!client) {
    await replyMessage(replyToken, [
      { type: 'text', text: `找不到學員代碼「${code}」，請確認後再試。` },
    ])
    return
  }

  if (client.line_user_id) {
    await replyMessage(replyToken, [
      { type: 'text', text: '這個帳號已經綁定了其他 LINE，請聯繫教練處理。' },
    ])
    return
  }

  // 綁定
  await supabase
    .from('clients')
    .update({
      line_user_id: lineUserId,
      last_line_activity: new Date().toISOString(),
    })
    .eq('id', client.id)

  await replyMessage(replyToken, [
    { type: 'text', text: `綁定成功！歡迎 ${client.name} 🎉\n\n輸入「狀態」可查看今天的健康數據。` },
  ])
}

async function handleStatusQuery(replyToken: string, lineUserId: string, supabase: any) {
  const { data: client } = await supabase
    .from('clients')
    .select('id, name')
    .eq('line_user_id', lineUserId)
    .single()

  if (!client) {
    await replyMessage(replyToken, [
      { type: 'text', text: '你還沒綁定帳號，請先輸入「綁定 [學員代碼]」。' },
    ])
    return
  }

  const today = new Date().toISOString().split('T')[0]

  // 並行查詢今日資料
  const [wellness, nutrition, training] = await Promise.all([
    supabase.from('daily_wellness').select('*').eq('client_id', client.id).eq('date', today).single(),
    supabase.from('nutrition_logs').select('*').eq('client_id', client.id).eq('date', today).single(),
    supabase.from('training_logs').select('*').eq('client_id', client.id).eq('date', today).single(),
  ])

  const lines: string[] = [`📊 ${client.name} 今日狀態\n`]

  if (wellness.data) {
    const w = wellness.data
    lines.push(`😴 睡眠：${w.sleep_quality || '-'}/5`)
    lines.push(`⚡ 精力：${w.energy_level || '-'}/5`)
    lines.push(`😊 心情：${w.mood || '-'}/5`)
    if (w.hrv) lines.push(`💓 HRV：${w.hrv}ms`)
  } else {
    lines.push('⚠️ 今天還沒填寫身心狀態')
  }

  lines.push('')

  if (nutrition.data) {
    const n = nutrition.data
    lines.push(`🍽️ 飲食：${n.compliant ? '✅ 達標' : '❌ 未達標'}`)
    if (n.protein_grams) lines.push(`🥩 蛋白質：${n.protein_grams}g`)
    if (n.water_ml) lines.push(`💧 水量：${n.water_ml}ml`)
  } else {
    lines.push('⚠️ 今天還沒記錄飲食')
  }

  lines.push('')

  if (training.data) {
    lines.push(`🏋️ 訓練：${training.data.training_type} (RPE ${training.data.rpe || '-'})`)
  } else {
    lines.push('⚠️ 今天還沒記錄訓練')
  }

  await replyMessage(replyToken, [{ type: 'text', text: lines.join('\n') }])
}
