// 跨指標關聯偵測 — Howard 會「串關係」的血檢組合，做成確定性規則。
// 設計哲學：組合是「機率訊號」不是診斷；只偵測 Howard 定義過、文獻站得住的組合，
// 不讓 LLM 自由聯想（那會幻覺出聽起來對、其實沒根據的關聯）。措辭一律保守。
// 組合來源：lib/lab-draft-engine.ts 的「跨指標關聯」+ Howard 的判斷規則。
//
// 用法：client-diagnosis 算完每筆血檢的 status 後，把 labs 丟進來，回傳命中的訊號。

import { getLabDirection } from '@/utils/labStatus'

export interface CrossMarkerSignal {
  id: string
  title: string
  detail: string
  severity: 'info' | 'attention'
}

interface LabLite {
  test_name: string
  value: string | number
}

interface CrossCtx {
  isFatLoss?: boolean
  prepPhase?: string | null
  clientMode?: string | null
  mthfr?: string | null // heterozygous / homozygous / normal
}

export function detectCrossMarkerSignals(
  labs: LabLite[],
  gender: '男性' | '女性' | undefined,
  ctx: CrossCtx = {}
): CrossMarkerSignal[] {
  const find = (aliases: string[]) =>
    labs.find((l) => aliases.some((a) => l.test_name === a || (l.test_name || '').includes(a)))
  const dirOf = (lab?: LabLite) => (lab ? getLabDirection(lab.test_name, Number(lab.value), gender) : null)

  // 減脂/備賽情境：部分荷爾蒙/甲狀腺下降是「預期代價」，措辭要區分（接 lab-draft-engine MODE_PHILOSOPHIES）
  const inCut =
    !!ctx.isFatLoss ||
    ['cut', 'peak_week'].includes(ctx.prepPhase || '') ||
    ['bodybuilding', 'athletic'].includes(ctx.clientMode || '')

  const signals: CrossMarkerSignal[] = []

  const shbg = find(['SHBG'])
  const freeT = find(['游離睪固酮'])
  const bioT = find(['生物可利用睪固酮'])
  const androgenLow = dirOf(freeT) === 'low' || dirOf(bioT) === 'low'

  // A. SHBG↑ + 游離/生物可利用睪固酮↓ → 游離雄性素被綁住
  if (dirOf(shbg) === 'high' && androgenLow) {
    signals.push({
      id: 'shbg_free_androgen',
      title: 'SHBG 偏高 + 游離雄性素偏低',
      detail:
        '游離/可利用的雄性素可能被 SHBG 綁住——總睪固酮也許還行，但實際能用的偏低。常見於低體脂/備賽/年齡或甲狀腺影響。建議總睪固酮、游離(或生物可利用)睪固酮、SHBG 一起看，別只看總量。',
      severity: 'attention',
    })
  }

  // B 拆兩型（對帳 2026-06 修正：原本把「TSH↑+FT4↓」當減脂可逆節能是錯的，會漏接真甲低）：
  const tsh = find(['TSH'])
  const ft4 = find(['Free T4'])
  const ft3 = find(['Free T3'])

  // B1. 原發性甲狀腺低下型（TSH↑ + Free T4↓）= 疾病型態，不可當減脂可逆節能放著，一律提示就醫複檢。
  if (dirOf(tsh) === 'high' && dirOf(ft4) === 'low') {
    signals.push({
      id: 'primary_hypothyroid',
      title: 'TSH 偏高 + Free T4 偏低（疑似甲狀腺低下）',
      detail:
        '這個組合（TSH 升高合併 Free T4 偏低）是原發性甲狀腺低下的典型型態，不是減脂期的可逆節能性下降——別當成赤字副作用放著。建議轉介家醫科/內分泌科複檢，含甲狀腺抗體(anti-TPO)。',
      severity: 'attention',
    })
  }

  // B2. 減脂期節能性下降型（Free T3↓ 而 TSH 未升高）= 多為可逆、回補熱量改善。
  //     刻意排除「TSH 偏高」——那是上面的疾病型、不是節能。
  if (dirOf(ft3) === 'low' && dirOf(tsh) !== 'high') {
    signals.push({
      id: 'thyroid_energy_saving',
      title: 'Free T3 偏低（甲狀腺節能性下降）',
      detail: inCut
        ? '低 T3 而 TSH 沒升高，常是熱量赤字的節能性下降、回補熱量多會改善，多屬暫時。但若伴隨明顯疲勞/怕冷或持續惡化，建議與家醫科或整合醫學醫師討論。'
        : '低 T3 而 TSH 沒升高。非減脂期出現要找原因（含低能量可用性等），若伴隨疲勞/怕冷等症狀，建議與家醫科或整合醫學醫師討論。',
      severity: 'attention',
    })
  }

  // C. 同半胱胺酸↑ → 甲基化訊號（接 MTHFR / 甲基葉酸規則）。
  //    若已知 MTHFR 帶因，直接講死、不再用「如果你是」。
  const homo = find(['同半胱胺酸'])
  if (dirOf(homo) === 'high') {
    const isCarrier = ['heterozygous', 'homozygous'].includes((ctx.mthfr || '').toLowerCase())
    signals.push({
      id: 'homocysteine',
      title: '同半胱胺酸偏高',
      detail: isCarrier
        ? `甲基化代謝訊號。你已知是 MTHFR 帶因(${ctx.mthfr})，葉酸代謝效率較低，這正好對應同半胱胺酸偏高——補葉酸要用甲基葉酸(5-MTHF)而非一般合成葉酸，並確保 B12/B6 足夠。`
        : '甲基化代謝訊號，常與葉酸/B12/B6 不足或 MTHFR 基因型有關。建議檢查 MTHFR 基因；若為帶因者宜用甲基葉酸(5-MTHF)而非一般葉酸。',
      severity: 'attention',
    })
  }

  // D. 鐵蛋白↑ + CRP↑ → 發炎假性升高，別當鐵過載（接鐵蛋白/CRP 規則）
  const fer = find(['鐵蛋白'])
  const crp = find(['hs-CRP']) || find(['CRP'])
  if (dirOf(fer) === 'high' && dirOf(crp) === 'high') {
    signals.push({
      id: 'ferritin_inflammation',
      title: '鐵蛋白偏高 + 發炎(CRP)偏高',
      detail:
        '鐵蛋白是急性期蛋白，發炎時會假性升高——CRP 也高時，先別把鐵蛋白當成鐵過載。等 CRP 回到正常、鐵蛋白仍高，才考慮鐵負荷的問題。',
      severity: 'attention',
    })
  }

  // E. 空腹胰島素↑ + (三酸甘油酯↑ 或 HDL↓) → 胰島素阻抗/代謝症候群
  const ins = find(['空腹胰島素'])
  const tg = find(['三酸甘油酯'])
  const hdl = find(['HDL-C'])
  if (dirOf(ins) === 'high' && (dirOf(tg) === 'high' || dirOf(hdl) === 'low')) {
    signals.push({
      id: 'insulin_resistance',
      title: '空腹胰島素偏高 + 血脂訊號',
      detail:
        '空腹胰島素偏高搭配三酸甘油酯偏高或 HDL 偏低，是胰島素阻抗/代謝症候群的典型組合。優先處理飲食結構與體脂，這比單看任一項更重要。',
      severity: 'attention',
    })
  }

  // F. (男性) 雄性素↓ + 雌二醇↑ → 芳香化偏高訊號
  if (gender === '男性') {
    const e2 = find(['雌二醇'])
    if (androgenLow && dirOf(e2) === 'high') {
      signals.push({
        id: 'low_androgen_high_e2',
        title: '雄性素偏低 + 雌二醇偏高',
        detail: inCut
          ? '雄性素偏低同時雌二醇偏高。備賽/低脂期常為暫時。若非備賽期，可能與芳香化偏高(常和體脂、酒精、年齡有關)相關，建議睪固酮軸與 E2 一起追，先從體脂與酒精著手。'
          : '雄性素偏低同時雌二醇偏高，可能與芳香化偏高(常和體脂、酒精、年齡有關)相關。建議睪固酮軸與 E2 一起追蹤，先從體脂與酒精著手。',
        severity: 'attention',
      })
    }
  }

  // G. (減脂期) HOMA-IR 偏高 → 可能真的影響減脂的生理阻力（Howard 臨床 + 證據相符）。
  //    注意：同半胱胺酸 / Lp(a) 不放這裡——它們是健康/心血管風險，沒有證據會「造成減脂卡關」。
  if (ctx.isFatLoss && dirOf(find(['HOMA-IR'])) === 'high') {
    signals.push({
      id: 'insulin_resistance_plateau',
      title: '胰島素阻抗訊號（影響飲食組成選擇）',
      detail:
        'HOMA-IR(胰島素阻抗)偏高。⚠️總熱量赤字仍是減脂主因——胰島素阻抗對總減重的因果證據其實偏弱(別讓停滯被怪到胰島素而忽略依從性)。它比較是「飲食組成」的訊號：高 HOMA-IR 者優先降升糖負荷、加阻力訓練，必要時與醫師配合。',
      severity: 'attention',
    })
  }

  // H. Lp(a) 偏高 → 基因性心血管風險，與體重/減脂無關（不歸因卡關），純健康面導向就醫。
  if (dirOf(find(['Lp(a)'])) === 'high') {
    signals.push({
      id: 'lpa_cvd_risk',
      title: 'Lp(a) 偏高（心血管風險）',
      detail:
        'Lp(a) 偏高主要由基因決定，是心血管風險指標，跟體重或減脂進度無關、也不是飲食能直接改善的。這是健康面的紅旗，建議請學員與醫師討論心血管風險管理。',
      severity: 'attention',
    })
  }

  return signals
}
