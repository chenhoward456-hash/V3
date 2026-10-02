import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  personalReason,
  plainLabItem, buildDoctorScript, buildStudentLabVisit, cleanPrepNotes, visitToText,
  DEPARTMENT, ROUTINE_ITEM, MAX_OPTIONAL, type StudentLabVisit,
} from '@/lib/lab-order-student'
import { buildLabOrder, type TemplateItem } from '@/lib/lab-order'
import { scanMedicalCompliance } from '@/lib/compliance-scrub'

/**
 * 學員版「下次抽血」契約：學員看到的是「去診間怎麼講」，不是檢驗所套餐。
 * Howard 2026-10-01：價格／底盤／有錢再加 給學員看「超怪」，像在推銷檢驗所。
 */

// 正式環境男/女目標導向公版的項目名（2026-10-01 從 lab_panel_templates 唯讀查得）
const MALE_NAMES = ['Testosterone 總睪固酮', 'Free Testosterone 游離睪固酮', 'Estradiol E2 雌激素', 'DHEA-S', 'Prolactin 催乳激素', 'Free T3', 'Free T4', 'Homocysteine 同半胱胺酸', 'HOMA-IR (Insulin + Glucose)', '25-OH Vitamin D Total', 'Ferritin 鐵蛋白', 'Vitamin B12', 'Folate 葉酸', 'Mg 鎂', 'Apo B (外送大安聯合)']
const FEMALE_EXTRA = ['Progesterone P4 黃體脂酮', 'LH 黃體成激素', 'FSH 濾泡刺激素', 'Anti-TPO 抗甲狀腺過氧化酶', 'Iron + TIBC', 'AMH 抗穆勒氏管荷爾蒙', 'Apo B (外送)']
const ALL_NAMES = [...MALE_NAMES, ...FEMALE_EXTRA]

const PREP = '抽血前 8 小時空腹（可喝水）\n⚠️ MC 第 2-3 天抽血（賀爾蒙 panel 必須）\n抽血前 24 小時：不訓練、不喝酒'

/** 學員端不准出現的字：價格、套餐、分級 */
const FORBIDDEN = /底盤|套餐|元|NT\$|\$|有錢再加|有預算|省|必開|必驗|沒錢|問價/

const allText = (v: StudentLabVisit) =>
  [visitToText(v), v.selfPayNote, ...v.items.map(i => i.why), ...v.prepNotes, ...v.reportQuestions].join('\n')

describe('plainLabItem：公版混寫 → 白話項目名', () => {
  it('例子照 Howard 給的', () => {
    expect(plainLabItem('Testosterone 總睪固酮').name).toBe('總睪固酮')
    expect(plainLabItem('HOMA-IR (Insulin + Glucose)').name).toBe('空腹胰島素＋空腹血糖（算 HOMA-IR 胰島素敏感度）')
    expect(plainLabItem('Apo B (外送大安聯合)').name).toBe('ApoB')
    expect(plainLabItem('Apo B (外送)').name).toBe('ApoB')
  })

  it('游離睪固酮不能被吃成總睪固酮；ApoB 跟 ApoE 分開', () => {
    expect(plainLabItem('Free Testosterone 游離睪固酮').name).toBe('游離睪固酮')
    expect(plainLabItem('Apo E genotyping').name).toBe('ApoE 基因型')
  })

  it('常見項目都翻成中文', () => {
    expect(plainLabItem('25-OH Vitamin D Total').name).toBe('維生素 D')
    expect(plainLabItem('Mg 鎂').name).toBe('鎂')
    expect(plainLabItem('Prolactin 催乳激素').name).toBe('泌乳激素')
    expect(plainLabItem('Homocysteine 同半胱胺酸').name).toBe('同半胱胺酸')
  })

  it('引擎對不回 canonical 的女性項目用關鍵字補', () => {
    expect(plainLabItem('Progesterone P4 黃體脂酮').name).toBe('黃體素')
    expect(plainLabItem('LH 黃體成激素').name).toBe('LH（黃體生成素）')
    expect(plainLabItem('FSH 濾泡刺激素').name).toBe('FSH（濾泡刺激素）')
    expect(plainLabItem('Anti-TPO').name).toBe('甲狀腺抗體（Anti-TPO）')
    expect(plainLabItem('Iron + TIBC').name).toBe('血清鐵＋總鐵結合能力（TIBC）')
    expect(plainLabItem('AMH').name).toBe('AMH（抗穆勒氏管荷爾蒙）')
  })

  it('引擎自己補進來的中文 label 也認得', () => {
    expect(plainLabItem('SHBG（性荷爾蒙結合球蛋白）').name).toBe('SHBG（性荷爾蒙結合球蛋白）')
    expect(plainLabItem('白蛋白').name).toBe('白蛋白')
  })

  it('完全對不到：砍掉括號註記、只留中文，不吐檢驗所名', () => {
    const r = plainLabItem('Zinc 鋅 (外送大安聯合)')
    expect(r.name).toBe('鋅')
    expect(r.why).toBe('')
  })

  it('每一個正式公版項目都有白話名＋為什麼，而且過合規', () => {
    for (const n of ALL_NAMES) {
      const r = plainLabItem(n)
      expect(r.why, n).not.toBe('')
      expect(r.name, n).not.toMatch(/外送|大安/)
      expect(scanMedicalCompliance(`${r.name} ${r.why}`), n).toEqual([])
    }
  })
})

describe('buildDoctorScript：進診間可以這樣說', () => {
  it('有資料就用學員資料組，結尾請醫生安排抽血', () => {
    const s = buildDoctorScript({ age: 32, gender: '男性', goalType: 'cut', trainingEnabled: true })
    expect(s).toContain('今年 32 歲')
    expect(s).toContain('男性')
    expect(s).toContain('減脂')
    expect(s).toContain('重量訓練')
    expect(s.endsWith('想請醫生幫我安排抽血。')).toBe(true)
  })

  it('bulk / recomp 各自有說法', () => {
    expect(buildDoctorScript({ goalType: 'bulk' })).toContain('增肌')
    expect(buildDoctorScript({ goalType: 'recomp' })).toContain('減脂同時增肌')
  })

  it('什麼都拿不到 → 通用版，不含數字', () => {
    const s = buildDoctorScript({})
    expect(s).not.toMatch(/\d/)
    expect(s.endsWith('想請醫生幫我安排抽血。')).toBe(true)
    expect(buildDoctorScript({ age: null, gender: null, goalType: 'maintenance', trainingEnabled: false })).toBe(s)
  })

  it('範本過合規', () => {
    expect(scanMedicalCompliance(buildDoctorScript({ age: 45, gender: '女性', goalType: 'recomp', trainingEnabled: true }))).toEqual([])
  })
})

describe('cleanPrepNotes', () => {
  it('拿掉 ⚠️、MC/panel 換白話', () => {
    const r = cleanPrepNotes(PREP)
    expect(r).toHaveLength(3)
    expect(r.join('')).not.toMatch(/⚠️|MC|panel/)
    expect(r[1]).toContain('月經')
  })
  it('morning peak 換白話', () => {
    expect(cleanPrepNotes('建議早上 8-10 點抽（睪固酮 morning peak）')).toEqual(['建議早上 8-10 點抽（睪固酮早上濃度最高）'])
  })
  it('空的就空陣列', () => {
    expect(cleanPrepNotes(null)).toEqual([])
  })
})

describe('buildStudentLabVisit：學員端輸出不准有價格／底盤／分級', () => {
  // 用真的引擎跑一次，確保接起來後輸出仍乾淨
  const TPL: TemplateItem[] = ALL_NAMES.map((name, i) => ({ name, price: 300 + i * 50, priority: 'must' }))
  const plan = buildLabOrder({
    labs: [{ test_name: '睪固酮', value: 250, date: '2026-05-01' } as never],
    templateItems: TPL, basePrice: 3600, gender: '男性', today: '2026-10-01',
  })
  const api = {
    must: plan.must, defer: plan.defer, skip: plan.skip,
    basePackage: { price: 3600, skippable: false, why: plan.basePackage.why },
    prepNotes: PREP,
  }
  const v = buildStudentLabVisit(api, { age: 30, gender: '男性', goalType: 'bulk', trainingEnabled: true })

  it('科別預設新陳代謝科', () => {
    expect(v.department).toBe(DEPARTMENT)
    expect(v.department).toContain('新陳代謝科')
  })

  it('沒有任何價格、底盤、分級字眼', () => {
    expect(allText(v)).not.toMatch(FORBIDDEN)
  })

  it('整張輸出過合規', () => {
    expect(scanMedicalCompliance(allText(v))).toEqual([])
  })

  it('常規抽血要開時列在第一項（用白話，不叫底盤）', () => {
    expect(v.items[0]).toMatchObject(ROUTINE_ITEM)
    const skippable = buildStudentLabVisit({ ...api, basePackage: { skippable: true } }, {})
    expect(skippable.items[0].name).not.toBe(ROUTINE_ITEM.name)
  })

  it('must 全列、defer 最多帶前幾項並標成可一起驗、skip 一項都不列', () => {
    const optional = v.items.filter(i => i.optional)
    expect(optional.length).toBe(Math.min(MAX_OPTIONAL, plan.defer.length))
    const names = new Set(v.items.map(i => i.name))
    for (const l of plan.must) expect(names.has(plainLabItem(l.label).name)).toBe(true)
    const listed = new Set([...plan.must, ...plan.defer.slice(0, MAX_OPTIONAL)].map(l => plainLabItem(l.label).name))
    for (const l of plan.skip) {
      const n = plainLabItem(l.label).name
      if (!listed.has(n)) expect(names.has(n), n).toBe(false)
    }
  })

  it('總睪固酮上次偏低 → 必驗；清單用白話名', () => {
    expect(v.items.some(i => i.name === '總睪固酮' && !i.optional)).toBe(true)
    expect(v.items.every(i => !/[（(]外送/.test(i.name))).toBe(true)
  })

  it('有自費提醒、有看報告的問題', () => {
    expect(v.selfPayNote).toContain('自費')
    expect(v.reportQuestions.length).toBeGreaterThan(0)
  })
})

describe('學員卡原始碼本身也不准有價格／底盤字眼', () => {
  it('components/client/LabOrderCard.tsx', () => {
    const src = readFileSync(resolve(__dirname, '../../components/client/LabOrderCard.tsx'), 'utf8')
    // 拿掉註解再檢查（註解裡可以解釋「為什麼不顯示價格」）
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
    expect(code).not.toMatch(/底盤|有錢再加|有預算|元|省|NT\$|price|Cost/)
  })
})

describe('personalReason：引擎 why → 學員看的「你的原因」（2026-10-02）', () => {
  it('留下數字、目標、日期；講錢的話拿掉', () => {
    expect(personalReason('上次 626.72（最佳 700-900），2026-09-30 驗的，要看有沒有動'))
      .toBe('上次 626.72（目標 700-900），2026-09-30 驗的，這次看有沒有往目標走')
    expect(personalReason('上次 1.67 正常，但已經 536 天，沒錢可以晚一輪')).toBe('上次 1.67 正常，但已經 536 天')
    expect(personalReason('從沒驗過，是基準線不是追蹤，沒錢可以晚一輪')).toBe('從沒驗過，先驗一次當自己的基準')
  })
  it('含底盤／價格字眼整句不給（認得的底盤句會先翻成學員版，見下方）', () => {
    expect(personalReason('底盤可以不開、直接開單項')).toBe('')
    expect(personalReason('約 $3600')).toBe('')
    expect(personalReason(undefined)).toBe('')
  })
  it('buildStudentLabVisit 把原因掛到對應項目，學員輸出仍過合規、不含價格', () => {
    const v = buildStudentLabVisit({
      must: [{ label: 'Testosterone 總睪固酮', why: '上次 626.72（最佳 700-900），2026-09-30 驗的，要看有沒有動' }],
      defer: [{ label: 'Free T3', why: '從沒驗過，是基準線不是追蹤，沒錢可以晚一輪' }],
    }, {})
    expect(v.items[0].personal).toMatch(/626\.72/)
    expect(v.items[1].personal).toBe('從沒驗過，先驗一次當自己的基準')
    const all = v.items.map(i => i.personal ?? '').join('\n')
    expect(all).not.toMatch(/沒錢|底盤|元/)
    expect(scanMedicalCompliance(all)).toEqual([])
  })
})

describe('一般抽血那項的原因（引擎底盤句 → 學員版）', () => {
  it.each([
    ['2026-09-30 驗過但有項目不正常，底盤值得再開一次', '2026-09-30 那次有幾項要追蹤，這次一起再驗一次'],
    ['沒有常規項目紀錄，底盤該開', '還沒有一般抽血的紀錄，先建立基準'],
    ['常規項目上次是 2025-08-01（427 天前），底盤該開', '上次是 2025-08-01（427 天前），該更新了'],
  ])('%s', (raw, want) => expect(personalReason(raw)).toBe(want))
  it('掛在「一般抽血」那項', () => {
    const v = buildStudentLabVisit({ must: [], basePackage: { skippable: false, why: '沒有常規項目紀錄，底盤該開' } }, {})
    expect(v.items[0]).toMatchObject({ name: ROUTINE_ITEM.name, personal: '還沒有一般抽血的紀錄，先建立基準' })
  })
})
