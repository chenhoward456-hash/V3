/**
 * LINE Webhook Handler Functions
 *
 * Extracted from app/api/line/webhook/route.ts for modularity.
 * All database-writing handlers and query handlers live here.
 */

import { SupabaseClient } from '@supabase/supabase-js'
import { replyMessage, pushMessage, qr, switchRichMenuForUser } from '@/lib/line'
import { createLogger } from '@/lib/logger'
import { DAY_MS } from '@/lib/date-utils'

const log = createLogger('LINE-Handlers')

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://howard456.vercel.app'

// ═══════════════════════════════════════
// Shared types
// ═══════════════════════════════════════

/** Client record returned from LINE quick-record queries */
export interface LineClient {
  id: string
  name: string
  unique_code: string
  protein_target: number | null
  water_target: number | null
  calories_target: number | null
  subscription_tier: string | null
  training_enabled: boolean
  wellness_enabled: boolean
}

// ═══════════════════════════════════════
// Quick Reply presets (used by handlers)
// ═══════════════════════════════════════

const QR_AFTER_RECORD = {
  items: [
    qr('💧 記水量', '記水量'),
    qr('🍽️ 記飲食', '記飲食'),
    qr('🏋️ 記訓練', '記訓練'),
    qr('📊 今日狀態', '狀態'),
  ],
}

const QR_MAIN = {
  items: [
    qr('📊 今日狀態', '狀態'),
    qr('📈 7天趨勢', '趨勢'),
    qr('⚖️ 記體重', '記體重'),
    qr('🍽️ 記飲食', '記飲食'),
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

// ═══════════════════════════════════════
// Helpers
// ═══════════════════════════════════════

/** Taiwan timezone date string (YYYY-MM-DD) */
export function getTaiwanDate(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' })
}

// ═══════════════════════════════════════
// Client lookup
// ═══════════════════════════════════════

export async function getClientByLineId(lineUserId: string, supabase: SupabaseClient): Promise<LineClient | null> {
  const { data } = await supabase
    .from('clients')
    .select('id, name, unique_code, protein_target, water_target, calories_target, subscription_tier, training_enabled, wellness_enabled')
    .eq('line_user_id', lineUserId)
    .maybeSingle()
  return data
}

// ═══════════════════════════════════════
// Quick record: Weight
// ═══════════════════════════════════════

export async function handleQuickWeight(replyToken: string, client: LineClient | null, weight: number, supabase: SupabaseClient) {
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
    .maybeSingle()

  let msg = `✅ 已記錄體重：${weight} kg`
  if (prev?.weight) {
    const diff = weight - prev.weight
    const sign = diff > 0 ? '+' : ''
    msg += `\n${diff === 0 ? '➡️' : diff > 0 ? '📈' : '📉'} 比上次 ${sign}${diff.toFixed(1)} kg（${prev.date}）`
  }

  await replyMessage(replyToken, [{ type: 'text', text: msg, quickReply: QR_AFTER_RECORD }])
}

// ═══════════════════════════════════════
// Quick record: Water
// ═══════════════════════════════════════

export async function handleQuickWater(replyToken: string, client: LineClient | null, waterMl: number, supabase: SupabaseClient) {
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
    .maybeSingle()

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

// ═══════════════════════════════════════
// Quick record: Protein
// ═══════════════════════════════════════

export async function handleQuickProtein(replyToken: string, client: LineClient | null, protein: number, supabase: SupabaseClient) {
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

// ═══════════════════════════════════════
// Quick record: Diet compliance
// ═══════════════════════════════════════

export async function handleQuickCompliance(replyToken: string, client: LineClient | null, compliant: boolean, supabase: SupabaseClient) {
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

// ═══════════════════════════════════════
// Quick record: Training
// ═══════════════════════════════════════

export async function handleQuickTraining(
  replyToken: string, client: LineClient | null,
  trainingType: string, duration: number | null, rpe: number | null,
  supabase: SupabaseClient
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

  // Input validation: duration
  if (duration != null && (duration < 1 || duration > 300)) {
    await replyMessage(replyToken, [{ type: 'text', text: '訓練時長需在 1-300 分鐘之間' }])
    return
  }

  // Input validation: RPE
  if (rpe != null && (rpe < 1 || rpe > 10)) {
    await replyMessage(replyToken, [{ type: 'text', text: 'RPE 需在 1-10 之間' }])
    return
  }

  const today = getTaiwanDate()
  const record: { client_id: string; date: string; training_type: string; duration?: number; rpe?: number } = { client_id: client.id, date: today, training_type: trainingType }
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
    arms: '手臂', cardio: '有氧', rest: '休息', full_body: '全身', upper_body: '上肢',
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

// ═══════════════════════════════════════
// Quick record: Wellness
// ═══════════════════════════════════════

export async function handleQuickWellness(
  replyToken: string, client: LineClient | null,
  sleep: number, energy: number, mood: number,
  supabase: SupabaseClient
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

  // Input validation: sleep/energy/mood must be 1-5
  if (sleep < 1 || sleep > 5 || energy < 1 || energy > 5 || mood < 1 || mood > 5) {
    await replyMessage(replyToken, [{ type: 'text', text: '數值必須在 1-5 之間', quickReply: QR_WELLNESS }])
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
// Bind account
// ═══════════════════════════════════════

export async function handleBind(replyToken: string, lineUserId: string, code: string, supabase: SupabaseClient) {
  const { data: existing } = await supabase
    .from('clients')
    .select('id, name')
    .eq('line_user_id', lineUserId)
    .maybeSingle()

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
    .maybeSingle()

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

  // Switch Rich Menu based on subscription tier
  await switchRichMenuForUser(lineUserId, client.subscription_tier || 'free')

  await replyMessage(replyToken, [
    {
      type: 'text',
      text: `綁定成功！歡迎 ${client.name} 🎉\n\n下方選單已切換為快速記錄模式，點按鈕開始使用 👇`,
      quickReply: QR_MAIN,
    },
  ])

  // Push onboarding guide after 1 second delay (via pushMessage to avoid reply limit)
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
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://howard456.vercel.app'

  const common = [
    `📋 ${name} 的系統使用指南`,
    '',
    '━━━━━━━━━━━━━━━━',
    '⚖️ 每日體重記錄（最重要！）',
    '→ 每天起床後空腹量體重，直接輸入數字（如「73.5」）系統會自動記錄',
    '→ 連續 14 天後啟動 TDEE 校正',
    '',
    '🍽️ 飲食記錄',
    '→ 輸入「記飲食」標記今天飲食達標或未達標',
    '→ 搭配體重數據，系統可分析你的飲食合規率',
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
      '✅ 飲食達標紀錄',
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
      '✅ 完整補品管理與血檢追蹤',
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
// Status query
// ═══════════════════════════════════════

export async function handleStatusQuery(replyToken: string, client: LineClient, supabase: SupabaseClient) {
  const today = getTaiwanDate()

  const [bodyRes, wellness, nutrition, training] = await Promise.all([
    supabase.from('body_composition').select('weight').eq('client_id', client.id).eq('date', today).maybeSingle(),
    supabase.from('daily_wellness').select('*').eq('client_id', client.id).eq('date', today).maybeSingle(),
    supabase.from('nutrition_logs').select('*').eq('client_id', client.id).eq('date', today).maybeSingle(),
    supabase.from('training_logs').select('*').eq('client_id', client.id).eq('date', today).maybeSingle(),
  ])

  const lines: string[] = [`📊 ${client.name} 今日狀態\n`]

  // Collect missing-item quick reply buttons
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

  // Dynamic buttons: show what's missing, always include trend
  const statusQR = {
    items: [
      ...missingButtons.slice(0, 3),
      qr('📈 7天趨勢', '趨勢'),
    ],
  }

  await replyMessage(replyToken, [{ type: 'text', text: lines.join('\n'), quickReply: statusQR }])
}

// ═══════════════════════════════════════
// Trend query
// ═══════════════════════════════════════

export async function handleTrendQuery(replyToken: string, client: LineClient, supabase: SupabaseClient) {

  const today = getTaiwanDate()
  const sevenDaysAgo = new Date(new Date().getTime() - 7 * DAY_MS).toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' })

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
      .eq('client_id', client.id).order('week_of', { ascending: false }).limit(1).maybeSingle(),
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
    lines.push(`   ${body.map((b: { weight: number }) => b.weight).join(' → ')}`)
  } else if (body.length === 1) {
    lines.push(`⚖️ 體重：${body[0].weight}kg（僅 1 筆紀錄）`)
  } else {
    lines.push('⚖️ 體重：無紀錄')
  }

  if (nutrition.length > 0) {
    const compliantDays = nutrition.filter((n: { compliant: boolean | null }) => n.compliant).length
    const rate = Math.round((compliantDays / nutrition.length) * 100)
    lines.push(`\n🍽️ 飲食合規：${compliantDays}/${nutrition.length} 天（${rate}%）`)

    const proteins = nutrition.filter((n: { protein_grams: number | null }) => n.protein_grams).map((n: { protein_grams: number | null }) => n.protein_grams as number)
    if (proteins.length > 0) {
      const avg = Math.round(proteins.reduce((a: number, b: number) => a + b, 0) / proteins.length)
      lines.push(`🥩 平均蛋白質：${avg}g/天`)
    }

    const waters = nutrition.filter((n: { water_ml: number | null }) => n.water_ml).map((n: { water_ml: number | null }) => n.water_ml as number)
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
      arms: '手臂', cardio: '有氧', rest: '休息', full_body: '全身', upper_body: '上肢',
    }
    const typeSummary = Object.entries(typeCount).map(([k, v]) => `${typeLabel[k] || k}×${v}`).join(' ')
    lines.push(`\n🏋️ 訓練 ${training.length} 天：${typeSummary}`)

    const rpes = training.filter((t: { rpe: number | null }) => t.rpe).map((t: { rpe: number | null }) => t.rpe as number)
    if (rpes.length > 0) {
      const avg = (rpes.reduce((a: number, b: number) => a + b, 0) / rpes.length).toFixed(1)
      lines.push(`💪 平均 RPE：${avg}`)
    }
  } else {
    lines.push('\n🏋️ 訓練：無紀錄')
  }

  if (wellness.length > 0) {
    const avgSleep = (wellness.reduce((s: number, w: { sleep_quality: number | null }) => s + (w.sleep_quality || 0), 0) / wellness.length).toFixed(1)
    const avgEnergy = (wellness.reduce((s: number, w: { energy_level: number | null }) => s + (w.energy_level || 0), 0) / wellness.length).toFixed(1)
    const avgMood = (wellness.reduce((s: number, w: { mood: number | null }) => s + (w.mood || 0), 0) / wellness.length).toFixed(1)
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
// Postback handling
// ═══════════════════════════════════════

/** LINE webhook event shape (subset of fields we use) */
interface LineWebhookEvent {
  type: string
  replyToken: string
  source?: { userId?: string; type?: string }
  message?: { type: string; text?: string }
  postback?: { data: string }
}

export async function handlePostback(event: LineWebhookEvent, userId: string, supabase: SupabaseClient) {
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

// ═══════════════════════════════════════
// Quick record: Natural language nutrition (AI estimation)
// ═══════════════════════════════════════

export async function handleNaturalNutrition(
  replyToken: string,
  client: LineClient | null,
  foodDescription: string,
  supabase: SupabaseClient
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

  try {
    // 1. 用 Claude Haiku 估算熱量
    const Anthropic = (await import('@anthropic-ai/sdk')).default
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      await replyMessage(replyToken, [{ type: 'text', text: '營養估算功能暫時不可用，請稍後再試' }])
      return
    }
    const anthropic = new Anthropic({ apiKey })

    const aiResponse = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      messages: [
        {
          role: 'user',
          content: `你是營養估算工具。根據以下食物描述，估算熱量和巨量營養素。
回傳嚴格 JSON 格式：{"calories":數字,"protein":數字,"carbs":數字,"fat":數字,"items":"食物摘要"}
如果無法判斷份量，用台灣常見份量估算。不要解釋，只回 JSON。

食物描述：${foodDescription}`,
        },
      ],
    })

    const aiText = aiResponse.content[0].type === 'text' ? aiResponse.content[0].text : ''
    const jsonMatch = aiText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      await replyMessage(replyToken, [{ type: 'text', text: '無法辨識食物內容，請描述更具體一點，例如：\n「吃了雞胸 200g 白飯一碗」' }])
      return
    }

    const parsed = JSON.parse(jsonMatch[0])
    const calories = Math.round(parsed.calories || 0)
    const protein = Math.round(parsed.protein || 0)
    const carbs = Math.round(parsed.carbs || 0)
    const fat = Math.round(parsed.fat || 0)
    const items = parsed.items || foodDescription

    if (calories <= 0) {
      await replyMessage(replyToken, [{ type: 'text', text: '無法估算熱量，請描述更具體一點，例如：\n「雞胸 200g + 白飯一碗 + 燙青菜」' }])
      return
    }

    // 2. 寫入或累加 nutrition_logs
    const today = getTaiwanDate()
    const { data: existing } = await supabase
      .from('nutrition_logs')
      .select('id, calories, protein, carbs, fat, note')
      .eq('client_id', client.id)
      .eq('date', today)
      .maybeSingle()

    if (existing) {
      // 累加
      const newCal = (existing.calories || 0) + calories
      const newPro = (existing.protein || 0) + protein
      const newCarbs = (existing.carbs || 0) + carbs
      const newFat = (existing.fat || 0) + fat
      const newNote = existing.note ? `${existing.note}\n${items}` : items

      await supabase
        .from('nutrition_logs')
        .update({ calories: newCal, protein: newPro, carbs: newCarbs, fat: newFat, note: newNote })
        .eq('id', existing.id)

      const target = client.calories_target
      const pctText = target ? ` (${Math.round(newCal / target * 100)}%)` : ''

      await replyMessage(replyToken, [
        {
          type: 'text',
          text: `✅ 已記錄：${items}\n約 ${calories} kcal（P ${protein}g / C ${carbs}g / F ${fat}g）\n\n📊 今日累計 ${newCal} kcal${pctText}`,
          quickReply: QR_AFTER_RECORD,
        },
      ])
    } else {
      // 新增
      await supabase
        .from('nutrition_logs')
        .insert({ client_id: client.id, date: today, calories, protein, carbs, fat, compliant: true, note: items })

      await replyMessage(replyToken, [
        {
          type: 'text',
          text: `✅ 已記錄：${items}\n約 ${calories} kcal（P ${protein}g / C ${carbs}g / F ${fat}g）`,
          quickReply: QR_AFTER_RECORD,
        },
      ])
    }
  } catch (err: unknown) {
    log.error('Natural nutrition error:', err)
    await replyMessage(replyToken, [{ type: 'text', text: '記錄失敗，請稍後再試' }])
  }
}
