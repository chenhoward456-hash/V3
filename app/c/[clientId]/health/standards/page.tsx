'use client'

import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { LAB_THRESHOLDS, LAB_OPTIMAL_RANGES } from '@/utils/labStatus'

interface CompareRow {
  testName: string
  unit: string
  category: string
  hospitalNormal: string   // 一般醫院定的「正常」上限/範圍
  howardOptimal: string    // Howard 採用的最佳化範圍
  why: string              // 為什麼差距重要
}

// 同步 timeline page 的分類
const CATEGORIES = [
  '代謝健康', '心血管風險', '系統性發炎', '肝腎功能',
  '甲狀腺 / 荷爾蒙', '微量營養素',
]

const HIGHER_IS_BETTER = new Set(['HDL-C', '白蛋白', 'eGFR'])

function rangeToText(v: number | { min: number; max: number } | undefined, higherBetter = false): string {
  if (v === undefined || v === null) return '—'
  if (typeof v === 'object') return `${v.min}-${v.max}`
  return higherBetter ? `> ${v}` : `< ${v}`
}

const COMPARISONS: CompareRow[] = [
  {
    testName: 'ApoB', unit: 'mg/dL', category: '心血管風險',
    hospitalNormal: rangeToText((LAB_THRESHOLDS as any)['ApoB']?.normal),
    howardOptimal: rangeToText(LAB_OPTIMAL_RANGES['ApoB']),
    why: 'ApoB 是脂蛋白「顆粒數」— 比 LDL-C 更準確預測心血管風險。國際長壽研究指出 < 80 為較低風險區，< 50 為最佳優化目標。'
  },
  {
    testName: 'Lp(a)', unit: 'mg/dL', category: '心血管風險',
    hospitalNormal: rangeToText((LAB_THRESHOLDS as any)['Lp(a)']?.normal),
    howardOptimal: '不可改變的遺傳因子，目標越低越好',
    why: 'Lp(a) 主要由基因決定，無法靠生活方式大幅改變。但作為心血管風險獨立預測因子，數值越低風險越低，> 50 mg/dL 需要更積極控制其他可改變因素。'
  },
  {
    testName: 'HbA1c', unit: '%', category: '代謝健康',
    hospitalNormal: rangeToText((LAB_THRESHOLDS as any)['HbA1c']?.normal),
    howardOptimal: rangeToText(LAB_OPTIMAL_RANGES['HbA1c']),
    why: '糖尿病門檻是 6.5%，前期是 5.7-6.4%。但研究顯示即使在 5.5-5.7 範圍內，代謝病風險就已開始上升。長壽目標 < 5.0%。'
  },
  {
    testName: '空腹胰島素', unit: 'μIU/mL', category: '代謝健康',
    hospitalNormal: rangeToText((LAB_THRESHOLDS as any)['空腹胰島素']?.normal),
    howardOptimal: rangeToText(LAB_OPTIMAL_RANGES['空腹胰島素']),
    why: '胰島素阻抗的最早指標。醫院很少測，但血糖開始升高前 10-20 年，空腹胰島素就已經偏高。'
  },
  {
    testName: 'hs-CRP', unit: 'mg/L', category: '系統性發炎',
    hospitalNormal: rangeToText((LAB_THRESHOLDS as any)['hs-CRP']?.normal),
    howardOptimal: rangeToText(LAB_OPTIMAL_RANGES['hs-CRP']),
    why: '系統性低度發炎是慢性病的共通底層 — 心血管、糖尿病、癌症、神經退化都跟它有關。長壽目標 < 0.5。'
  },
  {
    testName: '同半胱胺酸', unit: 'μmol/L', category: '系統性發炎',
    hospitalNormal: rangeToText((LAB_THRESHOLDS as any)['同半胱胺酸']?.normal),
    howardOptimal: rangeToText(LAB_OPTIMAL_RANGES['同半胱胺酸']),
    why: '心血管獨立風險因子 + 大腦健康指標。高同半胱胺酸與失智症、心血管疾病相關。MTHFR 變異者尤其需要追蹤。'
  },
  {
    testName: '維生素 D', unit: 'ng/mL', category: '微量營養素',
    hospitalNormal: rangeToText((LAB_THRESHOLDS as any)['維生素D']?.normal),
    howardOptimal: rangeToText(LAB_OPTIMAL_RANGES['維生素D']),
    why: '醫院定義「不足」門檻是 30，但研究顯示 50-80 ng/mL 才是免疫、骨骼、激素合成的最佳區間。台灣人室內生活普遍偏低。'
  },
  {
    testName: '睪固酮（男）', unit: 'ng/dL', category: '甲狀腺 / 荷爾蒙',
    hospitalNormal: rangeToText((LAB_THRESHOLDS as any)['睪固酮']?.normal),
    howardOptimal: rangeToText(LAB_OPTIMAL_RANGES['睪固酮']),
    why: '醫院「正常」下限 300 已是嚴重偏低 — 影響肌肉、骨密度、性慾、認知。最佳區間 700-900 才是真正的代謝活躍狀態。'
  },
  {
    testName: '游離睪固酮（男）', unit: 'pg/mL', category: '甲狀腺 / 荷爾蒙',
    hospitalNormal: rangeToText((LAB_THRESHOLDS as any)['游離睪固酮']?.normal),
    howardOptimal: rangeToText(LAB_OPTIMAL_RANGES['游離睪固酮']),
    why: '真正可用的睪固酮 — 比總睪固酮更重要。SHBG 升高會壓低這個數字即使總睪固酮正常。'
  },
  {
    testName: 'TSH', unit: 'mIU/L', category: '甲狀腺 / 荷爾蒙',
    hospitalNormal: rangeToText((LAB_THRESHOLDS as any)['TSH']?.normal),
    howardOptimal: rangeToText(LAB_OPTIMAL_RANGES['TSH']),
    why: '醫院「正常」是 0.4-4.0 但 2.5-4.0 範圍其實已是亞臨床低下信號。最佳區間 1.0-2.5 才是甲狀腺真正活躍狀態。'
  },
]

export default function StandardsComparisonPage() {
  const params = useParams()
  const clientId = (params?.clientId as string) ?? ''

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="bg-white border-b border-gray-200 px-4 py-4 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-2 mb-2">
            <Link href={`/c/${clientId}/health/timeline`} className="text-gray-500 hover:text-gray-700">
              <ChevronLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-lg font-semibold text-gray-900">標準對照</h1>
          </div>
          <p className="text-xs text-gray-500 ml-7">
            Howard 採用的最佳化追蹤範圍 vs 一般醫院的「正常」門檻
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6">
        <div className="bg-primary-50 border border-primary-200 rounded-xl p-4 mb-6">
          <p className="text-sm text-primary-900 leading-relaxed">
            <strong>為什麼會有「兩套標準」？</strong>
            <br />
            一般醫院檢驗報告上的「正常範圍」是基於人群統計的<strong>疾病門檻</strong> — 過了線才算病。
            但「沒病」≠「最佳健康狀態」。Howard Protocol 採用的「最佳化追蹤範圍」參考<strong>國際長壽研究 + 功能醫學文獻</strong>，
            以長期健康、預防、表現優化為導向。
            <br />
            <br />
            <strong>連續追蹤趨勢 &gt; 單一數字</strong>。同一個指標，從 X 變化到 Y 比「目前在多少」更值得關注。
          </p>
        </div>

        {/* 標準來源說明（更客觀的雙軌呈現）*/}
        <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6 text-xs leading-relaxed">
          <div className="font-semibold text-gray-900 mb-2">📚 標準來源說明</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <div className="font-medium text-gray-700 mb-1">「醫院正常」（警示閾值）</div>
              <ul className="text-gray-600 list-disc list-inside space-y-0.5">
                <li>hsCRP：AHA/CDC 工作組</li>
                <li>HbA1c / 空腹血糖：ADA</li>
                <li>維生素 D：Endocrine Society</li>
                <li>ApoB / LDL：Canadian CCS / AHA 2021</li>
                <li>TSH / 甲狀腺：Endocrine Society</li>
              </ul>
            </div>
            <div>
              <div className="font-medium text-emerald-700 mb-1">「Howard 進階追蹤」（個人優化目標）</div>
              <ul className="text-gray-600 list-disc list-inside space-y-0.5">
                <li>參考國際長壽研究文獻</li>
                <li>功能醫學「最佳化範圍」共識</li>
                <li>方向：「沒病門檻 → 最佳化目標」</li>
                <li><strong>非醫學共識診斷標準</strong></li>
                <li>適合搭配教練 + 整合醫學醫師執行</li>
              </ul>
            </div>
          </div>
        </div>

        {CATEGORIES.map(cat => {
          const rows = COMPARISONS.filter(c => c.category === cat)
          if (rows.length === 0) return null
          return (
            <section key={cat} className="mb-8">
              <h2 className="text-base font-semibold text-gray-900 mb-3">{cat}</h2>
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs text-gray-600">
                    <tr>
                      <th className="px-3 py-2 text-left">指標</th>
                      <th className="px-3 py-2 text-left">醫院「正常」</th>
                      <th className="px-3 py-2 text-left">Howard 最佳</th>
                      <th className="px-3 py-2 text-left hidden md:table-cell">為什麼有差</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(r => (
                      <tr key={r.testName} className="border-t border-gray-100">
                        <td className="px-3 py-3 align-top">
                          <div className="font-medium text-gray-900">{r.testName}</div>
                          <div className="text-[11px] text-gray-500">{r.unit}</div>
                        </td>
                        <td className="px-3 py-3 align-top text-gray-700">{r.hospitalNormal}</td>
                        <td className="px-3 py-3 align-top">
                          <span className="inline-block px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                            {r.howardOptimal}
                          </span>
                        </td>
                        <td className="px-3 py-3 align-top text-xs text-gray-600 hidden md:table-cell">
                          {r.why}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Mobile: 為什麼有差 顯示為下方註解 */}
              <div className="md:hidden mt-2 space-y-2">
                {rows.map(r => (
                  <div key={r.testName} className="text-xs text-gray-600 leading-relaxed px-2">
                    <strong className="text-gray-900">{r.testName}</strong>：{r.why}
                  </div>
                ))}
              </div>
            </section>
          )
        })}

        <div className="mt-10 bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-xs text-amber-900 leading-relaxed">
            <strong>免責提醒：</strong>本對照表為教練參考資訊，僅作為生活方式調整的參考依據，
            <strong>不構成醫療診斷、治療或處方建議</strong>。
            您的健檢報告應由您的醫師專業判讀，任何指標異常請諮詢家醫科或整合醫學醫師。
          </p>
        </div>
      </div>
    </div>
  )
}
