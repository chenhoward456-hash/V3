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
  /** 會被這個藥拉高／影響的血檢項目 */
  markers: string[]
  /** 給學員看的一句話（不寫病名、不叫人停藥） */
  note: string
  refs: string[]
}

export const MEDICATION_EFFECTS: Record<string, MedicationEffect> = {
  isotretinoin: {
    label: '口服 A 酸',
    markers: ['CPK', 'AST', 'ALT', 'ALP', '三酸甘油酯', 'LDL-C', '總膽固醇', '白血球'],
    note: '你在吃口服 A 酸：服藥期間這項常會偏高，加上大重量訓練 CK 會升更多。等療程結束後再驗一次，那個數字才是你真正的基準；有肌肉痠痛無力或尿色變深要回診告訴醫生',
    refs: [
      'Lee 2016 JAMA Dermatol meta-analysis（PMID 26630323）：服藥期間血脂、肝指數、白血球平均上升',
      'Chroni 2010 Drug Saf（PMID 20000864）：A 酸＋激烈運動 CK 可升高，偶達正常值 100 倍',
    ],
  },
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
