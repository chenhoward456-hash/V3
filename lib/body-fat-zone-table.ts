/**
 * Body Fat Percentage Zone Lookup Table
 * ======================================
 * Evidence-based macronutrient & deficit recommendations by body fat zone and gender.
 *
 * Literature basis (完整引用見 nutrition-engine.ts 頂部 References):
 *   [1]  Helms, Aragon & Fitschen (2014) JISSN — 備賽營養建議, 蛋白質 2.3-3.1 g/kg LBM
 *   [2]  Garthe et al. (2011) IJSNEM — 慢速 vs 快速減重: 0.7% BW/wk 保留更多 LBM
 *   [3]  Roberts, Helms, Trexler, Fitschen (2020) J Hum Kinet — 蛋白質 1.8-2.7 g/kg
 *   [4]  Iraki et al. (2019) Sports — 增肌期 surplus +10-20%, 蛋白質 1.6-2.2 g/kg
 *   [5]  Morton et al. (2018) BJSM — 蛋白質 1.6 g/kg 飽和點 meta-analysis
 *   [6]  Stokes et al. (2018) Nutrients — 女性低劑量蛋白質同等有效
 *   [7]  Trexler et al. (2014) JISSN — 代謝適應, refeed, reverse dieting
 *   [8]  Byrne et al. (2018) Int J Obes — MATADOR: intermittent restriction 優於連續
 *   [9]  Loucks & Thuma (2003) JCEM — EA < 30 kcal/kg FFM/day 閾值
 *   [10] Mountjoy et al. (2018) BJSM — IOC RED-S consensus
 *   [11] Alpert (2005) J Theor Biol — 最大脂肪動員率 ~31 kcal/lb fat/day
 *   [16] Jäger et al. (2017) JISSN — ISSN protein position stand
 *   [17] Aragon et al. (2017) JISSN — ISSN diets & body composition
 *   -    Campbell et al. (2020) — Off-season bodybuilding nutrition
 *
 * Recovery Modifier System:
 *   Recovery indicators (sleep quality, energy, mood, training RPE) are scored 1-5.
 *   A composite "recovery score" drives automatic adjustments to deficit depth,
 *   refeed frequency, and protein priority. The leaner the zone, the more
 *   aggressively the system responds to recovery degradation.
 *
 * All g/kg values reference TOTAL body weight unless explicitly noted as LBM.
 * For zones 4-5 (overweight), protein is dosed on adjusted body weight:
 *   adjusted_bw = ideal_bw + 0.25 * (actual_bw - ideal_bw)
 *   where ideal_bw = lean_mass / (1 - target_mid_bf%)
 */

// ============================================================
//  TYPES
// ============================================================

export type Gender = 'male' | 'female'

export type BodyFatZoneId =
  | 'competition_lean'
  | 'very_lean'
  | 'athletic'
  | 'average'
  | 'overweight'

// 從 recovery-engine 統一匯入恢復相關類型與函數
export { type RecoveryState, type RecoveryIndicators, classifyRecovery } from './recovery-engine'
import { type RecoveryState, type RecoveryIndicators, classifyRecovery } from './recovery-engine'

/** Full zone definition with all macro and deficit parameters */
export interface BodyFatZone {
  id: BodyFatZoneId
  label: string
  gender: Gender

  // Body fat range
  bfMin: number              // inclusive, % (e.g. 8 = 8%)
  bfMax: number              // exclusive for upper zones, inclusive for last zone

  // ------ CUTTING (deficit) recommendations ------
  cut: {
    proteinGPerKg: number       // g per kg total BW (or adjusted BW for overweight)
    proteinGPerKgLBM: number    // g per kg lean body mass (reference)
    fatGPerKg: number           // minimum fat g/kg
    fatMaxPctCal: number        // fat ceiling as % of total calories
    carbApproach: string        // narrative: how to set carbs
    carbEstGPerKg: number       // typical starting point g/kg
    deficitPctTDEE: { min: number; max: number }   // % of TDEE (e.g. 10 = 10%)
    deficitKcal: { min: number; max: number }       // absolute kcal range
    weightLossRate: { min: number; max: number }    // % BW per week
    refeedFrequency: string     // e.g. "every 5-7 days"
    dietBreakWeeks: number      // suggest full diet break after N weeks
  }

  // ------ BULKING (surplus) recommendations ------
  bulk: {
    proteinGPerKg: number
    fatGPerKg: number
    fatMaxPctCal: number
    carbEstGPerKg: number
    surplusPctTDEE: { min: number; max: number }
    surplusKcal: { min: number; max: number }
    weightGainRate: { min: number; max: number }    // % BW per week
  }

  // ------ Recovery modification rules ------
  recovery: {
    /** How sensitive this zone is to recovery degradation (1-5, 5 = most) */
    sensitivity: number
    /** Recovery score threshold below which we auto-reduce deficit */
    autoReduceThreshold: RecoveryState
    /** Actions per recovery state */
    actions: Record<RecoveryState, RecoveryAction>
  }

  // ------ Key considerations ------
  notes: string[]
}

export interface RecoveryAction {
  deficitMultiplier: number         // 1.0 = no change, 0.5 = halve the deficit
  proteinAdjustGPerKg: number       // add this to base protein (can be 0)
  carbAdjustPct: number             // multiply carb allocation (1.0 = no change)
  refeedOverride: string | null     // override refeed frequency, or null = use default
  actionLabel: string               // human-readable summary
}

// ============================================================
//  MALE ZONES
// ============================================================

const MALE_ZONES: BodyFatZone[] = [
  // ─── ZONE 1: Competition Lean (<8%) ───
  {
    id: 'competition_lean',
    label: 'Competition Lean',
    gender: 'male',
    bfMin: 0,
    bfMax: 8,
    cut: {
      // 自然選手優化：Bandegan 2017 IAAO ~2.0 g/kg 赤字上限；原 3.0 → 2.2
      proteinGPerKg: 2.2,
      proteinGPerKgLBM: 2.4,
      // 自然選手優化：降低脂肪讓位給碳水（+ 50g 絕對底線）
      fatGPerKg: 0.7,
      fatMaxPctCal: 30,
      carbApproach: 'Remainder of calories after protein + fat. Prioritize around training. Carb cycling strongly recommended (higher on training days, lower on rest days).',
      carbEstGPerKg: 2.0,
      // Very conservative deficit; Alpert: limited fat stores cap max oxidation
      // At 8% BF, 80kg male = 6.4kg fat = ~14 lbs fat * 31 kcal ≈ 434 kcal/day max from fat alone
      deficitPctTDEE: { min: 5, max: 15 },
      deficitKcal: { min: 100, max: 350 },
      weightLossRate: { min: 0.25, max: 0.5 },
      refeedFrequency: 'Every 3-5 days (1-2 days at maintenance or slight surplus, carb-focused)',
      dietBreakWeeks: 4,
    },
    bulk: {
      // Post-contest reverse: very conservative surplus to avoid rapid fat rebound
      proteinGPerKg: 2.4,
      fatGPerKg: 1.0,
      fatMaxPctCal: 30,
      carbEstGPerKg: 5.0,
      surplusPctTDEE: { min: 5, max: 10 },
      surplusKcal: { min: 100, max: 250 },
      weightGainRate: { min: 0.15, max: 0.35 },
    },
    recovery: {
      sensitivity: 5,
      autoReduceThreshold: 'good',  // Even "good" triggers caution at this leanness
      actions: {
        optimal: {
          deficitMultiplier: 1.0,
          proteinAdjustGPerKg: 0,
          carbAdjustPct: 1.0,
          refeedOverride: null,
          actionLabel: 'Maintain current plan. Monitor closely.',
        },
        good: {
          deficitMultiplier: 0.85,
          proteinAdjustGPerKg: 0,
          carbAdjustPct: 1.1,
          refeedOverride: 'Every 3-4 days',
          actionLabel: 'Reduce deficit by 15%. Add extra carbs around training. Increase refeed frequency.',
        },
        struggling: {
          deficitMultiplier: 0.5,
          proteinAdjustGPerKg: 0.2,
          carbAdjustPct: 1.25,
          refeedOverride: 'Every 2-3 days or move to maintenance for 7-14 days',
          actionLabel: 'Halve the deficit. Boost protein to 3.2 g/kg. Strongly consider a full diet break.',
        },
        critical: {
          deficitMultiplier: 0,
          proteinAdjustGPerKg: 0.2,
          carbAdjustPct: 1.5,
          refeedOverride: 'Immediate diet break: 10-14 days at maintenance',
          actionLabel: 'STOP CUTTING. Move to maintenance immediately. Risk of muscle loss, hormonal disruption, and injury is very high.',
        },
      },
    },
    notes: [
      'This zone is unsustainable long-term (days to a few weeks max for competition).',
      'Hormonal suppression (testosterone, thyroid T3, leptin) is expected and significant.',
      'Metabolic adaptation is maximal. TDEE may be 15-25% below prediction (Trexler 2014).',
      'Any decline in sleep, energy, mood, or training performance should trigger immediate deficit reduction.',
      'Frequent refeeds (primarily carbohydrate) help partially restore leptin and thyroid (Dirlewanger 2000).',
      'Post-competition: reverse diet slowly (+100-150 kcal/week) to minimize fat overshoot.',
      'Strength loss > 5% or persistent RPE increase of 1+ point = mandatory deficit reduction.',
    ],
  },

  // ─── ZONE 2: Very Lean (8-12%) ───
  {
    id: 'very_lean',
    label: 'Very Lean',
    gender: 'male',
    bfMin: 8,
    bfMax: 12,
    cut: {
      // 自然選手優化：原 2.6 → 2.1（MPS 天花板低，多吃無益）
      proteinGPerKg: 2.1,
      proteinGPerKgLBM: 2.3,
      fatGPerKg: 0.7,
      fatMaxPctCal: 25,
      carbApproach: 'Remainder after protein + fat. Carb cycling recommended. Prioritize peri-workout carbs.',
      carbEstGPerKg: 3.0,
      // Moderate deficit; at 10% BF 80kg = 8kg fat ≈ 17.6 lbs * 31 ≈ 545 kcal max oxidation
      deficitPctTDEE: { min: 10, max: 20 },
      deficitKcal: { min: 200, max: 500 },
      weightLossRate: { min: 0.5, max: 0.75 },
      refeedFrequency: 'Every 5-7 days (1 day at maintenance, carb-focused)',
      dietBreakWeeks: 6,
    },
    bulk: {
      proteinGPerKg: 2.2,
      fatGPerKg: 1.0,
      fatMaxPctCal: 30,
      carbEstGPerKg: 5.5,
      // Campbell 2020: off-season surplus +200-400 kcal
      surplusPctTDEE: { min: 8, max: 15 },
      surplusKcal: { min: 200, max: 400 },
      weightGainRate: { min: 0.2, max: 0.4 },
    },
    recovery: {
      sensitivity: 4,
      autoReduceThreshold: 'struggling',
      actions: {
        optimal: {
          deficitMultiplier: 1.0,
          proteinAdjustGPerKg: 0,
          carbAdjustPct: 1.0,
          refeedOverride: null,
          actionLabel: 'On track. Continue current plan.',
        },
        good: {
          deficitMultiplier: 0.9,
          proteinAdjustGPerKg: 0,
          carbAdjustPct: 1.05,
          refeedOverride: null,
          actionLabel: 'Slight deficit reduction. Monitor trends closely.',
        },
        struggling: {
          deficitMultiplier: 0.65,
          proteinAdjustGPerKg: 0.2,
          carbAdjustPct: 1.2,
          refeedOverride: 'Every 4-5 days or 2-day refeed block',
          actionLabel: 'Reduce deficit by 35%. Increase protein to 2.8 g/kg. Add refeed days.',
        },
        critical: {
          deficitMultiplier: 0.25,
          proteinAdjustGPerKg: 0.2,
          carbAdjustPct: 1.4,
          refeedOverride: 'Full diet break: 7-14 days at maintenance',
          actionLabel: 'Near-maintenance eating for 1-2 weeks. Prioritize sleep and recovery before resuming cut.',
        },
      },
    },
    notes: [
      'Sustainable for several weeks to a few months with careful management.',
      'Hormonal suppression is moderate. Libido and energy may decline.',
      'Slower rate of loss (0.5-0.75% BW/week) is critical to preserve lean mass (Garthe 2011).',
      'Refeeds should emphasize carbohydrates (not fat) for leptin and glycogen restoration.',
      'Monitor training volume tolerance; reduce volume by 10-20% if recovery is poor while maintaining intensity.',
      'Diet breaks every 6 weeks help attenuate metabolic adaptation (Byrne 2018 MATADOR study).',
    ],
  },

  // ─── ZONE 3: Athletic (12-17%) ───
  {
    id: 'athletic',
    label: 'Athletic',
    gender: 'male',
    bfMin: 12,
    bfMax: 17,
    cut: {
      // 自然選手優化：原 2.3 → 2.0（ISSN 2017: 1.4-2.0 g/kg）
      proteinGPerKg: 2.0,
      proteinGPerKgLBM: 2.3,
      fatGPerKg: 0.7,
      fatMaxPctCal: 25,
      carbApproach: 'Remainder after protein + fat. Standard carb distribution or mild cycling optional.',
      carbEstGPerKg: 3.5,
      deficitPctTDEE: { min: 15, max: 25 },
      deficitKcal: { min: 300, max: 500 },
      weightLossRate: { min: 0.5, max: 1.0 },
      refeedFrequency: 'Every 7-10 days (1 day at maintenance)',
      dietBreakWeeks: 8,
    },
    bulk: {
      proteinGPerKg: 2.0,
      fatGPerKg: 1.0,
      fatMaxPctCal: 30,
      carbEstGPerKg: 5.0,
      surplusPctTDEE: { min: 10, max: 20 },
      surplusKcal: { min: 250, max: 500 },
      weightGainRate: { min: 0.25, max: 0.5 },
    },
    recovery: {
      sensitivity: 3,
      autoReduceThreshold: 'struggling',
      actions: {
        optimal: {
          deficitMultiplier: 1.0,
          proteinAdjustGPerKg: 0,
          carbAdjustPct: 1.0,
          refeedOverride: null,
          actionLabel: 'Progressing well. Maintain current approach.',
        },
        good: {
          deficitMultiplier: 1.0,
          proteinAdjustGPerKg: 0,
          carbAdjustPct: 1.0,
          refeedOverride: null,
          actionLabel: 'No adjustment needed. Continue monitoring.',
        },
        struggling: {
          deficitMultiplier: 0.75,
          proteinAdjustGPerKg: 0.1,
          carbAdjustPct: 1.15,
          refeedOverride: 'Every 5-7 days',
          actionLabel: 'Reduce deficit by 25%. Add a weekly refeed. Check sleep hygiene.',
        },
        critical: {
          deficitMultiplier: 0.5,
          proteinAdjustGPerKg: 0.2,
          carbAdjustPct: 1.3,
          refeedOverride: 'Diet break: 5-7 days at maintenance',
          actionLabel: 'Halve the deficit and take a short diet break. Assess stress load.',
        },
      },
    },
    notes: [
      'Ideal "stage lean" starting point for a competition prep (12-16 weeks out).',
      'Most sustainable zone for long-term leanness in trained males.',
      'Hormonal function is generally well-preserved at moderate deficits.',
      'Can tolerate standard 0.5-1.0% BW/week loss rate without significant LBM loss.',
      'Higher training volumes are tolerable compared to leaner zones.',
      'Body recomposition (simultaneous fat loss + muscle gain) is possible for novice/intermediate lifters at the upper range.',
    ],
  },

  // ─── ZONE 4: Average (17-22%) ───
  {
    id: 'average',
    label: 'Average',
    gender: 'male',
    bfMin: 17,
    bfMax: 22,
    cut: {
      // More fat stores = can use slightly lower protein per kg total BW
      // ISSN 2017: 1.4-2.0 g/kg; moderate deficit does not require extreme protein
      proteinGPerKg: 2.0,
      proteinGPerKgLBM: 2.4,
      fatGPerKg: 0.8,
      fatMaxPctCal: 28,
      carbApproach: 'Remainder after protein + fat. Even distribution across meals. No cycling needed.',
      carbEstGPerKg: 3.0,
      // Can be more aggressive; ample fat stores support higher oxidation rates
      // 20% BF, 85kg = 17kg fat ≈ 37.4 lbs * 31 ≈ 1160 kcal theoretical max
      deficitPctTDEE: { min: 20, max: 30 },
      deficitKcal: { min: 400, max: 750 },
      weightLossRate: { min: 0.7, max: 1.0 },
      refeedFrequency: 'Every 10-14 days or as needed for adherence',
      dietBreakWeeks: 10,
    },
    bulk: {
      proteinGPerKg: 1.8,
      fatGPerKg: 1.0,
      fatMaxPctCal: 30,
      carbEstGPerKg: 4.5,
      surplusPctTDEE: { min: 10, max: 15 },
      surplusKcal: { min: 200, max: 350 },
      weightGainRate: { min: 0.25, max: 0.5 },
    },
    recovery: {
      sensitivity: 2,
      autoReduceThreshold: 'critical',
      actions: {
        optimal: {
          deficitMultiplier: 1.0,
          proteinAdjustGPerKg: 0,
          carbAdjustPct: 1.0,
          refeedOverride: null,
          actionLabel: 'All systems normal. Maintain plan.',
        },
        good: {
          deficitMultiplier: 1.0,
          proteinAdjustGPerKg: 0,
          carbAdjustPct: 1.0,
          refeedOverride: null,
          actionLabel: 'No changes needed.',
        },
        struggling: {
          deficitMultiplier: 0.85,
          proteinAdjustGPerKg: 0.1,
          carbAdjustPct: 1.1,
          refeedOverride: null,
          actionLabel: 'Slight deficit reduction. Focus on sleep and stress management.',
        },
        critical: {
          deficitMultiplier: 0.6,
          proteinAdjustGPerKg: 0.2,
          carbAdjustPct: 1.2,
          refeedOverride: 'Diet break: 5-7 days at maintenance',
          actionLabel: 'Reduce deficit significantly. Take a diet break if sustained >1 week.',
        },
      },
    },
    notes: [
      'Ample fat stores allow more aggressive deficits with lower risk of LBM loss.',
      'Body recomposition is highly achievable for novice and detrained lifters.',
      'Adherence and consistency are the primary bottleneck, not physiological limits.',
      'Refeeds serve more for psychological adherence than hormonal necessity at this level.',
      'Recommend cutting to athletic range (12-17%) before committing to a bulk phase.',
      'Metabolic adaptation is minimal at moderate body fat; initial weight loss is often rapid (water + glycogen).',
    ],
  },

  // ─── ZONE 5: Overweight (>22%) ───
  {
    id: 'overweight',
    label: 'Overweight',
    gender: 'male',
    bfMin: 22,
    bfMax: 100,
    cut: {
      // For overweight: use adjusted body weight for protein dosing
      // adjusted_bw = ideal_bw + 0.25 * (actual_bw - ideal_bw)
      // Effective range: ~1.6-2.0 g/kg adjusted BW ≈ 1.2-1.5 g/kg total BW for very overweight
      proteinGPerKg: 1.6,         // g/kg ADJUSTED body weight (see note)
      proteinGPerKgLBM: 2.2,
      fatGPerKg: 0.7,
      fatMaxPctCal: 30,
      carbApproach: 'Remainder after protein + fat. Focus on whole food sources and fiber. Volume eating strategies.',
      carbEstGPerKg: 2.5,
      // Large fat stores support substantial deficits
      // 30% BF, 95kg = 28.5kg fat ≈ 62.7 lbs * 31 ≈ 1944 kcal theoretical max
      deficitPctTDEE: { min: 20, max: 35 },
      deficitKcal: { min: 500, max: 1000 },
      weightLossRate: { min: 0.7, max: 1.2 },
      refeedFrequency: 'Every 2-3 weeks or as needed for adherence',
      dietBreakWeeks: 12,
    },
    bulk: {
      // Bulking is NOT recommended in this zone; recomp or cut first
      proteinGPerKg: 1.6,
      fatGPerKg: 0.9,
      fatMaxPctCal: 30,
      carbEstGPerKg: 3.5,
      surplusPctTDEE: { min: 0, max: 5 },
      surplusKcal: { min: 0, max: 150 },
      weightGainRate: { min: 0, max: 0.2 },
    },
    recovery: {
      sensitivity: 1,
      autoReduceThreshold: 'critical',
      actions: {
        optimal: {
          deficitMultiplier: 1.0,
          proteinAdjustGPerKg: 0,
          carbAdjustPct: 1.0,
          refeedOverride: null,
          actionLabel: 'Continue current deficit. Focus on building habits.',
        },
        good: {
          deficitMultiplier: 1.0,
          proteinAdjustGPerKg: 0,
          carbAdjustPct: 1.0,
          refeedOverride: null,
          actionLabel: 'No changes. Consistency is the priority.',
        },
        struggling: {
          deficitMultiplier: 0.9,
          proteinAdjustGPerKg: 0,
          carbAdjustPct: 1.05,
          refeedOverride: null,
          actionLabel: 'Small deficit reduction for sustainability. Prioritize adherence over speed.',
        },
        critical: {
          deficitMultiplier: 0.7,
          proteinAdjustGPerKg: 0.1,
          carbAdjustPct: 1.15,
          refeedOverride: 'Eat at maintenance for 3-5 days, then resume',
          actionLabel: 'Reduce deficit. Short maintenance phase. Address sleep, stress, and non-diet factors.',
        },
      },
    },
    notes: [
      'Protein should be dosed on adjusted body weight, not total body weight (see formula above).',
      'Body recomposition is highly likely for novice lifters — simultaneous fat loss and muscle gain.',
      'Larger deficits are physiologically safe (ample fat stores) but adherence is the primary concern.',
      'Early weight loss is rapid (2-4 kg first week from water/glycogen) — set expectations.',
      'Bulking is not recommended; maintain caloric deficit or recomp until reaching average/athletic zone.',
      'Focus on protein intake and resistance training as the two highest-priority habits.',
      'Metabolic health markers (insulin sensitivity, inflammation) improve rapidly with even modest fat loss.',
    ],
  },
]

// ============================================================
//  FEMALE ZONES
// ============================================================

const FEMALE_ZONES: BodyFatZone[] = [
  // ─── ZONE 1: Competition Lean (<15%) ───
  {
    id: 'competition_lean',
    label: 'Competition Lean',
    gender: 'female',
    bfMin: 0,
    bfMax: 15,
    cut: {
      // 自然選手優化：原 2.6 → 2.0（女性 MPS 在較低劑量即飽和，Stokes 2018）
      proteinGPerKg: 2.0,
      proteinGPerKgLBM: 2.2,
      // Female fat floor: estrogen synthesis, menstrual function（+ 45g 絕對底線）
      // Loucks 2004: EA < 30 kcal/kg FFM → menstrual disruption
      fatGPerKg: 0.8,
      fatMaxPctCal: 30,
      carbApproach: 'Remainder of calories. Carb cycling recommended. Prioritize training-day carbs. Monitor menstrual function as primary safety signal.',
      carbEstGPerKg: 2.0,
      // Very conservative; females face hormonal disruption at much higher thresholds
      deficitPctTDEE: { min: 5, max: 12 },
      deficitKcal: { min: 75, max: 250 },
      weightLossRate: { min: 0.2, max: 0.4 },
      refeedFrequency: 'Every 3-4 days (1-2 days at maintenance, carb-focused)',
      dietBreakWeeks: 3,
    },
    bulk: {
      proteinGPerKg: 2.0,
      fatGPerKg: 1.1,
      fatMaxPctCal: 30,
      carbEstGPerKg: 4.5,
      surplusPctTDEE: { min: 5, max: 10 },
      surplusKcal: { min: 75, max: 200 },
      weightGainRate: { min: 0.1, max: 0.25 },
    },
    recovery: {
      sensitivity: 5,
      autoReduceThreshold: 'good',
      actions: {
        optimal: {
          deficitMultiplier: 1.0,
          proteinAdjustGPerKg: 0,
          carbAdjustPct: 1.0,
          refeedOverride: null,
          actionLabel: 'Maintain plan. Track menstrual status and bone health.',
        },
        good: {
          deficitMultiplier: 0.75,
          proteinAdjustGPerKg: 0,
          carbAdjustPct: 1.15,
          refeedOverride: 'Every 2-3 days',
          actionLabel: 'Reduce deficit by 25%. Increase refeeds. This is a high-risk zone for RED-S.',
        },
        struggling: {
          deficitMultiplier: 0.3,
          proteinAdjustGPerKg: 0.2,
          carbAdjustPct: 1.3,
          refeedOverride: 'Move to maintenance immediately for 7-14 days',
          actionLabel: 'Near-eliminate deficit. Immediate diet break. Monitor for amenorrhea.',
        },
        critical: {
          deficitMultiplier: 0,
          proteinAdjustGPerKg: 0.2,
          carbAdjustPct: 1.5,
          refeedOverride: 'STOP DIETING. Maintenance or slight surplus for 2-4 weeks minimum',
          actionLabel: 'STOP CUTTING. RED-S risk is extreme. Prioritize energy availability above all goals. Medical screening recommended.',
        },
      },
    },
    notes: [
      'This zone is NOT sustainable. Competition-only — days to 1-2 weeks maximum.',
      'Essential fat for females is ~12-14% (Lohman 1992). Below this, physiological harm is expected.',
      'RED-S risk is extreme: amenorrhea, bone density loss, thyroid suppression, cardiovascular effects.',
      'Energy availability MUST remain above 30 kcal/kg FFM/day; below 20 = functional hypothalamic amenorrhea.',
      'Menstrual cycle loss is the #1 red flag — if period is missed, deficit should be eliminated.',
      'Refeeds must be frequent and substantial (carb-focused) to support leptin and thyroid.',
      'Post-competition: reverse diet conservatively. Full hormonal recovery can take 3-6+ months.',
      'Bone density screening recommended for athletes who remain in this zone repeatedly.',
    ],
  },

  // ─── ZONE 2: Very Lean (15-20%) ───
  {
    id: 'very_lean',
    label: 'Very Lean',
    gender: 'female',
    bfMin: 15,
    bfMax: 20,
    cut: {
      // 自然選手優化：原 2.2 → 1.8
      proteinGPerKg: 1.8,
      proteinGPerKgLBM: 2.1,
      fatGPerKg: 0.9,
      fatMaxPctCal: 28,
      carbApproach: 'Remainder after protein + fat. Carb cycling optional. Peri-workout carbs prioritized.',
      carbEstGPerKg: 2.5,
      deficitPctTDEE: { min: 8, max: 18 },
      deficitKcal: { min: 150, max: 400 },
      weightLossRate: { min: 0.3, max: 0.6 },
      refeedFrequency: 'Every 5-7 days (1 day at maintenance, carb-focused)',
      dietBreakWeeks: 5,
    },
    bulk: {
      proteinGPerKg: 1.8,
      fatGPerKg: 1.0,
      fatMaxPctCal: 30,
      carbEstGPerKg: 5.0,
      surplusPctTDEE: { min: 8, max: 15 },
      surplusKcal: { min: 150, max: 350 },
      weightGainRate: { min: 0.15, max: 0.35 },
    },
    recovery: {
      sensitivity: 4,
      autoReduceThreshold: 'struggling',
      actions: {
        optimal: {
          deficitMultiplier: 1.0,
          proteinAdjustGPerKg: 0,
          carbAdjustPct: 1.0,
          refeedOverride: null,
          actionLabel: 'Progressing well. Monitor menstrual regularity.',
        },
        good: {
          deficitMultiplier: 0.9,
          proteinAdjustGPerKg: 0,
          carbAdjustPct: 1.05,
          refeedOverride: null,
          actionLabel: 'Minor adjustment. Track cycle and energy.',
        },
        struggling: {
          deficitMultiplier: 0.6,
          proteinAdjustGPerKg: 0.2,
          carbAdjustPct: 1.2,
          refeedOverride: 'Every 4-5 days or 2-day refeed block',
          actionLabel: 'Reduce deficit by 40%. Increase refeeds. If cycle is disrupted, move to maintenance.',
        },
        critical: {
          deficitMultiplier: 0.15,
          proteinAdjustGPerKg: 0.2,
          carbAdjustPct: 1.4,
          refeedOverride: 'Diet break: 10-14 days at maintenance',
          actionLabel: 'Move to near-maintenance. Assess menstrual status and energy availability.',
        },
      },
    },
    notes: [
      'Achievable and sustainable for some female athletes, but requires careful monitoring.',
      'Menstrual cycle regularity is the key biomarker — any disruption warrants dietary adjustment.',
      'Energy availability should stay above 30 kcal/kg FFM/day at all times.',
      'Slower rate of loss (0.3-0.6% BW/week) is more critical for females than males at this leanness.',
      'Fat intake floor (1.0 g/kg) is non-negotiable for estrogen and reproductive function.',
      'Luteal phase (days 15-28) may show 1-2 kg scale increase from water retention — do not adjust calories based on this.',
    ],
  },

  // ─── ZONE 3: Athletic (20-25%) ───
  {
    id: 'athletic',
    label: 'Athletic',
    gender: 'female',
    bfMin: 20,
    bfMax: 25,
    cut: {
      // 自然選手優化：原 2.0 → 1.8（Morton 2018: 1.6 g/kg 即飽和）
      proteinGPerKg: 1.8,
      proteinGPerKgLBM: 2.2,
      fatGPerKg: 0.9,
      fatMaxPctCal: 28,
      carbApproach: 'Remainder after protein + fat. Standard distribution. Mild carb cycling optional.',
      carbEstGPerKg: 3.0,
      deficitPctTDEE: { min: 12, max: 22 },
      deficitKcal: { min: 250, max: 450 },
      weightLossRate: { min: 0.5, max: 0.8 },
      refeedFrequency: 'Every 7-10 days (1 day at maintenance)',
      dietBreakWeeks: 8,
    },
    bulk: {
      proteinGPerKg: 1.8,
      fatGPerKg: 1.0,
      fatMaxPctCal: 30,
      carbEstGPerKg: 4.5,
      surplusPctTDEE: { min: 8, max: 15 },
      surplusKcal: { min: 150, max: 350 },
      weightGainRate: { min: 0.2, max: 0.4 },
    },
    recovery: {
      sensitivity: 3,
      autoReduceThreshold: 'struggling',
      actions: {
        optimal: {
          deficitMultiplier: 1.0,
          proteinAdjustGPerKg: 0,
          carbAdjustPct: 1.0,
          refeedOverride: null,
          actionLabel: 'On track. Maintain current approach.',
        },
        good: {
          deficitMultiplier: 1.0,
          proteinAdjustGPerKg: 0,
          carbAdjustPct: 1.0,
          refeedOverride: null,
          actionLabel: 'No adjustment needed.',
        },
        struggling: {
          deficitMultiplier: 0.75,
          proteinAdjustGPerKg: 0.1,
          carbAdjustPct: 1.1,
          refeedOverride: 'Every 5-7 days',
          actionLabel: 'Reduce deficit by 25%. Add weekly refeed. Assess life stress load.',
        },
        critical: {
          deficitMultiplier: 0.5,
          proteinAdjustGPerKg: 0.2,
          carbAdjustPct: 1.25,
          refeedOverride: 'Diet break: 5-7 days at maintenance',
          actionLabel: 'Halve the deficit. Take a short diet break. Prioritize sleep.',
        },
      },
    },
    notes: [
      'This is the most sustainable lean range for most trained females.',
      'Hormonal function is generally well-preserved. Menstrual cycle should be regular.',
      'Good starting point for either a bulk or a contest prep (16-20 weeks out).',
      'Body recomposition is achievable for novice/intermediate female lifters at the upper range.',
      'Standard 0.5-0.8% BW/week loss is well-tolerated with proper protein and training.',
      'Account for menstrual cycle phase when interpreting weekly weight trends.',
    ],
  },

  // ─── ZONE 4: Average (25-30%) ───
  {
    id: 'average',
    label: 'Average',
    gender: 'female',
    bfMin: 25,
    bfMax: 30,
    cut: {
      proteinGPerKg: 1.8,
      proteinGPerKgLBM: 2.3,
      fatGPerKg: 0.8,
      fatMaxPctCal: 28,
      carbApproach: 'Remainder after protein + fat. Focus on whole food carb sources and fiber.',
      carbEstGPerKg: 2.5,
      deficitPctTDEE: { min: 15, max: 25 },
      deficitKcal: { min: 300, max: 600 },
      weightLossRate: { min: 0.5, max: 0.9 },
      refeedFrequency: 'Every 10-14 days or as needed for adherence',
      dietBreakWeeks: 10,
    },
    bulk: {
      proteinGPerKg: 1.6,
      fatGPerKg: 0.9,
      fatMaxPctCal: 30,
      carbEstGPerKg: 4.0,
      surplusPctTDEE: { min: 5, max: 12 },
      surplusKcal: { min: 100, max: 300 },
      weightGainRate: { min: 0.2, max: 0.4 },
    },
    recovery: {
      sensitivity: 2,
      autoReduceThreshold: 'critical',
      actions: {
        optimal: {
          deficitMultiplier: 1.0,
          proteinAdjustGPerKg: 0,
          carbAdjustPct: 1.0,
          refeedOverride: null,
          actionLabel: 'Maintain plan. Focus on consistency.',
        },
        good: {
          deficitMultiplier: 1.0,
          proteinAdjustGPerKg: 0,
          carbAdjustPct: 1.0,
          refeedOverride: null,
          actionLabel: 'No changes needed.',
        },
        struggling: {
          deficitMultiplier: 0.85,
          proteinAdjustGPerKg: 0.1,
          carbAdjustPct: 1.1,
          refeedOverride: null,
          actionLabel: 'Slight deficit reduction. Evaluate sleep and lifestyle stressors.',
        },
        critical: {
          deficitMultiplier: 0.6,
          proteinAdjustGPerKg: 0.2,
          carbAdjustPct: 1.2,
          refeedOverride: 'Eat at maintenance for 5-7 days',
          actionLabel: 'Reduce deficit. Short maintenance phase. Address non-diet recovery factors.',
        },
      },
    },
    notes: [
      'Average body fat for non-athletic women. Ample physiological headroom for moderate deficits.',
      'Adherence and lifestyle sustainability are the main challenges, not physiology.',
      'Refeeds are primarily for psychological adherence and diet adherence at this range.',
      'Body recomposition is very achievable for novice lifters — expect simultaneous fat loss and muscle gain.',
      'Recommend reaching athletic range (20-25%) before committing to a dedicated bulk.',
      'Menstrual cycle should be regular; disruption at this BF% suggests energy availability is too low.',
    ],
  },

  // ─── ZONE 5: Overweight (>30%) ───
  {
    id: 'overweight',
    label: 'Overweight',
    gender: 'female',
    bfMin: 30,
    bfMax: 100,
    cut: {
      // Use adjusted body weight for protein dosing
      proteinGPerKg: 1.4,         // g/kg ADJUSTED body weight
      proteinGPerKgLBM: 2.0,
      fatGPerKg: 0.7,
      fatMaxPctCal: 30,
      carbApproach: 'Remainder after protein + fat. Emphasize fiber-rich whole food carbs. Volume eating for satiety.',
      carbEstGPerKg: 2.0,
      deficitPctTDEE: { min: 20, max: 35 },
      deficitKcal: { min: 500, max: 900 },
      weightLossRate: { min: 0.7, max: 1.2 },
      refeedFrequency: 'Every 2-3 weeks or as needed for adherence',
      dietBreakWeeks: 12,
    },
    bulk: {
      // Bulking NOT recommended; recomp or cut first
      proteinGPerKg: 1.4,
      fatGPerKg: 0.8,
      fatMaxPctCal: 30,
      carbEstGPerKg: 3.0,
      surplusPctTDEE: { min: 0, max: 5 },
      surplusKcal: { min: 0, max: 100 },
      weightGainRate: { min: 0, max: 0.15 },
    },
    recovery: {
      sensitivity: 1,
      autoReduceThreshold: 'critical',
      actions: {
        optimal: {
          deficitMultiplier: 1.0,
          proteinAdjustGPerKg: 0,
          carbAdjustPct: 1.0,
          refeedOverride: null,
          actionLabel: 'Continue current plan. Build habits.',
        },
        good: {
          deficitMultiplier: 1.0,
          proteinAdjustGPerKg: 0,
          carbAdjustPct: 1.0,
          refeedOverride: null,
          actionLabel: 'No changes. Consistency is everything.',
        },
        struggling: {
          deficitMultiplier: 0.9,
          proteinAdjustGPerKg: 0,
          carbAdjustPct: 1.05,
          refeedOverride: null,
          actionLabel: 'Small deficit reduction. Prioritize adherence over aggressive loss.',
        },
        critical: {
          deficitMultiplier: 0.7,
          proteinAdjustGPerKg: 0.1,
          carbAdjustPct: 1.1,
          refeedOverride: 'Eat at maintenance for 3-5 days, then resume',
          actionLabel: 'Reduce deficit. Take a maintenance break. Focus on non-scale wins.',
        },
      },
    },
    notes: [
      'Protein dosed on adjusted body weight: adjusted_bw = ideal_bw + 0.25 * (actual_bw - ideal_bw).',
      'Body recomposition is almost guaranteed for novice lifters — expect rapid strength gains alongside fat loss.',
      'Larger deficits are physiologically tolerable but adherence is the #1 failure point.',
      'Initial weight loss is rapid (water/glycogen) — set expectations for 2-4 kg first-week drop then slower progress.',
      'Bulking is not recommended; cut or recomp until reaching average/athletic zone.',
      'Prioritize protein intake and resistance training as the two highest-impact habits.',
      'Metabolic health improvements (insulin sensitivity, inflammation) are rapid with even 5% BW loss.',
      'Menstrual irregularity at this BF% is more likely driven by insulin resistance than energy deficiency.',
    ],
  },
]

// ============================================================
//  ALL ZONES COMBINED
// ============================================================

export const BODY_FAT_ZONES: BodyFatZone[] = [...MALE_ZONES, ...FEMALE_ZONES]

// ============================================================
//  LOOKUP FUNCTIONS
// ============================================================

/**
 * Get the body fat zone for a given gender and body fat percentage.
 * Returns the matching zone or null if inputs are invalid.
 */
export function getBodyFatZone(gender: Gender, bodyFatPct: number): BodyFatZone | null {
  if (bodyFatPct < 0 || bodyFatPct > 100) return null

  const zones = gender === 'male' ? MALE_ZONES : FEMALE_ZONES
  for (const zone of zones) {
    if (bodyFatPct >= zone.bfMin && bodyFatPct < zone.bfMax) {
      return zone
    }
  }
  // Last zone catches the upper boundary (bfMax = 100 is inclusive)
  return zones[zones.length - 1]
}

/**
 * Get the zone ID string (useful for switch statements in the nutrition engine).
 */
export function getBodyFatZoneId(gender: Gender, bodyFatPct: number): BodyFatZoneId | null {
  const zone = getBodyFatZone(gender, bodyFatPct)
  return zone?.id ?? null
}

/**
 * Calculate adjusted body weight for protein dosing in overweight zones.
 * adjusted_bw = ideal_bw + 0.25 * (actual_bw - ideal_bw)
 *
 * @param actualWeight - current body weight in kg
 * @param bodyFatPct - current body fat % (e.g. 30 = 30%)
 * @param gender - 'male' | 'female'
 * @returns adjusted body weight in kg
 */
export function getAdjustedBodyWeight(
  actualWeight: number,
  bodyFatPct: number,
  gender: Gender
): number {
  // Target "ideal" mid-range BF% for the athletic zone
  const idealBfPct = gender === 'male' ? 15 : 22
  const leanMass = actualWeight * (1 - bodyFatPct / 100)
  const idealWeight = leanMass / (1 - idealBfPct / 100)
  const adjustedWeight = idealWeight + 0.25 * (actualWeight - idealWeight)
  return Math.round(adjustedWeight * 10) / 10
}

/**
 * Get full macro recommendation for a person, accounting for zone, goal, and recovery.
 *
 * @returns An object with exact gram targets and any warnings/overrides.
 */
export function getZoneMacros(params: {
  gender: Gender
  bodyWeight: number          // kg
  bodyFatPct: number          // % (e.g. 15 = 15%)
  goalType: 'cut' | 'bulk'
  estimatedTDEE: number       // kcal
  recoveryIndicators?: RecoveryIndicators | null
}): {
  zone: BodyFatZone
  recoveryState: RecoveryState
  protein: number              // grams
  fat: number                  // grams
  carbs: number                // grams
  calories: number             // kcal
  deficitOrSurplus: number     // kcal (negative = deficit)
  proteinPerKg: number         // actual g/kg used
  fatPerKg: number             // actual g/kg used
  carbsPerKg: number           // actual g/kg used
  warnings: string[]
} {
  const zone = getBodyFatZone(params.gender, params.bodyFatPct)
  if (!zone) {
    throw new Error(`Invalid body fat percentage: ${params.bodyFatPct}`)
  }

  const bw = params.bodyWeight
  const tdee = params.estimatedTDEE
  const warnings: string[] = []

  // Determine recovery state
  const recoveryState = params.recoveryIndicators
    ? classifyRecovery(params.recoveryIndicators)
    : 'good'

  // Get recovery action for this zone
  const recoveryAction = zone.recovery.actions[recoveryState]

  // Determine which weight to use for protein dosing
  const isOverweight = zone.id === 'overweight'
  const proteinDoseWeight = isOverweight
    ? getAdjustedBodyWeight(bw, params.bodyFatPct, params.gender)
    : bw

  if (isOverweight) {
    warnings.push(
      `Protein dosed on adjusted body weight (${proteinDoseWeight} kg) instead of actual (${bw} kg).`
    )
  }

  if (params.goalType === 'cut') {
    const spec = zone.cut

    // 1. Base protein (adjusted for recovery)
    let proteinPerKg = spec.proteinGPerKg + recoveryAction.proteinAdjustGPerKg
    let protein = Math.round(proteinDoseWeight * proteinPerKg)

    // 2. Base fat
    let fatPerKg = spec.fatGPerKg
    let fat = Math.round(bw * fatPerKg)

    // 3. Deficit (midpoint of range, then apply recovery multiplier)
    const baseMidDeficit = (spec.deficitKcal.min + spec.deficitKcal.max) / 2
    let deficit = Math.round(baseMidDeficit * recoveryAction.deficitMultiplier)

    // Clamp deficit to zone range
    deficit = Math.max(0, Math.min(deficit, spec.deficitKcal.max))

    // 4. Target calories
    let targetCalories = Math.round(tdee - deficit)

    // 5. Carbs = remainder, adjusted by recovery multiplier
    let proFatCal = protein * 4 + fat * 9
    let carbCalories = Math.max(0, targetCalories - proFatCal)
    carbCalories = Math.round(carbCalories * recoveryAction.carbAdjustPct)
    let carbs = Math.round(carbCalories / 4)

    // Recalculate actual calories from macros
    let actualCalories = protein * 4 + carbs * 4 + fat * 9

    // Safety: minimum carb floor (30g)
    if (carbs < 30) {
      carbs = 30
      actualCalories = protein * 4 + carbs * 4 + fat * 9
      warnings.push('Carbs set to minimum floor (30g). Consider reducing deficit.')
    }

    // Add recovery warnings
    if (recoveryState === 'struggling') {
      warnings.push(recoveryAction.actionLabel)
    }
    if (recoveryState === 'critical') {
      warnings.push(`CRITICAL: ${recoveryAction.actionLabel}`)
    }
    if (recoveryAction.refeedOverride) {
      warnings.push(`Refeed schedule: ${recoveryAction.refeedOverride}`)
    }

    return {
      zone,
      recoveryState,
      protein,
      fat,
      carbs,
      calories: actualCalories,
      deficitOrSurplus: actualCalories - tdee,
      proteinPerKg,
      fatPerKg,
      carbsPerKg: Math.round((carbs / bw) * 10) / 10,
      warnings,
    }
  } else {
    // BULK
    const spec = zone.bulk

    let proteinPerKg = spec.proteinGPerKg
    let protein = Math.round(proteinDoseWeight * proteinPerKg)

    let fatPerKg = spec.fatGPerKg
    let fat = Math.round(bw * fatPerKg)

    const midSurplus = (spec.surplusKcal.min + spec.surplusKcal.max) / 2
    let surplus = Math.round(midSurplus)
    let targetCalories = Math.round(tdee + surplus)

    let proFatCal = protein * 4 + fat * 9
    let carbs = Math.max(30, Math.round((targetCalories - proFatCal) / 4))
    let actualCalories = protein * 4 + carbs * 4 + fat * 9

    // Warn if bulking in overweight zone
    if (isOverweight) {
      warnings.push(
        'Bulking is not recommended at this body fat level. Consider a cut or recomposition phase.'
      )
    }

    return {
      zone,
      recoveryState,
      protein,
      fat,
      carbs,
      calories: actualCalories,
      deficitOrSurplus: actualCalories - tdee,
      proteinPerKg,
      fatPerKg,
      carbsPerKg: Math.round((carbs / bw) * 10) / 10,
      warnings,
    }
  }
}

// ============================================================
//  QUICK REFERENCE SUMMARY (for logging / debugging / display)
// ============================================================

/**
 * Returns a condensed summary string of all zones for a given gender.
 * Useful for debugging or displaying in admin tools.
 */
export function printZoneSummary(gender: Gender): string {
  const zones = gender === 'male' ? MALE_ZONES : FEMALE_ZONES
  const lines: string[] = [
    `=== ${gender.toUpperCase()} BODY FAT ZONES ===`,
    '',
    'Zone                | BF%       | Cut Pro | Cut Fat | Cut Carb | Deficit kcal    | Loss %BW/wk  | Refeed',
    '--------------------|-----------|---------|---------|----------|-----------------|--------------|------------------',
  ]

  for (const z of zones) {
    const bfRange = z.bfMax < 100 ? `${z.bfMin}-${z.bfMax}%` : `>${z.bfMin}%`
    lines.push(
      [
        z.label.padEnd(20),
        bfRange.padEnd(10),
        `${z.cut.proteinGPerKg}g/kg`.padEnd(8),
        `${z.cut.fatGPerKg}g/kg`.padEnd(8),
        `${z.cut.carbEstGPerKg}g/kg`.padEnd(9),
        `${z.cut.deficitKcal.min}-${z.cut.deficitKcal.max}`.padEnd(16),
        `${z.cut.weightLossRate.min}-${z.cut.weightLossRate.max}%`.padEnd(13),
        z.cut.refeedFrequency,
      ].join('| ')
    )
  }

  return lines.join('\n')
}
