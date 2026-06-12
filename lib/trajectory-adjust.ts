/**
 * 軌跡式 macros 自動調整
 *
 * 核心邏輯：根據「目前每週體重變化速率」 vs 「達標所需速率」的缺口，
 * 計算每日 kcal 缺口，並在 macro_bounds 邊界內調整 macros。
 *
 * 適用於所有有 goal_type + target_weight + target_date 的學員（不分 tier）。
 * coached/protocol tier 的教練可透過 macro_bounds 設定客製邊界。
 *
 * 基因 + 體脂安全層：低體脂 / MTHFR 突變 / 5-HTTLPR 血清素風險者，赤字會被收窄，
 * 避免「數學上對、但對這個基因 + 體脂是錯」的過度減脂（吃肌肉 / 甲基化崩潰 / 血清素不足）。
 */

import { type GeneticProfile, getSerotoninRiskLevel } from './supplement-engine'

export interface MacroBounds {
  min_calories?: number | null
  min_protein_per_kg?: number | null
  max_loss_per_week?: number | null
  min_loss_per_week?: number | null
}

export interface TrajectoryInput {
  bodyDataEntries: Array<{ date: string; weight: number | null }>
  goalType: 'cut' | 'bulk' | 'recomp' | null
  targetWeight: number | null
  targetDate: string | null
  currentCalories: number | null
  currentProtein: number | null
  currentFat: number | null
  currentCarbs: number | null
  currentCarbsTrainingDay: number | null
  currentCarbsRestDay: number | null
  gender: 'male' | 'female' | string | null
  bounds: MacroBounds | null
  lastAdjustAt: string | null
  // 基因 + 體脂安全層輸入（缺省時不套用對應保護，行為與舊版相同）
  geneticProfile?: GeneticProfile | null
  bodyFatPct?: number | null
}

export type SkipCategory =
  | 'no_target'        // 缺 goal_type / target_weight / target_date — 需教練補欄位
  | 'no_calories'      // 沒設 calories_target — 需教練補 macro
  | 'no_body_data'     // 體重資料不足 2 週 — 需推學員量體重
  | 'cooldown'         // 冷卻中 — 無需動作
  | 'trend_reversed'   // 趨勢反轉 — 需教練判斷 (refeed 抖動 vs 真反轉)
  | 'on_track'         // 進度跟得上 — 無需動作
  | 'too_small'        // 調整 < 50 kcal — 無需動作

export interface TrajectoryAdjustment {
  shouldAdjust: boolean
  reason: string
  skipCategory: SkipCategory | null  // shouldAdjust=true 時為 null
  currentRatePerWeek: number | null
  neededRatePerWeek: number | null
  kcalAdjustment: number | null
  newMacros: {
    calories_target: number
    carbs_target?: number
    carbs_training_day?: number
    carbs_rest_day?: number
  } | null
  hitBoundary: boolean
  boundaryDetail: string | null
  cooldownDaysRemaining: number | null
  trajectoryData: {
    currentAvg: number
    weeksOfData: number
    delta1w: number | null
    delta4w: number | null
    regressionSlope: number | null
    trendReversed: boolean
  } | null
}

const DEFAULT_COOLDOWN_DAYS = 7
const TREND_REVERSAL_DELTA_THRESHOLD = 0.15
const SIGNIFICANT_GAP_KG_PER_WEEK = 0.1

// ── 基因 + 體脂安全層常數 ──
// 常數值直接對齊 lib/nutrition-engine.ts 的 GENETIC namespace（[G1][G2] PMID 已附於該檔）
const BF_FLOOR_MALE = 10              // 男性體脂安全下限 %
const BF_FLOOR_FEMALE = 16           // 女性體脂安全下限 %
const MAX_DEFICIT_AT_BF_FLOOR = 500  // 低於體脂下限時，每日赤字上限 kcal
const MTHFR_DEFICIT_REDUCTION = { homozygous: 150, heterozygous: 100 } as const // 赤字收窄 kcal
const SEROTONIN_CARB_FLOOR = { high: 120, moderate: 100 } as const // 碳水最低下限 g（保護 5-HT 合成）

// 性別正規化：cron 傳中文（'女性'/'男性'），測試傳英文（'female'/'male'）。兩者都要認，
// 否則女性會套到男性體脂下限(10%) → 低體脂赤字保護被靜默繞過（RED-S 風險）。
function isFemaleGender(gender: string | null | undefined): boolean {
  return gender === 'female' || gender === '女性' || gender === 'F' || gender === 'f'
}

type ResolvedBounds = { min_calories: number; min_protein_per_kg: number; max_loss_per_week: number; min_loss_per_week: number }

function getDefaultBounds(currentWeight: number, gender: string | null): ResolvedBounds {
  const isFemale = isFemaleGender(gender)
  return {
    min_calories: isFemale ? 1200 : 1500,
    min_protein_per_kg: 1.8,
    max_loss_per_week: Math.max(0.5, currentWeight * 0.01),
    min_loss_per_week: 0.3,
  }
}

function cooldownDaysFor(targetDate: string | null): number {
  if (!targetDate) return DEFAULT_COOLDOWN_DAYS
  const daysLeft = Math.floor((new Date(targetDate).getTime() - Date.now()) / 86_400_000)
  if (daysLeft < 14) return 5
  if (daysLeft < 30) return 7
  if (daysLeft < 60) return 10
  return 14
}

function computeWeeklyAverages(entries: Array<{ date: string; weight: number | null }>) {
  const withWeight = entries
    .filter(e => e.weight != null && !Number.isNaN(Number(e.weight)))
    .map(e => ({ date: e.date, weight: Number(e.weight) }))
    .sort((a, b) => a.date.localeCompare(b.date))

  if (withWeight.length === 0) return null

  // 以台北時區切週界（伺服器為 UTC，直接 setHours+toISOString 會位移一天，污染週均/斜率）
  const TPE_OFFSET = 8 * 60 * 60 * 1000
  const today = new Date(Date.now() + TPE_OFFSET)
  today.setUTCHours(0, 0, 0, 0)
  const weeks: Array<{ avg: number | null; count: number }> = []

  for (let i = 7; i >= 0; i--) {
    const end = new Date(today); end.setUTCDate(today.getUTCDate() - i * 7)
    const start = new Date(end); start.setUTCDate(end.getUTCDate() - 6)
    const startStr = start.toISOString().split('T')[0]
    const endStr = end.toISOString().split('T')[0]
    const inWeek = withWeight.filter(e => e.date >= startStr && e.date <= endStr)
    const avg = inWeek.length > 0 ? inWeek.reduce((s, e) => s + e.weight, 0) / inWeek.length : null
    weeks.push({ avg, count: inWeek.length })
  }

  const filled = weeks.filter(w => w.avg != null)
  if (filled.length === 0) return null

  const current = filled[filled.length - 1]
  const previous = filled.length >= 2 ? filled[filled.length - 2] : null
  const fourWeeksAgoIdx = Math.max(0, filled.length - 5)
  const fourWeeksAgo = filled.length >= 5 ? filled[fourWeeksAgoIdx] : null

  const delta1w = previous ? current.avg! - previous.avg! : null
  const delta4w = fourWeeksAgo ? current.avg! - fourWeeksAgo.avg! : null

  let regressionSlope: number | null = null
  const points = weeks.map((w, idx) => ({ x: idx, y: w.avg })).filter(p => p.y != null) as Array<{ x: number; y: number }>
  if (points.length >= 3) {
    const n = points.length
    const meanX = points.reduce((s, p) => s + p.x, 0) / n
    const meanY = points.reduce((s, p) => s + p.y, 0) / n
    let num = 0, den = 0
    for (const p of points) {
      num += (p.x - meanX) * (p.y - meanY)
      den += (p.x - meanX) ** 2
    }
    if (den > 0) regressionSlope = num / den
  }

  const trendReversed = delta1w != null && delta4w != null &&
    Math.sign(delta1w) !== Math.sign(delta4w) &&
    Math.abs(delta1w) > TREND_REVERSAL_DELTA_THRESHOLD

  return {
    currentAvg: current.avg!,
    weeksOfData: filled.length,
    delta1w,
    delta4w,
    regressionSlope,
    trendReversed,
  }
}

export function computeTrajectoryAdjustment(input: TrajectoryInput): TrajectoryAdjustment {
  const empty = (reason: string, category: SkipCategory): TrajectoryAdjustment => ({
    shouldAdjust: false,
    reason,
    skipCategory: category,
    currentRatePerWeek: null,
    neededRatePerWeek: null,
    kcalAdjustment: null,
    newMacros: null,
    hitBoundary: false,
    boundaryDetail: null,
    cooldownDaysRemaining: null,
    trajectoryData: null,
  })

  if (!input.goalType || !input.targetWeight || !input.targetDate) {
    return empty('缺少 goal_type / target_weight / target_date', 'no_target')
  }
  if (!input.currentCalories || input.currentCalories <= 0) {
    return empty('未設定當前 calories_target', 'no_calories')
  }

  const traj = computeWeeklyAverages(input.bodyDataEntries)
  if (!traj || traj.weeksOfData < 3) {
    return { ...empty('體重資料不足 3 週（單週 outlier 容易騙引擎）', 'no_body_data'), trajectoryData: traj }
  }

  const cooldownDays = cooldownDaysFor(input.targetDate)
  if (input.lastAdjustAt) {
    const daysSinceLast = (Date.now() - new Date(input.lastAdjustAt).getTime()) / 86_400_000
    if (daysSinceLast < cooldownDays) {
      return {
        ...empty(`Cooldown 中（已過 ${Math.floor(daysSinceLast)} / ${cooldownDays} 天）`, 'cooldown'),
        cooldownDaysRemaining: Math.ceil(cooldownDays - daysSinceLast),
        trajectoryData: traj,
      }
    }
  }

  if (traj.trendReversed) {
    return { ...empty('趨勢反轉（1 週 vs 4 週方向相反）', 'trend_reversed'), trajectoryData: traj }
  }

  const remainingKg = traj.currentAvg - input.targetWeight
  const remainingDays = Math.max(1, Math.floor((new Date(input.targetDate).getTime() - Date.now()) / 86_400_000))
  const neededRatePerWeek = -remainingKg / (remainingDays / 7)
  const currentRatePerWeek = traj.regressionSlope ?? traj.delta1w ?? 0

  const gap = neededRatePerWeek - currentRatePerWeek
  if (Math.abs(gap) < SIGNIFICANT_GAP_KG_PER_WEEK) {
    return {
      ...empty('進度跟得上，不需調整', 'on_track'),
      currentRatePerWeek,
      neededRatePerWeek,
      trajectoryData: traj,
    }
  }

  const rawKcalAdjustment = Math.round(gap * 7700 / 7)

  let hitBoundary = false
  const boundaryNotes: string[] = []

  // ── 基因 + 體脂安全層（只作用於赤字 / 減脂方向）──
  // 「數學上對、生理上對這個基因 + 體脂是錯」的過度減脂，在此被收窄。
  let cappedAdjustment = rawKcalAdjustment
  if (cappedAdjustment < 0) {
    // 1. 體脂安全下限：BF 過低時，再砍會吃肌肉 → 限縮每日赤字
    const bf = input.bodyFatPct
    const bfFloor = isFemaleGender(input.gender) ? BF_FLOOR_FEMALE : BF_FLOOR_MALE
    if (bf != null && bf < bfFloor && Math.abs(cappedAdjustment) > MAX_DEFICIT_AT_BF_FLOOR) {
      cappedAdjustment = -MAX_DEFICIT_AT_BF_FLOOR
      hitBoundary = true
      boundaryNotes.push(`體脂 ${bf}% < 安全下限 ${bfFloor}%，每日赤字限縮到 -${MAX_DEFICIT_AT_BF_FLOOR} kcal（保護瘦體組織）`)
    }

    // 2. MTHFR 突變：赤字收窄（吃多一點 → 飲食多樣性 → 葉酸/甲基化保護）
    const mthfr = input.geneticProfile?.mthfr
    const mthfrReduction = mthfr === 'homozygous' ? MTHFR_DEFICIT_REDUCTION.homozygous
      : mthfr === 'heterozygous' ? MTHFR_DEFICIT_REDUCTION.heterozygous : 0
    if (mthfrReduction > 0) {
      cappedAdjustment = Math.min(0, cappedAdjustment + mthfrReduction)
      hitBoundary = true
      boundaryNotes.push(`MTHFR ${mthfr === 'homozygous' ? '純合' : '雜合'}突變，赤字收窄 ${mthfrReduction} kcal（保護甲基化代謝）`)
    }

    // 3. 5-HTTLPR 血清素風險：碳水吸收赤字，碳水不可低於下限 → 反推赤字上限（保護 5-HT 合成）
    const serotoninRisk = getSerotoninRiskLevel(input.geneticProfile)
    const carbFloor = serotoninRisk === 'high' ? SEROTONIN_CARB_FLOOR.high
      : serotoninRisk === 'moderate' ? SEROTONIN_CARB_FLOOR.moderate : null
    const refCarbs = [input.currentCarbsRestDay, input.currentCarbs, input.currentCarbsTrainingDay]
      .find(v => v != null) as number | undefined
    if (carbFloor != null && refCarbs != null) {
      const maxDeficitFromCarbs = Math.max(0, (refCarbs - carbFloor) * 4)
      if (Math.abs(cappedAdjustment) > maxDeficitFromCarbs) {
        cappedAdjustment = -maxDeficitFromCarbs
        hitBoundary = true
        boundaryNotes.push(`5-HTTLPR ${serotoninRisk === 'high' ? 'SS' : 'SL'}，碳水不可低於 ${carbFloor}g，赤字限縮（保護血清素合成）`)
      }
    }
  }

  const defaults = getDefaultBounds(traj.currentAvg, input.gender ?? null)
  const userBounds = input.bounds ?? {}
  const bounds: { min_calories: number; min_protein_per_kg: number; max_loss_per_week: number; min_loss_per_week: number } = {
    min_calories: userBounds.min_calories ?? defaults.min_calories,
    min_protein_per_kg: userBounds.min_protein_per_kg ?? defaults.min_protein_per_kg,
    max_loss_per_week: userBounds.max_loss_per_week ?? defaults.max_loss_per_week,
    min_loss_per_week: userBounds.min_loss_per_week ?? defaults.min_loss_per_week,
  }

  // 撞 max_loss_per_week (掉太快 → 加碳)
  let finalKcalAdjustment = cappedAdjustment

  const projectedRate = currentRatePerWeek + (cappedAdjustment * 7 / 7700)
  if (input.goalType === 'cut' && projectedRate < -bounds.max_loss_per_week) {
    const allowedRate = -bounds.max_loss_per_week
    finalKcalAdjustment = Math.round((allowedRate - currentRatePerWeek) * 7700 / 7)
    hitBoundary = true
    boundaryNotes.push(`撞 max_loss_per_week (${bounds.max_loss_per_week} kg/週)，限縮調整幅度`)
  }

  // 撞 min_calories
  const proposedCal = input.currentCalories + finalKcalAdjustment
  let newCal = proposedCal
  if (proposedCal < bounds.min_calories) {
    newCal = bounds.min_calories
    finalKcalAdjustment = newCal - input.currentCalories
    hitBoundary = true
    boundaryNotes.push(`撞 min_calories (${bounds.min_calories} kcal)，無法再砍 — 建議加有氧、延目標日或改目標體重`)
  }

  newCal = Math.round(newCal / 10) * 10
  const boundaryDetail = boundaryNotes.length > 0 ? boundaryNotes.join('；') : null

  // 碳水吸收全部缺口（不動蛋白/脂肪）
  const actualKcalShift = newCal - input.currentCalories
  if (Math.abs(actualKcalShift) < 50) {
    return {
      ...empty('調整後熱量變化 < 50 kcal，不值得套用', 'too_small'),
      currentRatePerWeek,
      neededRatePerWeek,
      kcalAdjustment: cappedAdjustment,
      hitBoundary,
      boundaryDetail,
      trajectoryData: traj,
    }
  }

  const carbShift = Math.round((actualKcalShift / 4) / 5) * 5
  const newMacros: TrajectoryAdjustment['newMacros'] = { calories_target: newCal }
  if (input.currentCarbs != null) newMacros.carbs_target = Math.max(50, input.currentCarbs + carbShift)
  if (input.currentCarbsTrainingDay != null) newMacros.carbs_training_day = Math.max(50, input.currentCarbsTrainingDay + carbShift)
  if (input.currentCarbsRestDay != null) newMacros.carbs_rest_day = Math.max(50, input.currentCarbsRestDay + carbShift)

  const direction = actualKcalShift < 0 ? '砍' : '加'
  const reason = `週速率 ${currentRatePerWeek.toFixed(2)} kg vs 需 ${neededRatePerWeek.toFixed(2)} kg → ${direction} ${Math.abs(actualKcalShift)} kcal/天`

  return {
    shouldAdjust: true,
    reason,
    currentRatePerWeek,
    neededRatePerWeek,
    kcalAdjustment: actualKcalShift,
    newMacros,
    hitBoundary,
    boundaryDetail,
    cooldownDaysRemaining: 0,
    trajectoryData: traj,
    skipCategory: null,
  }
}

export function getCooldownDaysForDeadline(targetDate: string | null): number {
  return cooldownDaysFor(targetDate)
}
