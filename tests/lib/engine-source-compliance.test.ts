import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { scanMedicalCompliance } from '@/lib/compliance-scrub'

/**
 * 引擎原始碼合規掃描（2026-07-10）
 *
 * 為什麼要掃原始碼而不只掃執行結果：
 * 引擎的輸出分支非常多（性別 × 目標 × 血檢組合 × 基因型），跑不完所有路徑。
 * 但病名是**寫死在字串字面值裡**的，直接掃原始碼就能 100% 覆蓋。
 *
 * 這支抓到過的真實問題（2026-07-10）：
 *   - nutrition-engine：「CRP 偏高 — 系統性發炎」→ 被 degradeToSafe 整段換成罐頭句，
 *     學員反而看不到真正的警告
 *   - supplement-engine：「Omega-3 有助於降低系統性發炎」→ 同上
 *   - lab-nutrition-advisor：「副甲狀腺功能亢進或惡性腫瘤」直接印給學員
 *
 * 只掃「會流向學員」的引擎。compliance-scrub.ts 自己是 deny-list 定義處，必須排除。
 */

const ENGINE_FILES = [
  'lib/nutrition-engine.ts',
  'lib/supplement-engine.ts',
  'lib/lab-nutrition-advisor.ts',
  'lib/recovery-engine.ts',
  'lib/weekly-tasks.ts',
  'lib/weekly-coaching.ts',
]

/** 是否為註解行（用來排除說明用途提到病名的註解，例如「原文『系統性發炎』已移除」）。 */
function isCommentLine(line: string): boolean {
  const t = line.trim()
  return t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')
}

/**
 * 是否為「查表別名」行——這些字串是用來比對 DB 裡的 test_name，不會渲染給任何人。
 * 例：getValue(['homair', 'homa-ir', '胰島素阻抗'])
 * 這種行掃到病名是誤判；真正給學員看的文字不會長這樣。
 */
function isLookupLine(line: string): boolean {
  return /getValue\s*\(|matchLabName\s*\(|TEST_ALIASES|aliases\s*:|keywords\s*:|:\s*true\s*,/.test(line)
}

/** 抽出一行裡的字串字面值內容（單引號 / 雙引號 / 樣板字串），只取含中文或英文字母者。 */
function stringLiterals(line: string): string[] {
  const out: string[] = []
  for (const re of [/'([^'\n]*)'/g, /"([^"\n]*)"/g, /`([^`\n]*)`/g]) {
    for (const m of line.matchAll(re)) {
      // 剝掉樣板字串裡的 ${程式碼}——那是變數名不是給人看的文字
      // （例：`${hasAmenorrhea ? …}` 的變數名含 "amenorrhea" 會誤判成病名）
      const s = m[1].replace(/\$\{[^}]*\}/g, ' ')
      if (s && /[一-龥A-Za-z]/.test(s)) out.push(s)
    }
  }
  return out
}

/**
 * 是否為文獻引用（作者+年份、PMID、期刊名）。
 * 引用裡的英文期刊名（如 "Diabetes Care"、NEJM 論文標題含 gout）不是對學員下診斷，放行。
 * 但引用「說明文字」裡的中文病名仍要擋——它會跟著渲染給學員（補品卡會顯示文獻）。
 */
function isCitation(lit: string): boolean {
  return /PMID/i.test(lit) || /et al\.?/i.test(lit) || /\b(19|20)\d{2}\b\s*[(:：]/.test(lit)
}

/** 命中詞是否為純英文（期刊名誤判多發生在英文詞）。 */
function isLatinTerm(term: string): boolean {
  return !/[一-龥]/.test(term)
}

describe('引擎原始碼不得寫死疾病名/處方藥名/診斷語氣', () => {
  for (const file of ENGINE_FILES) {
    it(`${file} 的字串字面值全數通過合規掃描`, () => {
      let src: string
      try {
        src = readFileSync(resolve(process.cwd(), file), 'utf8')
      } catch {
        // 檔案不存在就跳過（引擎被重構/改名時不要假紅）
        return
      }

      const violations: string[] = []
      src.split('\n').forEach((line, i) => {
        if (isCommentLine(line) || isLookupLine(line)) return
        for (const lit of stringLiterals(line)) {
          let hits = scanMedicalCompliance(lit)
          // 文獻引用：放行英文期刊名/論文標題裡的病名，中文病名照擋
          if (isCitation(lit)) hits = hits.filter(h => !isLatinTerm(h.term))
          if (hits.length > 0) {
            violations.push(`${file}:${i + 1}  "${lit.slice(0, 70)}"  → 命中 ${hits.map(h => h.term).join(', ')}`)
          }
        }
      })

      expect(
        violations,
        `以下字串會流向學員且踩到醫療合規紅線（病名/藥名/診斷語氣）。\n` +
          `改成描述數據事實 + 導向就醫，不要下診斷：\n\n${violations.join('\n')}\n`,
      ).toEqual([])
    })
  }

  it('掃描器有效（反向哨兵，避免上面全部假綠）', () => {
    expect(scanMedicalCompliance('符合代謝症候群模式').length).toBeGreaterThan(0)
    expect(scanMedicalCompliance('惡性腫瘤').length).toBeGreaterThan(0)
    expect(scanMedicalCompliance('系統性發炎').length).toBeGreaterThan(0)
  })
})
