/**
 * 算得出來的血檢指標 —— 不用另外花錢驗的那些。
 *
 * ## 為什麼有這支（2026-09-13）
 *
 * Howard：「太貴了，乾，沒錢啦。」公版把 15 項 must 全開給他 ＝ 加驗 6,870 ＋ 底盤 3,600。
 *
 * 其中**游離睪固酮 400 元是白花的**：它可以從「總睪固酮 ＋ SHBG ＋ 白蛋白」算出來
 * （Vermeulen 1999, JCEM，PMID 10523012）。拿他自己的舊資料回推驗證過：
 *
 *   2026-03-20  總T 403.92 / SHBG 38.4 / 白蛋白 4.6
 *     → 算出 游離T 71.2 pg/mL（實測 72.8）、生物可利用 185 ng/dL（實測 182）
 *   2025-08     總T 515 / SHBG 24.4 / 白蛋白 4.6
 *     → 算出 游離T 119.3 pg/mL（實測 123）、生物可利用 309 ng/dL（實測 325）
 *
 * 誤差 2–5%，而且**生物可利用睪固酮本來就是算的**，不是測的 —— 沒有哪家實驗室
 * 真的去分離蛋白質再測一次。所以那 400 元買到的是一個我們本來就有的數字。
 *
 * ⚠️ 尺標警告：計算式的游離 T 與**免疫法直接測**的游離 T 不同尺，不能混著比趨勢。
 * 上面兩組對得起來，代表他那家實驗室給的就是算的（或用了相符的方法）——
 * **換實驗室要重新對一次**，別預設永遠對得上。
 */

/** 睪固酮分子量 g/mol */
const T_MW = 288.4
/** 白蛋白分子量 g/mol */
const ALB_MW = 66500
/** 睪固酮–白蛋白結合常數 L/mol（Vermeulen 1999） */
const K_ALB = 3.6e4
/** 睪固酮–SHBG 結合常數 L/mol（Vermeulen 1999） */
const K_SHBG = 1e9
/** 沒給白蛋白時的預設值 g/dL —— 白蛋白在健康人身上幾乎不動，用預設的誤差遠小於不算 */
export const DEFAULT_ALBUMIN_GDL = 4.3

export type TestosteroneDerivation = {
  /** pg/mL */
  freeTestosterone: number
  /** ng/dL */
  bioavailableTestosterone: number
  /** 游離佔總量的百分比 */
  freePercent: number
  /** 白蛋白是不是用預設值（是的話數字要保守看） */
  albuminAssumed: boolean
}

/**
 * Vermeulen 1999 計算式：總睪固酮 ＋ SHBG ＋ 白蛋白 → 游離／生物可利用睪固酮。
 *
 * @param totalT_ngdl 總睪固酮 ng/dL
 * @param shbg_nmolL  SHBG nmol/L
 * @param albumin_gdl 白蛋白 g/dL；沒有就用 DEFAULT_ALBUMIN_GDL
 */
export function deriveTestosterone(
  totalT_ngdl: number,
  shbg_nmolL: number,
  albumin_gdl?: number | null,
): TestosteroneDerivation | null {
  if (!Number.isFinite(totalT_ngdl) || !Number.isFinite(shbg_nmolL)) return null
  if (totalT_ngdl <= 0 || shbg_nmolL <= 0) return null

  const albuminAssumed = albumin_gdl == null || !Number.isFinite(albumin_gdl) || albumin_gdl <= 0
  const alb = albuminAssumed ? DEFAULT_ALBUMIN_GDL : (albumin_gdl as number)

  const T = (totalT_ngdl * 10) / T_MW * 1e-9   // ng/dL → mol/L
  const S = shbg_nmolL * 1e-9                   // nmol/L → mol/L
  const Calb = (alb * 10) / ALB_MW              // g/dL → mol/L

  // 解 [FT] 的二次式：N·Ks·FT² + (N + Ks(S−T))·FT − T = 0
  const N = 1 + K_ALB * Calb
  const a = K_SHBG * N
  const b = N + K_SHBG * (S - T)
  const c = -T
  const disc = b * b - 4 * a * c
  if (disc < 0) return null
  const FT = (-b + Math.sqrt(disc)) / (2 * a)
  if (!Number.isFinite(FT) || FT <= 0) return null

  return {
    freeTestosterone: FT * T_MW * 1e9,            // mol/L → pg/mL
    bioavailableTestosterone: FT * N * T_MW * 1e8, // mol/L → ng/dL
    freePercent: (FT / T) * 100,
    albuminAssumed,
  }
}

/**
 * HOMA-IR（胰島素阻抗指數）＝ 空腹胰島素 × 空腹血糖 / 405
 * Matthews 1985, Diabetologia（PMID 3899825）。單位：胰島素 μIU/mL、血糖 mg/dL。
 *
 * 實驗室若把 HOMA-IR 當獨立項目再收一次錢，那筆是白花的 —— 它就是這兩個數字相乘。
 */
export function deriveHomaIR(insulin_uIUmL: number, glucose_mgdl: number): number | null {
  if (!Number.isFinite(insulin_uIUmL) || !Number.isFinite(glucose_mgdl)) return null
  if (insulin_uIUmL <= 0 || glucose_mgdl <= 0) return null
  return (insulin_uIUmL * glucose_mgdl) / 405
}

/**
 * 哪些指標算得出來、要用到哪些輸入。
 * key／from 都是 `utils/labMatch.ts` 的 canonical ID。
 */
export const DERIVABLE_MARKERS: Record<string, { from: string[]; method: string; source: string }> = {
  free_testosterone: {
    from: ['testosterone', 'shbg'],
    method: '用總睪固酮＋SHBG＋白蛋白算',
    source: 'Vermeulen 1999 (PMID 10523012)',
  },
  bioavailable_testosterone: {
    from: ['testosterone', 'shbg'],
    method: '用總睪固酮＋SHBG＋白蛋白算',
    source: 'Vermeulen 1999 (PMID 10523012)',
  },
  homa_ir: {
    from: ['fasting_insulin', 'fasting_glucose'],
    method: '空腹胰島素 × 空腹血糖 ÷ 405',
    source: 'Matthews 1985 (PMID 3899825)',
  },
}
