// 腎功能判斷的單一真相：是否該對「會墊高肌酸酐的東西」（肌酸補充）踩煞車。
//
// 哲學（與 nutrition-engine 腎蛋白守門一致）：
//   eGFR 才是腎功能真相。肌酸酐會因「腎不好」或「肌肉量大」而升高，
//   練很大的人肌酸酐天生高、腎其實正常 → 不該被當腎病處理。
//   - 有 eGFR：只看 eGFR。<60 才踩煞車；≥60 就算肌酸酐高也放行（肌肉量大）。
//   - 沒有 eGFR 佐證但肌酸酐偏高：保守踩煞車（無法確認是否非腎因性）。
import { matchLabName } from './labMatch'

export interface KidneyLabLike {
  test_name: string
  value: number | null
  status?: string
}

export function shouldRestrictCreatine(labs: KidneyLabLike[], gender?: string): boolean {
  if (!labs || labs.length === 0) return false
  const egfr = labs.find(l => l.value != null && matchLabName(l.test_name, ['egfr', '腎絲球過濾率']))
  if (egfr && egfr.value != null) return egfr.value < 60 // 有 eGFR：只看它（正常就放行肌肉量大者）

  const cr = labs.find(l => l.value != null && matchLabName(l.test_name, ['肌酸酐', 'creatinine']))
  const crMax = gender === '女性' ? 1.1 : 1.3
  return !!(cr && cr.value != null && cr.value > crMax) // 沒 eGFR：肌酸酐高才保守擋
}
