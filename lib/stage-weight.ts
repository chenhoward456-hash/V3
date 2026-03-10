/**
 * 參考舞台體重計算 — 從 nutrition-engine.ts 提取
 */

export interface RecommendedStageWeightResult {
  ffm: number                    // 去脂體重 (kg)
  ffmi: number | null            // Fat Free Mass Index (kg/m²)，需要身高才能算
  recommendedLow: number         // 參考體重下限 (kg) — 以最高目標體脂推算
  recommendedHigh: number        // 參考體重上限 (kg) — 以最低目標體脂推算
  targetBFLow: number            // 使用的目標體脂下限 (%)
  targetBFHigh: number           // 使用的目標體脂上限 (%)
  currentBF: number              // 輸入的現況體脂 (%)
  currentWeight: number          // 輸入的現況體重 (kg)
  fatMass: number                // 現況脂肪量 (kg)
  fatToLose: number | null       // 需要減掉的脂肪量 (kg)，以參考中點計算
  mode: 'competition' | 'health' // 模式標籤
}

export function calcRecommendedStageWeight(
  currentWeight: number,
  bodyFatPct: number,   // 0–100 的百分比，例如 15 代表 15%
  gender: string,       // '男性' | '女性'
  heightCm?: number | null,
  isCompetition: boolean = true
): RecommendedStageWeightResult {
  const isMale = gender === '男性'

  // 去脂體重
  const ffm = Math.round(currentWeight * (1 - bodyFatPct / 100) * 10) / 10
  const fatMass = Math.round((currentWeight - ffm) * 10) / 10

  // FFMI (需要身高)
  let ffmi: number | null = null
  if (heightCm && heightCm > 0) {
    const heightM = heightCm / 100
    ffmi = Math.round((ffm / (heightM * heightM)) * 10) / 10
  }

  // 目標體脂範圍（依模式 + 性別）
  let targetBFLow: number
  let targetBFHigh: number
  if (isCompetition) {
    // 備賽：男性 4-6%，女性 10-14%（Halliday 2016 修正）
    targetBFLow = isMale ? 4 : 10
    targetBFHigh = isMale ? 6 : 14
  } else {
    // 一般健康/體態：男性 10-18%，女性 18-25%（ACSM）
    targetBFLow = isMale ? 10 : 18
    targetBFHigh = isMale ? 18 : 25
  }

  // 參考體重 = FFM ÷ (1 - 目標體脂)
  // 體脂高上限 → 體重下限；體脂低上限 → 體重上限
  const recommendedLow = Math.round(ffm / (1 - targetBFHigh / 100) * 10) / 10
  const recommendedHigh = Math.round(ffm / (1 - targetBFLow / 100) * 10) / 10

  // 以參考中點計算需減脂量
  const recommendedMid = (recommendedLow + recommendedHigh) / 2
  const fatToLose = currentWeight > recommendedMid
    ? Math.round((currentWeight - recommendedMid) * 10) / 10
    : null

  return {
    ffm,
    ffmi,
    recommendedLow,
    recommendedHigh,
    targetBFLow,
    targetBFHigh,
    currentBF: bodyFatPct,
    currentWeight,
    fatMass,
    fatToLose,
    mode: isCompetition ? 'competition' : 'health',
  }
}
