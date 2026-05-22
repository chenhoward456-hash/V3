'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

interface FaqItem {
  cat: string
  q: string
  a: string
}

const FAQS: FaqItem[] = [
  // 基礎觀念
  {
    cat: '基礎觀念',
    q: '為什麼 ApoB 比 LDL-C 更重要？',
    a: 'LDL-C 測的是膽固醇「總含量」，但動脈粥狀硬化是由顆粒撞擊血管壁造成，所以「顆粒數量」(ApoB) 比含量更接近真正風險。2021 Canadian CVS Guidelines 已建議當三酸甘油酯 >1.5 mmol/L 時，ApoB 為優選篩檢指標。Peter Attia「Outlive」(2023) 也以 ApoB 為心血管風險核心指標。',
  },
  {
    cat: '基礎觀念',
    q: '為什麼 Howard 標準 ApoB <50 比醫院 <130 嚴格？',
    a: '醫院 <130 是「疾病門檻」(過了就算高血脂)。Peter Attia 在「Outlive」主張長壽優化目標為 ApoB <50（最低風險區）— 此為個人化健康優化立場，**非醫學共識診斷標準**。2024 JAMA Cardiology 研究顯示，LDL-C 70 對應的人群中位 ApoB 約 60，所以 <50 是「比中位數更低」的位置。',
  },
  {
    cat: '基礎觀念',
    q: '空腹胰島素為什麼比血糖更早顯示問題？',
    a: '胰島素阻抗發展過程：胰島素分泌增加 → 維持血糖正常 → 持續 10-20 年 → 胰臟撐不住 → 血糖才升高 → 一般健檢才看到。空腹胰島素能在這個沉默期早期捕捉。功能醫學共識：<5 µIU/mL「健康」；長壽派 (Attia) <2.5。',
  },
  {
    cat: '基礎觀念',
    q: '同半胱胺酸 (Homocysteine) 是什麼？',
    a: '甲基化代謝的中間產物。標準實驗室「正常」<15 µmol/L，但研究顯示 >10 心血管風險上升、>15 失智症風險上升。功能醫學優化區間 6-9。常見升高原因：B12 / 葉酸 / B6 缺乏、MTHFR 基因變異。介入：甲基化形式 B12 + 葉酸。',
  },
  {
    cat: '基礎觀念',
    q: '為什麼追蹤「趨勢」比單一數字重要？',
    a: '同樣是 ApoB 60，從 80 → 60 (進步) 跟從 40 → 60 (退步) 意義完全相反。年度健檢只看到 snapshot；連續追蹤能抓「方向 + 速度」，更能預測未來健康狀態。',
  },
  {
    cat: '基礎觀念',
    q: '我可以自己抽血嗎？',
    a: '台灣法規下，血液檢驗需醫師處方。你可以到聯安、美兆、汎美等健檢中心做完整 panel，或請家醫科 / 整合醫學醫師開立檢驗單。拿到報告後上傳到系統就能自動生成觀察筆記。',
  },

  // 補品策略
  {
    cat: '補品策略',
    q: 'Omega-3 EPA/DHA 該吃多少？魚油 vs 藻油？',
    a: 'AHA 2019 科學建議：高三酸甘油酯者 4 g/日 EPA+DHA 處方級劑量；一般保健 1-2 g/日。REDUCE-IT 試驗 (NEJM 2019) 顯示 4g/日 EPA 處方藥降低心血管事件 25%。魚油 vs 藻油：藻油為原始來源、不含重金屬、適合素食者；魚油較便宜。FDA 一般 OTC 建議 ≤2g/日，超過建議與醫師討論。',
  },
  {
    cat: '補品策略',
    q: '維生素 D 過量風險？>100 ng/mL 有事嗎？',
    a: 'Endocrine Society 建議 25-OH-D 目標 40-60 ng/mL；高劑量補充 (>4000 IU/日長期) 可能造成高血鈣症。文獻認為 >100 ng/mL 為毒性警示區、>150 ng/mL 明確高血鈣風險上升。建議搭配 K2 (MK-7) 引導鈣質沉積到骨骼而非血管。',
  },
  {
    cat: '補品策略',
    q: '長期補鋅該注意銅平衡嗎？',
    a: '是。長期高劑量鋅 (>40 mg/日) 會競爭抑制銅吸收，造成銅缺乏（影響鐵代謝、神經）。文獻建議鋅:銅比約 15:1（例：鋅 15 mg + 銅 1 mg）。短期備賽期可不補銅，長期 (>3 個月) 建議搭配。',
  },
  {
    cat: '補品策略',
    q: '維生素 K2 為什麼要跟 D3 一起吃？',
    a: 'D3 促進腸道吸收鈣質、K2 (MK-7) 引導鈣質沉積到骨骼而非血管。研究方向認為單獨高劑量 D3 可能增加血管鈣化風險，搭配 K2 可平衡。常見組合：D3 4000-5000 IU + K2 (MK-7) 100-200 mcg。',
  },

  // 進階追蹤
  {
    cat: '進階追蹤',
    q: 'HRV（心率變異性）是什麼？為什麼追蹤？',
    a: 'HRV 衡量自律神經系統「交感 vs 副交感」平衡。高 HRV = 神經系統有彈性、恢復良好；低 HRV = 持續壓力、過度訓練、疾病早期信號。常用設備：Garmin、Polar、Oura Ring、Apple Watch（夜間測得最準）。沒有絕對「好壞」數字，個人基線比較才有意義。',
  },
  {
    cat: '進階追蹤',
    q: '連續血糖監測 (CGM) 適合非糖尿病人嗎？',
    a: 'CGM 用 14 天 sensor 連續測組織液血糖，可看食物、運動、壓力、睡眠對血糖即時反應。Levels Health、Veri 等公司針對非糖尿病人「代謝健康優化」市場。台灣自費 NT$2000-3000 / 14 天。對代謝症候群高風險者有教育價值，但長期使用對非糖尿病人的硬 outcome 證據仍有限，**主要是教育用途**。',
  },
  {
    cat: '進階追蹤',
    q: 'DEXA 體脂掃描多久該做一次？',
    a: 'DEXA 是測量身體組成「金標準」（脂肪、肌肉、骨密度分區）。建議：基線測 1 次 + 每 12-24 個月複測。每年做 1 次合理。台灣自費 NT$2000-3000。比 InBody 準確很多但不便宜，建議用於「長期 trajectory」追蹤，不是月月測。',
  },
  {
    cat: '進階追蹤',
    q: '表觀基因年齡 (Epigenetic age) 測試值得嗎？',
    a: '基於 DNA 甲基化模式估算「生物年齡」(GrimAge / PhenoAge 等)。研究方向認為它跟長壽相關性比實際年齡強。但目前商業檢測 (Elysium TruAge、TruDiagnostic) 個人化準確度、生活方式介入後變化的可靠性仍有爭議。值得測：好奇 + 預算夠。不值得測：希望靠它做精準介入決策的人。',
  },

  // 實務操作
  {
    cat: '實務操作',
    q: '如何跟一般家醫科溝通自費加驗項目？',
    a: '直接列清單：「我想自費加驗 ApoB / Lp(a) / 空腹胰島素 / hs-CRP / 同半胱胺酸 / Free T3 / Vit D」。家醫科通常願意協助開立。遇到「健保不給付不能加驗」時，請改去：(1) 整合醫學或功能醫學門診 (2) 大型健檢中心（聯安、美兆、汎美等）做完整 panel。',
  },
  {
    cat: '實務操作',
    q: '抽血前該怎麼準備？',
    a: '基本：空腹 8-12 小時（只能喝水）、前一天降低訓練量（避免 ALT / CK 因運動升高）、避免酒精 48 小時、選擇上午 7-9 點抽（皮質醇 / 睪固酮日內變化）。長期藥物 / 補品照常吃但記錄下來。女性建議經期第 21 天 (黃體期中)、固定每次相同期相比較。',
  },
  {
    cat: '實務操作',
    q: '健保檢驗 vs 自費功能醫學檢驗差在哪？',
    a: '健保項目以「疾病診斷」為導向，項目少（一般健檢約 10-15 項）、用「疾病門檻」判讀。自費功能醫學項目以「健康優化」為導向，可加驗 ApoB、Lp(a)、空腹胰島素、Free T3、同半胱胺酸、Omega-3 指數、有機酸等 30-100 項，用「最佳化範圍」判讀。Howard Protocol 主要服務後者。',
  },
  {
    cat: '實務操作',
    q: '報告紅字 / 紅字解讀心法',
    a: '不要看到紅字就慌、也不要綠字就放心。三個層次：(1) **方向**：跟自己上次比，進步還是退步？(2) **位置**：在「警示」線附近、還是已到「最佳」位置？(3) **關聯**：跟其他指標一起看，是不是某個系統（代謝、發炎、荷爾蒙）整組偏移？單一紅字 + 趨勢進步 = 不用慌；單一綠字 + 趨勢惡化 = 要注意。',
  },
]

const CATEGORIES = ['基礎觀念', '補品策略', '進階追蹤', '實務操作']

export default function HealthLearnPage() {
  const params = useParams()
  const clientId = (params?.clientId as string) ?? ''
  const [activeCat, setActiveCat] = useState<string>('基礎觀念')

  const filtered = FAQS.filter(f => f.cat === activeCat)

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="bg-white border-b border-gray-200 px-4 py-4 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-2 mb-1">
            <Link href={`/c/${clientId}/health/timeline`} className="text-gray-500 hover:text-gray-700">
              <ChevronLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-lg font-semibold text-gray-900">健康知識 FAQ</h1>
          </div>
          <p className="text-xs text-gray-500 ml-7">
            常見問題、文獻方向、實務操作 — 想到再來查
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* 類別 tab */}
        <div className="flex gap-2 mb-4 overflow-x-auto">
          {CATEGORIES.map(c => (
            <button
              key={c}
              onClick={() => setActiveCat(c)}
              className={`px-4 py-2 text-sm rounded-full whitespace-nowrap transition-colors ${
                activeCat === c
                  ? 'bg-emerald-600 text-white'
                  : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        {/* FAQ list */}
        <div className="space-y-2">
          {filtered.map((item, i) => (
            <details key={i} className="group bg-white border border-gray-200 rounded-lg">
              <summary className="cursor-pointer px-4 py-3 text-sm text-gray-900 hover:bg-gray-50 rounded-lg list-none flex items-center justify-between">
                <span className="font-medium pr-2">{item.q}</span>
                <span className="text-gray-400 group-open:rotate-180 transition-transform shrink-0">▾</span>
              </summary>
              <p className="px-4 pb-3 pt-1 text-sm text-gray-700 leading-relaxed">
                {item.a}
              </p>
            </details>
          ))}
        </div>

        {/* 來源參考 — 折疊式 */}
        <details className="mt-8 bg-white border border-gray-200 rounded-lg">
          <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg list-none flex items-center justify-between">
            <span>📚 主要參考來源</span>
            <span className="text-gray-400">▾</span>
          </summary>
          <ul className="px-4 pb-3 text-xs text-gray-600 space-y-1 leading-relaxed">
            <li>• 2021 Canadian Cardiovascular Society Guidelines for Dyslipidemia (Pearson et al., Can J Cardiol)</li>
            <li>• Individual Variation in ApoB Distribution (Sayed et al., 2024 JAMA Cardiol)</li>
            <li>• AHA/CDC Working Group: hsCRP Risk Categories (&lt;1 低 / 1-3 中 / &gt;3 高)</li>
            <li>• AHA 2019 Science Advisory: Omega-3 for Hypertriglyceridemia (4 g/d EPA+DHA)</li>
            <li>• REDUCE-IT trial (Bhatt et al., 2019 NEJM): EPA 4g/d → MACE -25%</li>
            <li>• Endocrine Society Vitamin D Guidelines (40-60 ng/mL 偏好區間)</li>
            <li>• Peter Attia「Outlive: The Science &amp; Art of Longevity」(2023)</li>
            <li>• IFM / 功能醫學共識（同半胱胺酸 6-9、Vit D &gt;40）</li>
          </ul>
        </details>

        {/* 免責 */}
        <p className="mt-6 text-[11px] text-amber-700 leading-relaxed">
          ⚠️ 本 FAQ 為教練資訊整理，不構成醫療診斷或處方建議。如有具體健康疑慮請諮詢家醫科或整合醫學醫師。
        </p>
      </div>
    </div>
  )
}
