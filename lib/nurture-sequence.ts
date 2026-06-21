/**
 * Lead Nurture Sequence — 12 天 LINE 養客序列
 *
 * 流程：
 *  - Day 0 (follow 當下)：歡迎訊息 + PDF 連結
 *  - Day 2/4/6/8/10/12：每天 cron 檢查、push 對應訊息
 *
 * 對象：非付費學員的 LINE follower（已綁定學員不進入此序列）
 */

import { SupabaseClient } from '@supabase/supabase-js'
import { pushMessage, LineMessage } from '@/lib/line'
import { createLogger } from '@/lib/logger'

const log = createLogger('NurtureSequence')

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://howard456.vercel.app'

// PDF 連結 — 等實際 PDF 排好後填入 env var；未設定時用 placeholder
const PDF_URL = process.env.LEAD_MAGNET_PDF_URL || `${SITE_URL}/pdf/healthcomplete-map.pdf`

// ═══════════════════════════════════════
// Day 0：加入立即發送（歡迎 + PDF）
// ═══════════════════════════════════════

export function buildDay0Messages(): LineMessage[] {
  return [
    {
      type: 'text',
      text: '嘿，謝謝你加入 👊\n我是 Howard，CSCS 教練。\n\n我做了一套「邊用邊看自己進步」的健康追蹤系統，免費就能用。\n\n先給你看方案差別 👇',
    },
    {
      type: 'flex',
      altText: '📘 Howard Protocol 方案介紹',
      contents: {
        type: 'bubble',
        body: {
          type: 'box',
          layout: 'vertical',
          contents: [
            { type: 'text', text: '📘 Howard Protocol', weight: 'bold', size: 'xl' },
            { type: 'text', text: '完整版 PDF 製作中 · 先看方案介紹', size: 'sm', color: '#888888', margin: 'md', wrap: true },
          ],
        },
        footer: {
          type: 'box',
          layout: 'vertical',
          contents: [
            {
              type: 'button',
              action: { type: 'uri', label: '查看方案介紹', uri: PDF_URL },
              style: 'primary',
              color: '#3756d8',
            },
          ],
        },
      },
    },
    {
      type: 'text',
      text: '🎯 三件事可以馬上做：\n\n1️⃣ 點上方「方案介紹」看你想要的版本\n2️⃣ 拿到專屬代碼後，把代碼貼回 LINE 我就幫你綁定\n3️⃣ 綁定後會給你完整使用說明連結\n\n之後我會偶爾分享真的有用的進步觀念（不是雞湯）。不想收到，左上角靜音就好 🙏',
    },
  ]
}

// ═══════════════════════════════════════
// Day 2-12：排程訊息
// ═══════════════════════════════════════

export function buildDayMessages(day: number): LineMessage[] {
  switch (day) {
    case 2:
      return [
        { type: 'text', text: '昨天 PDF 翻了嗎？' },
        {
          type: 'text',
          text: '很多人練 1-2 年沒進步，以為是天賦。\n\n99% 不是。是動作品質。\n\n每下漏 30% 刺激，10 年累積下來就差很多。',
        },
        {
          type: 'text',
          text: '深蹲時膝蓋內夾這個錯誤，90% 男生都中。\n下次練腿時注意一下 🦵\n\n明天聊「練越多反而沒進步」。',
        },
      ]

    case 4:
      return [
        { type: 'text', text: '反直覺問題：\n練越多 = 進步越快嗎？\n\n❌' },
        {
          type: 'text',
          text: '肌肉不是在健身房長的。\n是你睡覺、吃飯、休息的時候長的。\n\n訓練只是給訊號，恢復才是合成。',
        },
        {
          type: 'text',
          text: 'HRV 就是一個能告訴你「今天該不該重訓」的指標 — 大多數人都沒用過。\n\n明天分享「進步最快的人都有的 3 個共通點」🎯',
        },
      ]

    case 6:
      return [
        {
          type: 'text',
          text: '帶學員幾年，進步最快的人都有 3 個共通點：\n\n1️⃣ 訓練減量（6 天 → 4 天）\n2️⃣ 每週看趨勢，不看單天體重\n3️⃣ 訓練日/休息日吃不一樣的碳水',
        },
        {
          type: 'text',
          text: '不是練更多，是有系統地調整。\n\n碳水循環這套方法 — 訓練日 vs 休息日要怎麼吃完全不同，多數人不知道。\n\n明天給你一個免費工具，看你卡在哪 🎯',
        },
      ]

    case 8:
      return [
        { type: 'text', text: '卡關不是不夠努力，\n是不知道卡在哪。\n\n我做了個免費診斷，5 分鐘填完 👇' },
        {
          type: 'flex',
          altText: '🎯 免費診斷 · 5 分鐘',
          contents: {
            type: 'bubble',
            body: {
              type: 'box',
              layout: 'vertical',
              contents: [
                { type: 'text', text: '🎯 免費診斷', weight: 'bold', size: 'xl' },
                { type: 'text', text: '5 分鐘看你最該優先優化什麼', size: 'sm', color: '#888888', margin: 'md', wrap: true },
              ],
            },
            footer: {
              type: 'box',
              layout: 'vertical',
              contents: [
                {
                  type: 'button',
                  action: { type: 'uri', label: '開始診斷', uri: `${SITE_URL}/diagnosis` },
                  style: 'primary',
                  color: '#3756d8',
                },
              ],
            },
          },
        },
        {
          type: 'text',
          text: '會告訴你：\n✅ 目前狀態\n✅ 該優先優化什麼\n✅ 3-6 個月可能的變化\n\n填完截圖傳我，我親自幫你看 👀',
        },
      ]

    case 10:
      return [
        { type: 'text', text: '你可能好奇我為什麼做這個系統。\n\n老實說 — 因為我 20 歲那年慘到不行。' },
        {
          type: 'text',
          text: '那時候我「只練不管其他」：\n天天訓練、加重量、不睡覺。\n\n結果？\n🔻 全身發炎疼痛\n🔻 免疫崩潰反覆生病\n🔻 甚至引發細菌感染、開始禿頭\n\n醫生跟我說：「你的身體在求救，你卻一直加碼。」\n\n完全恢復花了我 8 個月。',
        },
        {
          type: 'text',
          text: '從那之後我明白 — 訓練量再大、知識再正確，沒有同時管恢復跟營養，最後是身體先垮。\n\n但手動追蹤太累，Excel 撐了 2 年又放棄。最後我決定自己寫一個系統，讓這件事自動化。\n\n明天細講 ⚙️',
        },
      ]

    case 12:
      return [
        { type: 'text', text: '講到這你應該猜到了。\n我做的系統有兩個版本 👇' },
        {
          type: 'flex',
          altText: '🔵 自主管理版 NT$499/月',
          contents: {
            type: 'bubble',
            header: {
              type: 'box',
              layout: 'vertical',
              contents: [
                { type: 'text', text: '🔵 自主管理版', weight: 'bold', size: 'xl', color: '#ffffff' },
                { type: 'text', text: 'NT$499 / 月', size: 'md', color: '#ffffff', margin: 'sm' },
              ],
              backgroundColor: '#3756d8',
              paddingAll: '20px',
            },
            body: {
              type: 'box',
              layout: 'vertical',
              spacing: 'sm',
              contents: [
                { type: 'text', text: '• 自適應 TDEE（每週自動重算）', size: 'sm', wrap: true },
                { type: 'text', text: '• 訓練/休息日碳水自動分配', size: 'sm', wrap: true },
                { type: 'text', text: '• HRV 個人基線追蹤', size: 'sm', wrap: true },
                { type: 'text', text: '• 過度訓練早期偵測', size: 'sm', wrap: true },
                { type: 'text', text: '• Refeed 自動觸發', size: 'sm', wrap: true },
              ],
            },
            footer: {
              type: 'box',
              layout: 'vertical',
              contents: [
                {
                  type: 'button',
                  action: { type: 'uri', label: '了解方案', uri: `${SITE_URL}/join?tier=self_managed` },
                  style: 'primary',
                  color: '#3756d8',
                },
              ],
            },
          },
        },
        {
          type: 'flex',
          altText: '🟢 教練指導版 NT$2,999/月',
          contents: {
            type: 'bubble',
            header: {
              type: 'box',
              layout: 'vertical',
              contents: [
                { type: 'text', text: '🟢 教練指導版', weight: 'bold', size: 'xl', color: '#ffffff' },
                { type: 'text', text: 'NT$2,999 / 月 · 限 20 人', size: 'md', color: '#ffffff', margin: 'sm' },
              ],
              backgroundColor: '#1a3a5c',
              paddingAll: '20px',
            },
            body: {
              type: 'box',
              layout: 'vertical',
              spacing: 'sm',
              contents: [
                { type: 'text', text: '• 上面全部功能', size: 'sm', wrap: true },
                { type: 'text', text: '• 我每週幫你 review 數據', size: 'sm', wrap: true },
                { type: 'text', text: '• LINE 即時諮詢', size: 'sm', wrap: true },
                { type: 'text', text: '• 每月 1 次視訊', size: 'sm', wrap: true },
              ],
            },
            footer: {
              type: 'box',
              layout: 'vertical',
              contents: [
                {
                  type: 'button',
                  action: { type: 'uri', label: '了解方案', uri: `${SITE_URL}/join?tier=coached` },
                  style: 'primary',
                  color: '#1a3a5c',
                },
              ],
            },
          },
        },
        { type: 'text', text: '99% 從 499 開始就夠。\n不綁約，隨時取消。' },
        {
          type: 'text',
          text: '有問題直接回這訊息，我親自回 🙌\n\n謝謝你看完這 12 天的訊息。\n不管訂不訂，PDF 都是你的。\n\n— Howard',
        },
      ]

    default:
      return []
  }
}

// ═══════════════════════════════════════
// 訂閱者管理
// ═══════════════════════════════════════

/** 用戶 follow 時 — 啟動序列 */
export async function enrollSubscriber(
  lineUserId: string,
  supabase: SupabaseClient,
  profile?: { displayName?: string; pictureUrl?: string }
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('nurture_subscribers')
      .upsert(
        {
          line_user_id: lineUserId,
          followed_at: new Date().toISOString(),
          status: 'active',
          last_sent_day: 0,
          display_name: profile?.displayName || null,
          picture_url: profile?.pictureUrl || null,
        },
        { onConflict: 'line_user_id' }
      )

    if (error) {
      log.error('enrollSubscriber failed', { lineUserId, error })
      return false
    }
    return true
  } catch (err) {
    log.error('enrollSubscriber exception', { lineUserId, err })
    return false
  }
}

/** 用戶 unfollow 時 — 停止序列 */
export async function unenrollSubscriber(lineUserId: string, supabase: SupabaseClient): Promise<void> {
  try {
    await supabase
      .from('nurture_subscribers')
      .update({ status: 'unfollowed' })
      .eq('line_user_id', lineUserId)
      .eq('status', 'active')
  } catch (err) {
    log.error('unenrollSubscriber exception', { lineUserId, err })
  }
}

/** 用戶綁定為付費學員時 — 標記轉換成功，停止序列 */
export async function markConverted(lineUserId: string, supabase: SupabaseClient): Promise<void> {
  try {
    await supabase
      .from('nurture_subscribers')
      .update({ status: 'converted' })
      .eq('line_user_id', lineUserId)
      .in('status', ['active', 'completed'])
  } catch (err) {
    log.error('markConverted exception', { lineUserId, err })
  }
}

// ═══════════════════════════════════════
// Dispatcher：每天 cron 呼叫
// ═══════════════════════════════════════

/** 序列天數對應到從 followed_at 算起的天數 */
// 2026-06-22 停用 12 天 nurture 序列（Howard：沒意義；且免費 LINE 額度該留給付費學員、
// 不要花在追沒付錢的潛在客）。清空＝cron 照跑但不推任何序列訊息。加入時的即時歡迎(Day 0)保留。
const SEQUENCE_DAYS: number[] = []

interface DispatchResult {
  processed: number
  sent: number
  errors: number
  details: Array<{ lineUserId: string; day: number; ok: boolean; error?: string }>
}

/**
 * 找出所有該發訊息的訂閱者並 push
 * 邏輯：取所有 active 訂閱者，計算從 followed_at 至今的天數，發對應 Day 訊息
 */
export async function dispatchNurtureSequence(supabase: SupabaseClient): Promise<DispatchResult> {
  const result: DispatchResult = { processed: 0, sent: 0, errors: 0, details: [] }

  // 取所有 active 訂閱者，且 last_sent_day < 12
  const { data: subscribers, error } = await supabase
    .from('nurture_subscribers')
    .select('line_user_id, followed_at, last_sent_day')
    .eq('status', 'active')
    .lt('last_sent_day', 12)

  if (error) {
    log.error('dispatchNurtureSequence query failed', error)
    return result
  }

  if (!subscribers || subscribers.length === 0) {
    log.info('dispatchNurtureSequence: no active subscribers needing messages')
    return result
  }

  const now = new Date()

  for (const sub of subscribers) {
    result.processed++

    const followedAt = new Date(sub.followed_at)
    const daysSinceFollow = Math.floor((now.getTime() - followedAt.getTime()) / (1000 * 60 * 60 * 24))

    // 找出最大的 SEQUENCE_DAY 滿足：≤ daysSinceFollow 且 > last_sent_day
    let dayToSend: number | null = null
    for (const d of SEQUENCE_DAYS) {
      if (d <= daysSinceFollow && d > sub.last_sent_day) {
        dayToSend = d // 持續更新，取最大的
      }
    }

    if (dayToSend === null) continue

    // 發送訊息
    const messages = buildDayMessages(dayToSend)
    if (messages.length === 0) continue

    try {
      // 樂觀鎖：先嘗試 UPDATE 標記「準備發送」，只有當 last_sent_day 仍小於 dayToSend 才能成功
      // 防止兩個 cron 同時跑時重複發訊息
      const isCompleted = dayToSend === 12
      const { data: updated, error: updateErr } = await supabase
        .from('nurture_subscribers')
        .update({
          last_sent_day: dayToSend,
          ...(isCompleted ? { status: 'completed' } : {}),
        })
        .eq('line_user_id', sub.line_user_id)
        .lt('last_sent_day', dayToSend) // 只有 last_sent_day < dayToSend 才更新
        .select('line_user_id')

      if (updateErr || !updated || updated.length === 0) {
        // 另一個 cron 已經處理過了，跳過
        log.info(`Skipped ${sub.line_user_id} Day ${dayToSend} (already sent or locked)`)
        continue
      }

      const res = await pushMessage(sub.line_user_id, messages)
      const ok = res.ok

      if (ok) {
        result.sent++
        result.details.push({ lineUserId: sub.line_user_id, day: dayToSend, ok: true })
        log.info(`Sent Day ${dayToSend} to ${sub.line_user_id}`)
      } else {
        result.errors++
        const errText = await res.text().catch(() => 'unknown')
        result.details.push({ lineUserId: sub.line_user_id, day: dayToSend, ok: false, error: errText })
        log.error(`Push failed for ${sub.line_user_id} Day ${dayToSend}: ${errText}`)
      }
    } catch (err) {
      result.errors++
      result.details.push({
        lineUserId: sub.line_user_id,
        day: dayToSend,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      })
      log.error(`Push exception for ${sub.line_user_id} Day ${dayToSend}`, err)
    }

    // 避免 LINE API rate limit，每筆間隔 100ms
    await new Promise((r) => setTimeout(r, 100))
  }

  return result
}
