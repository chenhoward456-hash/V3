/**
 * 補品 × 血檢 一致性守門層（reconciler）
 *
 * 問題：補品引擎每條規則各自做血檢檢查，漏一條（或某條被 name-substring dedup 改寫）就會出現
 * 「補品建議推 X、血檢端卻說 X 偏高要減」的自相矛盾——謝佳峻的肌酸 vs 肌酸酐就是這類。
 *
 * 解法：把「補品 → 它會抬高/惡化哪些 marker」做成一張宣告式表，所有建議在送出前過這道通則。
 * 命中且該 marker 目前在「危險側」（高鐵蛋白、高鋅、高鈣…而非缺乏）→ 依設定壓制或加註。
 * 新增補品只要在表裡填一列就自動被守門，不需要再各自 patch（這就是「整體邏輯一致」而非破洞補洞）。
 *
 * 重要：必須判「危險側」而非單看 status——鐵蛋白/鋅/維生素 D 偏「低」也是 attention，
 * 那是缺乏要補，不能誤殺。所以每條交互帶明確 triggered() 判斷（門檻對齊引擎既有常數）。
 *
 * 醫療合規：教練非醫師，警語一律用「暫緩 / 追蹤 / 與醫師確認」語氣，不下診斷、不開處方。
 */
import { matchLabName } from '@/utils/labMatch'
import type { LabResult, SupplementSuggestion } from './supplement-engine'

export interface SupplementLabInteraction {
  id: string
  /** 補品名稱含任一關鍵字即適用（對 suggestion.name 做 includes，非血檢比對） */
  supplementKeywords: string[]
  /** 此補品會抬高/惡化的血檢 marker 關鍵字（用 labMatch canonical 比對） */
  markerKeywords: string[]
  /** marker 是否落在「該補品會惡化」的危險側（避免把缺乏誤判成過量） */
  triggered: (marker: LabResult) => boolean
  action: 'suppress' | 'caveat'
  /** 壓制理由 / 加註警語（吃命中的 marker 產生說明） */
  note: (marker: LabResult) => string
}

const v = (m: LabResult) => `${m.value ?? ''}${m.unit ? ' ' + m.unit : ''}`.trim()

export const SUPPLEMENT_LAB_INTERACTIONS: SupplementLabInteraction[] = [
  // 肌酸 ↔ 腎指標：肌酸會墊高肌酸酐；肌酸酐高或 eGFR 低時暫緩（謝佳峻案例，集中在此不再內聯特判）
  {
    id: 'creatine-kidney',
    supplementKeywords: ['肌酸'],
    markerKeywords: ['肌酸酐', 'creatinine', 'egfr', '腎絲球過濾率'],
    triggered: (m) => m.status !== 'normal', // 肌酸酐高 / eGFR 低都是同向風險，皆非「正常」
    action: 'suppress',
    note: (m) =>
      `腎指標目前偏離（${m.test_name} ${v(m)}），肌酸補充會墊高肌酸酐。健美選手肌酸酐高常為肌肉量/補充所致、未必腎損，但建議先暫緩肌酸、待回穩或與醫師確認非腎因性後再評估。`,
  },
  // 鐵劑 ↔ 鐵蛋白：高鐵蛋白（鐵過載）不該再補鐵；safety net 防 name dedup 把停鐵卡改寫成補鐵
  {
    id: 'iron-overload',
    supplementKeywords: ['鐵劑'],
    markerKeywords: ['鐵蛋白', 'ferritin'],
    triggered: (m) => m.value != null && m.value > 200,
    action: 'suppress',
    note: (m) =>
      `鐵蛋白偏高（${v(m)}，參考上限約 200 ng/mL），不建議再補鐵——高鐵蛋白增加氧化壓力與器官鐵沉積風險，建議與醫師討論。`,
  },
  // 鋅 ↔ 血清鋅：高鋅會抑制銅吸收；高鋅時不該再補鋅
  {
    id: 'zinc-excess',
    supplementKeywords: ['鋅'],
    markerKeywords: ['鋅', 'zinc'],
    triggered: (m) => m.value != null && m.value > 120,
    action: 'suppress',
    note: (m) =>
      `血清鋅偏高（${v(m)}，參考上限約 120 μg/dL），不建議再補鋅——長期過量鋅會抑制銅吸收，建議停止含鋅補品並回檢。`,
  },
  // 維生素 D ↔ 血鈣：D 增加鈣吸收；高血鈣時補 D 有害
  {
    id: 'vitd-hypercalcemia',
    supplementKeywords: ['維生素 D', '維生素D', 'D3'],
    markerKeywords: ['鈣', 'calcium'],
    triggered: (m) => m.value != null && m.value > 10.5,
    action: 'suppress',
    note: (m) =>
      `血鈣偏高（${v(m)}），維生素 D 會增加鈣吸收，建議先暫緩 D3 並與醫師確認血鈣成因。`,
  },
  // 維生素 D ↔ 維生素 D 本身：已達毒性範圍時不該再補
  {
    id: 'vitd-toxicity',
    supplementKeywords: ['維生素 D', '維生素D', 'D3'],
    markerKeywords: ['維生素d', 'vitamin d', '25-oh'],
    triggered: (m) => m.value != null && m.value > 100,
    action: 'suppress',
    note: (m) =>
      `維生素 D 已偏高（${v(m)}，> 100 ng/mL 屬潛在毒性範圍），不建議再補充，減量後通常數月自然回降。`,
  },
  // 電解質/鉀 ↔ 血鉀：高血鉀時含鉀電解質會再墊高
  {
    id: 'potassium-high',
    supplementKeywords: ['電解質', '鉀'],
    markerKeywords: ['鉀', 'potassium'],
    triggered: (m) => m.value != null && m.value > 5.0,
    action: 'suppress',
    note: (m) =>
      `血鉀偏高（${v(m)}），含鉀電解質補充會再墊高，建議先暫緩並與醫師確認。`,
  },
  // 鎂 ↔ 腎指標：鎂主要由腎臟排除，腎功能下降時易蓄積（加註，不一定壓制）
  {
    id: 'magnesium-kidney',
    supplementKeywords: ['鎂', 'magnesium'],
    markerKeywords: ['肌酸酐', 'creatinine', 'egfr', '腎絲球過濾率'],
    // 肌酸酐高 / eGFR 低都是 alert；兩者皆代表腎功能風險，加註提醒
    triggered: (m) => m.status === 'alert',
    action: 'caveat',
    note: (m) =>
      `腎功能指標明顯偏離（${m.test_name} ${v(m)}），鎂主要由腎臟代謝，補充前建議與醫師確認劑量。`,
  },
  // 電解質 ↔ 腎指標：腎功能下降時鉀/鎂排除變慢（加註）
  {
    id: 'electrolyte-kidney',
    supplementKeywords: ['電解質'],
    markerKeywords: ['肌酸酐', 'creatinine', 'egfr', '腎絲球過濾率'],
    triggered: (m) => m.status === 'alert',
    action: 'caveat',
    note: (m) =>
      `腎功能指標明顯偏離（${m.test_name}），腎功能下降時鉀/鎂排除變慢，電解質補充劑量建議與醫師確認。`,
  },
]

/** 「⚠️ 停止X / 就醫 / 監控」類卡片是矯正動作，本身不是「補 X」，守門時跳過不處理。 */
export function isCorrectiveSuggestion(name: string): boolean {
  return (
    name.startsWith('⚠️') ||
    name.includes('停止') ||
    name.includes('停用') ||
    name.includes('就醫') ||
    name.includes('監控')
  )
}

export interface ReconcileResult {
  suggestions: SupplementSuggestion[]
  /** 被壓制的建議（給報告透明顯示「為何沒推薦 X」，不要靜默吞掉） */
  suppressed: Array<{ name: string; reason: string; interactionId: string }>
}

/**
 * 補品建議的最後一道：對照當下血檢，壓制/加註會惡化已偏離 marker 的補品。
 * 在 generateSupplementSuggestions 最後（排序前）呼叫一次，所有消費端自動一致。
 */
export function reconcileSupplementsWithLabs(
  suggestions: SupplementSuggestion[],
  labs: LabResult[],
): ReconcileResult {
  const suppressed: ReconcileResult['suppressed'] = []
  const kept: SupplementSuggestion[] = []

  for (const s of suggestions) {
    if (isCorrectiveSuggestion(s.name)) {
      kept.push(s)
      continue
    }

    let dropped = false
    for (const rule of SUPPLEMENT_LAB_INTERACTIONS) {
      if (!rule.supplementKeywords.some((k) => s.name.includes(k))) continue
      const marker = labs.find(
        (l) => matchLabName(l.test_name, rule.markerKeywords) && rule.triggered(l),
      )
      if (!marker) continue

      if (rule.action === 'suppress') {
        suppressed.push({ name: s.name, reason: rule.note(marker), interactionId: rule.id })
        dropped = true
        break
      }
      // caveat：把警語併進 reason（避免重覆）
      const caveat = `⚠️ ${rule.note(marker)}`
      if (!s.reason.includes(caveat)) s.reason = `${s.reason}\n\n${caveat}`
    }

    if (!dropped) kept.push(s)
  }

  return { suggestions: kept, suppressed }
}
