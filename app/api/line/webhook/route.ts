import { NextRequest, NextResponse } from 'next/server'
import { verifyLineSignature, replyMessage, qr } from '@/lib/line'
import { createServiceSupabase } from '@/lib/supabase'
import { createLogger } from '@/lib/logger'

const log = createLogger('LINE-Webhook')

// 台灣時區 helper
function getTaiwanDate(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' })
}

// 常用 Quick Reply 組合
const QR_MAIN = {
  items: [
    qr('📊 今日狀態', '狀態'),
    qr('📈 7天趨勢', '趨勢'),
    qr('⚖️ 記體重', '記體重'),
    qr('🍽️ 記飲食', '記飲食'),
  ],
}

const QR_AFTER_RECORD = {
  items: [
    qr('💧 記水量', '記水量'),
    qr('🍽️ 記飲食', '記飲食'),
    qr('🏋️ 記訓練', '記訓練'),
    qr('📊 今日狀態', '狀態'),
  ],
}

const QR_TRAINING_TYPES = {
  items: [
    qr('推', '訓練 推'),
    qr('拉', '訓練 拉'),
    qr('腿', '訓練 腿'),
    qr('胸', '訓練 胸'),
  ],
}

const QR_COMPLIANCE = {
  items: [
    qr('✅ 達標', '達標'),
    qr('❌ 未達標', '未達標'),
  ],
}

const QR_WELLNESS = {
  items: [
    qr('😊 好 (4 4 4)', '身心 4 4 4'),
    qr('😐 普通 (3 3 3)', '身心 3 3 3'),
    qr('😩 差 (2 2 2)', '身心 2 2 2'),
    qr('🔥 超好 (5 5 5)', '身心 5 5 5'),
  ],
}

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
      log.info(`New follower: ${userId}`)
      await replyMessage(event.replyToken, [
        {
          type: 'text',
          text: '歡迎加入 Howard Protocol！\n\n請輸入你的學員代碼（8碼）來綁定帳號，例如：\n綁定 k8f3m2n5\n\n綁定後輸入「選單」可查看所有功能',
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
      await supabase
        .from('clients')
        .update({ line_user_id: null, last_line_activity: null })
        .eq('line_user_id', userId)
      break
  }
}

async function handleTextMessage(event: any, userId: string, supabase: any) {
  const text = (event.message.text || '').trim()

  // 選單指令 — 叫出所有功能按鈕
  if (text === '選單' || text === '功能' || text === '指令' || text === 'help' || text === '?') {
    await replyMessage(event.replyToken, [
      { type: 'text', text: '請點選下方按鈕 👇', quickReply: QR_MAIN },
    ])
    return
  }

  // 綁定指令
  const bindMatch = text.match(/^綁定\s+([a-zA-Z0-9]+)$/i)
  if (bindMatch) {
    await handleBind(event.replyToken, userId, bindMatch[1], supabase)
    return
  }

  // 查詢狀態
  if (text === '狀態' || text === '今天狀態') {
    await handleStatusQuery(event.replyToken, userId, supabase)
    return
  }

  // 趨勢查詢
  if (text === '趨勢' || text === '週報') {
    await handleTrendQuery(event.replyToken, userId, supabase)
    return
  }

  // ── 互動式入口：點按鈕進入流程 ──
  if (text === '記體重') {
    await replyMessage(event.replyToken, [
      { type: 'text', text: '請輸入體重（kg），例如：\n體重 72.5', quickReply: QR_MAIN },
    ])
    return
  }
  if (text === '記水量') {
    await replyMessage(event.replyToken, [
      { type: 'text', text: '請輸入水量（ml），例如：\n水 500\n\n水量會自動累加', quickReply: QR_MAIN },
    ])
    return
  }
  if (text === '記飲食') {
    await replyMessage(event.replyToken, [
      { type: 'text', text: '今天飲食達標嗎？', quickReply: QR_COMPLIANCE },
    ])
    return
  }
  if (text === '記訓練') {
    await replyMessage(event.replyToken, [
      { type: 'text', text: '今天練什麼？', quickReply: QR_TRAINING_TYPES },
    ])
    return
  }
  if (text === '記身心') {
    await replyMessage(event.replyToken, [
      { type: 'text', text: '今天整體感覺如何？\n（睡眠/精力/心情 各 1-5 分）', quickReply: QR_WELLNESS },
    ])
    return
  }

  // ── 快速記錄：體重 ──
  const weightMatch = text.match(/^體重\s+([\d.]+)$/i)
  if (weightMatch) {
    await handleQuickWeight(event.replyToken, userId, parseFloat(weightMatch[1]), supabase)
    return
  }

  // ── 快速記錄：水量 ──
  const waterMatch = text.match(/^水\s+([\d]+)$/i)
  if (waterMatch) {
    await handleQuickWater(event.replyToken, userId, parseInt(waterMatch[1]), supabase)
    return
  }

  // ── 快速記錄：蛋白質 ──
  const proteinMatch = text.match(/^蛋白質?\s+([\d]+)$/i)
  if (proteinMatch) {
    await handleQuickProtein(event.replyToken, userId, parseInt(proteinMatch[1]), supabase)
    return
  }

  // ── 快速記錄：飲食達標 ──
  if (text === '達標' || text === '飲食達標') {
    await handleQuickCompliance(event.replyToken, userId, true, supabase)
    return
  }
  if (text === '未達標' || text === '飲食未達標') {
    await handleQuickCompliance(event.replyToken, userId, false, supabase)
    return
  }

  // ── 快速記錄：訓練 ──
  const trainingMatch = text.match(/^訓練\s+(push|pull|legs|chest|shoulder|arms|cardio|rest|推|拉|腿|胸|肩|手臂|有氧|休息)(?:\s+([\d]+)分鐘?)?(?:\s+RPE\s*([\d]+))?$/i)
  if (trainingMatch) {
    const typeMap: Record<string, string> = {
      '推': 'push', '拉': 'pull', '腿': 'legs', '胸': 'chest',
      '肩': 'shoulder', '手臂': 'arms', '有氧': 'cardio', '休息': 'rest',
    }
    const rawType = trainingMatch[1].toLowerCase()
    const trainingType = typeMap[rawType] || rawType
    const duration = trainingMatch[2] ? parseInt(trainingMatch[2]) : null
    const rpe = trainingMatch[3] ? parseInt(trainingMatch[3]) : null
    await handleQuickTraining(event.replyToken, userId, trainingType, duration, rpe, supabase)
    return
  }

  // ── 快速記錄：身心狀態 ──
  const wellnessMatch = text.match(/^身心\s+(\d)\s+(\d)\s+(\d)$/i)
  if (wellnessMatch) {
    const sleep = parseInt(wellnessMatch[1])
    const energy = parseInt(wellnessMatch[2])
    const mood = parseInt(wellnessMatch[3])
    await handleQuickWellness(event.replyToken, userId, sleep, energy, mood, supabase)
    return
  }

  // 非指令訊息 → 不自動回覆，讓教練在 LINE OA 後台手動回覆
}

// ═══════════════════════════════════════
// 快速記錄 handlers
// ═══════════════════════════════════════

async function getClientByLineId(lineUserId: string, supabase: any) {
  const { data } = await supabase
    .from('clients')
    .select('id, name, protein_target, water_target, calories_target')
    .eq('line_user_id', lineUserId)
    .single()
  return data
}

async function handleQuickWeight(replyToken: string, lineUserId: string, weight: number, supabase: any) {
  const client = await getClientByLineId(lineUserId, supabase)
  if (!client) {
    await replyMessage(replyToken, [{ type: 'text', text: '請先綁定帳號：綁定 [學員代碼]' }])
    return
  }

  if (weight < 20 || weight > 300) {
    await replyMessage(replyToken, [{ type: 'text', text: '體重數值不合理，請輸入 20~300 之間的數字' }])
    return
  }

  const today = getTaiwanDate()
  const { error } = await supabase
    .from('body_composition')
    .upsert({ client_id: client.id, date: today, weight }, { onConflict: 'client_id,date' })

  if (error) {
    log.error('Quick weight error:', error)
    await replyMessage(replyToken, [{ type: 'text', text: '記錄失敗，請稍後再試' }])
    return
  }

  const { data: prev } = await supabase
    .from('body_composition')
    .select('weight, date')
    .eq('client_id', client.id)
    .lt('date', today)
    .order('date', { ascending: false })
    .limit(1)
    .single()

  let msg = `✅ 已記錄體重：${weight} kg`
  if (prev?.weight) {
    const diff = weight - prev.weight
    const sign = diff > 0 ? '+' : ''
    msg += `\n${diff === 0 ? '➡️' : diff > 0 ? '📈' : '📉'} 比上次 ${sign}${diff.toFixed(1)} kg（${prev.date}）`
  }

  await replyMessage(replyToken, [{ type: 'text', text: msg, quickReply: QR_AFTER_RECORD }])
}

async function handleQuickWater(replyToken: string, lineUserId: string, waterMl: number, supabase: any) {
  const client = await getClientByLineId(lineUserId, supabase)
  if (!client) {
    await replyMessage(replyToken, [{ type: 'text', text: '請先綁定帳號：綁定 [學員代碼]' }])
    return
  }

  if (waterMl < 0 || waterMl > 10000) {
    await replyMessage(replyToken, [{ type: 'text', text: '水量數值不合理，請輸入 0~10000 ml' }])
    return
  }

  const today = getTaiwanDate()
  const { data: existing } = await supabase
    .from('nutrition_logs')
    .select('water_ml')
    .eq('client_id', client.id)
    .eq('date', today)
    .single()

  const newWater = (existing?.water_ml || 0) + waterMl

  const { error } = await supabase
    .from('nutrition_logs')
    .upsert(
      { client_id: client.id, date: today, water_ml: newWater, compliant: existing ? undefined : true },
      { onConflict: 'client_id,date' }
    )

  if (error) {
    log.error('Quick water error:', error)
    await replyMessage(replyToken, [{ type: 'text', text: '記錄失敗，請稍後再試' }])
    return
  }

  const target = client.water_target || 3000
  const pct = Math.round((newWater / target) * 100)
  const bar = pct >= 100 ? '🎉' : pct >= 70 ? '💧' : '🥤'

  await replyMessage(replyToken, [
    {
      type: 'text',
      text: `${bar} +${waterMl}ml → 今日累計 ${newWater}ml（目標 ${target}ml 的 ${pct}%）`,
      quickReply: {
        items: [
          qr('💧 再喝 300ml', '水 300'),
          qr('💧 再喝 500ml', '水 500'),
          qr('🍽️ 記飲食', '記飲食'),
          qr('📊 今日狀態', '狀態'),
        ],
      },
    },
  ])
}

async function handleQuickProtein(replyToken: string, lineUserId: string, protein: number, supabase: any) {
  const client = await getClientByLineId(lineUserId, supabase)
  if (!client) {
    await replyMessage(replyToken, [{ type: 'text', text: '請先綁定帳號：綁定 [學員代碼]' }])
    return
  }

  if (protein < 0 || protein > 500) {
    await replyMessage(replyToken, [{ type: 'text', text: '蛋白質數值不合理，請輸入 0~500g' }])
    return
  }

  const today = getTaiwanDate()
  const { error } = await supabase
    .from('nutrition_logs')
    .upsert({ client_id: client.id, date: today, protein_grams: protein }, { onConflict: 'client_id,date' })

  if (error) {
    log.error('Quick protein error:', error)
    await replyMessage(replyToken, [{ type: 'text', text: '記錄失敗，請稍後再試' }])
    return
  }

  const target = client.protein_target
  let msg = `✅ 已記錄蛋白質：${protein}g`
  if (target) {
    const pct = Math.round((protein / target) * 100)
    msg += `（目標 ${target}g 的 ${pct}%）`
  }

  await replyMessage(replyToken, [{ type: 'text', text: msg, quickReply: QR_AFTER_RECORD }])
}

async function handleQuickCompliance(replyToken: string, lineUserId: string, compliant: boolean, supabase: any) {
  const client = await getClientByLineId(lineUserId, supabase)
  if (!client) {
    await replyMessage(replyToken, [{ type: 'text', text: '請先綁定帳號：綁定 [學員代碼]' }])
    return
  }

  const today = getTaiwanDate()
  const { error } = await supabase
    .from('nutrition_logs')
    .upsert({ client_id: client.id, date: today, compliant }, { onConflict: 'client_id,date' })

  if (error) {
    log.error('Quick compliance error:', error)
    await replyMessage(replyToken, [{ type: 'text', text: '記錄失敗，請稍後再試' }])
    return
  }

  const afterCompliance = {
    items: [
      qr('🏋️ 記訓練', '記訓練'),
      qr('😊 記身心', '記身心'),
      qr('💧 記水量', '記水量'),
      qr('📊 今日狀態', '狀態'),
    ],
  }

  await replyMessage(replyToken, [
    {
      type: 'text',
      text: compliant ? '✅ 今日飲食已標記「達標」' : '❌ 今日飲食已標記「未達標」',
      quickReply: afterCompliance,
    },
  ])
}

async function handleQuickTraining(
  replyToken: string, lineUserId: string,
  trainingType: string, duration: number | null, rpe: number | null,
  supabase: any
) {
  const client = await getClientByLineId(lineUserId, supabase)
  if (!client) {
    await replyMessage(replyToken, [{ type: 'text', text: '請先綁定帳號：綁定 [學員代碼]' }])
    return
  }

  if (rpe && (rpe < 1 || rpe > 10)) {
    await replyMessage(replyToken, [{ type: 'text', text: 'RPE 必須在 1-10 之間' }])
    return
  }

  const today = getTaiwanDate()
  const record: any = { client_id: client.id, date: today, training_type: trainingType }
  if (duration) record.duration = duration
  if (rpe) record.rpe = rpe

  const { error } = await supabase
    .from('training_logs')
    .upsert(record, { onConflict: 'client_id,date' })

  if (error) {
    log.error('Quick training error:', error)
    await replyMessage(replyToken, [{ type: 'text', text: '記錄失敗，請稍後再試' }])
    return
  }

  const typeLabel: Record<string, string> = {
    push: '推', pull: '拉', legs: '腿', chest: '胸', shoulder: '肩',
    arms: '手臂', cardio: '有氧', rest: '休息', full_body: '全身',
  }

  let msg = `🏋️ 已記錄訓練：${typeLabel[trainingType] || trainingType}`
  if (duration) msg += ` ${duration}分鐘`
  if (rpe) msg += ` RPE${rpe}`

  const afterTraining = {
    items: [
      qr('😊 記身心', '記身心'),
      qr('🍽️ 記飲食', '記飲食'),
      qr('📊 今日狀態', '狀態'),
      qr('📈 7天趨勢', '趨勢'),
    ],
  }

  await replyMessage(replyToken, [{ type: 'text', text: msg, quickReply: afterTraining }])
}

async function handleQuickWellness(
  replyToken: string, lineUserId: string,
  sleep: number, energy: number, mood: number,
  supabase: any
) {
  const client = await getClientByLineId(lineUserId, supabase)
  if (!client) {
    await replyMessage(replyToken, [{ type: 'text', text: '請先綁定帳號：綁定 [學員代碼]' }])
    return
  }

  if ([sleep, energy, mood].some(v => v < 1 || v > 5)) {
    await replyMessage(replyToken, [{ type: 'text', text: '分數必須在 1-5 之間', quickReply: QR_WELLNESS }])
    return
  }

  const today = getTaiwanDate()
  const { error } = await supabase
    .from('daily_wellness')
    .upsert(
      { client_id: client.id, date: today, sleep_quality: sleep, energy_level: energy, mood },
      { onConflict: 'client_id,date' }
    )

  if (error) {
    log.error('Quick wellness error:', error)
    await replyMessage(replyToken, [{ type: 'text', text: '記錄失敗，請稍後再試' }])
    return
  }

  const afterWellness = {
    items: [
      qr('📊 今日狀態', '狀態'),
      qr('📈 7天趨勢', '趨勢'),
      qr('🏋️ 記訓練', '記訓練'),
      qr('🍽️ 記飲食', '記飲食'),
    ],
  }

  await replyMessage(replyToken, [
    {
      type: 'text',
      text: `✅ 已記錄身心狀態\n😴 睡眠：${sleep}/5\n⚡ 精力：${energy}/5\n😊 心情：${mood}/5`,
      quickReply: afterWellness,
    },
  ])
}

// ═══════════════════════════════════════
// 趨勢查詢
// ═══════════════════════════════════════

async function handleTrendQuery(replyToken: string, lineUserId: string, supabase: any) {
  const client = await getClientByLineId(lineUserId, supabase)
  if (!client) {
    await replyMessage(replyToken, [{ type: 'text', text: '請先綁定帳號：綁定 [學員代碼]' }])
    return
  }

  const today = getTaiwanDate()
  const sevenDaysAgo = new Date(new Date().getTime() - 7 * 86400000).toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' })

  const [bodyRes, nutritionRes, trainingRes, wellnessRes, summaryRes] = await Promise.all([
    supabase.from('body_composition').select('date, weight')
      .eq('client_id', client.id).gte('date', sevenDaysAgo).lte('date', today)
      .not('weight', 'is', null).order('date', { ascending: true }),
    supabase.from('nutrition_logs').select('date, compliant, protein_grams, water_ml')
      .eq('client_id', client.id).gte('date', sevenDaysAgo).lte('date', today)
      .order('date', { ascending: true }),
    supabase.from('training_logs').select('date, training_type, rpe')
      .eq('client_id', client.id).gte('date', sevenDaysAgo).lte('date', today)
      .order('date', { ascending: true }),
    supabase.from('daily_wellness').select('date, sleep_quality, energy_level, mood')
      .eq('client_id', client.id).gte('date', sevenDaysAgo).lte('date', today)
      .order('date', { ascending: true }),
    supabase.from('weekly_summaries').select('summary, status, suggested_calories, weekly_weight_change_rate, warnings')
      .eq('client_id', client.id).order('week_of', { ascending: false }).limit(1).single(),
  ])

  const body = bodyRes.data || []
  const nutrition = nutritionRes.data || []
  const training = trainingRes.data || []
  const wellness = wellnessRes.data || []

  const lines: string[] = [`📊 ${client.name} 近 7 天趨勢\n`]

  if (body.length >= 2) {
    const first = body[0].weight
    const last = body[body.length - 1].weight
    const diff = last - first
    const sign = diff > 0 ? '+' : ''
    lines.push(`⚖️ 體重：${last}kg（${sign}${diff.toFixed(1)}kg）`)
    lines.push(`   ${body.map((b: any) => b.weight).join(' → ')}`)
  } else if (body.length === 1) {
    lines.push(`⚖️ 體重：${body[0].weight}kg（僅 1 筆紀錄）`)
  } else {
    lines.push('⚖️ 體重：無紀錄')
  }

  if (nutrition.length > 0) {
    const compliantDays = nutrition.filter((n: any) => n.compliant).length
    const rate = Math.round((compliantDays / nutrition.length) * 100)
    lines.push(`\n🍽️ 飲食合規：${compliantDays}/${nutrition.length} 天（${rate}%）`)

    const proteins = nutrition.filter((n: any) => n.protein_grams).map((n: any) => n.protein_grams)
    if (proteins.length > 0) {
      const avg = Math.round(proteins.reduce((a: number, b: number) => a + b, 0) / proteins.length)
      lines.push(`🥩 平均蛋白質：${avg}g/天`)
    }

    const waters = nutrition.filter((n: any) => n.water_ml).map((n: any) => n.water_ml)
    if (waters.length > 0) {
      const avg = Math.round(waters.reduce((a: number, b: number) => a + b, 0) / waters.length)
      lines.push(`💧 平均水量：${avg}ml/天`)
    }
  } else {
    lines.push('\n🍽️ 飲食：無紀錄')
  }

  if (training.length > 0) {
    const typeCount: Record<string, number> = {}
    for (const t of training) {
      typeCount[t.training_type] = (typeCount[t.training_type] || 0) + 1
    }
    const typeLabel: Record<string, string> = {
      push: '推', pull: '拉', legs: '腿', chest: '胸', shoulder: '肩',
      arms: '手臂', cardio: '有氧', rest: '休息', full_body: '全身',
    }
    const typeSummary = Object.entries(typeCount).map(([k, v]) => `${typeLabel[k] || k}×${v}`).join(' ')
    lines.push(`\n🏋️ 訓練 ${training.length} 天：${typeSummary}`)

    const rpes = training.filter((t: any) => t.rpe).map((t: any) => t.rpe)
    if (rpes.length > 0) {
      const avg = (rpes.reduce((a: number, b: number) => a + b, 0) / rpes.length).toFixed(1)
      lines.push(`💪 平均 RPE：${avg}`)
    }
  } else {
    lines.push('\n🏋️ 訓練：無紀錄')
  }

  if (wellness.length > 0) {
    const avgSleep = (wellness.reduce((s: number, w: any) => s + (w.sleep_quality || 0), 0) / wellness.length).toFixed(1)
    const avgEnergy = (wellness.reduce((s: number, w: any) => s + (w.energy_level || 0), 0) / wellness.length).toFixed(1)
    const avgMood = (wellness.reduce((s: number, w: any) => s + (w.mood || 0), 0) / wellness.length).toFixed(1)
    lines.push(`\n😴 平均睡眠：${avgSleep}/5`)
    lines.push(`⚡ 平均精力：${avgEnergy}/5`)
    lines.push(`😊 平均心情：${avgMood}/5`)
  }

  if (summaryRes.data) {
    const s = summaryRes.data
    lines.push(`\n📝 最新週報：`)
    if (s.status) lines.push(`狀態：${s.status}`)
    if (s.weekly_weight_change_rate != null) lines.push(`週變化率：${s.weekly_weight_change_rate > 0 ? '+' : ''}${s.weekly_weight_change_rate}%`)
    if (s.warnings?.length > 0) lines.push(`⚠️ ${s.warnings.join('、')}`)
  }

  await replyMessage(replyToken, [{ type: 'text', text: lines.join('\n'), quickReply: QR_MAIN }])
}

// ═══════════════════════════════════════
// 原有功能
// ═══════════════════════════════════════

async function handleBind(replyToken: string, lineUserId: string, code: string, supabase: any) {
  const { data: existing } = await supabase
    .from('clients')
    .select('id, name')
    .eq('line_user_id', lineUserId)
    .single()

  if (existing) {
    await replyMessage(replyToken, [
      { type: 'text', text: `你已經綁定帳號「${existing.name}」了！`, quickReply: QR_MAIN },
    ])
    return
  }

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

  await supabase
    .from('clients')
    .update({
      line_user_id: lineUserId,
      last_line_activity: new Date().toISOString(),
    })
    .eq('id', client.id)

  await replyMessage(replyToken, [
    {
      type: 'text',
      text: `綁定成功！歡迎 ${client.name} 🎉\n\n點下方按鈕開始使用 👇`,
      quickReply: QR_MAIN,
    },
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

  const today = getTaiwanDate()

  const [wellness, nutrition, training] = await Promise.all([
    supabase.from('daily_wellness').select('*').eq('client_id', client.id).eq('date', today).single(),
    supabase.from('nutrition_logs').select('*').eq('client_id', client.id).eq('date', today).single(),
    supabase.from('training_logs').select('*').eq('client_id', client.id).eq('date', today).single(),
  ])

  const lines: string[] = [`📊 ${client.name} 今日狀態\n`]

  // 收集缺漏項目的 quick reply 按鈕
  const missingButtons = []

  if (wellness.data) {
    const w = wellness.data
    lines.push(`😴 睡眠：${w.sleep_quality || '-'}/5`)
    lines.push(`⚡ 精力：${w.energy_level || '-'}/5`)
    lines.push(`😊 心情：${w.mood || '-'}/5`)
    if (w.hrv) lines.push(`💓 HRV：${w.hrv}ms`)
  } else {
    lines.push('⚠️ 身心狀態未記錄')
    missingButtons.push(qr('😊 記身心', '記身心'))
  }

  lines.push('')

  if (nutrition.data) {
    const n = nutrition.data
    lines.push(`🍽️ 飲食：${n.compliant ? '✅ 達標' : '❌ 未達標'}`)
    if (n.protein_grams) lines.push(`🥩 蛋白質：${n.protein_grams}g`)
    if (n.water_ml) lines.push(`💧 水量：${n.water_ml}ml`)
  } else {
    lines.push('⚠️ 飲食未記錄')
    missingButtons.push(qr('🍽️ 記飲食', '記飲食'))
  }

  lines.push('')

  if (training.data) {
    lines.push(`🏋️ 訓練：${training.data.training_type} (RPE ${training.data.rpe || '-'})`)
  } else {
    lines.push('⚠️ 訓練未記錄')
    missingButtons.push(qr('🏋️ 記訓練', '記訓練'))
  }

  // 動態按鈕：缺什麼就顯示什麼，最後加趨勢
  const statusQR = {
    items: [
      ...missingButtons.slice(0, 3),
      qr('📈 7天趨勢', '趨勢'),
    ],
  }

  await replyMessage(replyToken, [{ type: 'text', text: lines.join('\n'), quickReply: statusQR }])
}
