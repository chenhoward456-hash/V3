/**
 * LINE Bot Webhook — 接收學員在 LINE 裡的訊息
 *
 * 支援指令：
 *   「體重 75.5」 → 記錄今天體重
 *   「飲食 合規」/「飲食 不合規」 → 記錄今天飲食
 *   「狀態」 → 查看本週摘要
 *   「幫助」 → 顯示可用指令
 *
 * 學員綁定：
 *   首次使用需發送「綁定 XXXXX」（unique_code）完成綁定
 *   綁定後 LINE userId 會存入 clients 表
 */

import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase'

const supabase = createServiceSupabase()

function verifySignature(body: string, signature: string): boolean {
  const secret = process.env.LINE_CHANNEL_SECRET
  if (!secret) return false
  const hash = crypto.createHmac('sha256', secret).update(body).digest('base64')
  return hash === signature
}

async function replyMessage(replyToken: string, text: string) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN
  if (!token) return
  await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      replyToken,
      messages: [{ type: 'text', text }],
    }),
  })
}

async function getClientByLineUserId(userId: string) {
  const { data } = await supabase
    .from('clients')
    .select('*')
    .eq('line_user_id', userId)
    .single()
  return data
}

async function handleTextMessage(userId: string, replyToken: string, text: string) {
  const msg = text.trim()
  const today = new Date().toISOString().split('T')[0]

  // ── 綁定指令 ──
  if (msg.startsWith('綁定 ') || msg.startsWith('綁定')) {
    const code = msg.replace('綁定', '').trim()
    if (!code) {
      await replyMessage(replyToken, '請輸入你的學員代碼，例如：\n綁定 abc123')
      return
    }
    const { data: client, error } = await supabase
      .from('clients')
      .select('id, name')
      .eq('unique_code', code)
      .single()

    if (error || !client) {
      await replyMessage(replyToken, `找不到代碼「${code}」的學員，請確認後重試。`)
      return
    }

    await supabase.from('clients').update({ line_user_id: userId }).eq('id', client.id)
    await replyMessage(replyToken, `綁定成功！${client.name}，之後你可以直接在這裡記錄體重和飲食。\n\n輸入「幫助」查看所有指令。`)
    return
  }

  // ── 以下指令需要已綁定 ──
  const client = await getClientByLineUserId(userId)
  if (!client) {
    await replyMessage(replyToken, '你還沒有綁定帳號。\n請輸入「綁定 你的學員代碼」來開始。\n\n學員代碼可以在你的個人頁面網址中找到。')
    return
  }

  // ── 體重記錄 ──
  if (msg.startsWith('體重')) {
    const weightStr = msg.replace('體重', '').trim()
    const weight = parseFloat(weightStr)
    if (isNaN(weight) || weight < 20 || weight > 300) {
      await replyMessage(replyToken, '請輸入正確的體重，例如：\n體重 75.5')
      return
    }

    const { error } = await supabase.from('body_composition').upsert(
      { client_id: client.id, date: today, weight },
      { onConflict: 'client_id,date' }
    )

    if (error) {
      await replyMessage(replyToken, '記錄失敗，請稍後再試。')
    } else {
      await replyMessage(replyToken, `✅ 已記錄今天體重 ${weight} kg\n\n持續記錄，系統每週會自動分析趨勢！`)
    }
    return
  }

  // ── 飲食記錄 ──
  if (msg.startsWith('飲食')) {
    const detail = msg.replace('飲食', '').trim()
    const compliant = detail === '合規' || detail === '達標' || detail === 'ok' || detail === 'OK'
    const notCompliant = detail === '不合規' || detail === '沒達標' || detail === '爆' || detail === 'no'

    if (!compliant && !notCompliant) {
      await replyMessage(replyToken, '請輸入飲食狀態：\n飲食 合規\n飲食 不合規')
      return
    }

    const { error } = await supabase.from('nutrition_logs').upsert(
      { client_id: client.id, date: today, compliant },
      { onConflict: 'client_id,date' }
    )

    if (error) {
      await replyMessage(replyToken, '記錄失敗，請稍後再試。')
    } else {
      await replyMessage(replyToken, compliant
        ? '✅ 今天飲食合規，做得好！'
        : '📝 已記錄，明天繼續努力！偶爾一次不影響大局。')
    }
    return
  }

  // ── 狀態查詢 ──
  if (msg === '狀態' || msg === '查詢') {
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const since = sevenDaysAgo.toISOString().split('T')[0]

    const [bodyRes, nutritionRes, trainingRes] = await Promise.all([
      supabase.from('body_composition').select('weight, date').eq('client_id', client.id).gte('date', since).order('date', { ascending: false }).limit(7),
      supabase.from('nutrition_logs').select('compliant, date').eq('client_id', client.id).gte('date', since),
      supabase.from('training_logs').select('training_type, date').eq('client_id', client.id).gte('date', since),
    ])

    const weights = bodyRes.data || []
    const nutrition = nutritionRes.data || []
    const training = trainingRes.data || []

    const latestWeight = weights[0]?.weight ? `${weights[0].weight} kg（${weights[0].date}）` : '無記錄'
    const compliantDays = nutrition.filter((n: any) => n.compliant).length
    const trainingDays = training.filter((t: any) => t.training_type !== 'rest').length

    await replyMessage(replyToken,
      `📊 ${client.name} 本週摘要\n\n` +
      `⚖️ 最新體重：${latestWeight}\n` +
      `🥗 飲食合規：${compliantDays}/${nutrition.length} 天\n` +
      `🏋️ 訓練天數：${trainingDays} 天\n\n` +
      `繼續保持！有問題隨時問我。`)
    return
  }

  // ── 幫助 ──
  if (msg === '幫助' || msg === 'help' || msg === '?') {
    await replyMessage(replyToken,
      '📋 可用指令：\n\n' +
      '體重 75.5 → 記錄今天體重\n' +
      '飲食 合規 → 記錄今天飲食達標\n' +
      '飲食 不合規 → 記錄今天飲食沒達標\n' +
      '狀態 → 查看本週摘要\n' +
      '幫助 → 顯示此訊息\n\n' +
      '每天花 10 秒記錄，系統會自動幫你分析趨勢！')
    return
  }

  // ── 未知指令 ──
  await replyMessage(replyToken, `我還看不懂「${msg}」😅\n輸入「幫助」查看可用指令。`)
}

export async function POST(request: NextRequest) {
  const secret = process.env.LINE_CHANNEL_SECRET
  const accessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN
  if (!secret || !accessToken) {
    return NextResponse.json({ error: 'LINE Bot 未設定' }, { status: 503 })
  }

  // 驗證簽名
  const body = await request.text()
  const signature = request.headers.get('x-line-signature') || ''
  if (!verifySignature(body, signature)) {
    return NextResponse.json({ error: '簽名驗證失敗' }, { status: 403 })
  }

  try {
    const data = JSON.parse(body)
    const events = data.events || []

    for (const event of events) {
      if (event.type === 'message' && event.message?.type === 'text') {
        await handleTextMessage(event.source.userId, event.replyToken, event.message.text)
      }
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[line/webhook] Error:', error)
    return NextResponse.json({ error: '處理失敗' }, { status: 500 })
  }
}
