/**
 * 抽完血自動起草「教練補充」（clients.coach_summary）＋健康目標（clients.health_goals）。
 *
 * 為什麼：手寫的教練重點會過期、沒人發現（2026-10-08 Howard 的報告還掛著 6/26 的版本，
 * 寫著「9 月初複驗」但 9/30 已經抽完）。而 lib/lab-consult.ts 每次抽血都能確定性算出
 * 真變化／要留意／下次驗什麼 —— 這裡把它排成教練口吻的草稿，丟進 pending_proposals，
 * 晨報列出來，教練回「套用 名字」才寫入。系統不直接改學員資料。
 *
 * 草稿第一行固定「更新至 YYYY/MM/DD」＝抽血日：健康報告靠這個判斷教練補充有沒有過期，
 * 這裡也靠它判斷要不要再起草（見 needsDraft）。
 */
import type { LabConsult } from './lab-consult'

export const COACH_SUMMARY_DRAFT_TYPE = 'coach_summary_draft'

const slash = (d: string) => d.replace(/-/g, '/')
const sign = (n: number) => (n > 0 ? `+${n}` : String(n))
const STACK_LABEL: Record<string, string> = { caution: '要注意', 'no-indication': '沒有血檢依據' }

/** 從教練補充文字讀出「更新至 YYYY/MM/DD」；沒有就回 null */
export function writtenDate(summary: string | null | undefined): string | null {
  const m = (summary ?? '').match(/更新至\s*(\d{4})[/-](\d{1,2})[/-](\d{1,2})/)
  return m ? `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}` : null
}

/** 教練補充還沒寫到這次抽血 → 要起草 */
export function needsDraft(summary: string | null | undefined, drawDate: string): boolean {
  const w = writtenDate(summary)
  return w == null || w < drawDate
}

export function buildCoachSummaryDraft(c: LabConsult): { summary: string; healthGoals: string } {
  const items: string[] = []
  if (c.better.length) {
    items.push(`真的變好：${c.better.map(x => `${x.name} ${x.from}→${x.to}（${sign(x.pct)}%）`).join('、')}`)
  }
  for (const x of c.worse) {
    items.push(`${x.name} ${x.from}→${x.to}（${sign(x.pct)}%）${x.outOfRange ? '，落在要留意的範圍' : ''}${x.hint ? `：${x.hint}` : ''}${x.medNote ? `；${x.medNote}` : ''}`)
  }
  for (const w of c.watch.filter(w => !c.worse.some(x => x.name === w.name))) {
    items.push(`${w.name} ${w.value}${w.unit ? ` ${w.unit}` : ''}${w.idealText ? `（理想 ${w.idealText}）` : ''}：${w.note}`)
  }
  for (const a of c.answered) items.push(`預測對答案｜${a.marker}：預測${a.expected}，${a.baseline}→${a.result}，${a.verdict}`)
  for (const s of c.stack.filter(s => s.status === 'caution' || s.status === 'no-indication')) {
    items.push(`補品｜${s.name}（${STACK_LABEL[s.status]}）：${s.basis}`)
  }
  if (items.length === 0) items.push('這次沒有超過正常波動的變化，也沒有要留意的項目')

  // 同一句說明（例：A 酸的提醒）會掛在好幾個項目上 → 草稿裡只講第一次；系統自述的句子不進教練口吻
  const seen = new Set<string>()
  const tidy = items.map(t => {
    const [head, ...rest] = t.split('：')
    if (!rest.length) return t
    const clauses = rest.join('：').split('；').filter(cl => {
      const k = cl.trim()
      if (!k || k.startsWith('系統沒有這項') || seen.has(k)) return false
      seen.add(k)
      return true
    })
    return clauses.length ? `${head}：${clauses.join('；')}` : head
  })

  const nextLabels = c.next.items.map(i => i.label.replace(/（.*?）/g, ''))
  const lines = [
    `🏆 血檢追蹤（更新至 ${slash(c.drawDate)}）：`,
    '',
    ...tidy.map((t, i) => `${i + 1}) ${t}`),
    '',
    `📅 下次抽血 ${slash(c.next.date)}${nextLabels.length ? `：${nextLabels.join('、')}` : ''}`,
  ]
  const healthGoals = `${slash(c.next.date)} 回檢${nextLabels.length ? `：驗 ${nextLabels.join('、')}` : ''}`
  return { summary: lines.join('\n'), healthGoals }
}

