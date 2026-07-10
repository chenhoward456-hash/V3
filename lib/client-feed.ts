/**
 * 「為你更新」卡片流 (For-You Feed)
 *
 * 把儀表板從「給看」變「主動講」：純函式，吃學員既有資料，
 * 產出報喜報憂、有人味的更新卡片。三個觸發來源：
 *   1. 血檢趨勢（analyzeLabs）— 進步報喜、偏離報憂
 *   2. 回檢提醒（next_checkup_date）
 *   3. macro 自動調整說明（macro_adjustment_log 最新一筆 system 調整）
 *
 * 不依賴 DB、不依賴 push 配額；component 只負責渲染。
 */

import { analyzeLabs, type LabResultRow } from './lab-trend-analyzer'

export type FeedTone = 'good' | 'warn' | 'alert' | 'info'

export interface FeedCard {
  /** 事件穩定 id：資料變了會產生新 id，舊的關掉不影響新卡 */
  id: string
  tone: FeedTone
  icon: string
  title: string
  body: string
  cta?: { label: string; href: string }
}

export interface MacroAdjustmentRow {
  applied_at: string
  applied_by: string | null
  trigger_source: string | null
  old_macros: Record<string, unknown> | null
  new_macros: Record<string, unknown> | null
  reason: string | null
}

export interface CoachMessageRow {
  id: string
  title: string | null
  body: string
  mode: string | null
  created_at: string
}

export interface ClientFeedInput {
  labs: LabResultRow[]
  gender?: '男性' | '女性'
  nextCheckupDate?: string | null
  macroAdjustment?: MacroAdjustmentRow | null
  /** 最近一則教練週度訊息（點推播進來要看得到完整內容） */
  coachMessage?: CoachMessageRow | null
  /** 學員 unique_code：有的話「新血檢入庫」卡帶「看完整報告」連結 */
  clientCode?: string
  /** 覆寫「今天」，方便測試；預設為現在 */
  today?: string
}

function daysBetween(fromISO: string, toISO: string): number {
  const a = new Date(fromISO + 'T00:00:00').getTime()
  const b = new Date(toISO + 'T00:00:00').getTime()
  return Math.round((b - a) / (1000 * 60 * 60 * 24))
}

function num(v: unknown): number | null {
  const n = typeof v === 'string' ? parseFloat(v) : typeof v === 'number' ? v : NaN
  return Number.isFinite(n) ? n : null
}

function pickCalories(m: Record<string, unknown> | null): number | null {
  if (!m) return null
  return num(m.calories) ?? num(m.calories_target) ?? num(m.kcal)
}
function pickCarbs(m: Record<string, unknown> | null): number | null {
  if (!m) return null
  return num(m.carbs) ?? num(m.carbs_target)
}

/**
 * 產出「為你更新」卡片，已排序（最該講的在前）並上限 4 張。
 */
export function buildClientFeed(input: ClientFeedInput): FeedCard[] {
  const today = input.today || new Date().toISOString().slice(0, 10)
  const cards: FeedCard[] = []

  // ── 1. 血檢趨勢 ───────────────────────────────
  const findings = analyzeLabs(input.labs || [], { gender: input.gender })

  const wins = findings.filter(f => f.severity === 'improving' && f.previousValue != null)
  const criticals = findings.filter(f => f.severity === 'critical')
  const attentions = findings.filter(f => f.severity === 'attention')

  // 報憂：alert 等級（最多 2）
  for (const f of criticals.slice(0, 2)) {
    cards.push({
      id: `lab_alert_${f.testName}_${f.latestDate}_${f.latestValue}`,
      tone: 'alert',
      icon: '🩸',
      title: `${f.testName} 要盯一下`,
      body: `目前 ${f.latestValue}${f.unit ? ' ' + f.unit : ''}${f.optimalText ? `，最佳 ${f.optimalText}` : ''} · 持續追蹤`,
    })
  }

  // 報喜：顯著進步（最多 2）
  for (const f of wins.slice(0, 2)) {
    const dir = f.previousValue != null && f.latestValue < f.previousValue ? '降到' : '升到'
    const pct = f.changePercent != null ? Math.abs(Math.round(f.changePercent)) : null
    cards.push({
      id: `lab_win_${f.testName}_${f.latestDate}_${f.latestValue}`,
      tone: 'good',
      icon: '🎉',
      title: `${f.testName} 進步了！`,
      body: `${f.previousValue} ${dir} ${f.latestValue}${f.unit ? ' ' + f.unit : ''}${pct != null ? `（+${pct}%）` : ''} 👏`,
    })
  }

  // 報憂：attention 等級（最多 1，避免洗版）
  for (const f of attentions.slice(0, 1)) {
    cards.push({
      id: `lab_warn_${f.testName}_${f.latestDate}_${f.latestValue}`,
      tone: 'warn',
      icon: '🩸',
      title: `${f.testName} 稍微偏離`,
      body: `目前 ${f.latestValue}${f.unit ? ' ' + f.unit : ''}${f.optimalText ? `，最佳 ${f.optimalText}` : ''} · 留意即可`,
    })
  }

  const latestLabDate = input.labs.reduce<string | null>(
    (acc, r) => (acc == null || r.date > acc ? r.date : acc), null)

  // ── 1.5 新血檢入庫回聲 ─────────────────────────
  // 全綠的新批次原本一聲不吭（只有紅字/進步/偏離會跳卡）→ 學員抽了血、系統看過了，
  // 卻沒有任何回應。原則：每筆輸入都要有回聲。14 天內的最新批次若沒被其他血檢卡提過，補一張。
  if (latestLabDate) {
    const sinceLab = daysBetween(latestLabDate, today)
    const batchCount = input.labs.filter(r => r.date === latestLabDate).length
    const batchMentioned = cards.some(c => c.id.startsWith('lab_') && c.id.includes(latestLabDate))
    if (sinceLab >= 0 && sinceLab <= 14 && batchCount > 0 && !batchMentioned) {
      cards.push({
        id: `lab_new_${latestLabDate}_${batchCount}`,
        tone: 'good',
        icon: '🩸',
        title: '新血檢已入庫',
        body: `${latestLabDate} 的 ${batchCount} 項結果都看過了，沒有需要警示的項目`,
        ...(input.clientCode ? { cta: { label: '看完整報告', href: `/c/${input.clientCode}/report` } } : {}),
      })
    }
  }

  // ── 2. 回檢提醒 ───────────────────────────────
  // 回檢日之後已有新血檢進來＝這次回檢已完成，別再喊「過期快去抽血」
  // （教練後台逾期警示照跑，提醒教練設下一次日期；學員端不重複嘮叨）
  const checkupFulfilled = !!(input.nextCheckupDate && latestLabDate && latestLabDate >= input.nextCheckupDate)
  if (input.nextCheckupDate && !checkupFulfilled) {
    const d = daysBetween(today, input.nextCheckupDate)
    if (d < 0) {
      cards.push({
        id: `checkup_${input.nextCheckupDate}`,
        tone: 'warn',
        icon: '📅',
        title: '回檢日過囉',
        body: `回檢日（${input.nextCheckupDate}）已過 ${-d} 天 · 安排抽血看最新變化`,
      })
    } else if (d <= 21) {
      cards.push({
        id: `checkup_${input.nextCheckupDate}`,
        tone: 'info',
        icon: '📅',
        title: d === 0 ? '今天是回檢日' : '回檢日快到了',
        body: d === 0
          ? `今天（${input.nextCheckupDate}）是回檢日，記得抽血`
          : `${input.nextCheckupDate} · 還有 ${d} 天`,
      })
    }
  }

  // ── 3. macro 自動調整說明 ─────────────────────
  const adj = input.macroAdjustment
  if (adj && (adj.applied_by === 'system' || adj.trigger_source === 'trajectory' || adj.trigger_source === 'tdee_weekly')) {
    const appliedDate = adj.applied_at.slice(0, 10)
    const within = daysBetween(appliedDate, today)
    if (within >= 0 && within <= 7) {
      const oldCal = pickCalories(adj.old_macros)
      const newCal = pickCalories(adj.new_macros)
      const oldC = pickCarbs(adj.old_macros)
      const newC = pickCarbs(adj.new_macros)
      const parts: string[] = []
      if (oldCal != null && newCal != null && oldCal !== newCal) parts.push(`熱量 ${oldCal}→${newCal} kcal`)
      if (oldC != null && newC != null && oldC !== newC) parts.push(`碳水 ${oldC}→${newC} g`)
      const changeStr = parts.length ? parts.join('、') : '營養目標'
      const reasonStr = adj.reason ? `原因：${adj.reason}` : '系統依你的進度自動微調。'
      cards.push({
        id: `macro_${adj.applied_at}`,
        tone: 'info',
        icon: '🎯',
        title: '你的目標自動調整了',
        body: `${changeStr} · ${reasonStr}`,
      })
    }
  }

  // ── 排序：按「要不要行動」而非「色調嚴重度」——管家先講該做的事、監看/報喜沉下去 ──
  // 回檢過期/今天(去抽血) → 目標調整了(要知道) → 回檢快到/偏離(多留意) → 要盯一下(純監看) → 進步了(報喜無動作)
  // 只動排序，不改任何血檢閾值/判讀/文字。上限 4。
  const priority = (c: FeedCard): number => {
    if (c.id.startsWith('checkup_')) return c.tone === 'warn' ? 0 : 2 // 過期/今天=0；快到=2
    if (c.id.startsWith('macro_')) return 1
    if (c.id.startsWith('lab_warn_')) return 2
    if (c.id.startsWith('lab_alert_')) return 3 // 「要盯一下·持續追蹤」＝純監看，讓給有動作的
    if (c.id.startsWith('lab_new_')) return 3   // 入庫回聲＝告知＋看報告，排在行動項後面
    if (c.id.startsWith('lab_win_')) return 4
    return 3
  }
  cards.sort((a, b) => priority(a) - priority(b))
  return cards.slice(0, 4)
}
