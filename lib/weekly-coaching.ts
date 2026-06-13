/**
 * 每週教練監督 — 草擬引擎（撐月費的核心，見 docs/WEEKLY_COACHING_LOOP.md）
 *
 * 把 Howard 的教練判斷編碼：吃一位學員近期數據 → 草擬「本週該調什麼 + 為什麼 + 給學員的話」。
 * 核心規則：先偵測資料量自動切兩模式——
 *   adjust（資料夠）：數據驅動的教練調整（陳胤豪案例）
 *   accountability（資料不足/斷記錄）：不假裝，翻成召回 + 標記教練介入（謝佳峻案例）
 *
 * 純函式、可測。Howard 在核准佇列改的東西 = 未來要回頭修這裡的判斷。
 */

export type WeeklyCoachingClient = {
  name: string
  goal_type?: string | null
  prep_phase?: string | null
  competition_date?: string | null
  competition_enabled?: boolean | null
  target_weight?: number | string | null
  calories_target?: number | string | null
  protein_target?: number | string | null
}

export type WCInput = {
  client: WeeklyCoachingClient
  weights: { date: string; weight: number | string | null }[]
  nutrition: { date: string; compliant?: boolean | null; calories?: number | string | null; protein_grams?: number | string | null }[]
  training: { date: string; training_type: string | null }[]
  wellness: { date: string; energy_level?: number | null }[]
  labs: { test_name: string; value: number | string | null; status?: string | null; date?: string | null }[]
  now: string // YYYY-MM-DD（台灣日）
}

export type WeeklyCoachingDraft = {
  mode: 'adjust' | 'accountability'
  dataDays: number
  headline: string
  bullets: string[]        // 「本週數據怎麼說」
  adjustments: string[]    // 建議調整
  studentMessage: string   // 要發給學員的人話訊息
  needsCoachReview: boolean
  flags: string[]          // 給教練的旗標（新血檢/快流失…）
}

function num(v: number | string | null | undefined): number | null {
  if (v == null) return null
  const n = typeof v === 'number' ? v : parseFloat(v)
  return Number.isFinite(n) ? n : null
}
function daysAgo(now: string, d: string): number {
  return Math.round((Date.parse(now) - Date.parse(d)) / 86_400_000)
}
function avg(xs: number[]): number | null {
  const v = xs.filter(x => Number.isFinite(x))
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null
}

export function computeWeeklyCoachingDraft(input: WCInput): WeeklyCoachingDraft {
  const { client, now } = input
  const name = client.name
  const recent = <T extends { date: string }>(arr: T[], days: number) => (arr || []).filter(x => x.date && daysAgo(now, x.date) <= days && daysAgo(now, x.date) >= 0)

  const w14 = recent(input.weights, 14)
  const n14 = recent(input.nutrition, 14)
  const t14 = recent(input.training, 14)
  // 近 14 天有記錄的「不同日子」數（任一類型）
  const loggedDays = new Set<string>([...w14, ...n14, ...t14, ...recent(input.wellness, 14)].map(x => x.date))
  const dataDays = loggedDays.size
  const lastWeight = [...input.weights].filter(x => num(x.weight) != null).sort((a, b) => b.date.localeCompare(a.date))[0]
  const daysSinceWeight = lastWeight ? daysAgo(now, lastWeight.date) : 999

  const flags: string[] = []
  // 新血檢（近 14 天）→ 一律標記教練看
  const newLab = (input.labs || []).find(l => l.date && daysAgo(now, l.date) <= 14 && daysAgo(now, l.date) >= 0)
  if (newLab) flags.push('近期有新血檢，需教練判讀定方向')

  // ── 模式判定：資料不足 / 斷記錄 → 問責模式 ──
  if (dataDays < 4 || daysSinceWeight > 6) {
    flags.unshift('資料不足/斷記錄 → 需教練親自介入，勿自動發')
    const gapMsg = daysSinceWeight > 6 && lastWeight ? `你已經 ${daysSinceWeight} 天沒記體重了。` : '你最近幾乎沒記錄。'
    return {
      mode: 'accountability',
      dataDays,
      headline: `資料不足（近 14 天僅 ${dataDays} 天有記錄）→ 問責召回`,
      bullets: [
        `近 14 天只有 ${dataDays} 天有任何記錄${lastWeight ? `，最後一次量體重在 ${daysSinceWeight} 天前` : ''}。`,
        '資料不夠，做數據調整會是猜的 → 不假裝、不亂調。',
        newLab ? '有新血檢可作為硬數據參考。' : '沒有近期硬數據可依。',
      ],
      adjustments: ['先不調整 macro/訓練（資料不足）', '目標：把學員拉回來記錄第一筆'],
      studentMessage: `${name}，${gapMsg}\n沒有你的數據，我看不到你、也沒辦法幫你調整。\n今天先花 10 秒記一筆體重，我才接得上。卡住的話直接回我。`,
      needsCoachReview: true,
      flags,
    }
  }

  // ── 調整模式（資料夠）──
  const bullets: string[] = []
  const adjustments: string[] = []
  const msgLines: string[] = []

  // 1) 體重趨勢（用近 14 天線性兩端估週速率）
  const ws = w14.map(x => ({ d: x.date, v: num(x.weight)! })).filter(x => x.v != null).sort((a, b) => a.d.localeCompare(b.d))
  let weightNote = ''
  if (ws.length >= 3) {
    const first = ws[0], last = ws[ws.length - 1]
    const span = Math.max(1, daysAgo(last.d, first.d) || (daysAgo(now, first.d)))
    const perWeek = ((last.v - first.v) / span) * 7
    const dir = perWeek < -0.1 ? '下降' : perWeek > 0.1 ? '上升' : '持平'
    weightNote = `體重 ${first.v}→${last.v}（約 ${perWeek >= 0 ? '+' : ''}${perWeek.toFixed(1)}kg/週，${dir}）`
    bullets.push(`⚖️ ${weightNote}`)

    // 備賽/減脂：對照目標速率
    const tw = num(client.target_weight)
    const isCut = client.goal_type === 'cut' || client.prep_phase === 'cut'
    if (isCut && tw != null && client.competition_date) {
      // daysAgo(comp, now) = comp - now = 距賽天數（賽在未來為正）
      const weeksLeft = Math.max(0.5, daysAgo(client.competition_date, now) / 7)
      const need = (last.v - tw) / weeksLeft // kg/week needed
      if (need > 0) {
        if (perWeek > -0.1) { adjustments.push('體重沒在掉、但賽期逼近 → 製造赤字（降熱量或加有氧）'); bullets.push(`🎯 距賽 ~${weeksLeft.toFixed(0)} 週、要 -${need.toFixed(1)}kg/週才到 ${tw}kg，目前沒掉 → 落後`) }
        else if (perWeek <= -need * 1.4) { adjustments.push('掉太快、有掉肌風險 → 略收赤字'); bullets.push(`🎯 掉得比需要的 ${need.toFixed(1)}kg/週 還快 → 太猛`) }
        else { bullets.push(`🎯 距賽 ~${weeksLeft.toFixed(0)} 週、需 -${need.toFixed(1)}kg/週 → 進度上，別加速`) }
      }
    }
  } else {
    bullets.push('⚖️ 體重資料偏少，趨勢先觀察')
  }

  // 2) 蛋白攝取 vs 目標
  const pTarget = num(client.protein_target)
  const pAvg = avg(n14.map(x => num(x.protein_grams)!).filter(v => v != null))
  if (pTarget && pAvg != null) {
    if (pAvg < pTarget * 0.9) {
      adjustments.push(`蛋白吃滿到 ${pTarget}g（近期平均才 ${Math.round(pAvg)}g）`)
      bullets.push(`🍗 蛋白平均 ${Math.round(pAvg)}g／目標 ${pTarget}g → 偏低，${client.prep_phase === 'cut' ? '備賽掉肌風險' : '不利維持肌肉'}`)
    } else {
      bullets.push(`🍗 蛋白 ${Math.round(pAvg)}g／目標 ${pTarget}g → 達標`)
    }
  }

  // 3) 熱量現實對帳：吃超過設定還在掉 → 別砍
  const cTarget = num(client.calories_target)
  const cAvg = avg(n14.map(x => num(x.calories)!).filter(v => v != null))
  if (cTarget && cAvg != null && ws.length >= 3) {
    const perWeek = ((ws[ws.length - 1].v - ws[0].v) / Math.max(1, daysAgo(ws[ws.length - 1].d, ws[0].d))) * 7
    if (cAvg > cTarget * 1.05 && perWeek < -0.1) {
      adjustments.push('熱量不動（他吃超過設定還在掉，代表 TDEE 比設定高、砍它沒道理）')
      bullets.push(`🔥 實際吃 ~${Math.round(cAvg)} kcal（設定 ${cTarget}）卻仍在掉 → 別降熱量`)
    } else if (cAvg < cTarget * 0.95 && perWeek > -0.05) {
      adjustments.push('吃不到設定又沒掉 → 先確認執行，再考慮微調')
    }
  }

  // 4) 訓練頻率 / 休息
  const trained = t14.filter(x => x.training_type && x.training_type !== 'rest')
  const rests = t14.filter(x => x.training_type === 'rest')
  if (t14.length >= 4) {
    bullets.push(`🏋️ 近 14 天訓練 ${trained.length} 天、休息 ${rests.length} 天`)
    if (trained.length >= 10 && rests.length <= 1) adjustments.push('排 1 個固定休息日（高頻深切恢復遲早撞牆）')
  }

  // 5) 恢復
  const eAvg = avg(recent(input.wellness, 7).map(x => x.energy_level ?? NaN))
  if (eAvg != null) {
    if (eAvg <= 2.5) { adjustments.push('恢復偏差 → 本週降量/多睡'); bullets.push(`😴 近 7 天精力均 ${eAvg.toFixed(1)}/5 → 偏低`) }
    else bullets.push(`😴 恢復均 ${eAvg.toFixed(1)}/5 → 還行`)
  }

  if (adjustments.length === 0) adjustments.push('維持現況，按表執行（數據都在合理區）')

  // 組學員訊息
  msgLines.push(`${name}，這週我看了你的數據：`)
  msgLines.push(bullets.map(b => `・${b.replace(/^[^\s]+\s/, '')}`).slice(0, 3).join('\n'))
  msgLines.push('')
  msgLines.push(`本週調整：${adjustments.slice(0, 3).join('；')}。`)

  return {
    mode: 'adjust',
    dataDays,
    headline: weightNote || `${dataDays} 天記錄，數據驅動調整`,
    bullets,
    adjustments,
    studentMessage: msgLines.join('\n'),
    needsCoachReview: !!newLab,
    flags,
  }
}
