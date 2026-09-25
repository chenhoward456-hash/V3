/**
 * LINE「血檢」指令的回覆文字：學員自己打「血檢」就看得到
 *   1. 哪些真的變好／變差（超過正常波動才算，沒超過的一句帶過 —— Howard：「每個指標都說在變，看了很躁」）
 *   2. 教練的預測對答案
 *   3. 下次抽血驗什麼、大約多少錢、哪些不用花錢
 * 走 reply（不吃推播額度）。純函式，資料由 webhook 用 loadLongevity / loadStudentLabOrder 組好丟進來。
 * 合規：只放指標名、數字、引擎產的理由；教練手寫的 cause/action 不放（那是網頁版過完降級器才顯示的）。
 */
import type { MarkerStory, HypothesisGrade, LabHypothesis } from '@/lib/longevity-lens'
import type { StudentLabOrder } from '@/lib/lab-order-data'

export interface LabSummaryInput {
  stories: MarkerStory[]
  hypotheses: (LabHypothesis & { grade: HypothesisGrade })[]
  order: StudentLabOrder | null
  dashboardUrl: string
  today: string
}

const MAX_LINES = 6
const fmt = (v: number) => (Math.abs(v) >= 100 ? Math.round(v).toString() : (Math.round(v * 10) / 10).toString())
const md = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`

function changeLine(s: MarkerStory): string {
  const c = s.change!
  const unit = s.latest?.unit ? ` ${s.latest.unit}` : ''
  const pct = `${c.pctChange > 0 ? '+' : ''}${Math.round(c.pctChange)}%`
  return `・${s.name} ${fmt(c.from.value)} → ${fmt(c.to.value)}${unit}（${pct}，正常波動約 ±${Math.round(c.rcvPct)}%）`
}

const MAX_NAMES = 8
function names(list: MarkerStory[]): string {
  const n = list.map(s => s.name)
  return n.length <= MAX_NAMES ? n.join('、') : `${n.slice(0, MAX_NAMES).join('、')} 等 ${n.length} 項`
}

function capped(lines: string[]): string[] {
  if (lines.length <= MAX_LINES) return lines
  return [...lines.slice(0, MAX_LINES), `・…還有 ${lines.length - MAX_LINES} 項，看儀表板`]
}

const HYP_STATUS: Record<HypothesisGrade['status'], string> = {
  pending: '⏳ 等結果',
  overdue: '⏰ 該驗了還沒驗',
  confirmed: '✅ 中了',
  partial: '🟡 方向對，還沒到目標',
  no_change: '➖ 在正常波動內，沒真的動',
  refuted: '❌ 往反方向走',
}

function hypothesisLine(h: LabSummaryInput['hypotheses'][number]): string {
  const target = h.expected_direction === 'stable'
    ? '維持不變'
    : h.expected_value != null
      ? `${h.expected_direction === 'up' ? '≥' : '≤'} ${fmt(Number(h.expected_value))}`
      : h.expected_direction === 'up' ? '往上' : '往下'
  const g = h.grade
  const result = g.result ? `，這次 ${fmt(g.result.value)}` : h.retest_by && g.status === 'pending' ? `（預計 ${md(h.retest_by)} 前驗）` : ''
  return `・${h.marker} 預測 ${target}${result} → ${HYP_STATUS[g.status]}`
}

export function formatLabSummary(input: LabSummaryInput): string {
  const { stories, hypotheses, order, dashboardUrl, today } = input
  const withData = stories.filter(s => s.latest)

  if (withData.length === 0 && hypotheses.length === 0 && (!order || !order.enabled)) {
    return '你目前還沒有血檢紀錄，也還沒開血檢追蹤。\n\n想開始追的話，直接在這裡跟 Howard 說一聲 🙏'
  }

  const parts: string[] = []

  if (withData.length > 0) {
    const lastDate = withData.map(s => s.latest!.date).sort().at(-1)!
    parts.push(`🩸 你的血檢進退（最近一次抽血 ${md(lastDate)}）`)

    const better = withData.filter(s => s.direction === 'better')
    const worse = withData.filter(s => s.direction === 'worse')
    const steady = withData.filter(s => s.change?.verdict === 'noise')
    const neutral = withData.filter(s => s.change && s.change.verdict !== 'noise' && s.direction == null)
    const single = withData.filter(s => !s.change)

    if (better.length === 0 && worse.length === 0) {
      parts.push('這次沒有超過正常波動的變化 —— 數字在跳，但都還在同一個人每次抽都會有的誤差內。')
    }
    if (better.length) parts.push(['✅ 真的變好', ...capped(better.map(changeLine))].join('\n'))
    if (worse.length) parts.push(['⚠️ 真的變差', ...capped(worse.map(changeLine))].join('\n'))
    if (steady.length) parts.push(`➖ 沒真的變（在正常波動內）：${names(steady)}`)
    if (neutral.length) parts.push(`👌 有變，但前後都在很好的範圍，不用管：${names(neutral)}`)
    if (single.length) parts.push(`📍 只驗過一次、還看不出趨勢：${names(single)}`)
  }

  // 預測：還在等的全列；有結果的只列半年內出爐的，舊帳不翻
  const cutoff = new Date(`${today}T00:00:00Z`)
  cutoff.setUTCDate(cutoff.getUTCDate() - 180)
  const cutoffStr = cutoff.toISOString().slice(0, 10)
  const hyps = hypotheses.filter(h => !h.grade.result || h.grade.result.date >= cutoffStr)
  if (hyps.length) parts.push(['🎯 教練的預測', ...capped(hyps.map(hypothesisLine))].join('\n'))

  if (order?.enabled) {
    const lines: string[] = []
    const when = !order.nextCheckupDate ? ''
      : order.nextCheckupDate < today ? `（原訂 ${md(order.nextCheckupDate)}，已經過了，該約了）`
      : `（預計 ${md(order.nextCheckupDate)}）`
    if (order.must.length === 0) {
      lines.push(`🧪 下次抽血${when}：目前沒有非驗不可的`)
    } else {
      lines.push(`🧪 下次抽血${when}驗這些${order.mustCost > 0 ? `，約 $${order.mustCost.toLocaleString('en-US')}` : ''}`)
      lines.push(...capped(order.must.map(l => `・${l.label}${l.price != null ? ` $${l.price}` : ''}`)))
    }
    if (order.skip.length) lines.push(`💰 ${order.skip.length} 項上次已經很好或不用重驗，這次省下來`)
    parts.push(lines.join('\n'))
  }

  parts.push(`每一項為什麼變、下一步怎麼做 👉 ${dashboardUrl}?openExternalBrowser=1`)
  return parts.join('\n\n')
}
