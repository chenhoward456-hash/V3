import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'

export const metadata: Metadata = {
  title: '數據會說話 — The Howard Protocol 真實案例',
  description: '一個 7.8% 體脂、血檢幾乎全項達到最佳標準的身體。不是猜的減脂，是基因導向、抽血驗證的系統化優化。',
  alternates: { canonical: 'https://howard456.vercel.app/case/data' },
  openGraph: {
    title: '數據會說話 — The Howard Protocol 真實案例',
    description: '7.8% 體脂、血檢全項達標。基因導向、抽血驗證的系統化優化。',
    url: 'https://howard456.vercel.app/case/data',
  },
}

// 真實案例數據快照（陳胤豪本人，資料區間 2026-02 ~ 06）。
// 這是策展用的行銷快照；數字皆取自其真實 body_composition / lab_results。
const HERO_STATS = [
  { label: '體脂', from: '10%', to: '7.8%', note: '4 個月' },
  { label: '體重', from: '84kg', to: '81.8kg', note: '穩定減脂' },
  { label: '量測次數', value: '111', note: '4 個月不間斷' },
  { label: '血檢項目', value: '14 項', note: '多次回測驗證' },
]

// 達到 Howard 最佳標準的指標（藍標）
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

// 「發現問題 → protocol → 回測驗證」的鐵證
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

const SYSTEM = [
  { icon: '📊', title: '每日數據追蹤', desc: '體重、營養、訓練、睡眠——4 個月 111 次量測，趨勢用線性回歸看拐點，不是看單日。' },
  { icon: '🩸', title: 'Howard 標準血檢', desc: '不是醫院「正常就好」，是「正常但能更好」的最佳化標準，每項附 PubMed 文獻依據。' },
  { icon: '🧬', title: '基因導向營養', desc: 'MTHFR / APOE / 5-HTTLPR 基因型，個人化補充與飲食方向，每項都有原因、文獻與對應的血檢指標。' },
  { icon: '🤖', title: '引擎自動調整', desc: '依進度速率 + 體脂 + 基因自動調整營養，低體脂自動收窄赤字保護肌肉，不會把人榨乾。' },
]

function Stat({ label, from, to, value, note }: { label: string; from?: string; to?: string; value?: string; note: string }) {
  return (
    <div className="text-center px-2">
      <div className="text-xs text-slate-400 mb-1.5">{label}</div>
      {from && to ? (
        <div className="flex items-baseline justify-center gap-1.5">
          <span className="text-base text-slate-400 line-through decoration-slate-600">{from}</span>
          <span className="text-blue-400">→</span>
          <span className="text-2xl md:text-3xl font-bold text-white">{to}</span>
        </div>
      ) : (
        <div className="text-2xl md:text-3xl font-bold text-white">{value}</div>
      )}
      <div className="text-[11px] text-slate-500 mt-1">{note}</div>
    </div>
  )
}

export default function CaseDataPage() {
  return (
    <div className="bg-white">
      {/* HERO */}
      <section className="bg-slate-900 text-white px-5 py-14 md:py-20">
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-[1.2fr_1fr] gap-10 items-center">
            <div>
              <p className="text-xs tracking-[0.2em] text-blue-400 font-medium mb-5">THE HOWARD PROTOCOL · 真實案例</p>
              <h1 className="text-3xl md:text-5xl font-bold leading-tight mb-5">
                7.8% 體脂，<br className="hidden md:block" />血檢幾乎全項達標。
                <span className="block text-blue-400 mt-2">不是猜的。</span>
              </h1>
              <p className="text-slate-300 text-base md:text-lg leading-relaxed max-w-xl">
                減脂誰都能做。但把一個身體的血檢、基因、生活數據全部讀進來，個人化調整營養與補充、再用回測持續追蹤變化——這才是系統在做的事。
              </p>
            </div>
            <div className="relative aspect-[3/4] rounded-3xl overflow-hidden border border-slate-700 max-w-[260px] mx-auto w-full">
              <Image src="/after.jpg" alt="7.8% 體脂的身體" fill sizes="(max-width:768px) 70vw, 260px" className="object-cover" />
              <div className="absolute bottom-3 left-3 bg-blue-600 text-white text-sm font-bold px-3 py-1.5 rounded-lg shadow-lg">7.8% 體脂</div>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-y-6 gap-x-3 border-t border-slate-700 pt-8 mt-10">
            {HERO_STATS.map((s) => <Stat key={s.label} {...s} />)}
          </div>
        </div>
      </section>

      {/* 血檢達標 */}
      <section className="px-5 py-16 max-w-3xl mx-auto">
        <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-2">血檢：不是減重，是把整個身體調到最佳</h2>
        <p className="text-slate-500 mb-8 leading-relaxed">
          一個 7.8% 體脂的人，代謝、血脂、血糖幾乎全項落在 Howard 最佳標準（藍標＝正常之上的最佳化區）。
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
      </section>

      {/* 發現→修復→驗證 */}
      <section className="px-5 py-16 bg-slate-50">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-2">看出方向 → 個人化補充策略 → 抽血追蹤變化</h2>
          <p className="text-slate-500 mb-8 leading-relaxed">這是別人給不出的部分：不是吃補品碰運氣，是讀進血檢與基因、個人化調整，再用回測追蹤變化。相關補充與飲食調整，建議與醫師或藥師討論。</p>
          <div className="space-y-5">
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

          {/* 真實檢驗報告 — 同半胱胺酸前後對照（原始檢驗單） */}
          <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
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
        </div>
      </section>

      {/* 系統怎麼做到的 */}
      <section className="px-5 py-16 max-w-3xl mx-auto">
        <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-8">這套系統怎麼做到的</h2>
        <div className="grid md:grid-cols-2 gap-4">
          {SYSTEM.map((s) => (
            <div key={s.title} className="rounded-2xl border border-slate-200 p-5">
              <div className="text-2xl mb-2">{s.icon}</div>
              <div className="font-semibold text-slate-900 mb-1">{s.title}</div>
              <div className="text-sm text-slate-600 leading-relaxed">{s.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* 誠實揭露 — 把激進減脂的代價講出來，並展示系統如何自動防護 */}
      <section className="px-5 pb-4 max-w-3xl mx-auto">
        <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-5">
          <p className="text-sm font-semibold text-slate-900 mb-1.5">誠實說一件事</p>
          <p className="text-sm text-slate-600 leading-relaxed">
            備賽到 7.8% 這麼瘦，睪固酮確實會下降——這是激進減脂的代價，多數教練不會跟你說。所以這套系統會<b className="text-slate-900">依體脂自動收手</b>：體脂太低就縮減熱量赤字，不為了數字把人榨乾。看得到代價、也防得住，才是真的系統。
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="px-5 py-16 bg-slate-900 text-white text-center">
        <div className="max-w-xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold mb-3">想知道你的身體能被優化到什麼程度？</h2>
          <p className="text-slate-300 mb-8 leading-relaxed">先做一次免費的系統分析，30 秒看到你的營養目標與方向。</p>
          <Link href="/diagnosis" className="inline-block bg-blue-600 hover:bg-blue-700 transition-colors text-white font-bold px-8 py-4 rounded-xl text-lg">
            免費系統分析 →
          </Link>
          <p className="text-xs text-slate-500 mt-4">不用註冊、不用付費，直接看結果</p>
          <p className="mt-6">
            <Link href="/case" className="text-slate-300 hover:text-white underline text-sm">← 看完整的轉變故事</Link>
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
