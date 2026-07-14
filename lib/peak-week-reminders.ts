/**
 * Peak Week 每日提醒
 *
 * 為什麼需要（Helms Ch.7）：
 *   「**你在賽前一晚看起來如何，決定了 80% 的碳水判斷。**」
 *   而視覺評估有紀律要求——固定燈光、時間、評估前吃了幾餐，用影片或並排照片，不能靠記憶或鏡子。
 *   這件事沒人提醒就會忘；忘了，peak week 最重要的那個決策就只能用猜的。
 *
 * 兩種提醒：
 *   · 早上：今天的計畫（吃多少、做什麼）+ 量晨重（peak week 的晨重是判讀依據）
 *   · 晚上：拍照比外觀 → 決定明天的碳水（溢→取低標、飽而硬→中間、扁→取高標）
 */

export interface PeakReminderDay {
  daysOut: number
  label?: string
  phase?: 'depletion' | 'fat_load' | 'carb_load' | 'taper' | 'show_day'
  carbs?: number
  trainingNote?: string
  coachNote?: string
}

export interface PeakReminder {
  title: string
  body: string
}

/** 需要在當晚做視覺判讀的階段——充碳期與 taper（判讀結果直接決定隔天碳水） */
function needsVisualCheck(day: PeakReminderDay): boolean {
  return day.phase === 'carb_load' || day.phase === 'taper'
}

/** 早上：今天要吃什麼、做什麼 */
export function buildPeakMorningReminder(day: PeakReminderDay | null | undefined): PeakReminder | null {
  if (!day) return null

  if (day.daysOut === 0) {
    return {
      title: '🏆 比賽日',
      body: [
        day.carbs != null ? `今天碳水 ${day.carbs}g（看外觀微調）` : null,
        '每 2–3 小時一餐，一半在預賽前吃完。上台 pump 前補鈉。水喝到不渴、不限水。',
      ].filter(Boolean).join(' · '),
    }
  }

  const head = day.label ? `Day ${day.daysOut} — ${day.label}` : `Day ${day.daysOut}`
  const parts = [
    day.carbs != null ? `碳水 ${day.carbs}g` : null,
    day.trainingNote ? `訓練：${day.trainingNote}` : null,
    day.coachNote ?? null,
    '先量晨重（peak week 的晨重是判讀依據，別漏）',
  ].filter(Boolean)

  return { title: `🏆 ${head}`, body: parts.join(' · ') }
}

/**
 * 晚上：視覺判讀 —— peak week 最重要的一刻。
 * Helms：「你賽前一晚看起來如何，決定了 80% 的碳水判斷。」
 */
export function buildPeakEveningReminder(day: PeakReminderDay | null | undefined): PeakReminder | null {
  if (!day || day.daysOut === 0) return null
  if (!needsVisualCheck(day)) {
    // 低碳期還沒到判讀階段，只提醒拍基準照（之後所有比較都靠它）
    if (day.daysOut >= 3) {
      return {
        title: '📸 拍今天的基準照',
        body: '固定燈光、角度、時間、吃了幾餐 — 條件不固定就沒有可比性。之後每天同條件拍，才比得出來。',
      }
    }
    return null
  }

  const isLastNight = day.daysOut === 1
  return {
    title: isLastNight ? '⚠️ 今晚的判讀決定 80% 的賽日碳水' : '📸 今晚比外觀，決定明天碳水',
    body: [
      isLastNight
        ? 'Helms：你賽前一晚看起來如何，決定了 80% 的碳水判斷。'
        : null,
      '拍照（固定燈光/角度）跟基準照並排比：',
      '🔴 溢出、線條被蓋 → 明天取低標',
      '🟢 飽而硬 → 取中間',
      '🟡 扁 → 取高標',
      '⚠️ 灌完當下「軟」常常是暫時的，12–24h 會自己收 — 別急著判定溢出。',
    ].filter(Boolean).join('\n'),
  }
}
