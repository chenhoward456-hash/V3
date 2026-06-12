import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'

export const metadata: Metadata = {
  title: '我的故事 - The Howard Protocol',
  description: 'Howard 的 6 年體態追蹤紀錄。從2020年系統崩潰到2026年完全重生，透過系統化訓練與營養介入達到菁英等級。',
  alternates: { canonical: 'https://howard456.vercel.app/case' },
  openGraph: {
    title: '我的故事 - The Howard Protocol',
    description: 'Howard 的 6 年體態追蹤紀錄 - 從系統崩潰到完全重生',
    url: 'https://howard456.vercel.app/case',
  },
}

// 達到 Howard 最佳標準的指標（藍標＝正常之上的最佳化區）。陳胤豪本人真實 lab_results。
const OPTIMAL_MARKERS = [
  { name: 'HOMA-IR', value: '0.49', std: '最佳 < 0.8', desc: '胰島素敏感度頂級' },
  { name: '空腹胰島素', value: '2.17', unit: 'μIU/mL', std: '最佳 < 2.5', desc: '代謝健康' },
  { name: 'ApoB', value: '42', unit: 'mg/dL', std: '最佳 ~50', desc: '心血管風險極低' },
  { name: '三酸甘油酯', value: '34', unit: 'mg/dL', std: '最佳 < 60', desc: '血脂教科書級' },
  { name: 'LDL-C', value: '69', unit: 'mg/dL', std: '最佳 < 100', desc: '低密度膽固醇' },
  { name: 'HDL-C', value: '69', unit: 'mg/dL', std: '越高越好', desc: '高密度膽固醇' },
  { name: 'HbA1c', value: '5.1', unit: '%', std: '最佳 < 5.5', desc: '血糖控制' },
  { name: '維生素D', value: '59', unit: 'ng/mL', std: '最佳 60–80', desc: '接近最佳區' },
]

// 「看出方向 → 個人化補充 → 抽血回測」的鐵證
const BEFORE_AFTER = [
  {
    name: '同半胱胺酸',
    from: '15',
    to: '9',
    unit: 'μmol/L',
    story:
      'MTHFR 雜合基因型，葉酸代謝效率較低。依數據與基因型搭配活性葉酸（5-MTHF）營養補充，4 次回測追蹤，數字從偏高回到範圍內。對 MTHFR 型，活性葉酸的吸收路徑不同——這是基因導向營養才看得到的差別。',
    cite: 'Qin 2012, Nutr J — 華人 RCT：MTHFR C677T 基因型影響葉酸降同半胱胺酸的效果',
  },
  {
    name: '維生素 D',
    from: '27',
    to: '59',
    unit: 'ng/mL',
    story:
      '從「不足」（< 30）拉到接近最佳區（60–80）。3 次回測追蹤劑量反應，不是補一補就算了。',
    cite: 'Endocrine Society 維生素 D 指引',
  },
]

export default function CasePage() {
  return (
    <section className="section-container">
      <h2 className="doc-title">我的故事</h2>
      <p className="doc-subtitle">Howard 的 6 年體態追蹤紀錄</p>

      <div className="bg-warning/5 border-2 border-warning/30 rounded-xl p-6 mb-8">
        <p className="text-text-secondary text-sm leading-relaxed">
          ⚠️ <strong>個人經驗分享</strong>：以下內容為個人案例紀錄，僅供參考。每個人的身體狀況不同，效果因人而異。任何健康相關決策請諮詢專業醫療人員。
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-10 my-16">
        <div className="relative">
          <div className="absolute -top-3 -left-3 bg-danger/75 text-white px-4 py-1.5 rounded-full font-normal text-sm z-10">
            2020 年初
          </div>
          <div className="relative h-[300px] md:h-[420px] rounded-[1.5rem] overflow-hidden" style={{boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04), 0 12px 32px rgba(0, 0, 0, 0.03)'}}>
            <Image
              src="/before.jpg"
              alt="2020 年系統崩潰狀態"
              fill
              className="object-cover"
            />
          </div>
          <div className="mt-6">
            <h3 className="text-danger mb-4 text-lg font-medium">❌ 系統失效</h3>
            <div className="bg-bg-tertiary/40 p-6 rounded-2xl border-l-[3px] border-danger/40">
              <div className="text-text-secondary leading-loose text-[15px]">
                • 嚴重落髮（頭頂明顯稀疏）<br />
                • 圓潤浮腫的臉型<br />
                • 全身性慢性發炎<br />
                • 持續疲勞、無動力<br />
                • hs-CRP 發炎指標異常
              </div>
            </div>
          </div>
        </div>

        <div className="relative">
          <div className="absolute -top-3 -left-3 bg-success/75 text-white px-4 py-1.5 rounded-full font-normal text-sm z-10">
            2026 年
          </div>
          <div className="relative h-[300px] md:h-[420px] rounded-[1.5rem] overflow-hidden" style={{boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04), 0 12px 32px rgba(0, 0, 0, 0.03)'}}>
            <Image
              src="/after.jpg"
              alt="2026 年完全重生狀態 - 頭髮恢復與體態改善"
              fill
              className="object-cover"
              style={{ objectPosition: 'center 20%' }}
            />
          </div>
          <div className="mt-6">
            <h3 className="text-success mb-4 text-lg font-medium">✓ 系統優化</h3>
            <div className="bg-bg-tertiary/40 p-6 rounded-2xl border-l-[3px] border-success/40">
              <div className="text-text-secondary leading-loose text-[15px]">
                • 頭髮恢復濃密<br />
                • 精實體態 (FFMI 23.6)<br />
                • 發炎指標正常化<br />
                • 精力充沛、高效能<br />
                • HRV 達到菁英等級 (91ms)
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white border-2 border-border p-10 rounded-2xl my-12">
        <h3 className="mb-6 text-text-primary text-[1.3rem] font-bold">🔬 核心發現</h3>
        <div className="code-block">
          <span className="code-label">系統分析結果</span>
          <div className="leading-loose">
            根據<strong>個人經驗</strong>，落髮可能不只是「年紀問題」，而是身體系統發出的警告訊號。<br /><br />
            
            經過系統化追蹤與調整，我發現三大可能原因：<br />
            1. <strong>慢性發炎</strong> - 可能影響毛囊健康<br />
            2. <strong>荷爾蒙波動</strong> - 睪固酮偏低，DHT 轉換過度<br />
            3. <strong>代謝問題</strong> - 胰島素阻抗，營養輸送受阻
          </div>
        </div>
      </div>

      <h3 className="my-16 text-2xl font-bold text-text-primary">📈 數據時間軸</h3>
      
      <div className="grid gap-8">
        <div className="protocol-card">
          <span className="tag red">2020 年初</span>
          <h3 className="text-xl mb-4 text-danger font-bold">系統崩潰期</h3>
          <p className="text-text-secondary mb-4">
            嚴重落髮、浮腫、慢性疲勞
          </p>
          <div className="bg-bg-tertiary p-4 rounded-lg font-mono">
            <div className="text-danger font-bold text-2xl mb-2">
              hs-CRP: 高
            </div>
            <div className="text-text-muted text-sm">發炎指標異常</div>
          </div>
        </div>

        <div className="protocol-card">
          <span className="tag orange">2022 年</span>
          <h3 className="text-xl mb-4 text-warning font-bold">系統修復期</h3>
          <p className="text-text-secondary mb-4">
            開始系統化訓練與營養介入
          </p>
          <div className="bg-bg-tertiary p-4 rounded-lg font-mono">
            <div className="text-warning font-bold text-2xl mb-2">
              Testosterone: 515 ng/dL
            </div>
            <div className="text-text-muted text-sm">荷爾蒙偏低</div>
          </div>
        </div>

        <div className="protocol-card">
          <span className="tag green">2026 年</span>
          <h3 className="text-xl mb-4 text-success font-bold">系統優化完成</h3>
          <p className="text-text-secondary mb-4">
            所有指標達到菁英水平
          </p>
          <div className="bg-bg-tertiary p-4 rounded-lg font-mono">
            <div className="text-success font-bold text-xl mb-2">
              Testosterone: 625 ng/dL<br />
              HOMA-IR: 0.49<br />
              HRV: 91 ms
            </div>
            <div className="text-text-muted text-sm">ELITE 等級</div>
          </div>
        </div>
      </div>

      {/* 血檢藍標 — 不是減重，是把整個身體調到最佳 */}
      <div className="my-24 max-w-4xl mx-auto">
        <h2 className="text-3xl font-bold text-center mb-4" style={{color: '#2D2D2D', letterSpacing: '0.05em'}}>
          血檢：不是減重，是把整個身體調到最佳
        </h2>
        <p className="text-center text-gray-600 mb-12 max-w-2xl mx-auto leading-relaxed">
          一個 7.8% 體脂的身體，代謝、血脂、血糖幾乎全項落在 Howard 最佳標準（藍標＝正常之上的最佳化區）。
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {OPTIMAL_MARKERS.map((m) => (
            <div key={m.name} className="rounded-2xl border border-blue-100 bg-blue-50/40 p-4">
              <div className="text-xs text-slate-500">{m.name}</div>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-2xl font-bold text-blue-700">{m.value}</span>
                {m.unit && <span className="text-[11px] text-slate-400">{m.unit}</span>}
              </div>
              <div className="mt-1 inline-block text-[10px] font-medium text-blue-600 bg-blue-100 rounded px-1.5 py-0.5">{m.std}</div>
              <div className="text-[11px] text-slate-500 mt-1.5 leading-snug">{m.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 看出方向 → 個人化補充 → 抽血回測（含真實檢驗單） */}
      <div className="my-24 max-w-4xl mx-auto">
        <h2 className="text-3xl font-bold text-center mb-4" style={{color: '#2D2D2D', letterSpacing: '0.05em'}}>
          看出方向 → 個人化補充策略 → 抽血追蹤變化
        </h2>
        <p className="text-center text-gray-600 mb-12 max-w-2xl mx-auto leading-relaxed">
          不是吃補品碰運氣，是讀進血檢與基因、個人化調整，再用回測追蹤變化。相關補充與飲食調整，建議與醫師或藥師討論。
        </p>
        <div className="space-y-5">
          {BEFORE_AFTER.map((b) => (
            <div key={b.name} className="rounded-2xl border border-gray-200 bg-white p-6">
              <div className="flex items-center gap-4 mb-3">
                <span className="text-base font-semibold text-gray-900">{b.name}</span>
                <div className="flex items-baseline gap-2">
                  <span className="text-xl text-gray-400 line-through decoration-gray-300">{b.from}</span>
                  <span className="text-emerald-500">→</span>
                  <span className="text-2xl font-bold text-emerald-600">{b.to}</span>
                  <span className="text-xs text-gray-400">{b.unit}</span>
                </div>
              </div>
              <p className="text-sm text-gray-600 leading-relaxed">{b.story}</p>
              <p className="text-[11px] text-gray-400 mt-2">📄 {b.cite}</p>
            </div>
          ))}
        </div>

        {/* 真實檢驗報告 — 同半胱胺酸前後對照（原始檢驗單） */}
        <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-6">
          <p className="text-xs font-medium text-gray-500 mb-3">真實檢驗報告 — 同半胱胺酸（原始檢驗單，未修圖）</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <figure className="m-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/case-homocysteine-before.jpg" alt="同半胱胺酸 15.0（補充前）" className="w-full rounded-lg border border-gray-100 bg-white" />
              <figcaption className="text-[11px] text-gray-400 mt-1 text-center">補充前 · 15.0</figcaption>
            </figure>
            <figure className="m-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/case-homocysteine-after.jpg" alt="同半胱胺酸 9.3（追蹤後）" className="w-full rounded-lg border border-gray-100 bg-white" />
              <figcaption className="text-[11px] text-gray-400 mt-1 text-center">追蹤後 · 9.3</figcaption>
            </figure>
          </div>
        </div>
      </div>

      {/* 誠實揭露 — 把激進減脂的代價講出來，並展示系統如何自動防護 */}
      <div className="my-24 max-w-4xl mx-auto">
        <div className="rounded-2xl border-2 border-amber-200 bg-amber-50/50 p-6 md:p-8">
          <p className="text-base font-bold text-gray-900 mb-2">誠實說一件事</p>
          <p className="text-sm text-gray-600 leading-relaxed">
            備賽到 7.8% 這麼瘦，睪固酮確實會下降——這是激進減脂的代價，多數教練不會跟你說。所以這套系統會<strong className="text-gray-900">依體脂自動收手</strong>：體脂太低就縮減熱量赤字，不為了數字把人榨乾。看得到代價、也防得住，才是真的系統。
          </p>
        </div>
      </div>

      {/* Technical Stack */}
      <div className="my-24 max-w-4xl mx-auto">
        <h2 className="text-3xl font-bold text-center mb-12" style={{color: '#2D2D2D', letterSpacing: '0.05em'}}>
          Technical Stack
        </h2>
        <p className="text-center text-gray-600 mb-12">
          專業背景與技術規格
        </p>

        <div className="bg-white border-2 border-gray-200 rounded-2xl p-8">
          <div className="grid md:grid-cols-2 gap-8">
            {/* 學歷認證 */}
            <div>
              <h3 className="text-sm font-bold text-gray-400 mb-4 tracking-wider">EDUCATION & CERTIFICATION</h3>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <span className="text-primary font-mono text-sm">▸</span>
                  <div>
                    <p className="font-medium text-gray-900">高雄醫學大學 運動醫學系</p>
                    <p className="text-sm text-gray-500">Bachelor of Sports Medicine</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-primary font-mono text-sm">▸</span>
                  <div>
                    <p className="font-medium text-gray-900">NSCA-CSCS 肌力與體能專家</p>
                    <p className="text-sm text-gray-500">Certified Strength & Conditioning Specialist</p>
                  </div>
                </div>
              </div>
            </div>

            {/* 技術專長 */}
            <div>
              <h3 className="text-sm font-bold text-gray-400 mb-4 tracking-wider">TECHNICAL EXPERTISE</h3>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <span className="text-success font-mono text-sm">✓</span>
                  <div>
                    <p className="font-medium text-gray-900">數據追蹤與分析</p>
                    <p className="text-sm text-gray-500">HRV / 血檢 / 體組成 / 訓練量化</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-success font-mono text-sm">✓</span>
                  <div>
                    <p className="font-medium text-gray-900">系統化訓練設計</p>
                    <p className="text-sm text-gray-500">肌力 / 代謝 / 恢復 / 營養介入</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-success font-mono text-sm">✓</span>
                  <div>
                    <p className="font-medium text-gray-900">個人實驗數據庫</p>
                    <p className="text-sm text-gray-500">6 年完整追蹤記錄（2020-2026）</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 數據規格 */}
          <div className="mt-8 pt-8 border-t-2 border-gray-100">
            <h3 className="text-sm font-bold text-gray-400 mb-4 tracking-wider">PERFORMANCE METRICS (2026)</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="font-mono text-2xl font-bold text-primary">625</div>
                <div className="text-xs text-gray-500 mt-1">Testosterone (ng/dL)</div>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="font-mono text-2xl font-bold text-success">0.49</div>
                <div className="text-xs text-gray-500 mt-1">HOMA-IR</div>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="font-mono text-2xl font-bold text-warning">91</div>
                <div className="text-xs text-gray-500 mt-1">HRV (ms)</div>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="font-mono text-2xl font-bold text-gray-900">ELITE</div>
                <div className="text-xs text-gray-500 mt-1">Overall Grade</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 訓練方法論 - Zone 2 實測 */}
      <div className="my-24 max-w-4xl mx-auto">
        <h2 className="text-3xl font-bold text-center mb-4" style={{color: '#2D2D2D', letterSpacing: '0.05em'}}>
          訓練方法論
        </h2>
        <p className="text-center text-gray-600 mb-12">
          備賽期間的 Zone 2 有氧實測數據
        </p>

        <div className="bg-gradient-to-br from-success/5 to-success/10 rounded-2xl p-8 border-2 border-success/20">
          <div className="flex items-center gap-3 mb-6">
            <span className="text-3xl">🏃</span>
            <div>
              <h3 className="text-2xl font-bold" style={{color: '#2D2D2D'}}>Zone 2 登階機 5 大好處</h3>
              <p className="text-sm text-gray-600">12 週 Whoop 實測數據</p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6 mb-6">
            <div className="bg-white rounded-xl p-6">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-2xl">✅</span>
                <h4 className="font-bold text-lg" style={{color: '#2D2D2D'}}>提升 HRV</h4>
              </div>
              <p className="text-gray-600 text-sm mb-2">Higher HRV</p>
              <div className="bg-success/10 rounded-lg p-3">
                <p className="text-sm text-gray-700">65ms → <strong className="text-success">91ms</strong> (+40%)</p>
              </div>
              <p className="text-xs text-gray-500 mt-2">副交感神經活性強，壓力恢復力佳</p>
            </div>

            <div className="bg-white rounded-xl p-6">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-2xl">✅</span>
                <h4 className="font-bold text-lg" style={{color: '#2D2D2D'}}>降低 RHR</h4>
              </div>
              <p className="text-gray-600 text-sm mb-2">Lower Resting Heart Rate</p>
              <div className="bg-primary/10 rounded-lg p-3">
                <p className="text-sm text-gray-700">58bpm → <strong className="text-primary">52bpm</strong> (-10%)</p>
              </div>
              <p className="text-xs text-gray-500 mt-2">心臟效率提升，心肺功能強化</p>
            </div>

            <div className="bg-white rounded-xl p-6">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-2xl">✅</span>
                <h4 className="font-bold text-lg" style={{color: '#2D2D2D'}}>睡眠更好</h4>
              </div>
              <p className="text-gray-600 text-sm mb-2">Better Sleep Quality</p>
              <div className="bg-warning/10 rounded-lg p-3">
                <p className="text-sm text-gray-700">深睡 18% → <strong className="text-warning">24%</strong> (+33%)</p>
              </div>
              <p className="text-xs text-gray-500 mt-2">穩定神經系統，深睡比例高</p>
            </div>

            <div className="bg-white rounded-xl p-6">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-2xl">✅</span>
                <h4 className="font-bold text-lg" style={{color: '#2D2D2D'}}>核心穩定</h4>
              </div>
              <p className="text-gray-600 text-sm mb-2">Stronger Core & Lower Body</p>
              <p className="text-xs text-gray-500">大肌群連動，排列穩定</p>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-2xl">✅</span>
              <h4 className="font-bold text-lg" style={{color: '#2D2D2D'}}>穩定情緒</h4>
            </div>
            <p className="text-sm text-gray-600">Zone 2 有氧最能舒壓 → 腦內啡上升，心情穩定</p>
          </div>

          <div className="mt-6 p-4 bg-gray-50 rounded-lg border-l-4 border-success">
            <p className="text-sm text-gray-700 leading-relaxed">
              💡 <strong>重點</strong>：Zone 2 有氧不是只有創造熱量赤字，它能讓粒線體效率更佳，大家不重訓至少好好善待自己的心肺能力！
            </p>
          </div>

          <div className="text-center mt-6">
            <Link 
              href="/blog/zone-2-cardio-benefits"
              className="inline-block text-success hover:underline font-medium"
            >
              閱讀完整文章 →
            </Link>
          </div>
        </div>
      </div>

      {/* CTA — 轉換目標：免費系統分析 */}
      <div className="my-16 bg-slate-900 text-white rounded-2xl p-8 md:p-12 text-center">
        <h3 className="text-2xl md:text-3xl font-bold mb-3">想知道你的身體能被優化到什麼程度？</h3>
        <p className="text-slate-300 mb-8 leading-relaxed max-w-xl mx-auto">
          先做一次免費的系統分析，30 秒看到你的營養目標與方向。
        </p>
        <Link
          href="/diagnosis"
          className="inline-block bg-blue-600 hover:bg-blue-700 transition-colors text-white font-bold px-8 py-4 rounded-xl text-lg"
        >
          免費系統分析 →
        </Link>
        <p className="text-xs text-slate-500 mt-4">不用註冊、不用付費，直接看結果</p>
        <p className="mt-6">
          <Link href="/training" className="text-slate-300 hover:text-white underline text-sm">查看完整訓練系統 →</Link>
        </p>
      </div>

      <p className="text-xs text-gray-400 leading-relaxed text-center max-w-3xl mx-auto mb-16">
        ⚠️ 個人案例分享，僅供參考。數據取自真實追蹤紀錄；每個人身體狀況不同，效果因人而異。任何健康決策請諮詢專業醫療人員。本服務非醫療行為。
      </p>
    </section>
  )
}
