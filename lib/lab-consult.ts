/**
 * 這次血檢顧問卡 —— 學員抽完血，系統自己先講「這次重點、要留意什麼、下次什麼時候驗、驗什麼」。
 *
 * ## 為什麼有這支（2026-10-01）
 *
 * Howard：「我今天丟完新血檢我也不知道要注意什麼、下次驗血什麼時候，他不是顧問嗎」。
 * 原本上傳血檢只會觸發 AI 草稿（lib/auto-draft.ts）→ 進教練審核佇列 → 教練沒開後台，學員就什麼都拿不到。
 *
 * 這張卡**不經 AI、不等教練審**：全部是確定性規則，而且只重用既有引擎，不自己發明門檻——
 *   - 這次重點：longevity-lens 的 RCV（個人正常波動）判斷真變化 vs 雜訊、judgeDirection 判變好／變差
 *   - 要留意：lab-trend-analyzer 的 analyzeLabs，只取 critical／attention（正常值不會進來、沒標準的指標不會進來）
 *   - 已經很好：analyzeLabs 的 optimal
 *   - 預測對答案：gradeHypothesis
 *   - 下次抽血：有要留意的 → 3 個月；沒有 → 6 個月；項目用 lab-order 的減法引擎（must＋前幾項 defer）
 *
 * 合規：學員看得到 → 不寫病名、不下診斷、不建議藥物；不出現價格、底盤、套餐（那是教練開單用的）。
 * 純函式，不碰 DB。
 */

import { MARKERS, buildMarkerStory, gradeHypothesis, type LabPoint, type LabHypothesis, type HypothesisStatus } from '@/lib/longevity-lens'
import { analyzeLabs, type LabResultRow } from '@/lib/lab-trend-analyzer'
import { buildLabOrder, type TemplateItem, type OrderRule } from '@/lib/lab-order'
import { getLabDirection, LAB_THRESHOLDS, HIGHER_IS_BETTER, FEMALE_VARIANTS, getOptimalRangeText } from '@/utils/labStatus'
import { medicationNoteFor, type ClientMedication } from '@/lib/medication-effects'
import { auditSupplement, supplementEffect, type IndicationStatus } from '@/lib/supplement-indication-audit'
import { sideFromReferenceRange } from '@/utils/labReferenceRange'
import { getLabCanonicalId } from '@/utils/labMatch'
import type { LabNutritionAdvice } from '@/lib/lab-nutrition-advisor'
import type { SupplementSuggestion } from '@/lib/supplement-engine'

/** 最近一次抽血在這個天數內才顯示卡片／才自動排下次（太舊的抽血不算「這次」） */
export const CONSULT_FRESH_DAYS = 60
/** 有要留意的項目 → 幾個月後回來驗 */
export const RETEST_MONTHS_WITH_ISSUE = 3
/** 沒有要留意的項目 → 幾個月後 */
export const RETEST_MONTHS_CLEAN = 6
/** 「已經很好」列出幾項名字 */
const GOOD_NAMES_SHOWN = 5
/** 下次抽血：可延後的項目最多帶幾項 */
const DEFER_SHOWN = 3

export interface ConsultChange {
  name: string
  from: number
  to: number
  unit: string | null
  /** 變化幅度（%） */
  pct: number
  /** 這個人自己的正常波動（RCV，%）；超過才列 */
  rcvPct: number
  /** 變差、而且這次數字落在需要注意的範圍（也會出現在「要留意」的理由裡） */
  outOfRange?: boolean
  /** 變差時的白話提醒（例：肝指數受訓練影響） */
  hint?: string
  /** 正在吃的藥會影響這項 */
  medNote?: string
}

export interface ConsultWatch {
  name: string
  value: number
  unit: string | null
  /** high：數字超出標準範圍（labStatus alert）｜watch：落在需要注意的範圍 */
  level: 'high' | 'watch'
  /** 偏高／偏低 */
  side: 'high' | 'low' | null
  /** 理想範圍文字（例：<100、40-60），沒有就 null */
  idealText: string | null
  /** 系統沒設標準、改照檢驗所範圍判的：報告上印的範圍（例：46-171） */
  labRangeText?: string | null
  note: string
}

export interface ConsultAnswer {
  marker: string
  expected: string
  baseline: number
  result: number
  status: Exclude<HypothesisStatus, 'pending' | 'overdue'>
  verdict: string
}

export interface ConsultNextItem { label: string; why: string }

/**
 * 你在吃的保健品對帳（2026-10-03）：每一項有沒有血檢依據（supplement-indication-audit）、
 * 吃了之後對應的血檢有沒有動（開始日前最後一次 vs 之後最新一次）。原本只在教練後台編輯頁看得到。
 */
export interface ConsultStackItem {
  name: string
  /** 同名多次（早餐＋晚餐）合併成一行 */
  dose: string
  status: IndicationStatus
  basis: string
  effect: string | null
}

/**
 * 「接下來怎麼做」（2026-10-02）。Howard：「它沒有說所以我要注意什麼、保健品啥的建議，不然我知道有紀錄然後呢」。
 * 營養引擎（lab-nutrition-advisor）和補品引擎（supplement-engine）早就會算，但一個藏在「過往分析報告」摺疊裡、
 * 一個放在「計畫」分頁，跟血檢卡斷開。這裡只把兩個引擎的結果按血檢項目接起來，再掛上下次驗收日——不自己發明建議。
 */
export interface ConsultAction {
  name: string
  value: number | null
  unit: string | null
  /** 引擎給的目標範圍文字 */
  target: string | null
  title: string
  /** 吃的／生活上的做法（最多 3 條） */
  doThis: string[]
  supplements: { name: string; dosage: string; timing: string; reason: string }[]
  /** 正在吃的藥會影響這項（例：A 酸拉高 CK、肝指數、血脂） */
  medNote?: string | null
  /** 下次抽血日（驗收這項有沒有到目標） */
  retestDate: string
}

export interface LabConsult {
  /** 這次抽血日（全部 lab_results 裡最新的日期） */
  drawDate: string
  daysSinceDraw: number
  /** 最近一次抽血在 CONSULT_FRESH_DAYS 天內 */
  fresh: boolean
  /** 這次抽了幾項 */
  drawCount: number
  better: ConsultChange[]
  worse: ConsultChange[]
  /** 真的有變、但前後都在很好的範圍（不分好壞） */
  shiftedInRange: ConsultChange[]
  /** 有上一次可比、但變化在正常波動內的項目數 */
  noiseCount: number
  watch: ConsultWatch[]
  good: { count: number; names: string[] }
  answered: ConsultAnswer[]
  actions: ConsultAction[]
  stack: ConsultStackItem[]
  next: {
    date: string
    months: number
    reason: string
    items: ConsultNextItem[]
  }
}

export interface LabConsultInput {
  labs: LabResultRow[]
  gender?: string | null
  /** 台灣日 YYYY-MM-DD */
  today: string
  hypotheses?: LabHypothesis[]
  /** lab_panel_templates.add_on_items；沒有就只用「這次要留意的」當下次項目 */
  templateItems?: TemplateItem[] | null
  /** generateLabNutritionAdvice 的結果（用最新值算）；沒給就沒有「接下來怎麼做」 */
  advice?: LabNutritionAdvice[]
  /** generateSupplementSuggestions 的結果（用最新值算） */
  supplements?: SupplementSuggestion[]
  /** 教練排定的下次抽血日；在這次抽血之後就拿它當驗收日，否則用建議日 */
  scheduledCheckup?: string | null
  /** clients.medications：正在吃、會影響血檢的藥 */
  medications?: ClientMedication[] | null
  /** 有規律重訓（training_enabled）：eGFR 偏低時下次加驗 Cystatin C */
  resistanceTrained?: boolean
  /** supplements 表裡還沒封存的（學員正在吃的） */
  currentSupplements?: { name: string; dosage?: string | null; timing?: string | null; started_at?: string | null }[]
  genetics?: { gene_mthfr?: string | null; gene_apoe?: string | null }
}

const STACK_ORDER: Record<IndicationStatus, number> = { caution: 0, 'no-indication': 1, indicated: 2, lifestyle: 3 }

export function buildStack(
  current: NonNullable<LabConsultInput['currentSupplements']>,
  labs: LabResultRow[],
  genetics: LabConsultInput['genetics'],
  nextDate: string,
  medications: ClientMedication[] | null = null,
  today?: string,
): ConsultStackItem[] {
  const groups = new Map<string, { name: string; doses: string[]; started: string | null }>()
  for (const s of current) {
    const name = (s.name || '').trim()
    if (!name) continue
    const k = name.normalize('NFKC').toLowerCase()
    const dose = [s.dosage, s.timing].filter(Boolean).join(' ')
    const g = groups.get(k)
    if (g) { if (dose) g.doses.push(dose); if (s.started_at && (!g.started || s.started_at < g.started)) g.started = s.started_at }
    else groups.set(k, { name: name.normalize('NFKC'), doses: dose ? [dose] : [], started: s.started_at ?? null })
  }
  const auditLabs = labs.map(l => ({ test_name: l.test_name, value: l.value, status: l.status ?? null, date: l.date }))
  const out: ConsultStackItem[] = []
  for (const g of groups.values()) {
    const v = auditSupplement(g.name, auditLabs, genetics, { medications, today, dosage: g.doses[0] ?? null })
    const e = supplementEffect(g.name, auditLabs, g.started)
    let effect: string | null = null
    if (e) {
      if (e.after && e.before) effect = `${e.marker}：開始吃前 ${round(e.before.value)}（${e.before.date}）→ 之後 ${round(e.after.value)}（${e.after.date}）`
      else if (e.after) effect = `${e.marker}：吃了之後 ${round(e.after.value)}（${e.after.date}），開始前沒有數字可比`
      else effect = `${e.marker}：${g.started} 開始吃之後還沒驗過，${nextDate} 抽血時看有沒有效`
    }
    out.push({ name: g.name, dose: g.doses.join('；'), status: v.status, basis: v.basis, effect })
  }
  return out.sort((a, b) => STACK_ORDER[a.status] - STACK_ORDER[b.status])
}

/**
 * 目標一律從唯一標準檔（utils/labStatus.ts）讀：有「最佳」就寫「最佳（正常 X）」，沒有就寫正常範圍。
 * 2026-10-03 起因：營養引擎把「正常上限」寫成「（最佳）」——同半胱胺酸寫 <8（最佳），標準檔是正常 ≤8、最佳 <6；
 * 空腹血糖寫 <90（最佳），標準檔是正常 ≤90、最佳 <80。同一項在兩張卡出現兩個目標。
 */
export function standardTarget(testName: string, gender?: '男性' | '女性'): string | null {
  const lookup = gender === '女性' && FEMALE_VARIANTS.includes(testName) ? `${testName}_female` : testName
  const t = (LAB_THRESHOLDS as Record<string, { normal: number | { min: number; max: number } }>)[lookup]
  if (!t) return null
  const normal = typeof t.normal === 'object'
    ? `${t.normal.min}-${t.normal.max}`
    : HIGHER_IS_BETTER.has(lookup) ? `≥${t.normal}` : `≤${t.normal}`
  const optimal = getOptimalRangeText(testName, gender)
  return optimal ? `${optimal}（正常 ${normal}）` : `正常 ${normal}`
}

/** 每一項血檢要做什麼：營養引擎＋補品引擎，按血檢項目合併。只收「要處理的」（正向、跟血檢無關的補品不收） */
export function buildConsultActions(
  advice: LabNutritionAdvice[],
  supplements: SupplementSuggestion[],
  retestDate: string,
  watchNames: string[] = [],
  latest: Map<string, { value: number; unit: string | null }> = new Map(),
  opts: { gender?: '男性' | '女性'; medications?: ClientMedication[] | null; drawDate?: string } = {},
): ConsultAction[] {
  const byKey = new Map<string, ConsultAction>()
  const keyOf = (name: string) => getLabCanonicalId(name) ?? name
  for (const a of advice) {
    if (a.severity === 'positive') continue
    const k = keyOf(a.labMarker)
    const doThis = [...a.dietaryChanges]
    if (a.foodsToIncrease.length) doThis.push(`多吃：${a.foodsToIncrease.slice(0, 4).join('、')}`)
    if (a.foodsToReduce.length) doThis.push(`少吃：${a.foodsToReduce.slice(0, 4).join('、')}`)
    const prev = byKey.get(k)
    if (prev) { prev.doThis.push(...doThis); continue }
    byKey.set(k, {
      name: a.labMarker, value: round(a.currentValue), unit: a.unit || null, target: a.targetRange || null,
      title: a.title, doThis, supplements: [], retestDate,
    })
  }
  for (const sup of supplements) {
    if (sup.category === 'performance' || sup.triggerTests.length === 0) continue
    const k = keyOf(sup.triggerTests[0])
    const item = { name: sup.name, dosage: sup.dosage, timing: sup.timing, reason: sup.reason }
    const prev = byKey.get(k)
    if (prev) { prev.supplements.push(item); continue }
    const lv = latest.get(k)
    byKey.set(k, {
      name: sup.triggerTests[0], value: lv ? round(lv.value) : null, unit: lv?.unit ?? null, target: null,
      title: sup.name, doThis: [], supplements: [item], retestDate,
    })
  }
  const watchKeys = new Set(watchNames.map(keyOf))
  return [...byKey.entries()]
    .sort(([a], [b]) => Number(watchKeys.has(b)) - Number(watchKeys.has(a)))
    .map(([k, v]) => {
      // 肌酸酐／eGFR：引擎沒先講肌肉量時才補一句（重訓者的 eGFR 建議引擎自己會講）
      const muscle = [...MUSCLE_SENSITIVE].some(m => keyOf(m) === k)
      const engineSaysMuscle = v.doThis.some(d => d.includes('肌肉量'))
      const addMuscle = muscle && !engineSaysMuscle
      const doThis = [...new Set(v.doThis)].slice(0, addMuscle ? 2 : 3)
      if (addMuscle) doThis.unshift('先看訓練：肌肉量大或有補充肌酸時，肌酸酐會偏高、eGFR 會算得偏低')
      return {
        ...v,
        doThis,
        target: standardTarget(v.name, opts.gender) ?? v.target,
        medNote: medicationNoteFor(v.name, opts.medications, opts.drawDate),
      }
    })
}

const EMPTY_ROWS = { weights: [], nutrition: [], training: [], wellness: [] }

const toGender = (g?: string | null): '男性' | '女性' | undefined => (g === '男性' || g === '女性' ? g : undefined)

const dayDiff = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000)

/** YYYY-MM-DD 加 N 個月；月底溢位就停在該月最後一天（1/31 + 1 個月 = 2/28） */
export function addMonths(date: string, months: number): string {
  const [y, m, d] = date.split('-').map(Number)
  const targetMonthIdx = m - 1 + months
  const ty = y + Math.floor(targetMonthIdx / 12)
  const tm = ((targetMonthIdx % 12) + 12) % 12
  const lastDay = new Date(Date.UTC(ty, tm + 1, 0)).getUTCDate()
  const out = new Date(Date.UTC(ty, tm, Math.min(d, lastDay)))
  return out.toISOString().slice(0, 10)
}

/**
 * 下次抽血的白話項目名（canonical ID → 學員看得懂的名字）。
 * ⚠️ HOMA-IR 不能寫「胰島素阻抗」—— 那是 compliance-scrub 的病名清單。
 */
const PLAIN_LABEL: Record<string, string> = {
  testosterone: '總睪固酮',
  free_testosterone: '游離睪固酮',
  bioavailable_testosterone: '生物可利用睪固酮',
  shbg: 'SHBG（性荷爾蒙結合球蛋白）',
  estradiol: '雌二醇',
  prolactin: '泌乳素',
  dheas: 'DHEA-S',
  cortisol: '皮質醇',
  homocysteine: '同半胱胺酸',
  vitamin_b12: '維生素 B12',
  folate: '葉酸',
  vitamin_d: '維生素 D',
  homa_ir: '空腹胰島素＋空腹血糖',
  fasting_insulin: '空腹胰島素',
  fasting_glucose: '空腹血糖',
  hba1c: '糖化血色素 HbA1c',
  apob: 'ApoB（載脂蛋白 B）',
  lpa: 'Lp(a)',
  apoe: 'ApoE 基因型',
  ldl: '低密度膽固醇 LDL',
  hdl: '高密度膽固醇 HDL',
  total_cholesterol: '總膽固醇',
  triglyceride: '三酸甘油酯',
  ast: '肝指數 AST',
  alt: '肝指數 ALT',
  ggt: 'GGT',
  albumin: '白蛋白',
  creatinine: '肌酸酐',
  egfr: '腎絲球過濾率 eGFR',
  cystatin_c: '胱抑素 C（Cystatin C）',
  bun: '尿素氮 BUN',
  uric_acid: '尿酸',
  tsh: '甲狀腺刺激素 TSH',
  free_t4: '游離甲狀腺素 Free T4',
  free_t3: '游離 T3',
  ferritin: '鐵蛋白',
  hemoglobin: '血紅素',
  crp: 'C 反應蛋白 CRP',
  magnesium: '鎂',
  zinc: '鋅',
  omega3: 'Omega-3 指數',
}

/** 公版那種「Testosterone 總睪固酮」「Apo B (外送大安聯合)」→ 白話名；對不到就砍括號註記、有中文只留中文詞 */
export function plainLabel(raw: string, canonicalId: string | null): string {
  if (canonicalId && PLAIN_LABEL[canonicalId]) return PLAIN_LABEL[canonicalId]
  const cleaned = raw.replace(/[（(][^）)]*[）)]/g, ' ').replace(/\s+/g, ' ').trim()
  const cjk = cleaned.split(' ').filter(t => /[一-龥]/.test(t))
  return cjk.length ? cjk.join(' ') : cleaned
}

/** 下次抽血「為什麼驗」—— 自己寫白話，不沿用引擎給教練看的 why（裡面有「沒錢可以晚一輪」這類開單語言） */
const NEXT_WHY: Partial<Record<OrderRule, string>> = {
  'follow-up': '還不在理想範圍，追蹤變化',
  companion: '要跟其他項目同一管血，一起算才準',
  'risk-linked': '跟你其他結果一起看才完整',
  'never-tested': '還沒有你自己的基準值',
  stale: '很久沒驗了，補一個新的點',
  'out-of-range': '這次超出範圍，看有沒有回來',
  'muscle-check': '不受肌肉量影響，確認肌酸酐／eGFR 偏低是不是肌肉造成的',
}

const ANSWER_TEXT: Record<ConsultAnswer['status'], string> = {
  confirmed: '猜對了：方向對、也到目標',
  partial: '方向對，還沒到目標',
  no_change: '還沒看到明顯變化',
  refuted: '方向不如預期，教練會一起調整做法',
}

/** 常被訓練影響的指標：抽血前幾天練大重量會暫時升高（lib/lab-prep.ts 同一組依據，Pettersson 2008） */
const EXERCISE_SENSITIVE = new Set(['AST', 'ALT', 'CPK', 'LDH'])
/** 肌肉量／肌酸補充會拉高肌酸酐、讓用它算的 eGFR 偏低（同 longevity-lens 學員分組說明） */
const MUSCLE_SENSITIVE = new Set(['肌酸酐', 'eGFR'])

const round = (n: number) => (Math.abs(n) >= 100 ? Math.round(n * 10) / 10 : Math.round(n * 100) / 100)

function latestByKey(labs: LabResultRow[]): Map<string, { value: number; unit: string | null }> {
  const m = new Map<string, { value: number; unit: string | null; date: string }>()
  for (const l of labs) {
    const v = typeof l.value === 'string' ? parseFloat(l.value) : l.value
    const k = getLabCanonicalId(l.test_name) ?? l.test_name
    const prev = m.get(k)
    if (!prev || l.date > prev.date) m.set(k, { value: v, unit: l.unit ?? null, date: l.date })
  }
  return m
}

export function buildLabConsult(input: LabConsultInput): LabConsult | null {
  const { labs, today, hypotheses = [], templateItems } = input
  const gender = toGender(input.gender)
  const valid = labs.filter(l => l.test_name && l.date && Number.isFinite(typeof l.value === 'string' ? parseFloat(l.value) : l.value))
  if (valid.length === 0) return null

  const drawDate = valid.reduce((m, l) => (l.date > m ? l.date : m), valid[0].date)
  const daysSinceDraw = dayDiff(drawDate, today)
  const drawCount = new Set(valid.filter(l => l.date === drawDate).map(l => l.test_name)).size

  // ── 這次重點：只看這次有抽到、有上一次可比的指標；RCV 判真變化 ──
  const byName: Record<string, LabPoint[]> = {}
  for (const l of valid) {
    const v = typeof l.value === 'string' ? parseFloat(l.value) : l.value
    ;(byName[l.test_name] ??= []).push({ date: l.date, value: v, unit: l.unit ?? null })
  }

  const better: ConsultChange[] = []
  const worse: ConsultChange[] = []
  const shiftedInRange: ConsultChange[] = []
  let noiseCount = 0
  for (const name of Object.keys(MARKERS)) {
    const points = byName[name]
    if (!points) continue
    const story = buildMarkerStory(name, points, EMPTY_ROWS, today, gender)
    if (!story.latest || story.latest.date !== drawDate || !story.change) continue
    if (story.change.verdict === 'noise') { noiseCount++; continue }
    const item: ConsultChange = {
      name,
      from: round(story.change.from.value),
      to: round(story.change.to.value),
      unit: story.latest.unit ?? null,
      pct: Math.round(story.change.pctChange),
      rcvPct: Math.round(story.change.rcvPct),
    }
    if (story.direction === 'better') better.push(item)
    else if (story.direction === 'worse') worse.push(item)
    else shiftedInRange.push(item)
  }
  const byMagnitude = (a: ConsultChange, b: ConsultChange) => Math.abs(b.pct) - Math.abs(a.pct)
  better.sort(byMagnitude); worse.sort(byMagnitude); shiftedInRange.sort(byMagnitude)

  // ── 要留意／已經很好：analyzeLabs，只看這次抽到的 ──
  const findings = analyzeLabs(valid, { gender }).filter(f => f.latestDate === drawDate)
  const flagged = findings.filter(f => f.severity === 'critical' || f.severity === 'attention')
  const watch: ConsultWatch[] = flagged.map(f => {
    const dir = getLabDirection(f.testName, f.latestValue, gender)
    // 用數字本身落在哪（alert＝超出標準）決定口氣；analyzeLabs 的 critical 還包含「跨進注意範圍」，那不等於超標
    const level: ConsultWatch['level'] = f.latestStatus === 'alert' ? 'high' : 'watch'
    let note = level === 'high'
      ? '超出標準範圍，建議帶這份報告跟醫師討論'
      : '落在需要注意的範圍，下次抽血追蹤有沒有回來'
    if (EXERCISE_SENSITIVE.has(f.testName)) note += '；抽血前 1–3 天練大重量會讓它暫時升高，下次抽血前 48 小時別練大重量'
    if (MUSCLE_SENSITIVE.has(f.testName)) note += '；肌肉量大或有補充肌酸時，肌酸酐會偏高、eGFR 會算得偏低，要跟訓練一起看'
    return {
      name: f.testName,
      value: round(f.latestValue),
      unit: f.unit,
      level,
      side: dir === 'normal' ? null : dir,
      idealText: f.optimalText,
      note,
    }
  })
  // 系統沒設判讀標準的指標（CPK、LDH、澱粉酶、CBC 細項…）：analyzeLabs 刻意略過它們（免得整張報告被灌成黃燈），
  // 但超出檢驗所自己印的範圍就該讓人看到（2026-10-02：Howard CPK 397／範圍 46–171 原本完全沒出現）。
  // 不發明門檻，只照檢驗所範圍；一律 watch 等級，不說「超標」。
  for (const l of valid) {
    if (l.date !== drawDate || l.test_name in LAB_THRESHOLDS) continue
    if (watch.some(w => w.name === l.test_name)) continue
    const v = typeof l.value === 'string' ? parseFloat(l.value) : l.value
    const side = sideFromReferenceRange(v, l.reference_range)
    if (!side) continue
    let note = '照檢驗所報告的範圍判斷；下次抽血追蹤有沒有回來'
    if (EXERCISE_SENSITIVE.has(l.test_name)) note += '；抽血前 1–3 天練大重量會讓它暫時升高，下次抽血前 48 小時別練大重量'
    watch.push({
      name: l.test_name,
      value: round(v),
      unit: l.unit ?? null,
      level: 'watch',
      side,
      idealText: null,
      labRangeText: String(l.reference_range).trim(),
      note,
    })
  }
  // 正在吃的藥會拉高的項目：「要留意」那行補一句（A 酸 → CK、肝指數、血脂）
  for (const w of watch) {
    const med = medicationNoteFor(w.name, input.medications, drawDate)
    if (med) w.note += `；${med}`
  }
  for (const w of worse) {
    const med = medicationNoteFor(w.name, input.medications, drawDate)
    if (med) w.medNote = med
  }
  // 同時在「變差」的，那行標出「落在要留意的範圍」；「要留意」照列（那裡才有該怎麼做）
  for (const w of worse) if (watch.some(x => x.name === w.name)) w.outOfRange = true
  for (const w of worse) {
    if (EXERCISE_SENSITIVE.has(w.name)) w.hint = '抽血前 1–3 天練大重量會讓它暫時升高，下次抽血前 48 小時別練大重量再對一次'
    else if (MUSCLE_SENSITIVE.has(w.name)) w.hint = '肌肉量大或有補充肌酸會影響這項，要跟訓練一起看'
  }

  const goodFindings = findings.filter(f => f.severity === 'optimal')
  const good = { count: goodFindings.length, names: goodFindings.slice(0, GOOD_NAMES_SHOWN).map(f => f.testName) }

  // ── 預測對答案：被這次結果判決的 ──
  const answered: ConsultAnswer[] = []
  for (const h of hypotheses) {
    const g = gradeHypothesis(h, byName[h.marker] ?? [], today, gender)
    if (!g.result || g.result.date !== drawDate) continue
    if (g.status === 'pending' || g.status === 'overdue') continue
    const dirText = h.expected_direction === 'up' ? '回升' : h.expected_direction === 'down' ? '下降' : '維持'
    const target = h.expected_value != null ? ` ${h.expected_direction === 'down' ? '≤' : '≥'} ${h.expected_value}` : ''
    answered.push({
      marker: h.marker,
      expected: h.expected_direction === 'stable' ? '維持不變' : `${dirText}${target}`,
      baseline: round(Number(h.baseline_value)),
      result: round(g.result.value),
      status: g.status,
      verdict: ANSWER_TEXT[g.status],
    })
  }

  // ── 下次抽血 ──
  const hasIssue = watch.length > 0
  const months = hasIssue ? RETEST_MONTHS_WITH_ISSUE : RETEST_MONTHS_CLEAN
  const reason = hasIssue
    ? `有 ${watch.length} 項要留意，${months} 個月後回來看有沒有改善`
    : `這次沒有要留意的項目，${months} 個月後再追蹤就好`

  const items: ConsultNextItem[] = []
  const seen = new Set<string>()
  const push = (label: string, id: string | null, why: string) => {
    const key = id ?? label
    if (seen.has(key)) return
    seen.add(key)
    items.push({ label, why })
  }
  // 下次驗什麼只有一個來源：開單引擎（lib/lab-order.ts）。Cystatin C、公版沒列的超範圍項目都在那裡加，
  // 學員抽血單／回檢邀請／教練開單看到的是同一份（2026-10-09 統一）。
  // 顯示順序：Cystatin C（決定肌酸酐那條要不要擔心）→ 這次要留意的 → 其餘必驗 → 可延後
  const plan = buildLabOrder({ labs: valid, templateItems: templateItems ?? [], gender, today, resistanceTrained: input.resistanceTrained })
  const pushLine = (l: (typeof plan.must)[number]) => push(plainLabel(l.label, l.canonicalId), l.canonicalId, NEXT_WHY[l.rule] ?? '補齊你的基準值')
  plan.must.filter(l => l.rule === 'muscle-check').forEach(pushLine)
  for (const w of watch) {
    const id = getLabCanonicalId(w.name)
    push(plainLabel(w.name, id), id, '這次要留意，看有沒有回來')
  }
  plan.must.filter(l => l.rule !== 'muscle-check').forEach(pushLine)
  plan.defer.slice(0, DEFER_SHOWN).forEach(pushLine)

  return {
    drawDate,
    daysSinceDraw,
    fresh: daysSinceDraw >= 0 && daysSinceDraw <= CONSULT_FRESH_DAYS,
    drawCount,
    better,
    worse,
    shiftedInRange,
    noiseCount,
    watch,
    good,
    answered,
    stack: buildStack(
      input.currentSupplements ?? [], valid, input.genetics,
      input.scheduledCheckup && input.scheduledCheckup > drawDate ? input.scheduledCheckup : addMonths(drawDate, months),
      input.medications ?? null, today,
    ),
    actions: buildConsultActions(
      input.advice ?? [], input.supplements ?? [],
      input.scheduledCheckup && input.scheduledCheckup > drawDate ? input.scheduledCheckup : addMonths(drawDate, months),
      watch.map(w => w.name),
      latestByKey(valid),
      { gender, medications: input.medications, drawDate },
    ),
    // 教練已排好、而且在這次抽血之後的日期優先（原本顯示「建議 12/30」，同一張卡的補品段卻寫 1/16 驗收）
    next: input.scheduledCheckup && input.scheduledCheckup > drawDate
      ? { date: input.scheduledCheckup, months, reason: hasIssue ? `已排定；有 ${watch.length} 項要留意，到時看有沒有改善` : '已排定；這次沒有要留意的項目，到時追蹤就好', items }
      : { date: addMonths(drawDate, months), months, reason, items },
  }
}

/**
 * 要不要自動把 clients.next_checkup_date 設成建議日期。
 * 只在：這次抽血夠新（fresh）、而且原本沒排或排的日期早於這次抽血（＝已經過去、這次就是那一次）。
 * **教練排在這次抽血之後的日期一律不動。**
 */
export function shouldAutoSetNextCheckup(current: string | null | undefined, consult: Pick<LabConsult, 'drawDate' | 'fresh' | 'next'> | null): string | null {
  if (!consult || !consult.fresh) return null
  if (current && current >= consult.drawDate) return null
  return consult.next.date
}

const fmtN = (n: number) => String(n)
const u = (unit: string | null) => (unit ? ` ${unit}` : '')

/**
 * 純文字版（測試、PR 範例、之後要推 LINE 也能直接用）。畫面上的卡片用同一份資料排版。
 */
export function renderLabConsultText(c: LabConsult): string {
  const out: string[] = []
  out.push(`這次血檢重點（${c.drawDate} 抽血，共 ${c.drawCount} 項）`)
  out.push('')
  out.push('【跟你上一次比，真的有變的】')
  if (c.better.length + c.worse.length + c.shiftedInRange.length === 0) {
    out.push('・沒有超過正常波動的變化')
  }
  for (const x of c.better) out.push(`・變好｜${x.name} ${fmtN(x.from)} → ${fmtN(x.to)}${u(x.unit)}（${x.pct > 0 ? '+' : ''}${x.pct}%）`)
  for (const x of c.worse) out.push(`・變差｜${x.name} ${fmtN(x.from)} → ${fmtN(x.to)}${u(x.unit)}（${x.pct > 0 ? '+' : ''}${x.pct}%）${x.outOfRange ? '，而且落在要留意的範圍' : ''}${x.hint ? `——${x.hint}` : ''}${x.medNote ? `；${x.medNote}` : ''}`)
  for (const x of c.shiftedInRange) out.push(`・有變動但都在很好的範圍｜${x.name} ${fmtN(x.from)} → ${fmtN(x.to)}${u(x.unit)}（${x.pct > 0 ? '+' : ''}${x.pct}%）`)
  if (c.noiseCount > 0) out.push(`・另外 ${c.noiseCount} 項有上下，但在你自己的正常波動內，不用放心上`)

  out.push('')
  out.push('【要留意】')
  if (c.watch.length === 0) out.push('・這次沒有')
  for (const w of c.watch) {
    const side = w.side === 'high' ? '偏高' : w.side === 'low' ? '偏低' : ''
    out.push(`・${w.name} ${fmtN(w.value)}${u(w.unit)}${side ? ` ${side}` : ''}${w.idealText ? `（理想 ${w.idealText}）` : ''}${w.labRangeText ? `（檢驗所範圍 ${w.labRangeText}）` : ''}：${w.note}`)
  }
  if (c.actions.length) {
    out.push('', '【接下來怎麼做】（做到下次抽血，那次看有沒有到目標）')
    for (const a of c.actions) {
      const tail = [...a.doThis, ...a.supplements.map(sp => `${sp.name.replace(/^⚠️\s*/, '')}：${sp.dosage}`)].join('；')
      out.push(`・${a.name}：${a.medNote ? `${a.medNote}；` : ""}${tail}`)
    }
  }

  if (c.stack.length) {
    const label: Record<string, string> = { caution: '要注意', 'no-indication': '沒有血檢依據', indicated: '有血檢依據', lifestyle: '生活型' }
    out.push('', '【你在吃的保健品】')
    for (const x of c.stack) out.push(`・${x.name}（${label[x.status]}）：${x.basis}${x.effect ? `｜${x.effect}` : ''}`)
  }
  out.push('')
  out.push('【已經很好】')
  out.push(c.good.count > 0
    ? `・${c.good.count} 項在理想範圍：${c.good.names.join('、')}${c.good.count > c.good.names.length ? ' 等' : ''}`
    : '・這次沒有落在理想範圍的項目（或這些項目還沒有理想範圍可比）')

  if (c.answered.length > 0) {
    out.push('')
    out.push('【預測對答案】')
    for (const a of c.answered) out.push(`・${a.marker}：預測${a.expected}，${fmtN(a.baseline)} → ${fmtN(a.result)}，${a.verdict}`)
  }

  out.push('')
  out.push('【下次抽血】')
  out.push(`・建議 ${c.next.date} 左右（${c.next.reason}）`)
  if (c.next.items.length > 0) {
    out.push('・建議驗：')
    for (const i of c.next.items) out.push(`  - ${i.label}：${i.why}`)
  } else {
    out.push('・要驗哪些，抽血前跟教練確認')
  }
  out.push('')
  out.push('這是追蹤與教育用途，不是醫療診斷；數字有疑慮請與醫師討論。')
  return out.join('\n')
}
