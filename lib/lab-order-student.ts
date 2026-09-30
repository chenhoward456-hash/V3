/**
 * 學員版「下次抽血」：把減法開單引擎的結果翻成「去診間怎麼講」。
 *
 * ## 為什麼有這支（2026-10-01）
 *
 * 原本學員卡直接吐檢驗所套餐：底盤 3600、每項價格、「必開／有錢再加／省」。
 * Howard：「給學員看超怪」——像在推銷檢驗所。學員真正要的是：
 * 去看哪一科、進診間怎麼跟醫生說、請醫生開哪幾項、抽血前怎麼準備、報告拿到後做什麼。
 *
 * 這支只做「呈現翻譯」，**不動引擎判斷**：哪些要驗、哪些不用，一律照 buildLabOrder。
 * 教練端（/admin 開單、晨報）仍用原本帶價格的版本。
 *
 * ⚠️ 學員看得到的每一句都不准有：價格、「底盤」、分級用語、病名、藥名
 * （tests/lib/lab-order-student.test.ts 釘住，並跑 scanMedicalCompliance）。
 * 例：「胰島素阻抗」在 compliance-scrub 的病名清單裡，所以 HOMA-IR 寫成「胰島素敏感度」。
 */
import { resolveMarkerId } from '@/lib/lab-order'
import { isMedicallyCompliant } from '@/lib/compliance-scrub'

export interface StudentLabProfile {
  age?: number | null
  gender?: string | null
  goalType?: string | null
  trainingEnabled?: boolean | null
}

/** API（/api/lab-order）回來、學員卡用得到的那幾欄 */
export interface StudentLabOrderInput {
  must?: { label: string }[]
  defer?: { label: string }[]
  basePackage?: { skippable: boolean } | null
  prepNotes?: string | null
}

export interface PlainLabItem {
  name: string
  why: string
  /** true＝引擎判「可延後」的項目，學員端標「可一起驗」，不講錢 */
  optional: boolean
}

export interface StudentLabVisit {
  department: string
  script: string
  items: PlainLabItem[]
  selfPayNote: string
  prepNotes: string[]
  reportQuestions: string[]
}

export const DEPARTMENT = '新陳代謝科（診所或醫院都可以）'
export const SELF_PAY_NOTE = '有些項目醫生可能會說要自費，問清楚價格再決定。'
/** 看報告回診時可以問醫生的（通用、不做判讀） */
export const REPORT_QUESTIONS = [
  '哪幾項不在參考範圍內？需要追蹤嗎？',
  '跟上次比，哪些有變化？',
  '這些數字建議多久再驗一次？',
]
/** 引擎「可延後」的項目最多帶幾項進清單（太長學員不會唸） */
export const MAX_OPTIONAL = 3

/** 一般健檢會做的常規抽血（引擎判斷這次該開時才列） */
export const ROUTINE_ITEM: PlainLabItem = {
  name: '一般抽血：肝腎功能、血脂、血糖、血球',
  why: '基本盤，先確認肝腎、血脂、血糖都在正常範圍',
  optional: false,
}

type Entry = { name: string; why: string }

/** canonical ID → 白話名＋一句為什麼 */
const BY_ID: Record<string, Entry> = {
  testosterone: { name: '總睪固酮', why: '看荷爾蒙底子，跟訓練恢復、長肌肉有關' },
  free_testosterone: { name: '游離睪固酮', why: '身體真正用得到的那一部分睪固酮' },
  shbg: { name: 'SHBG（性荷爾蒙結合球蛋白）', why: '要跟總睪固酮同一管血，才算得出能用的睪固酮' },
  albumin: { name: '白蛋白', why: '算游離睪固酮會用到' },
  estradiol: { name: '雌二醇（E2）', why: '男女都有，看跟睪固酮之間的平衡' },
  dheas: { name: 'DHEA-S', why: '腎上腺分泌的荷爾蒙，看壓力和荷爾蒙底子' },
  prolactin: { name: '泌乳激素', why: '偏高會壓到睪固酮和月經週期' },
  free_t3: { name: '游離 T3（甲狀腺）', why: '甲狀腺荷爾蒙，跟代謝速度有關' },
  free_t4: { name: '游離 T4（甲狀腺）', why: '跟 T3 一起看甲狀腺的狀態' },
  tsh: { name: 'TSH（甲狀腺刺激素）', why: '看甲狀腺的整體調控' },
  homocysteine: { name: '同半胱胺酸', why: '跟 B 群代謝、血管健康有關' },
  homa_ir: { name: '空腹胰島素＋空腹血糖（算 HOMA-IR 胰島素敏感度）', why: '看身體處理醣類的效率' },
  fasting_insulin: { name: '空腹胰島素', why: '跟空腹血糖一起看身體處理醣類的效率' },
  fasting_glucose: { name: '空腹血糖', why: '跟空腹胰島素一起看身體處理醣類的效率' },
  vitamin_d: { name: '維生素 D', why: '跟骨骼、免疫、荷爾蒙都有關' },
  ferritin: { name: '鐵蛋白', why: '身體的鐵存量，影響體力和恢復' },
  vitamin_b12: { name: '維生素 B12', why: '造血和神經都需要' },
  folate: { name: '葉酸', why: '跟 B12、同半胱胺酸一起看 B 群狀態' },
  magnesium: { name: '鎂', why: '肌肉、睡眠、恢復都用得到' },
  apob: { name: 'ApoB', why: '比 LDL 更直接看血管裡的壞膽固醇顆粒有多少' },
  apoe: { name: 'ApoE 基因型', why: '一輩子驗一次就好，看血脂代謝的體質' },
  lpa: { name: 'Lp(a)', why: '大多由基因決定，驗一次知道自己的底' },
}

/** 引擎對不回 canonical 的公版項目（女性荷爾蒙、鐵、甲狀腺抗體），用關鍵字補 */
const BY_KEYWORD: { re: RegExp; entry: Entry }[] = [
  { re: /progesterone|黃體素|黃體脂酮|黃體酮/i, entry: { name: '黃體素', why: '看月經週期後半段的荷爾蒙' } },
  { re: /\bLH\b|黃體成(長)?激素/i, entry: { name: 'LH（黃體生成素）', why: '腦下垂體發給卵巢／睪丸的訊號' } },
  { re: /\bFSH\b|濾泡刺激素/i, entry: { name: 'FSH（濾泡刺激素）', why: '跟 LH 一起看荷爾蒙的調控' } },
  { re: /\bAMH\b|抗穆勒氏管/i, entry: { name: 'AMH（抗穆勒氏管荷爾蒙）', why: '看卵巢的庫存量' } },
  { re: /anti-?\s*TPO|抗甲狀腺過氧化酶/i, entry: { name: '甲狀腺抗體（Anti-TPO）', why: '跟 T3、T4 一起看甲狀腺' } },
  { re: /TIBC|總鐵結合/i, entry: { name: '血清鐵＋總鐵結合能力（TIBC）', why: '跟鐵蛋白一起看鐵夠不夠' } },
]

/**
 * 公版／引擎的項目名（"Testosterone 總睪固酮"、"Apo B (外送大安聯合)"）→ 白話名＋為什麼。
 * 對不到的：砍掉括號註記（外送、檢驗所名），有中文就只留中文，why 留空。
 */
export function plainLabItem(label: string): Entry {
  const id = resolveMarkerId(label)
  if (id && BY_ID[id]) return BY_ID[id]
  for (const k of BY_KEYWORD) if (k.re.test(label)) return k.entry
  const cleaned = label.replace(/[（(][^）)]*[）)]/g, ' ').replace(/\s+/g, ' ').trim()
  const cjk = cleaned.match(/[一-鿿][一-鿿\s0-9A-Za-z-]*/)
  return { name: (cjk ? cjk[0] : cleaned).trim() || label, why: '' }
}

const GOAL_TEXT: Record<string, string> = {
  cut: '在減脂',
  bulk: '在增肌',
  recomp: '在減脂同時增肌',
}

/**
 * 「進診間可以這樣說」的第一人稱範本。
 * 資料有什麼用什麼；一項都沒有就回不含數字的通用版。
 */
export function buildDoctorScript(p: StudentLabProfile): string {
  const who: string[] = []
  if (p.age != null && Number.isFinite(p.age) && p.age > 0) who.push(`今年 ${Math.round(p.age)} 歲`)
  if (p.gender === '男性' || p.gender === '女性') who.push(p.gender)

  const doing: string[] = []
  const goal = p.goalType ? GOAL_TEXT[p.goalType] : undefined
  if (goal) doing.push(`最近${goal}`)
  if (p.trainingEnabled) doing.push('有固定做重量訓練')

  if (who.length === 0 && doing.length === 0) {
    return '醫生您好，我最近在調整飲食和訓練，想了解自己的荷爾蒙、代謝和營養狀況，想請醫生幫我安排抽血。'
  }
  const parts = ['醫生您好']
  if (who.length) parts.push(`我${who.join('、')}`)
  if (doing.length) parts.push(`${who.length ? '' : '我'}${doing.join('，')}`)
  return `${parts.join('，')}。想了解自己的荷爾蒙、代謝和營養狀況，追蹤身體有沒有照計畫在走，想請醫生幫我安排抽血。`
}

/** 公版的抽血前注意事項給學員看：拿掉 ⚠️、把「MC」「panel」這種內部簡寫換成白話，過合規 */
export function cleanPrepNotes(raw: string | null | undefined): string[] {
  if (!raw) return []
  return raw
    .split('\n')
    .map(t => t
      .replace(/⚠️\s*/g, '')
      .replace(/\bMC\s*/g, '月經')
      .replace(/賀爾蒙/g, '荷爾蒙')
      .replace(/\s*panel\s*/gi, '項目')
      .replace(/\s*morning peak/gi, '早上濃度最高')
      .trim())
    .filter(t => t && isMedicallyCompliant(t))
}

export function buildStudentLabVisit(d: StudentLabOrderInput, profile: StudentLabProfile): StudentLabVisit {
  const items: PlainLabItem[] = []
  const seen = new Set<string>()
  const add = (e: Entry, optional: boolean) => {
    if (seen.has(e.name)) return
    seen.add(e.name)
    items.push({ name: e.name, why: isMedicallyCompliant(e.why) ? e.why : '', optional })
  }

  if (d.basePackage && !d.basePackage.skippable) add(ROUTINE_ITEM, false)
  for (const l of d.must ?? []) add(plainLabItem(l.label), false)
  for (const l of (d.defer ?? []).slice(0, MAX_OPTIONAL)) add(plainLabItem(l.label), true)

  return {
    department: DEPARTMENT,
    script: buildDoctorScript(profile),
    items,
    selfPayNote: SELF_PAY_NOTE,
    prepNotes: cleanPrepNotes(d.prepNotes),
    reportQuestions: REPORT_QUESTIONS,
  }
}

/** 「複製給醫生看」的純文字（也是測試檢查學員端輸出的單一出口） */
export function visitToText(v: StudentLabVisit): string {
  return [
    `建議掛：${v.department}`,
    '',
    v.script,
    '',
    '想請醫生幫我驗：',
    ...v.items.map(i => `・${i.name}${i.optional ? '（可一起驗）' : ''}`),
  ].join('\n')
}
