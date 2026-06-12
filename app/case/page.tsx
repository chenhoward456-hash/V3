import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'

export const metadata: Metadata = {
  title: '我的故事 - The Howard Protocol',
  description: 'Howard 的 6 年體態追蹤紀錄。從掉髮、亞健康到 7.8% 體脂、血檢幾乎全項達標，透過系統化訓練、基因導向營養與抽血回測完成。',
  alternates: { canonical: 'https://howard456.vercel.app/case' },
  openGraph: {
    title: '我的故事 - The Howard Protocol',
    description: '從掉髮、亞健康到 7.8% 體脂、血檢全項達標 — 6 年系統化追蹤紀錄',
    url: 'https://howard456.vercel.app/case',
  },
}

// 開場數據快照（陳胤豪本人真實紀錄）
const HERO_STATS = [
  { value: '6 年', label: '完整追蹤' },
  { value: '7.8%', label: '體脂' },
  { value: '14 項', label: '血檢回測' },
  { value: '91ms', label: 'HRV · ELITE' },
]

// 轉變前後症狀對照
const BEFORE_SYMPTOMS = ['嚴重落髮（頭頂明顯稀疏）', '圓潤浮腫的臉型', '全身性慢性發炎', '持續疲勞、無動力', 'hs-CRP 發炎指標異常']
const AFTER_SYMPTOMS = ['頭髮恢復濃密', '精實體態（FFMI 23.6）', '發炎指標正常化', '精力充沛、高效能', 'HRV 達菁英等級（91ms）']

// 時間軸
const TIMELINE = [
  { year: '2020 年初', phase: '系統崩潰期', desc: '嚴重落髮、浮腫、慢性疲勞', stat: 'hs-CRP 偏高', statNote: '發炎指標異常', tone: 'rose' as const },
  { year: '2022 年', phase: '系統修復期', desc: '開始系統化訓練與營養介入', stat: 'Testosterone 515 ng/dL', statNote: '荷爾蒙偏低，緩步回升', tone: 'amber' as const },
  { year: '2026 年', phase: '系統優化完成', desc: '代謝、荷爾蒙、自律神經全面到位', stat: 'T 625 · HOMA-IR 0.49 · HRV 91', statNote: 'ELITE 等級', tone: 'emerald' as const },
]

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

// Zone 2 實測
const ZONE2 = [
  { metric: 'HRV', from: '65', to: '91', unit: 'ms', delta: '+40%', note: '副交感活性強，壓力恢復力佳' },
  { metric: '靜息心率', from: '58', to: '52', unit: 'bpm', delta: '-10%', note: '心臟效率提升，心肺強化' },
  { metric: '深層睡眠', from: '18', to: '24', unit: '%', delta: '+33%', note: '神經系統穩定，深睡比例高' },
]

function SectionHeader({ eyebrow, title, sub }: { eyebrow: string; title: string; sub?: string }) {
  return (
    <div className="mb-8">
      <p className="text-xs tracking-[0.2em] text-blue-600 font-medium mb-2">{eyebrow}</p>
      <h2 className="text-2xl md:text-3xl font-bold text-slate-900 leading-tight">{title}</h2>
      {sub && <p className="text-slate-500 mt-3 leading-relaxed">{sub}</p>}
    </div>
  )
}

const TONE = {
  rose: { dot: 'bg-rose-400', chip: 'text-rose-600 bg-rose-50 border-rose-200', stat: 'text-rose-600' },
  amber: { dot: 'bg-amber-400', chip: 'text-amber-600 bg-amber-50 border-amber-200', stat: 'text-amber-600' },
  emerald: { dot: 'bg-emerald-500', chip: 'text-emerald-600 bg-emerald-50 border-emerald-200', stat: 'text-emerald-600' },
}

export default function CasePage() {
  return (
    <div className="bg-white">
      {/* HERO */}
      <section className="bg-slate-900 text-white px-5 py-14 md:py-20">
        <div className="max-w-3xl mx-auto">
          <p className="text-xs tracking-[0.2em] text-blue-400 font-medium mb-5">THE HOWARD PROTOCOL · 我的故事</p>
          <h1 className="text-3xl md:text-5xl font-bold leading-tight mb-5">
            從掉髮、亞健康，
            <span className="block text-blue-400 mt-2">到 7.8% 體脂、血檢全項達標。</span>
          </h1>
          <p className="text-slate-300 text-base md:text-lg leading-relaxed max-w-xl">
            6 年完整追蹤紀錄。不是課表範本——是我把同一套系統用在自己身上、親身驗證過的東西。
          </p>
          <div className="grid grid-cols-4 gap-3 border-t border-slate-700 pt-8 mt-10">
            {HERO_STATS.map((s) => (
              <div key={s.label} className="text-center">
                <div className="text-xl md:text-3xl font-bold text-white">{s.value}</div>
                <div className="text-[11px] text-slate-400 mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 免責 */}
      <div className="px-5 pt-8 max-w-3xl mx-auto">
        <div className="rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3">
          <p className="text-xs text-slate-600 leading-relaxed">
            ⚠️ <strong className="text-slate-800">個人經驗分享</strong>：以下為個人案例紀錄，僅供參考。每個人身體狀況不同，效果因人而異。任何健康決策請諮詢專業醫療人員。
          </p>
        </div>
      </div>

      {/* 轉變前後 */}
      <section className="px-5 py-12 md:py-16 max-w-3xl mx-auto">
        <SectionHeader eyebrow="2020 → 2026" title="看得見的轉變" sub="頭髮、體態、發炎——都是身體狀態的鏡子。把整套系統調對，看不見的數據好了，看得見的地方也跟著回來。" />
        <div className="grid md:grid-cols-2 gap-5">
          {/* before */}
          <div>
            <div className="relative aspect-[3/4] rounded-2xl overflow-hidden border border-slate-200">
              <span className="absolute top-3 left-3 z-10 text-xs font-medium text-white bg-rose-500/85 rounded-full px-3 py-1">2020 年初</span>
              <Image src="/before.jpg" alt="2020 年系統崩潰狀態" fill className="object-cover" />
            </div>
            <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50/40 p-5">
              <p className="text-sm font-semibold text-rose-700 mb-3">系統失效</p>
              <ul className="space-y-1.5">
                {BEFORE_SYMPTOMS.map((s) => (
                  <li key={s} className="text-sm text-slate-600 flex gap-2"><span className="text-rose-400">·</span>{s}</li>
                ))}
              </ul>
            </div>
          </div>
          {/* after */}
          <div>
            <div className="relative aspect-[3/4] rounded-2xl overflow-hidden border border-slate-200">
              <span className="absolute top-3 left-3 z-10 text-xs font-medium text-white bg-emerald-500/85 rounded-full px-3 py-1">2026 年</span>
              <Image src="/after.jpg" alt="2026 年完全重生狀態" fill className="object-cover" style={{ objectPosition: 'center 20%' }} />
            </div>
            <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50/40 p-5">
              <p className="text-sm font-semibold text-emerald-700 mb-3">系統優化</p>
              <ul className="space-y-1.5">
                {AFTER_SYMPTOMS.map((s) => (
                  <li key={s} className="text-sm text-slate-600 flex gap-2"><span className="text-emerald-500">✓</span>{s}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* 核心發現 */}
      <section className="px-5 pb-4 max-w-3xl mx-auto">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 md:p-8">
          <p className="text-sm font-semibold text-slate-900 mb-3">🔬 核心發現</p>
          <p className="text-sm text-slate-600 leading-relaxed mb-4">
            根據個人經驗，落髮可能不只是「年紀問題」，而是身體系統發出的警告訊號。經過系統化追蹤與調整，我發現三個可能方向：
          </p>
          <div className="grid sm:grid-cols-3 gap-3">
            {[
              { t: '慢性發炎', d: '可能影響毛囊健康' },
              { t: '荷爾蒙波動', d: '睪固酮偏低、DHT 轉換過度' },
              { t: '代謝問題', d: '胰島素阻抗、營養輸送受阻' },
            ].map((x) => (
              <div key={x.t} className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-sm font-semibold text-slate-900">{x.t}</p>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">{x.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 時間軸 */}
      <section className="px-5 py-12 md:py-16 max-w-3xl mx-auto">
        <SectionHeader eyebrow="DATA TIMELINE" title="數據時間軸" />
        <div className="relative pl-6">
          <div className="absolute left-[5px] top-2 bottom-2 w-px bg-slate-200" />
          <div className="space-y-5">
            {TIMELINE.map((t) => (
              <div key={t.year} className="relative">
                <span className={`absolute -left-6 top-1.5 w-[11px] h-[11px] rounded-full ring-4 ring-white ${TONE[t.tone].dot}`} />
                <div className="rounded-2xl border border-slate-200 bg-white p-5">
                  <div className="flex items-center gap-3 mb-1.5">
                    <span className={`text-[11px] font-medium border rounded-full px-2.5 py-0.5 ${TONE[t.tone].chip}`}>{t.year}</span>
                    <span className="text-sm font-semibold text-slate-900">{t.phase}</span>
                  </div>
                  <p className="text-sm text-slate-500 mb-3">{t.desc}</p>
                  <div className={`text-lg font-bold ${TONE[t.tone].stat}`}>{t.stat}</div>
                  <div className="text-xs text-slate-400 mt-0.5">{t.statNote}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 血檢藍標 */}
      <section className="px-5 py-12 md:py-16 bg-slate-50">
        <div className="max-w-3xl mx-auto">
          <SectionHeader
            eyebrow="BLOODWORK"
            title="血檢：不是減重，是把整個身體調到最佳"
            sub="一個 7.8% 體脂的身體，代謝、血脂、血糖幾乎全項落在 Howard 最佳標準（藍標＝正常之上的最佳化區）。"
          />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {OPTIMAL_MARKERS.map((m) => (
              <div key={m.name} className="rounded-2xl border border-blue-100 bg-white p-4">
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
      </section>

      {/* 看出方向 → 個人化補充 → 抽血回測 */}
      <section className="px-5 py-12 md:py-16 max-w-3xl mx-auto">
        <SectionHeader
          eyebrow="DISCOVER → ADJUST → RETEST"
          title="看出方向 → 個人化補充策略 → 抽血追蹤變化"
          sub="不是吃補品碰運氣，是讀進血檢與基因、個人化調整，再用回測追蹤變化。相關補充與飲食調整，建議與醫師或藥師討論。"
        />
        <div className="space-y-4">
          {BEFORE_AFTER.map((b) => (
            <div key={b.name} className="rounded-2xl border border-slate-200 bg-white p-5 md:p-6">
              <div className="flex items-center gap-4 mb-3">
                <span className="text-base font-semibold text-slate-900">{b.name}</span>
                <div className="flex items-baseline gap-2">
                  <span className="text-xl text-slate-400 line-through decoration-slate-300">{b.from}</span>
                  <span className="text-emerald-500">→</span>
                  <span className="text-2xl font-bold text-emerald-600">{b.to}</span>
                  <span className="text-xs text-slate-400">{b.unit}</span>
                </div>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed">{b.story}</p>
              <p className="text-[11px] text-slate-400 mt-2">📄 {b.cite}</p>
            </div>
          ))}
        </div>

        {/* 真實檢驗報告 */}
        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-medium text-slate-500 mb-3">真實檢驗報告 — 同半胱胺酸（原始檢驗單，未修圖）</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <figure className="m-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/case-homocysteine-before.jpg" alt="同半胱胺酸 15.0（補充前）" className="w-full rounded-lg border border-slate-100 bg-white" />
              <figcaption className="text-[11px] text-slate-400 mt-1 text-center">補充前 · 15.0</figcaption>
            </figure>
            <figure className="m-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/case-homocysteine-after.jpg" alt="同半胱胺酸 9.3（追蹤後）" className="w-full rounded-lg border border-slate-100 bg-white" />
              <figcaption className="text-[11px] text-slate-400 mt-1 text-center">追蹤後 · 9.3</figcaption>
            </figure>
          </div>
        </div>
      </section>

      {/* 誠實揭露 */}
      <section className="px-5 pb-4 max-w-3xl mx-auto">
        <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-5 md:p-6">
          <p className="text-base font-bold text-slate-900 mb-2">誠實說一件事</p>
          <p className="text-sm text-slate-600 leading-relaxed">
            備賽到 7.8% 這麼瘦，睪固酮確實會下降——這是激進減脂的代價，多數教練不會跟你說。所以這套系統會<strong className="text-slate-900">依體脂自動收手</strong>：體脂太低就縮減熱量赤字，不為了數字把人榨乾。看得到代價、也防得住，才是真的系統。
          </p>
        </div>
      </section>

      {/* Zone 2 訓練方法論 */}
      <section className="px-5 py-12 md:py-16 max-w-3xl mx-auto">
        <SectionHeader eyebrow="TRAINING · ZONE 2" title="訓練方法論：Zone 2 有氧實測" sub="備賽期間 12 週 Whoop 實測數據。" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {ZONE2.map((z) => (
            <div key={z.metric} className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-slate-900">{z.metric}</span>
                <span className="text-[11px] font-medium text-emerald-600 bg-emerald-50 rounded px-1.5 py-0.5">{z.delta}</span>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-base text-slate-400 line-through decoration-slate-300">{z.from}</span>
                <span className="text-emerald-500">→</span>
                <span className="text-2xl font-bold text-slate-900">{z.to}</span>
                <span className="text-[11px] text-slate-400">{z.unit}</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1.5 leading-snug">{z.note}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 rounded-xl border-l-2 border-emerald-400 bg-emerald-50/40 px-4 py-3">
          <p className="text-sm text-slate-600 leading-relaxed">
            💡 Zone 2 有氧不只是創造熱量赤字，更能提升粒線體效率、穩定核心與情緒。不重訓的人，也至少好好善待自己的心肺。
          </p>
        </div>
        <Link href="/blog/zone-2-cardio-benefits" className="inline-block mt-4 text-sm text-blue-600 font-medium hover:underline">
          閱讀完整文章 →
        </Link>
      </section>

      {/* 背後的人 */}
      <section className="px-5 pb-4 max-w-3xl mx-auto">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
          <p className="text-xs tracking-[0.2em] text-slate-400 font-medium mb-3">EDUCATION & CERTIFICATION</p>
          <div className="space-y-2 mb-5">
            <p className="text-sm text-slate-700"><strong className="text-slate-900">高雄醫學大學 運動醫學系</strong> · Bachelor of Sports Medicine</p>
            <p className="text-sm text-slate-700"><strong className="text-slate-900">NSCA-CSCS 肌力與體能專家</strong> · Certified Strength &amp; Conditioning Specialist</p>
          </div>
          <p className="text-xs tracking-[0.2em] text-slate-400 font-medium mb-3">TECHNICAL EXPERTISE</p>
          <ul className="space-y-1.5">
            {['數據追蹤與分析（HRV／血檢／體組成／訓練量化）', '系統化訓練設計（肌力／代謝／恢復／營養介入）', '個人實驗數據庫（2020–2026 完整追蹤）'].map((s) => (
              <li key={s} className="text-sm text-slate-600 flex gap-2"><span className="text-emerald-500">✓</span>{s}</li>
            ))}
          </ul>
        </div>
      </section>

      {/* CTA */}
      <section className="px-5 py-16 bg-slate-900 text-white text-center mt-12">
        <div className="max-w-xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold mb-3">想知道你的身體能被優化到什麼程度？</h2>
          <p className="text-slate-300 mb-8 leading-relaxed">先做一次免費的系統分析，30 秒看到你的營養目標與方向。</p>
          <Link href="/diagnosis" className="inline-block bg-blue-600 hover:bg-blue-700 transition-colors text-white font-bold px-8 py-4 rounded-xl text-lg">
            免費系統分析 →
          </Link>
          <p className="text-xs text-slate-500 mt-4">不用註冊、不用付費，直接看結果</p>
          <p className="mt-6">
            <Link href="/training" className="text-slate-300 hover:text-white underline text-sm">查看完整訓練系統 →</Link>
          </p>
        </div>
      </section>

      {/* 免責 */}
      <section className="px-5 py-8 max-w-3xl mx-auto">
        <p className="text-xs text-slate-400 leading-relaxed">
          ⚠️ 個人案例分享，僅供參考。數據取自真實追蹤紀錄；每個人身體狀況不同，效果因人而異。任何健康決策請諮詢專業醫療人員。本服務非醫療行為。
        </p>
      </section>
    </div>
  )
}
