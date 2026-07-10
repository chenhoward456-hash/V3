/**
 * 流失出手 — 關心訊息草稿引擎
 *
 * 行動佇列的流失預警（減脂斷記錄／加入未啟動／未活動）→ 一鍵生成帶學員數據、
 * Howard 口吻的召回草稿。教練過目可改，發送走既有 /api/admin/weekly-coaching/send
 * （合規守門 + coach_messages 落庫 + Web Push 優先），或複製後用個人 LINE 貼（不吃 OA 額度）。
 *
 * 口吻三原則（改模板前先想清楚再動）：
 *   1. 點名事實不繞彎——第幾週、斷幾天、上次量多少，數據講話。
 *   2. 只給一個動作——「現在量個體重打上來」，門檻壓到 10 秒。
 *   3. 開一扇門不審問——卡住/想調整就回一句，別讓學員覺得回來=認錯。
 *
 * 純函式、可測。不得出現診斷/處方/疾病名（send route 有 scanMedicalCompliance 守門，
 * 但草稿本身就該乾淨——測試有掛合規契約）。
 */

export type WinbackSituation = 'cut_silent' | 'never_started' | 'idle'

export type WinbackContext = {
  name: string
  situation: WinbackSituation
  /** 斷了幾天沒記錄；never_started 時 = 加入天數 */
  daysSilent: number
  /** 減脂第幾週（cut_silent 用） */
  weeksIntoCut?: number
  /** 斷聯前最後一次體重 */
  lastWeight?: number | null
  /** 斷聯前的體重週速率（kg/週，負 = 下降；資料不足給 null） */
  trendPerWeek?: number | null
}

function fmtKg(w: number): string {
  return (Math.round(w * 10) / 10).toString()
}

export function buildWinbackMessage(ctx: WinbackContext): string {
  const { name, daysSilent } = ctx
  const lines: string[] = []

  if (ctx.situation === 'never_started') {
    lines.push(`${name}，你加入 ${daysSilent} 天了，還沒記過第一筆。`)
    lines.push('第一筆最簡單：現在站上體重計，把數字打給我就好，10 秒。')
    lines.push('有數據我才幫得上你，沒數據方案就是空轉。從今天這一筆開始。')
    return lines.join('\n')
  }

  if (ctx.situation === 'cut_silent') {
    const weeks = Math.max(1, ctx.weeksIntoCut ?? 1)
    lines.push(`${name}，減脂第 ${weeks} 週，你斷了 ${daysSilent} 天沒記錄。`)
    const w = ctx.lastWeight ?? null
    const trend = ctx.trendPerWeek ?? null
    if (w != null && trend != null && trend <= -0.2) {
      lines.push(`最可惜的是你斷在正在掉的時候——上次量 ${fmtKg(w)}kg、每週掉 ${fmtKg(Math.abs(trend))}kg，這個節奏很難得。`)
    } else if (w != null) {
      lines.push(`你上次量是 ${fmtKg(w)}kg，之後我就看不到你了。`)
    } else {
      lines.push(`這 ${daysSilent} 天我完全看不到你的狀況。`)
    }
    lines.push('不用補記這幾天、不用交代什麼。現在量一個體重打上來就好，10 秒。')
    lines.push('如果是卡住了或想換方式，直接回我一句，我來調——別消失。')
    return lines.join('\n')
  }

  // idle：一般未活動
  lines.push(`${name}，${daysSilent} 天沒看到你的記錄了。`)
  if (ctx.lastWeight != null) {
    lines.push(`上次量 ${fmtKg(ctx.lastWeight)}kg 之後就斷了。`)
  }
  lines.push('今天先記一筆體重就好，10 秒的事。')
  lines.push('最近太忙還是想調整方式，跟我說一聲，我來改——別悶著消失。')
  return lines.join('\n')
}
