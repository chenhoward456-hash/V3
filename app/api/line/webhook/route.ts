import { NextRequest, NextResponse } from 'next/server'
import { verifyLineSignature, replyMessage, pushMessage, qr, linkRichMenuToUser, unlinkRichMenuFromUser, listRichMenus } from '@/lib/line'
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
    case 'follow': {
      log.info(`New follower: ${userId}`)
      // 檢查是否是已綁定的回歸用戶 → 自動切到學員版 Rich Menu
      const existingClient = await getClientByLineId(userId, supabase)
      if (existingClient) {
        await switchToMemberRichMenu(userId)
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
      // 只清 last_line_activity，保留 line_user_id 避免用戶手滑封鎖後需要重新綁定
      await supabase
        .from('clients')
        .update({ last_line_activity: null })
        .eq('line_user_id', userId)
      break
  }
}

async function handleTextMessage(event: any, userId: string, supabase: any) {
  const text = (event.message.text || '').trim()

  // 一次性查詢 client，後續所有 handler 共用，避免重複 DB 查詢
  const client = await getClientByLineId(userId, supabase)

  // 已綁定用戶 → 確保使用學員版 Rich Menu（背景執行，不阻塞回覆）
  if (client) {
    switchToMemberRichMenu(userId).catch(() => {})
  }

  // 選單指令 — 叫出所有功能按鈕
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

  // 留言詢問
  if (text === '我想詢問問題') {
    await replyMessage(event.replyToken, [
      { type: 'text', text: '請直接打字描述你的問題，教練會親自回覆你！' },
    ])
    return
  }

  // 新用戶導流：免費評估
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

  // 新用戶導流：免費教學
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

  // 新用戶導流：查看方案
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

  // 新用戶導流：我要綁定
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

  // 評估結果跟進（做完 diagnosis 後回來）
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

  // 綁定指令
  const bindMatch = text.match(/^綁定\s+([a-zA-Z0-9_-]+)$/i)
  if (bindMatch) {
    await handleBind(event.replyToken, userId, bindMatch[1], supabase)
    return
  }

  // 未綁定用戶直接傳送 8 碼代碼 → 自動當作綁定
  if (!client) {
    const bareCodeMatch = text.match(/^[a-zA-Z0-9_-]{8}$/)
    if (bareCodeMatch) {
      await handleBind(event.replyToken, userId, text, supabase)
      return
    }
  }

  // ── 需要綁定帳號的功能（未綁定 → 升級提示）──
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

  // 查詢狀態
  if (text === '狀態' || text === '今天狀態') {
    await handleStatusQuery(event.replyToken, client!, supabase)
    return
  }

  // 趨勢查詢
  if (text === '趨勢' || text === '週報') {
    await handleTrendQuery(event.replyToken, client!, supabase)
    return
  }

  // ── 互動式入口：點按鈕進入流程 ──
  if (text === '記體重') {
    // 嘗試取上次體重，提供快捷按鈕
    if (client) {
      const { data: lastWeight } = await supabase
        .from('body_composition')
        .select('weight')
        .eq('client_id', client.id)
        .not('weight', 'is', null)
        .order('date', { ascending: false })
        .limit(1)
        .single()

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

  // ── 快速記錄：體重 ──
  const weightMatch = text.match(/^體重\s+([\d.]+)$/i)
  if (weightMatch) {
    await handleQuickWeight(event.replyToken, client, parseFloat(weightMatch[1]), supabase)
    return
  }

  // ── 快速記錄：水量 ──
  const waterMatch = text.match(/^水\s+([\d]+)$/i)
  if (waterMatch) {
    await handleQuickWater(event.replyToken, client, parseInt(waterMatch[1]), supabase)
    return
  }

  // ── 快速記錄：蛋白質 ──
  const proteinMatch = text.match(/^蛋白質?\s+([\d]+)$/i)
  if (proteinMatch) {
    await handleQuickProtein(event.replyToken, client, parseInt(proteinMatch[1]), supabase)
    return
  }

  // ── 快速記錄：飲食達標 ──
  if (text === '達標' || text === '飲食達標') {
    await handleQuickCompliance(event.replyToken, client, true, supabase)
    return
  }
  if (text === '未達標' || text === '飲食未達標') {
    await handleQuickCompliance(event.replyToken, client, false, supabase)
    return
  }

  // ── 快速記錄：訓練（選部位後 → 問時長） ──
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

  // ── 訓練第二步：選完時長 → 問強度 ──
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

  // ── 訓練第三步：儲存 ──
  const trainingSaveMatch = text.match(/^訓練儲存\s+(\w+)\s+(\d+)\s+(\d+)$/i)
  if (trainingSaveMatch) {
    const trainingType = trainingSaveMatch[1]
    const duration = parseInt(trainingSaveMatch[2])
    const rpe = parseInt(trainingSaveMatch[3])
    await handleQuickTraining(event.replyToken, client, trainingType, duration, rpe, supabase)
    return
  }

  // ── 身心分步記錄：步驟 1 — 睡眠 ──
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

  // ── 身心分步記錄：步驟 2 — 精力 ──
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

  // ── 身心分步記錄：步驟 3 — 心情 → 儲存 ──
  const moodMatch = text.match(/^心情\s+(\d)\s+(\d)\s+(\d)$/i)
  if (moodMatch) {
    const sleep = parseInt(moodMatch[1])
    const energy = parseInt(moodMatch[2])
    const mood = parseInt(moodMatch[3])
    await handleQuickWellness(event.replyToken, client, sleep, energy, mood, supabase)
    return
  }

  // ── 舊格式相容：身心 X X X ──
  const wellnessMatch = text.match(/^身心\s+(\d)\s+(\d)\s+(\d)$/i)
  if (wellnessMatch) {
    const sleep = parseInt(wellnessMatch[1])
    const energy = parseInt(wellnessMatch[2])
    const mood = parseInt(wellnessMatch[3])
    await handleQuickWellness(event.replyToken, client, sleep, energy, mood, supabase)
    return
  }

  // ── 舊格式相容：訓練 推 60 RPE 8 ──
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

  // ── 快速記錄：直接輸入數字當體重（已綁定用戶限定）──
  const bareNumberMatch = text.match(/^(\d{2,3}(?:\.\d{1,2})?)$/)
  if (bareNumberMatch && client) {
    const weight = parseFloat(bareNumberMatch[1])
    if (weight >= 30 && weight <= 200) {
      await handleQuickWeight(event.replyToken, client, weight, supabase)
      return
    }
  }

  // 非指令訊息 → 不自動回覆，讓教練在 LINE OA 後台手動回覆
  // （避免學員問正常問題時收到罐頭回覆，造成尷尬）
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

async function handleQuickWeight(replyToken: string, client: any, weight: number, supabase: any) {
  if (!client) {
    await replyMessage(replyToken, [
      {
        type: 'text',
        text: '此功能需綁定帳號 🔒\n輸入「綁定 [學員代碼]」或查看方案加入 👇',
        quickReply: { items: [qr('💰 查看方案', '查看方案'), qr('🔗 我有代碼', '我要綁定')] },
      },
    ])
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

async function handleQuickWater(replyToken: string, client: any, waterMl: number, supabase: any) {
  if (!client) {
    await replyMessage(replyToken, [
      {
        type: 'text',
        text: '此功能需綁定帳號 🔒\n輸入「綁定 [學員代碼]」或查看方案加入 👇',
        quickReply: { items: [qr('💰 查看方案', '查看方案'), qr('🔗 我有代碼', '我要綁定')] },
      },
    ])
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

async function handleQuickProtein(replyToken: string, client: any, protein: number, supabase: any) {
  if (!client) {
    await replyMessage(replyToken, [
      {
        type: 'text',
        text: '此功能需綁定帳號 🔒\n輸入「綁定 [學員代碼]」或查看方案加入 👇',
        quickReply: { items: [qr('💰 查看方案', '查看方案'), qr('🔗 我有代碼', '我要綁定')] },
      },
    ])
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

async function handleQuickCompliance(replyToken: string, client: any, compliant: boolean, supabase: any) {
  if (!client) {
    await replyMessage(replyToken, [
      {
        type: 'text',
        text: '此功能需綁定帳號 🔒\n輸入「綁定 [學員代碼]」或查看方案加入 👇',
        quickReply: { items: [qr('💰 查看方案', '查看方案'), qr('🔗 我有代碼', '我要綁定')] },
      },
    ])
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
  replyToken: string, client: any,
  trainingType: string, duration: number | null, rpe: number | null,
  supabase: any
) {
  if (!client) {
    await replyMessage(replyToken, [
      {
        type: 'text',
        text: '此功能需綁定帳號 🔒\n輸入「綁定 [學員代碼]」或查看方案加入 👇',
        quickReply: { items: [qr('💰 查看方案', '查看方案'), qr('🔗 我有代碼', '我要綁定')] },
      },
    ])
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
  replyToken: string, client: any,
  sleep: number, energy: number, mood: number,
  supabase: any
) {
  if (!client) {
    await replyMessage(replyToken, [
      {
        type: 'text',
        text: '此功能需綁定帳號 🔒\n輸入「綁定 [學員代碼]」或查看方案加入 👇',
        quickReply: { items: [qr('💰 查看方案', '查看方案'), qr('🔗 我有代碼', '我要綁定')] },
      },
    ])
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

async function handleTrendQuery(replyToken: string, client: any, supabase: any) {

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
    .select('id, name, line_user_id, subscription_tier')
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

  // 切換到學員版 Rich Menu
  await switchToMemberRichMenu(lineUserId)

  await replyMessage(replyToken, [
    {
      type: 'text',
      text: `綁定成功！歡迎 ${client.name} 🎉\n\n下方選單已切換為快速記錄模式，點按鈕開始使用 👇`,
      quickReply: QR_MAIN,
    },
  ])

  // 延遲 1 秒後推送系統使用指南（用 pushMessage 避免 reply 限制）
  setTimeout(async () => {
    try {
      const guide = buildOnboardingGuide(client.name, client.subscription_tier || 'free')
      await pushMessage(lineUserId, [{ type: 'text', text: guide }])
    } catch (err) {
      log.error('Onboarding guide push failed', err)
    }
  }, 1000)
}

function buildOnboardingGuide(name: string, tier: string): string {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://howardprotocol.com'

  const common = [
    `📋 ${name} 的系統使用指南`,
    '',
    '━━━━━━━━━━━━━━━━',
    '⚖️ 每日體重記錄（最重要！）',
    '→ 每天起床後空腹量體重，直接輸入數字（如「73.5」）系統會自動記錄',
    '→ 連續 14 天後啟動 TDEE 校正',
    '',
    '🍽️ 飲食記錄',
    '→ 輸入食物名稱（如「雞胸肉 200g」），AI 自動估算熱量與巨量營養素',
    '→ 也可以直接拍照，系統會辨識食物內容',
    '',
    '📊 查看狀態',
    '→ 輸入「今日」查看今天的攝取總覽',
    '→ 輸入「趨勢」查看 7 天體重與熱量變化',
  ]

  if (tier === 'free') {
    return [
      ...common,
      '',
      '━━━━━━━━━━━━━━━━',
      '🎁 你目前是免費方案，包含：',
      '✅ 體重追蹤 + 趨勢圖',
      '✅ 飲食紀錄 + 熱量估算',
      '✅ TDEE 與巨量營養素計算',
      '',
      '🔒 升級自主管理方案（$499/月）解鎖：',
      '• 24h AI 自動分析你的數據趨勢',
      '• 自適應 TDEE 每週自動校正',
      '• 訓練紀錄 + 身心狀態追蹤',
      '• Carb Cycling / Refeed 智能觸發',
      '',
      `👉 升級連結：${siteUrl}/remote`,
      '',
      '💡 建議先持續記錄 7 天，體驗系統後再決定是否升級！',
    ].join('\n')
  }

  if (tier === 'coached') {
    return [
      ...common,
      '',
      '🏋️ 訓練記錄',
      '→ 輸入「練」開始記錄今天的訓練內容',
      '',
      '😊 身心狀態',
      '→ 輸入「狀態」記錄睡眠、壓力、疲勞等指標',
      '',
      '💊 補劑追蹤',
      '→ 輸入「補劑」記錄每日補劑攝取',
      '',
      '━━━━━━━━━━━━━━━━',
      '🏆 你是教練指導方案，專屬功能：',
      '✅ 以上全部功能',
      '✅ CSCS 教練每週審閱你的數據',
      '✅ LINE 一對一諮詢',
      '✅ 補劑與血檢個人化建議',
      '',
      '💡 第一步：現在就輸入今天的體重吧！',
    ].join('\n')
  }

  // self_managed (499) — default for paid
  return [
    ...common,
    '',
    '🏋️ 訓練記錄',
    '→ 輸入「練」開始記錄今天的訓練內容',
    '',
    '😊 身心狀態',
    '→ 輸入「狀態」記錄睡眠、壓力、疲勞等指標',
    '',
    '🤖 AI 教練',
    '→ 直接用自然語言問問題（如「我這週吃太多了嗎？」）',
    '→ AI 會根據你的數據給出個人化建議',
    '',
    '━━━━━━━━━━━━━━━━',
    '✅ 你的方案包含：',
    '• 24h AI 自動分析 + 個人化建議',
    '• 自適應 TDEE 每週校正',
    '• 訓練追蹤 + 身心狀態記錄',
    '• Carb Cycling / Refeed 智能觸發',
    '',
    '💡 第一步：現在就輸入今天的體重吧！',
  ].join('\n')
}

// ═══════════════════════════════════════
// Rich Menu 切換
// ═══════════════════════════════════════

/** 找到學員版 Rich Menu 並綁定給用戶 */
async function switchToMemberRichMenu(lineUserId: string) {
  try {
    const menus = await listRichMenus()
    const memberMenu = menus.find((m: any) => m.name?.includes('學員版'))
    if (memberMenu) {
      await linkRichMenuToUser(lineUserId, memberMenu.richMenuId)
      log.info(`Switched to member rich menu for ${lineUserId}`)
    } else {
      log.warn('Member rich menu not found — user will see default (marketing) menu')
    }
  } catch (err) {
    log.error('Failed to switch rich menu:', err)
  }
}

// ═══════════════════════════════════════
// Rich Menu Postback 處理
// ═══════════════════════════════════════

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://howard456.vercel.app'

async function handlePostback(event: any, userId: string, supabase: any) {
  const data = event.postback?.data || ''
  const params = new URLSearchParams(data)
  const action = params.get('action')

  switch (action) {
    case 'contact_support':
      await handleContactSupport(event.replyToken)
      break
    default:
      log.warn(`Unknown postback action: ${action}`)
  }
}

async function handleContactSupport(replyToken: string) {
  await replyMessage(replyToken, [
    {
      type: 'flex',
      altText: '聯繫客服',
      contents: {
        type: 'bubble',
        body: {
          type: 'box',
          layout: 'vertical',
          contents: [
            {
              type: 'text',
              text: '需要幫助嗎？',
              weight: 'bold',
              size: 'lg',
            },
            {
              type: 'text',
              text: '選擇下方選項，或直接打字描述你的問題！',
              size: 'sm',
              color: '#888888',
              margin: 'md',
              wrap: true,
            },
          ],
        },
        footer: {
          type: 'box',
          layout: 'vertical',
          spacing: 'sm',
          contents: [
            {
              type: 'button',
              style: 'primary',
              color: '#4CAF50',
              action: {
                type: 'message',
                label: '📋 常見問題 FAQ',
                text: 'FAQ',
              },
            },
            {
              type: 'button',
              style: 'primary',
              color: '#2196F3',
              action: {
                type: 'message',
                label: '✏️ 直接留言給教練',
                text: '我想詢問問題',
              },
            },
            {
              type: 'button',
              style: 'secondary',
              action: {
                type: 'uri',
                label: '🌐 查看方案說明',
                uri: `${SITE_URL}/join`,
              },
            },
          ],
        },
      },
    },
  ])
}

async function handleStatusQuery(replyToken: string, client: any, supabase: any) {
  const today = getTaiwanDate()

  const [bodyRes, wellness, nutrition, training] = await Promise.all([
    supabase.from('body_composition').select('weight').eq('client_id', client.id).eq('date', today).single(),
    supabase.from('daily_wellness').select('*').eq('client_id', client.id).eq('date', today).single(),
    supabase.from('nutrition_logs').select('*').eq('client_id', client.id).eq('date', today).single(),
    supabase.from('training_logs').select('*').eq('client_id', client.id).eq('date', today).single(),
  ])

  const lines: string[] = [`📊 ${client.name} 今日狀態\n`]

  // 收集缺漏項目的 quick reply 按鈕
  const missingButtons = []

  if (bodyRes.data?.weight) {
    lines.push(`⚖️ 體重：${bodyRes.data.weight} kg`)
  } else {
    lines.push('⚠️ 體重未記錄')
    missingButtons.push(qr('⚖️ 記體重', '記體重'))
  }

  lines.push('')

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
