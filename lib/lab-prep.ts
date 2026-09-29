/**
 * 抽血前準備提醒 —— 別讓雜訊毀掉這一次。
 *
 * ## 為什麼有這支（2026-09-30）
 *
 * 長壽透鏡會用 RCV（個人正常波動範圍）判斷「這次的變化是真的還是雜訊」，
 * 預測對答案也靠前後兩次數字比。但如果抽血前一天練腿、沒空腹、下午才抽、換了一家，
 * 數字本身就髒了 —— 判斷再準也救不回來。這是血檢連續性的地基。
 *
 * 只在 `clients.next_checkup_date`（教練排定的抽血日）前 3 天、前 1 天、當天早上各推一則。
 * 刻意不看 `lab_panel_notes.next_review_date`：那是「該回檢了」，不是「約好哪天抽」。
 *
 * 依據（全部是常規檢驗前準備，不是個人判讀）：
 *   - 大重量／新動作後 ALT、AST、CK 會升高數天（Pettersson 2008, Br J Clin Pharmacol, PMID 17764474）
 *   - 睪固酮早上最高，指南要求早晨空腹抽（Bhasin 2018 Endocrine Society, PMID 29562364）
 *   - 生物素干擾免疫分析法（荷爾蒙、甲狀腺）（FDA 2017/2019 安全通報）
 *   - 三酸甘油酯、血糖、胰島素要空腹 8–12 小時；酒精拉高三酸甘油酯與肝指數
 */

import { DAY_MS } from './date-utils'

/** 哪幾天推（距抽血日天數） */
export const LAB_PREP_DAYS = [3, 1, 0] as const

export type LabPrepHypothesis = {
  marker: string
  /** 預測的基準那次抽血日 —— 「同一家」要對準這天，不是最近一次 */
  baseline_date?: string | null
  baseline_value: number | null
  expected_direction: 'up' | 'down' | string | null
  expected_value: number | null
}

export type LabPrepInput = {
  name: string
  /** YYYY-MM-DD，抽血日 */
  checkupDate: string
  /** YYYY-MM-DD，今天（台灣） */
  today: string
  /** 上次抽血日（提醒「同一家」用），沒有就 null */
  lastLabDate?: string | null
  /** 這次要對答案的預測 */
  hypotheses?: LabPrepHypothesis[]
}

export type LabPrepMessage = {
  daysUntil: number
  title: string
  body: string
  lineText: string
}

const WEEKDAY = ['日', '一', '二', '三', '四', '五', '六']

function dayDiff(from: string, to: string): number {
  const a = new Date(`${from}T00:00:00+08:00`).getTime()
  const b = new Date(`${to}T00:00:00+08:00`).getTime()
  if (Number.isNaN(a) || Number.isNaN(b)) return NaN
  return Math.round((b - a) / DAY_MS)
}

function fmtDate(d: string): string {
  const dt = new Date(`${d}T00:00:00+08:00`)
  const wd = WEEKDAY[new Date(dt.getTime() + 8 * 3600_000).getUTCDay()]
  return `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}（${wd}）`
}

function fmtNum(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10)
}

function hypothesisLines(hyps: LabPrepHypothesis[]): string[] {
  return hyps.map(h => {
    const base = h.baseline_value != null ? `上次 ${fmtNum(h.baseline_value)}` : ''
    const sign = h.expected_direction === 'down' ? '≤' : '≥'
    const exp = h.expected_value != null ? `預期 ${sign}${fmtNum(h.expected_value)}` : ''
    const detail = [base, exp].filter(Boolean).join(' → ')
    return `・${h.marker}${detail ? `（${detail}）` : ''}`
  })
}

/** 今天該不該推、推什麼。不在 3/1/0 天 → null */
export function buildLabPrepMessage(input: LabPrepInput): LabPrepMessage | null {
  const d = dayDiff(input.today, input.checkupDate)
  if (!(LAB_PREP_DAYS as readonly number[]).includes(d)) return null

  const when = fmtDate(input.checkupDate)
  const hyps = input.hypotheses ?? []
  // 有預測時，「同一家」要對準預測的基準那次（陳胤豪：基準 3/20，最近一次卻是 6/26）
  const anchor: string | null = hyps.map(h => h.baseline_date).filter((x): x is string => !!x).sort()[0] ?? input.lastLabDate ?? null
  const sameLab = anchor
    ? `・跟 ${fmtDate(anchor)} 那次同一家——換一家，有些項目就不能比`
    : '・以後每次都在同一家抽，數字才能前後比'
  const answer = hyps.length
    ? ['', '這次要對答案：', ...hypothesisLines(hyps)]
    : []

  if (d === 3) {
    return {
      daysUntil: 3,
      title: `🩸 ${when} 抽血，這 3 天這樣準備`,
      body: '別做大重量／新動作、停酒、生物素先停——不然數字會失真',
      lineText: [
        `🩸 ${input.name}，${when} 抽血，這 3 天這樣準備：`,
        '',
        '・別做大重量、沒練過的新動作、長時間有氧——肌肉被操完，肝指數（ALT／AST）和 CK 會高好幾天，報告會像肝有狀況',
        '・停酒（會拉高三酸甘油酯和肝指數）',
        '・有吃生物素（或高劑量 B 群、護髮保健品）的先停——它會干擾荷爾蒙、甲狀腺的檢驗，數字會失真',
        '・吃跟睡照平常，別突然節食或狂吃',
        ...answer,
      ].join('\n'),
    }
  }

  if (d === 1) {
    return {
      daysUntil: 1,
      title: '🩸 明天早上抽血',
      body: '今晚 10 點後只喝水；明早 7–10 點抽；同一家',
      lineText: [
        `🩸 ${input.name}，明天 ${when} 早上抽血：`,
        '',
        '・今晚 10 點後只喝水（空腹 8–12 小時，血糖、胰島素、三酸甘油酯才準）',
        '・今天別練下半身或大重量',
        '・明天早上 7–10 點抽——荷爾蒙早上最高，每次同一個時段才能比',
        sameLab,
        ...answer,
      ].join('\n'),
    }
  }

  return {
    daysUntil: 0,
    title: '🩸 今天抽血',
    body: '只喝水、先抽再練；報告出來在「健康」上傳',
    lineText: [
      `🩸 ${input.name}，今天抽血：`,
      '',
      '・只喝水——咖啡、補品、早餐都等抽完',
      '・先抽再練',
      sameLab,
      '・報告出來，在 App「健康」分頁上傳照片，系統會讀數字、跟上次比',
      ...answer,
    ].join('\n'),
  }
}

/** 預測的回測日落在抽血日前後幾天內，才算「這次要對答案」 */
export const HYPOTHESIS_MATCH_DAYS = 14

export function hypothesesForCheckup<T extends LabPrepHypothesis & { retest_by: string | null; notified_status?: string | null }>(
  hyps: T[],
  checkupDate: string,
): T[] {
  return hyps.filter(h => {
    if (h.notified_status) return false
    if (!h.retest_by) return false
    return Math.abs(dayDiff(h.retest_by, checkupDate)) <= HYPOTHESIS_MATCH_DAYS
  })
}
