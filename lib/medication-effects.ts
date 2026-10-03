/**
 * 已知藥物對血檢的影響（2026-10-03）。判讀時把「藥造成的偏高」跟「要處理的問題」分開。
 * 只收有文獻的藥；每個 marker 用 canonical 中文名（同 LAB_THRESHOLDS 的鍵）。
 * 資料存在 clients.medications（jsonb），格式見 migrations/20261003_add_client_medications.sql。
 */
export interface ClientMedication {
  key: string
  name?: string
  since?: string | null
  until?: string | null
}

interface MedicationEffect {
  label: string
  /** 會動肝指數的藥：補品對帳時，有肝毒性病例的補品（南非醉茄）要暫停 */
  liver?: boolean
  /** 服藥期間不能疊加的補品（關鍵字），與原因 */
  avoid?: { match: string[]; why: string }[]
  /** 會被這個藥拉高／影響的血檢項目 */
  markers: string[]
  /** 給學員看的一句話（不寫病名、不叫人停藥） */
  note: string
  refs: string[]
}

export const MEDICATION_EFFECTS: Record<string, MedicationEffect> = {
  isotretinoin: {
    label: '口服 A 酸',
    liver: true,
    avoid: [{
      match: ['維生素a', '維他命a', 'vitamin a', 'vitamina', 'retinol', '視黃醇', '魚肝油', 'cod liver'],
      why: 'A 酸本身就是維生素 A 衍生物，仿單警語：服藥期間不要再補維生素 A，疊加會造成維生素 A 過量',
    }, {
      // 2026-10-03：南非醉茄有罕見肝損傷病例報告（NIH LiverTox 收錄），A 酸也會影響肝指數 → 療程中保守先停
      match: ['南非', '醉茄', 'ashwagandha', 'ksm'],
      why: '南非醉茄有罕見的肝損傷病例報告；你正在吃口服 A 酸（也會影響肝指數），兩者疊在一起沒必要冒險 → 療程中先停，結束再評估',
    }],
    markers: ['CPK', 'AST', 'ALT', 'ALP', '三酸甘油酯', 'LDL-C', '總膽固醇', '白血球'],
    note: '你在吃口服 A 酸：服藥期間這項常會偏高，加上大重量訓練 CK 會升更多。等療程結束後再驗一次，那個數字才是你真正的基準；有肌肉痠痛無力或尿色變深要回診告訴醫生',
    refs: [
      'Lee 2016 JAMA Dermatol meta-analysis（PMID 26630323）：服藥期間血脂、肝指數、白血球平均上升',
      'Chroni 2010 Drug Saf（PMID 20000864）：A 酸＋激烈運動 CK 可升高，偶達正常值 100 倍',
    ],
  },
}

/** onDate 當天還在吃的藥（沒寫起訖就當還在吃） */
export function activeMedications(meds: ClientMedication[] | null | undefined, onDate?: string): ClientMedication[] {
  return (meds ?? []).filter(m => !(onDate && m.since && onDate < m.since) && !(onDate && m.until && onDate > m.until))
}

/** 這個人現在（today）還在吃、而且會影響這項血檢的藥；沒有回 null */
export function medicationNoteFor(
  testName: string,
  meds: ClientMedication[] | null | undefined,
  onDate?: string,
): string | null {
  if (!meds?.length) return null
  for (const m of meds) {
    const eff = MEDICATION_EFFECTS[m.key]
    if (!eff || !eff.markers.includes(testName)) continue
    // 抽血日在服藥期間才算（沒寫起訖就當還在吃）
    if (onDate && m.since && onDate < m.since) continue
    if (onDate && m.until && onDate > m.until) continue
    return eff.note
  }
  return null
}

/** 口語藥名 → 已知 key（助手 LINE 指令用）；對不到回 null，呼叫端照原名存成「沒有已知影響」的用藥 */
export function resolveMedicationKey(text: string): string | null {
  if (/a\s*酸|isotretinoin|羅可坦|roaccutane|accutane/i.test(text)) return 'isotretinoin'
  return null
}

/**
 * 開始／停止一個用藥（純函式）。
 * start：同 key 還在吃的就更新開始日，沒有就新增一筆；stop：把還在吃的那筆補上結束日（沒有就原樣回傳＋changed=false）。
 */
export function applyMedicationChange(
  meds: ClientMedication[] | null | undefined,
  change: { action: 'start' | 'stop'; key: string; name?: string; date: string },
): { medications: ClientMedication[]; changed: boolean } {
  const list = Array.isArray(meds) ? meds.map(m => ({ ...m })) : []
  const active = list.find(m => m.key === change.key && !m.until)
  if (change.action === 'start') {
    if (active) { active.since = change.date; if (change.name) active.name = change.name }
    else list.push({ key: change.key, name: change.name ?? MEDICATION_EFFECTS[change.key]?.label ?? change.key, since: change.date, until: null })
    return { medications: list, changed: true }
  }
  if (!active) return { medications: list, changed: false }
  active.until = change.date
  return { medications: list, changed: true }
}
