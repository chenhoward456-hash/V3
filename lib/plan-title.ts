/**
 * 計畫頁標題的顯示處理：拿掉 emoji，語意留下來。
 *
 * ## 為什麼（2026-09-14）
 *
 * `我的計畫` 的六個項目標題全部是 emoji 開頭（🎯🔢🏋️📋✅💼），實際畫面長這樣：
 *
 *   🎯 20 週要做什麼
 *   🔢 每天吃的四個數字
 *   🏋️ 你的課表為什麼長這樣
 *
 * DESIGN.md：「裝飾程度 minimal（靠字體、留白、層次做事，不靠色塊）」
 * 「乾淨、可信、值月費。看起來像醫療數據產品，不像玩具」。emoji 當項目符號跟這個對不上。
 *
 * ⚠️ **但不能全部無腦砍掉。** 其中 ⚠️ 跟 🚫 是有語意的
 * （「⚠️ 先講上次卡在哪」「🚫 這一段的三條紅線」），砍掉就把警示降級成一般條目。
 * 作法沿用 `TodayHeadline` 已經有的前例：emoji 移除、語意改用 CSS 色點承接。
 *
 * ## 為什麼在渲染層做，不改資料
 * emoji 在 `clients.onboarding_notes_rendered.sections[].title` 裡，是 per-client 的
 * production 資料（5 個學員都有）。渲染層處理＝不動學員資料、可回退，
 * 而且以後新產出的計畫頁自動適用，不用回頭補。
 */

/** 有警示語意的 emoji —— 這些不能只是拿掉，要轉成色點 */
const WARN_EMOJI = /^[⚠️\u{1F6AB}\u{1F534}\u{1F6D1}]+/u

/**
 * 開頭的 emoji / 符號 / 變異選擇符 / 零寬連接符。
 * 只吃**開頭**連續的那一段，句子中間的 emoji 不動（那是內文作者的選擇）。
 */
const LEADING_EMOJI =
  /^(?:[\p{Extended_Pictographic}\p{Emoji_Presentation}\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}️‍\u{1F3FB}-\u{1F3FF}]|\s)+/u

export type PlanTitle = {
  /** 拿掉 emoji 之後的標題 */
  text: string
  /** 'warn' = 原本掛著警示 emoji，要用色點承接；'none' = 一般條目 */
  tone: 'warn' | 'none'
}

export function planTitle(raw: string): PlanTitle {
  const s = (raw ?? '').trim()
  const tone: PlanTitle['tone'] = WARN_EMOJI.test(s) ? 'warn' : 'none'
  const text = s.replace(LEADING_EMOJI, '').trim()
  // 整串都是 emoji 的話留原文，不要回一個空標題
  return { text: text || s, tone }
}
