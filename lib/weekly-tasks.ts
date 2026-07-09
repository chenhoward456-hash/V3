/**
 * 當週任務 (Weekly Tasks) v1 — 規則型引擎輸出，不是 LLM 自由生成。
 *
 * 吃「已聚合的訊號」（跟 app/api/cron/weekly 現成算的一致），吐每週最多 3 條行動任務。
 * 設計紀律：
 *  1. garbage-in-garbage-out：資料不足就誠實叫他先記錄，絕不硬擠假回饋。
 *  2. 沉默優於亂說：沒有足夠體重資料時，不做任何趨勢型判斷。
 *  3. 規則型可解釋：每條任務都能對應一個明確條件，不幻覺。
 *
 * 輸入欄位刻意對齊 weekly cron 已計算的東西（weeklyWeights / weeklyWeightChangeRate /
 * refeedSuggested / daysSinceLast* / paceTargetKg），掛線時零額外取數。
 */

export interface WeeklyTask {
  key: string        // 規則識別（去重、追蹤、覆寫用）
  priority: number   // 越小越前
  icon: string
  title: string      // 一句行動（推播標題）
  detail: string     // 為什麼 / 怎麼做（推播內文）
}

export interface WeeklyTaskInput {
  clientName: string
  goalType: string | null
  daysSinceLastWeight: number | null       // 距上次量體重天數（null = 從沒量過）
  daysSinceLastNutrition: number | null    // 距上次記飲食天數
  weeklyWeights: { week: number; avgWeight: number }[]  // week0 = 本週最新，往前遞增
  weeklyWeightChangeRatePct: number | null // 引擎算的每週變化率（%）；減脂為負
  refeedSuggested: boolean                  // 引擎判定該 refeed
  targetWeight: number | null               // 最終目標體重
  weeksToTarget: number | null              // 距目標／比賽日還剩幾週
  isLatePrep: boolean                        // 比賽 ≤28 天：交給教練手動，不自動催進度（體重受水分干擾）
  latestWeight: number | null
}

const RECORD_GAP_DAYS = 3        // ≥3 天沒記 = 記錄缺口
const TOO_FAST_PCT = -1.5        // 每週掉幅超過 1.5% = 太快
const STALL_TOLERANCE = 0.005    // 近幾週波動 <0.5% = 停滯
const BEHIND_TOLERANCE = 0.3     // 落後進度線 >0.3kg 才給本週目標（模範生不硬催）

function isCutGoal(goalType: string | null): boolean {
  const g = goalType ?? 'cut'
  return g.includes('cut') || g.includes('減') || g.includes('fat')
}

/** 近 2–3 週體重是否停滯（波動 < 0.5%） */
function isStalled(weeklyWeights: { week: number; avgWeight: number }[]): boolean {
  const recent = [...weeklyWeights].sort((a, b) => a.week - b.week).slice(0, 3)
  if (recent.length < 2) return false
  const vals = recent.map(w => w.avgWeight)
  const range = Math.max(...vals) - Math.min(...vals)
  const base = vals[vals.length - 1] || 1
  return range / base < STALL_TOLERANCE
}

/** 最近一週的週均 + 較上週變化（給 steady 訊息帶真實數字用） */
function recentWeeklyChange(weeklyWeights: { week: number; avgWeight: number }[]): { latestAvg: number; deltaKg: number } | null {
  const sorted = [...weeklyWeights].sort((a, b) => a.week - b.week)
  if (sorted.length < 2) return null
  return {
    latestAvg: +sorted[0].avgWeight.toFixed(1),
    deltaKg: +(sorted[0].avgWeight - sorted[1].avgWeight).toFixed(1),
  }
}

export function generateWeeklyTasks(input: WeeklyTaskInput): WeeklyTask[] {
  const tasks: WeeklyTask[] = []
  const isCut = isCutGoal(input.goalType)

  // ── 規則 1（最高，先決）：資料不足 → 誠實叫他記錄，不硬生成趨勢回饋 ──
  const noRecentWeight = input.daysSinceLastWeight == null || input.daysSinceLastWeight >= RECORD_GAP_DAYS
  const noRecentNutrition = input.daysSinceLastNutrition == null || input.daysSinceLastNutrition >= RECORD_GAP_DAYS
  if (noRecentWeight || noRecentNutrition) {
    tasks.push({
      key: 'record-gap',
      priority: 1,
      icon: '📝',
      title: '先補記錄：每天早上量體重',
      detail: noRecentWeight
        ? '系統還看不到你的最新趨勢。空腹量體重、看 7 天平均——有資料我才幫得了你。'
        : '這幾天飲食沒記到，吃完打「達標／未達標」就好，系統才抓得到卡點。',
    })
  }

  // 有近期體重且足夠週數，才做趨勢型判斷（沉默優於亂說）
  const enoughWeight = input.weeklyWeights.length >= 2 && !noRecentWeight

  // ── 規則 2：掉太快（減脂）→ 放慢保肌 ──
  if (isCut && enoughWeight && input.weeklyWeightChangeRatePct != null && input.weeklyWeightChangeRatePct <= TOO_FAST_PCT) {
    tasks.push({
      key: 'too-fast',
      priority: 2,
      icon: '🐢',
      title: '放慢：訓練日加一份澱粉',
      detail: `這週掉 ${Math.abs(input.weeklyWeightChangeRatePct).toFixed(1)}%，太快會掉肌。訓練日多一份飯糰／地瓜，穩在每週 1% 以內。`,
    })
  }

  // ── 規則 3：停滯 ≥2 週 → 檢查合規、週日回報 ──
  if (isCut && enoughWeight && isStalled(input.weeklyWeights)) {
    tasks.push({
      key: 'stall',
      priority: 3,
      icon: '🔍',
      title: '本週檢查飲食合規，週日回報',
      detail: '體重卡 2 週了。先別急著砍——多半是熱量抓不準或漏記。這週據實記、週日跟我對一次。',
    })
  }

  // ── 規則 4：refeed → 安排回碳日 ──
  if (input.refeedSuggested) {
    tasks.push({
      key: 'refeed',
      priority: 4,
      icon: '🍚',
      title: '本週安排一次回碳日',
      detail: '代謝壓力累積到該洩壓了。挑一天把碳水拉到維持熱量（訓練日更好）——不是作弊，是策略。',
    })
  }

  // ── 規則 5：照「當前掉速能不能如期達標」判斷落後（非直線位置，避免 late-prep 過衝）──
  // 比賽 ≤28 天（late prep）交給教練手動、不自動催——此時體重受肝醣／水分干擾，且教練在場
  if (isCut && enoughWeight && !input.isLatePrep && input.targetWeight != null &&
      input.weeksToTarget != null && input.weeksToTarget > 0.5 &&
      input.latestWeight != null && input.weeklyWeightChangeRatePct != null) {
    const remaining = input.latestWeight - input.targetWeight
    if (remaining > BEHIND_TOLERANCE) {
      const requiredDrop = remaining / input.weeksToTarget                              // 每週要掉多少才如期
      const currentDrop = -(input.weeklyWeightChangeRatePct / 100) * input.latestWeight // 目前每週掉多少（kg，正=在掉）
      // 只有當前掉速明顯跟不上（<需求 80%）才催——模範生／超前不催
      if (currentDrop < requiredDrop * 0.8) {
        const weekTarget = +(input.latestWeight - requiredDrop).toFixed(1)
        tasks.push({
          key: 'behind-pace',
          priority: 5,
          icon: '🎯',
          title: `本週目標：掉到 ${weekTarget}kg`,
          detail: `離目標 ${input.targetWeight}kg 剩 ${input.weeksToTarget.toFixed(1)} 週，得每週 -${requiredDrop.toFixed(1)}kg；你目前約 -${Math.max(0, currentDrop).toFixed(1)}kg/週，稍微跟不上，這週補一下。`,
        })
      }
    }
  }

  // ── 規則 6（全綠）：都正常 → 穩住（帶真實數字，不空洞）──
  if (tasks.length === 0) {
    const wc = recentWeeklyChange(input.weeklyWeights)
    const numbers = wc ? `本週均重 ${wc.latestAvg}kg（較上週 ${wc.deltaKg > 0 ? '+' : ''}${wc.deltaKg}kg）` : ''
    tasks.push({
      key: 'steady',
      priority: 6,
      icon: '✅',
      title: numbers ? `狀態穩：${numbers}` : '狀態穩，照計畫走',
      detail: '在軌道上，別手癢亂改——維持記錄與課表，穩穩掉就是最快的路。',
    })
  }

  // 每週最多 3 條，按優先序
  return tasks.sort((a, b) => a.priority - b.priority).slice(0, 3)
}
