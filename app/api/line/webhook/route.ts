import { NextRequest, NextResponse } from 'next/server'
import { SupabaseClient } from '@supabase/supabase-js'
import { verifyLineSignature, replyMessage, qr, unlinkRichMenuFromUser, switchRichMenuForUser } from '@/lib/line'
import { createServiceSupabase } from '@/lib/supabase'
import { createLogger } from '@/lib/logger'
import {
  getClientByLineId,
  handleQuickWeight,
  handleQuickWater,
  handleQuickProtein,
  handleQuickCompliance,
  handleQuickTraining,
  handleQuickWellness,
  handleBind,
  handleStatusQuery,
  handleTrendQuery,
  handlePostback,
} from '@/lib/line-handlers'

const log = createLogger('LINE-Webhook')

/** LINE webhook event shape (subset of fields we use) */
interface LineWebhookEvent {
  type: string
  replyToken: string
  source?: { userId?: string; type?: string }
  message?: { type: string; text?: string }
  postback?: { data: string }
}

// ═══════════════════════════════════════
// Quick Reply presets
// ═══════════════════════════════════════

const QR_MAIN = {
  items: [
    qr('📊 今日狀態', '狀態'),
    qr('📈 7天趨勢', '趨勢'),
    qr('⚖️ 記體重', '記體重'),
    qr('🍽️ 記飲食', '記飲食'),
  ],
}

const QR_COMPLIANCE = {
  items: [
    qr('✅ 達標', '達標'),
    qr('❌ 未達標', '未達標'),
  ],
}

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://howard456.vercel.app'

// ═══════════════════════════════════════
// POST handler
// ═══════════════════════════════════════

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

    // Process events in parallel for faster response to LINE platform
    await Promise.allSettled(events.map((event: LineWebhookEvent) => handleEvent(event)))

    return NextResponse.json({ ok: true })
  } catch (error) {
    log.error('Webhook error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// ═══════════════════════════════════════
// Event routing
// ═══════════════════════════════════════

async function handleEvent(event: LineWebhookEvent) {
  const userId = event.source?.userId
  if (!userId) return

  const supabase = createServiceSupabase()

  // Update last activity time regardless of event type
  await supabase
    .from('clients')
    .update({ last_line_activity: new Date().toISOString() })
    .eq('line_user_id', userId)

  switch (event.type) {
    case 'follow': {
      log.info(`New follower: ${userId}`)
      const existingClient = await getClientByLineId(userId, supabase)
      if (existingClient) {
        await switchRichMenuForUser(userId, existingClient.subscription_tier || 'free')
        await replyMessage(event.replyToken, [
          {
            type: 'text',
            text: '歡迎回來！你的學員帳號還在 ✅\n\n直接使用下方功能吧 👇',
            quickReply: QR_MAIN,
          },
        ])
      } else {
        await replyMessage(event.replyToken, [
          {
            type: 'text',
            text: '歡迎來到 Howard Protocol！💪\n\n' +
              '我是 Howard，CSCS 認證教練。\n' +
              '這裡提供科學化的線上體態管理，幫你用數據達成目標。\n\n' +
              '👇 你可以先：',
            quickReply: {
              items: [
                qr('🧪 免費體態評估', '免費評估'),
                qr('📖 健身知識文章', '免費教學'),
                qr('💰 查看方案', '查看方案'),
                qr('🔗 我有學員代碼', '我要綁定'),
              ],
            },
          },
        ])
      }
      break
    }

    case 'message':
      if (event.message?.type === 'text') {
        await handleTextMessage(event, userId, supabase)
      } else if (event.message?.type === 'image') {
        await replyMessage(event.replyToken, [
          {
            type: 'text',
            text: '目前 LINE 不支援圖片分析 📷\n\n' +
              '如需 AI 分析食物營養素，請到儀表板使用 AI 聊天功能拍照分析。\n\n' +
              '在 LINE 可以用文字快速記錄 👇',
            quickReply: QR_MAIN,
          },
        ])
      }
      break

    case 'postback':
      await handlePostback(event, userId, supabase)
      break

    case 'unfollow':
      log.info(`Unfollowed: ${userId}`)
      await unlinkRichMenuFromUser(userId)
      await supabase
        .from('clients')
        .update({ last_line_activity: null })
        .eq('line_user_id', userId)
      break
  }
}

// ═══════════════════════════════════════
// Text message command matching
// ═══════════════════════════════════════

async function handleTextMessage(event: LineWebhookEvent, userId: string, supabase: SupabaseClient) {
  const text = (event.message?.text || '').trim()

  // Single client lookup shared by all handlers
  const client = await getClientByLineId(userId, supabase)

  // Ensure bound users have the correct Rich Menu (background, non-blocking)
  if (client) {
    switchRichMenuForUser(userId, client.subscription_tier || 'free').catch(() => {})
  }

  // Menu command
  if (text === '選單' || text === '功能' || text === '指令' || text === 'help' || text === '?') {
    await replyMessage(event.replyToken, [
      { type: 'text', text: '請點選下方按鈕 👇', quickReply: QR_MAIN },
    ])
    return
  }

  // FAQ
  if (text === 'FAQ' || text === 'faq' || text === '常見問題') {
    await replyMessage(event.replyToken, [
      {
        type: 'text',
        text: '📋 常見問題\n\n' +
          '❓ 免費方案包含什麼？\n→ 體重/體態追蹤、每日飲食紀錄、TDEE 與巨量素估算\n\n' +
          '❓ 499 方案跟免費差在哪？\n→ 24h AI 自動分析、自適應 TDEE、自動 Refeed 觸發、經期濾波\n\n' +
          '❓ 2999 方案多了什麼？\n→ CSCS 教練每週審閱 + LINE 諮詢 + 每月視訊\n\n' +
          '❓ 可以隨時取消嗎？\n→ 可以，無綁約，隨時取消下期不續扣\n\n' +
          '❓ 需要每天記錄嗎？\n→ 建議至少記體重和飲食達標，系統才能準確分析\n\n' +
          '👇 還有其他問題？直接打字問我！',
      },
    ])
    return
  }

  // Contact inquiry
  if (text === '我想詢問問題') {
    await replyMessage(event.replyToken, [
      { type: 'text', text: '請直接打字描述你的問題，教練會親自回覆你！' },
    ])
    return
  }

  // New user funnels
  if (text === '免費評估') {
    await replyMessage(event.replyToken, [
      {
        type: 'text',
        text: '🧪 免費體態評估\n\n' +
          '輸入基本資料，系統會即時算出你的 TDEE、建議熱量和巨量營養素。\n\n' +
          `👉 ${SITE_URL}/diagnosis\n\n` +
          '做完後回來告訴我「評估結果」，我幫你解讀！',
      },
    ])
    return
  }

  if (text === '免費教學') {
    await replyMessage(event.replyToken, [
      {
        type: 'text',
        text: '📖 免費健身知識\n\n' +
          '這裡有教練整理的訓練、營養、恢復等實用文章。\n\n' +
          `👉 ${SITE_URL}/blog`,
      },
    ])
    return
  }

  // 升級教練方案
  if (text === '升級' || text === '我要升級' || text === '我要升級教練方案') {
    if (client && client.subscription_tier === 'self_managed') {
      const payUrl = `${SITE_URL}/pay?tier=coached&name=${encodeURIComponent(client.name)}`
      await replyMessage(event.replyToken, [
        {
          type: 'text',
          text: [
            '👑 升級教練指導方案（NT$2,999/月）',
            '',
            '升級後你將獲得：',
            '✅ CSCS 教練每週審閱你的數據',
            '✅ LINE 一對一營養 / 訓練諮詢',
            '✅ 完整補品管理與血檢追蹤',
            '✅ 客製化營養調整',
            '',
            `👉 付款連結：${payUrl}`,
            '',
            '⚠️ 付款完成後，記得到儀表板取消舊的 $499 定期定額（設定 → 取消定期定額）',
          ].join('\n'),
        },
      ])
    } else if (client && client.subscription_tier === 'coached') {
      await replyMessage(event.replyToken, [
        { type: 'text', text: '你已經是教練指導方案了 👑\n有任何問題直接跟教練說！' },
      ])
    } else if (client && client.subscription_tier === 'free') {
      await replyMessage(event.replyToken, [
        {
          type: 'text',
          text: `目前你是免費方案，可以先升級自主管理版（$499/月）體驗 AI 功能。\n\n👉 ${SITE_URL}/join?tier=self_managed`,
        },
      ])
    } else {
      await replyMessage(event.replyToken, [
        {
          type: 'text',
          text: `想升級？先看看我們的方案：\n\n👉 ${SITE_URL}/join`,
          quickReply: {
            items: [
              qr('💰 查看方案', '查看方案'),
              qr('🔗 我有代碼', '我要綁定'),
            ],
          },
        },
      ])
    }
    return
  }

  if (text === '查看方案') {
    await replyMessage(event.replyToken, [
      {
        type: 'text',
        text: '💰 線上方案介紹\n\n' +
          '🆓 免費：體重追蹤 + 飲食紀錄\n' +
          '💎 NT$499/月：AI 自動分析 + 自適應 TDEE\n' +
          '👑 NT$2,999/月：CSCS 教練每週審閱 + LINE 諮詢\n\n' +
          `👉 ${SITE_URL}/join\n\n` +
          '所有方案無綁約，隨時取消！',
      },
    ])
    return
  }

  if (text === '我要綁定') {
    await replyMessage(event.replyToken, [
      {
        type: 'text',
        text: '請輸入你的學員代碼（8碼）來綁定帳號，例如：\n綁定 k8f3m2n5\n\n' +
          '還沒有代碼？先到方案頁面加入 👇',
        quickReply: {
          items: [
            qr('💰 查看方案', '查看方案'),
            qr('❓ 常見問題', 'FAQ'),
          ],
        },
      },
    ])
    return
  }

  // Post-diagnosis follow up
  if (text === '評估結果' || text === '評估報告') {
    await replyMessage(event.replyToken, [
      {
        type: 'text',
        text: '看到你的評估結果了嗎？🧪\n\n' +
          '系統給出的是基於公式的估算值，實際執行時會因個人差異需要調整。\n\n' +
          '如果你想要：\n' +
          '✅ 每天自動追蹤體重變化\n' +
          '✅ AI 根據真實數據校正你的 TDEE\n' +
          '✅ 教練幫你解讀報告、調整策略\n\n' +
          '可以考慮加入我們的線上方案 👇',
        quickReply: {
          items: [
            qr('💰 查看方案', '查看方案'),
            qr('❓ 有問題想問', '我想詢問問題'),
          ],
        },
      },
    ])
    return
  }

  // Bind command
  const bindMatch = text.match(/^綁定\s+([a-zA-Z0-9_-]+)$/i)
  if (bindMatch) {
    await handleBind(event.replyToken, userId, bindMatch[1], supabase)
    return
  }

  // Unbound user sending bare 8-char code -> auto-bind
  if (!client) {
    const bareCodeMatch = text.match(/^[a-zA-Z0-9_-]{8}$/)
    if (bareCodeMatch) {
      await handleBind(event.replyToken, userId, text, supabase)
      return
    }
  }

  // Member-only commands gate
  const MEMBER_COMMANDS = ['狀態', '今天狀態', '趨勢', '週報', '記體重', '記水量', '記飲食', '記訓練', '記身心']
  if (MEMBER_COMMANDS.includes(text) && !client) {
    await replyMessage(event.replyToken, [
      {
        type: 'text',
        text: '這個功能需要綁定帳號才能使用 🔒\n\n' +
          '加入方案後即可解鎖：\n' +
          '✅ 每日體重/飲食/訓練記錄\n' +
          '✅ 7 天趨勢分析\n' +
          '✅ AI 自動調整建議\n\n' +
          '先做免費評估，了解自己的狀態 👇',
        quickReply: {
          items: [
            qr('🧪 免費評估', '免費評估'),
            qr('💰 查看方案', '查看方案'),
            qr('🔗 我有代碼', '我要綁定'),
            qr('❓ FAQ', 'FAQ'),
          ],
        },
      },
    ])
    return
  }

  // Status query
  if (text === '狀態' || text === '今天狀態') {
    await handleStatusQuery(event.replyToken, client!, supabase)
    return
  }

  // Trend query
  if (text === '趨勢' || text === '週報') {
    await handleTrendQuery(event.replyToken, client!, supabase)
    return
  }

  // ── Interactive entry points ──

  if (text === '記體重') {
    if (client) {
      const { data: lastWeight } = await supabase
        .from('body_composition')
        .select('weight')
        .eq('client_id', client.id)
        .not('weight', 'is', null)
        .order('date', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (lastWeight?.weight) {
        const w = lastWeight.weight
        await replyMessage(event.replyToken, [
          {
            type: 'text',
            text: `上次體重 ${w} kg，今天呢？`,
            quickReply: {
              items: [
                qr(`${(w - 0.5).toFixed(1)}`, `體重 ${(w - 0.5).toFixed(1)}`),
                qr(`${w.toFixed(1)}（不變）`, `體重 ${w.toFixed(1)}`),
                qr(`${(w + 0.5).toFixed(1)}`, `體重 ${(w + 0.5).toFixed(1)}`),
                qr('自己輸入', '輸入體重'),
              ],
            },
          },
        ])
        return
      }
    }
    await replyMessage(event.replyToken, [
      { type: 'text', text: '請輸入體重（kg），例如：\n體重 72.5', quickReply: QR_MAIN },
    ])
    return
  }
  if (text === '輸入體重') {
    await replyMessage(event.replyToken, [
      { type: 'text', text: '請輸入體重（kg），例如：\n體重 72.5' },
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
    if (!client?.training_enabled) {
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://howardprotocol.com'
      await replyMessage(event.replyToken, [
        { type: 'text', text: `訓練記錄是自主管理方案（$499/月）以上的功能 🔒\n\n升級後解鎖訓練追蹤、AI 分析等完整功能。\n\n👉 ${siteUrl}/remote` },
      ])
      return
    }
    await replyMessage(event.replyToken, [
      {
        type: 'text',
        text: '今天練什麼部位？',
        quickReply: {
          items: [
            qr('推（胸/肩/三頭）', '訓練 推'),
            qr('拉（背/二頭）', '訓練 拉'),
            qr('腿', '訓練 腿'),
            qr('有氧', '訓練 有氧'),
          ],
        },
      },
    ])
    return
  }
  if (text === '記身心') {
    if (!client?.wellness_enabled) {
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://howardprotocol.com'
      await replyMessage(event.replyToken, [
        { type: 'text', text: `身心狀態記錄是自主管理方案（$499/月）以上的功能 🔒\n\n升級後解鎖身心追蹤、AI 分析等完整功能。\n\n👉 ${siteUrl}/remote` },
      ])
      return
    }
    await replyMessage(event.replyToken, [
      {
        type: 'text',
        text: '昨晚睡得如何？',
        quickReply: {
          items: [
            qr('😴 很差', '睡眠 1'),
            qr('😐 不太好', '睡眠 2'),
            qr('🙂 普通', '睡眠 3'),
            qr('😊 不錯', '睡眠 4'),
          ],
        },
      },
    ])
    return
  }

  // ── Quick records: weight ──
  const weightMatch = text.match(/^體重\s+([\d.]+)$/i)
  if (weightMatch) {
    await handleQuickWeight(event.replyToken, client, parseFloat(weightMatch[1]), supabase)
    return
  }

  // ── Quick records: water ──
  const waterMatch = text.match(/^水\s+([\d]+)$/i)
  if (waterMatch) {
    await handleQuickWater(event.replyToken, client, parseInt(waterMatch[1]), supabase)
    return
  }

  // ── Quick records: protein ──
  const proteinMatch = text.match(/^蛋白質?\s+([\d]+)$/i)
  if (proteinMatch) {
    await handleQuickProtein(event.replyToken, client, parseInt(proteinMatch[1]), supabase)
    return
  }

  // ── Quick records: diet compliance ──
  if (text === '達標' || text === '飲食達標') {
    await handleQuickCompliance(event.replyToken, client, true, supabase)
    return
  }
  if (text === '未達標' || text === '飲食未達標') {
    await handleQuickCompliance(event.replyToken, client, false, supabase)
    return
  }

  // ── Training step 1: select type -> ask duration ──
  const trainingMatch = text.match(/^訓練\s+(push|pull|legs|chest|shoulder|arms|cardio|rest|推|拉|腿|胸|肩|手臂|有氧|休息)$/i)
  if (trainingMatch) {
    const typeMap: Record<string, string> = {
      '推': 'push', '拉': 'pull', '腿': 'legs', '胸': 'chest',
      '肩': 'shoulder', '手臂': 'arms', '有氧': 'cardio', '休息': 'rest',
    }
    const rawType = trainingMatch[1].toLowerCase()
    const trainingType = typeMap[rawType] || rawType
    const typeLabel: Record<string, string> = {
      push: '推', pull: '拉', legs: '腿', chest: '胸', shoulder: '肩',
      arms: '手臂', cardio: '有氧', rest: '休息',
    }
    const label = typeLabel[trainingType] || trainingType
    await replyMessage(event.replyToken, [
      {
        type: 'text',
        text: `${label} 👍 練了多久？`,
        quickReply: {
          items: [
            qr('30 分鐘', `訓練完成 ${trainingType} 30`),
            qr('45 分鐘', `訓練完成 ${trainingType} 45`),
            qr('60 分鐘', `訓練完成 ${trainingType} 60`),
            qr('90 分鐘', `訓練完成 ${trainingType} 90`),
          ],
        },
      },
    ])
    return
  }

  // ── Training step 2: duration selected -> ask RPE ──
  const trainingDurationMatch = text.match(/^訓練完成\s+(\w+)\s+(\d+)$/i)
  if (trainingDurationMatch) {
    const trainingType = trainingDurationMatch[1]
    const duration = trainingDurationMatch[2]
    await replyMessage(event.replyToken, [
      {
        type: 'text',
        text: '強度感受如何？',
        quickReply: {
          items: [
            qr('輕鬆 RPE 5', `訓練儲存 ${trainingType} ${duration} 5`),
            qr('適中 RPE 7', `訓練儲存 ${trainingType} ${duration} 7`),
            qr('很硬 RPE 8', `訓練儲存 ${trainingType} ${duration} 8`),
            qr('快死了 RPE 10', `訓練儲存 ${trainingType} ${duration} 10`),
          ],
        },
      },
    ])
    return
  }

  // ── Training step 3: save ──
  const trainingSaveMatch = text.match(/^訓練儲存\s+(\w+)\s+(\d+)\s+(\d+)$/i)
  if (trainingSaveMatch) {
    const trainingType = trainingSaveMatch[1]
    const duration = parseInt(trainingSaveMatch[2])
    const rpe = parseInt(trainingSaveMatch[3])
    await handleQuickTraining(event.replyToken, client, trainingType, duration, rpe, supabase)
    return
  }

  // ── Wellness step 1: sleep ──
  const sleepMatch = text.match(/^睡眠\s+(\d)$/i)
  if (sleepMatch) {
    const sleep = sleepMatch[1]
    await replyMessage(event.replyToken, [
      {
        type: 'text',
        text: '今天精力如何？',
        quickReply: {
          items: [
            qr('🪫 沒電', `精力 ${sleep} 1`),
            qr('🔋 普通', `精力 ${sleep} 3`),
            qr('⚡ 充沛', `精力 ${sleep} 4`),
            qr('🔥 爆棚', `精力 ${sleep} 5`),
          ],
        },
      },
    ])
    return
  }

  // ── Wellness step 2: energy ──
  const energyMatch = text.match(/^精力\s+(\d)\s+(\d)$/i)
  if (energyMatch) {
    const sleep = energyMatch[1]
    const energy = energyMatch[2]
    await replyMessage(event.replyToken, [
      {
        type: 'text',
        text: '心情怎麼樣？',
        quickReply: {
          items: [
            qr('😩 很差', `心情 ${sleep} ${energy} 1`),
            qr('😐 普通', `心情 ${sleep} ${energy} 3`),
            qr('😊 不錯', `心情 ${sleep} ${energy} 4`),
            qr('🤩 超好', `心情 ${sleep} ${energy} 5`),
          ],
        },
      },
    ])
    return
  }

  // ── Wellness step 3: mood -> save ──
  const moodMatch = text.match(/^心情\s+(\d)\s+(\d)\s+(\d)$/i)
  if (moodMatch) {
    const sleep = parseInt(moodMatch[1])
    const energy = parseInt(moodMatch[2])
    const mood = parseInt(moodMatch[3])
    await handleQuickWellness(event.replyToken, client, sleep, energy, mood, supabase)
    return
  }

  // ── Legacy format: 身心 X X X ──
  const wellnessMatch = text.match(/^身心\s+(\d)\s+(\d)\s+(\d)$/i)
  if (wellnessMatch) {
    const sleep = parseInt(wellnessMatch[1])
    const energy = parseInt(wellnessMatch[2])
    const mood = parseInt(wellnessMatch[3])
    await handleQuickWellness(event.replyToken, client, sleep, energy, mood, supabase)
    return
  }

  // ── Legacy format: 訓練 推 60 RPE 8 ──
  const trainingFullMatch = text.match(/^訓練\s+(push|pull|legs|chest|shoulder|arms|cardio|rest|推|拉|腿|胸|肩|手臂|有氧|休息)\s+([\d]+)(?:分鐘?)?\s+RPE\s*([\d]+)$/i)
  if (trainingFullMatch) {
    const typeMap: Record<string, string> = {
      '推': 'push', '拉': 'pull', '腿': 'legs', '胸': 'chest',
      '肩': 'shoulder', '手臂': 'arms', '有氧': 'cardio', '休息': 'rest',
    }
    const rawType = trainingFullMatch[1].toLowerCase()
    const trainingType = typeMap[rawType] || rawType
    const duration = parseInt(trainingFullMatch[2])
    const rpe = parseInt(trainingFullMatch[3])
    await handleQuickTraining(event.replyToken, client, trainingType, duration, rpe, supabase)
    return
  }

  // ── Bare number as weight (bound users only) ──
  const bareNumberMatch = text.match(/^(\d{2,3}(?:\.\d{1,2})?)$/)
  if (bareNumberMatch && client) {
    const weight = parseFloat(bareNumberMatch[1])
    if (weight >= 30 && weight <= 200) {
      await handleQuickWeight(event.replyToken, client, weight, supabase)
      return
    }
  }

  // Non-command messages: no auto-reply, let coach reply manually in LINE OA backend
}
