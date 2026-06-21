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

  // B. TSH↑ + Free T4/T3↓ → 甲狀腺下降（減脂期多為節能性、非疾病）
  const tsh = find(['TSH'])
  const ft4 = find(['Free T4'])
  const ft3 = find(['Free T3'])
  if (dirOf(tsh) === 'high' && (dirOf(ft4) === 'low' || dirOf(ft3) === 'low')) {
    signals.push({
      id: 'thyroid_down',
      title: 'TSH 偏高 + 甲狀腺素偏低',
      detail: inCut
        ? '甲狀腺有下降跡象。正在減脂/備賽期時，這常是熱量赤字的節能性下降、回補熱量多會改善，多屬暫時。但若伴隨明顯疲勞/怕冷或持續惡化，建議與家醫科或整合醫學醫師討論。'
        : '甲狀腺功能有下降跡象。非減脂期出現要找原因，若伴隨疲勞/怕冷等症狀，建議與家醫科或整合醫學醫師討論。',
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

  // G. (減脂期) HOMA-IR / 同半胱胺酸 / Lp(a) 偏高 → 卡關的生理阻力，直接導向就醫配合
  //    (Howard 臨床：這些本身就可能讓人減不下來，跟備賽無關，不要只靠硬砍熱量解)
  if (ctx.isFatLoss) {
    const triggers: string[] = []
    if (dirOf(find(['HOMA-IR'])) === 'high') triggers.push('HOMA-IR(胰島素阻抗)')
    if (dirOf(find(['同半胱胺酸'])) === 'high') triggers.push('同半胱胺酸')
    if (dirOf(find(['Lp(a)'])) === 'high') triggers.push('Lp(a)')
    if (triggers.length) {
      signals.push({
        id: 'metabolic_resistance',
        title: '減脂卡關的生理阻力訊號',
        detail: `${triggers.join('、')} 偏高——減脂卡關時，這些代謝/發炎面的指標本身就可能是減不下來的生理原因(跟有沒有備賽無關)。建議請學員就醫、與醫療端配合處理，不要只靠硬砍熱量硬解。`,
        severity: 'attention',
      })
    }
  }

  return signals
}
