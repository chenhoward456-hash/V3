/**
 * plan-health.ts —— 課表本身的健檢（不看學員做了什麼）
 *
 * ⚠️ 為什麼是「不看實做」：2026-09-23 查 production，四個活躍學員裡
 *    **三個的 training_sets 完全是空的**（林宥任 60%、其餘三人 0%）。
 *    在那個覆蓋率下，「計畫 vs 實做」算出來的落差全是假的
 *    ——分不出「他沒做」還是「他沒記」。
 *
 *    但課表是**教練自己寫的**，資料一定完整。所以先檢查課表本身：
 *    不依賴任何人記錄，而且時機比事後對帳早三週（設定當下就擋）。
 *
 * ⚠️ 這支只是把 volume-audit 既有的零件組起來，不自己算組數。
 *    單獨成檔的理由是 ①/admin 的課表健檢 ②之後週訊要用同一套判讀——
 *    兩邊共用才不會出現「後台說肩後束 0 組、週訊說沒事」。
 */
import {
  planVolume,
  findGaps,
  findImbalances,
  pushPullRatio,
  MUSCLE_LABEL,
  VOLUME_MIN,
  VOLUME_MAX,
  type Gap,
  type Imbalance,
  type Muscle,
} from './volume-audit'

export interface PlanMuscleRow {
  muscle: Muscle
  label: string
  sets: number
  /** 低於 VOLUME_MIN / 在區間內 / 高於 VOLUME_MAX */
  flag: 'under' | 'ok' | 'over'
}

/**
 * 部位 → 教練可能用來描述它的字眼。
 *
 * ⚠️ 為什麼需要這張表：課表健檢最大的失敗模式是**把「刻意的」報成「漏掉的」**。
 *    真實案例（林宥任）：他的 phaseNote 明寫「胸椎太直…整份課表刻意減少
 *    把肩膀往後夾的動作（面拉、坐姿划船、反式蝴蝶全部拿掉），後縮類從 16 組砍到 6 組」。
 *    而健檢把「肩後束 0 組」報成紅色缺口——那不是漏排，是教練的處方。
 *
 *    教練已經把理由寫在 phaseNote 裡了，健檢就該讀它。
 */
/**
 * ⚠️ 這張表刻意**偏嚴格**。兩種誤判的代價不一樣：
 *   · 誤標「已註明」→ 真缺口被降級成灰色 → **漏報**
 *   · 誤標「未交代」→ 多一句提醒 → 只是吵
 *   漏報比較糟，所以只收「明確指訓練部位」的詞。
 *
 * ⛔ 踩過的：`chest: ['胸']` 會被「**胸椎**太直」命中，
 *    `back: ['背']` 會被「肩胛過度貼在**背上**」命中——兩個都是解剖位置不是肌群。
 *    所以那種一個字的寬詞全部拿掉，改用「胸大肌／背闊」這種只會指肌群的。
 */
const MUSCLE_ALIASES: Partial<Record<Muscle, string[]>> = {
  delts_rear: ['肩後', '後三角', '後束', '後縮', '肩胛後收', '面拉', '反式蝴蝶', '反向飛鳥'],
  delts_side: ['肩中', '中三角', '中束', '側平舉'],
  delts_front: ['肩前', '前三角', '前束', '肩推', '前平舉'],
  calves: ['小腿', '提踵', '腓腸', '比目魚'],
  core: ['核心', '腹肌', '軀幹', '抗旋', '死蟲', '棒式'],
  hamstrings: ['腿後', '膕繩', '腿彎舉', '腿勾'],
  quads: ['股四', '腿前', '大腿前', '腿伸'],
  glutes: ['臀部', '臀肌', '臀推'],
  traps: ['斜方'],
  chest: ['胸大肌', '胸肌', '胸推'],
  back: ['背闊', '闊背', '背肌'],
  biceps: ['二頭'],
  triceps: ['三頭'],
}

/** phaseNote 有沒有提到這個部位（＝教練已經知道並且刻意這樣排） */
export function notedInPhaseNote(muscle: Muscle, phaseNote: string | null | undefined): boolean {
  if (!phaseNote) return false
  const words = MUSCLE_ALIASES[muscle] ?? []
  return words.some((w) => phaseNote.includes(w))
}

export interface PlanHealth {
  hasPlan: boolean
  /** 課表排了幾天 */
  dayCount: number
  totalSets: number
  rows: PlanMuscleRow[]
  /**
   * 缺口。`notedByCoach` = phaseNote 有提到這個部位。
   * ⚠️ 不要因為有註明就把它從清單拿掉——教練可能寫了理由但數字還是排錯。
   *    降級顯示就好，判斷留給人。
   */
  gaps: Array<Gap & { notedByCoach: boolean }>
  imbalances: Array<Imbalance & { notedByCoach: boolean }>
  /** 課表的 phaseNote（教練寫的處方說明） */
  phaseNote: string | null
  push: number
  pull: number
  overheadPull: number
  /**
   * 課表裡認不出部位的動作名。
   * ⚠️ 這個最該修 —— 有一個認不出來，那個部位的組數就整批不見，
   *    下面所有的缺口／失衡判斷都會跟著失真。
   */
  unresolved: string[]
  /** 不計入肌肥大量的（暖身、呼吸、Posing、有氧） */
  excludedSets: number
  /** 有沒有任何**沒被 phaseNote 交代過**的發現 */
  hasFindings: boolean
}

export function checkPlanHealth(trainingPlan: unknown): PlanHealth {
  const days = (trainingPlan as { days?: unknown[] } | null)?.days ?? []
  const v = planVolume(trainingPlan)

  const rows: PlanMuscleRow[] = (Object.keys(v.byMuscle) as Muscle[])
    .map((m) => {
      const sets = v.byMuscle[m] ?? 0
      return {
        muscle: m,
        label: MUSCLE_LABEL[m],
        sets,
        flag: sets < VOLUME_MIN ? ('under' as const) : sets > VOLUME_MAX ? ('over' as const) : ('ok' as const),
      }
    })
    .sort((a, b) => b.sets - a.sets)

  const phaseNote = (trainingPlan as { phaseNote?: string } | null)?.phaseNote ?? null
  const gaps = findGaps(v).map((g) => ({ ...g, notedByCoach: notedInPhaseNote(g.muscle, phaseNote) }))
  const imbalances = findImbalances(v).map((im) => ({
    ...im,
    // 兩邊任一被註明就算——「後縮類砍到 6 組」講的就是肩中:肩後那一對
    notedByCoach: notedInPhaseNote(im.high, phaseNote) || notedInPhaseNote(im.low, phaseNote),
  }))
  const { push, pull } = pushPullRatio(v)
  const unresolved = Array.from(new Set(v.unresolved))

  return {
    hasPlan: (v.total ?? 0) > 0,
    dayCount: days.length,
    totalSets: v.total,
    rows,
    gaps,
    imbalances,
    phaseNote,
    push,
    pull,
    overheadPull: v.overheadPull,
    unresolved,
    excludedSets: v.excluded,
    hasFindings:
      gaps.some((g) => !g.notedByCoach)
      || imbalances.some((im) => !im.notedByCoach)
      || unresolved.length > 0,
  }
}

/**
 * 一句話總結，給列表／週訊用。
 * ⚠️ 只講「掛零」跟「認不出」——那兩個是客觀的。
 *    失衡要知道目標才判得準（備賽期腿刻意壓低不是錯），不放進一句話裡。
 */
export function summarizePlanHealth(h: PlanHealth): string | null {
  if (!h.hasPlan) return null
  const zeros = h.gaps.filter((g) => g.severity === 'zero' && !g.notedByCoach).map((g) => g.label)
  const bits: string[] = []
  if (zeros.length) bits.push(`${zeros.join('、')} 0 組`)
  if (h.unresolved.length) bits.push(`${h.unresolved.length} 個動作認不出部位`)
  return bits.length ? bits.join('；') : null
}
