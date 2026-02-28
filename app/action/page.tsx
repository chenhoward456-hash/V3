import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '實體訓練方案 - Howard Protocol | 台中北屯一對一指導',
  description: '一對一動作評估 × 客製化訓練計畫 × 智能管理系統全套。CSCS 認證教練即時指導，台中北屯 Coolday Fitness。',
  openGraph: {
    title: '實體訓練 + 智能管理 - Howard Protocol',
    description: '一對一指導 × CSCS 認證 × 系統追蹤 · 台中北屯',
  },
}

export default function ActionPage() {
  return (
    <>
      {/* ===== Hero ===== */}
      <section className="relative overflow-hidden" style={{ background: 'linear-gradient(180deg, #f5f7fa 0%, #ffffff 100%)' }}>
        <div className="max-w-4xl mx-auto px-6 py-16 md:py-24 text-center">
          <div className="inline-block bg-[#1e3a5f]/10 text-[#1e3a5f] text-sm font-semibold px-4 py-1.5 rounded-full mb-6">
            台中北屯 · Coolday Fitness
          </div>
          <h1 className="text-3xl md:text-5xl font-bold leading-tight mb-4" style={{ color: '#1e3a5f' }}>
            一對一訓練指導<br />+ 智能管理系統全套
          </h1>
          <p className="text-lg text-gray-500 mb-4 max-w-2xl mx-auto">
            不只教你動作，更用數據幫你追蹤進度、自動調整計畫。
          </p>
          <p className="text-sm text-gray-400">
            CSCS 認證 × 動作評估 × 即時指導 × 系統追蹤
          </p>
        </div>
      </section>

      {/* Howard 實戰工作照 */}
      <section className="max-w-4xl mx-auto px-6 -mt-6 mb-16">
        <div className="w-full h-[400px] rounded-2xl overflow-hidden shadow-sm">
          <img
            src="/howard-training.jpg"
            alt="Howard Chen 指導學員動作矯正"
            className="w-full h-full object-cover"
            style={{ objectPosition: 'center 30%' }}
          />
        </div>
      </section>

      {/* 流程 */}
      <section className="max-w-4xl mx-auto px-6 py-16">
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-12" style={{ color: '#1e3a5f' }}>
          訓練流程
        </h2>
        <div className="grid md:grid-cols-3 gap-8">
          {[
            {
              num: '01',
              title: '系統性評估',
              desc: '體態評估、動作能力測試、訓練目標討論。找出你卡關的真正原因。',
              details: ['體態評估（圓肩？骨盆前傾？）', '動作能力測試（深蹲、硬舉品質）', '訓練目標與生活作息評估'],
            },
            {
              num: '02',
              title: '客製化計畫',
              desc: '根據評估結果，量身打造你的訓練與營養計畫。',
              details: ['週期化訓練編排 + RPE 管理', '動作技術指導與矯正', '增肌 / 減脂營養策略'],
            },
            {
              num: '03',
              title: '持續追蹤調整',
              desc: '系統 + 教練雙重追蹤，根據你的數據持續調整計畫。',
              details: ['智能引擎每週分析體重趨勢', '自適應 TDEE 持續校正', '教練每週 review + LINE 諮詢'],
            },
          ].map(({ num, title, desc, details }) => (
            <div key={num} className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100">
              <span className="text-xs font-bold text-[#2563eb] bg-[#2563eb]/10 px-3 py-1 rounded-full">{num}</span>
              <h3 className="text-xl font-bold mt-4 mb-3" style={{ color: '#1e3a5f' }}>{title}</h3>
              <p className="text-gray-600 text-sm mb-4 leading-relaxed">{desc}</p>
              <ul className="space-y-2">
                {details.map(d => (
                  <li key={d} className="flex items-start gap-2 text-gray-500 text-xs">
                    <span className="text-[#2563eb] mt-0.5">✓</span>{d}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* 適合情況 + CTA */}
      <section className="bg-[#f5f7fa] py-20">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-10" style={{ color: '#1e3a5f' }}>適合以下情況</h2>
          <div className="grid grid-cols-2 gap-4 mb-12 text-left">
            {[
              '想開始肌力訓練，不知道從何開始',
              '自己練一陣子了，但進步停滯',
              '有圓肩、駝背等姿勢問題',
              '需要專業指導避免運動傷害',
            ].map(t => (
              <div key={t} className="bg-white rounded-xl p-4 text-sm text-gray-700 flex items-start gap-2">
                <span className="text-green-500 font-bold mt-0.5">+</span>{t}
              </div>
            ))}
          </div>

          <a
            href="https://lin.ee/dnbucVw"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block bg-[#1e3a5f] text-white px-10 py-4 rounded-xl font-bold text-lg hover:bg-[#1e3a5f]/90 transition-colors shadow-lg"
          >
            加 LINE 預約諮詢 💬
          </a>

          <p className="text-gray-400 text-xs mt-4">初次諮詢免費 · 費用會在 LINE 根據需求報價</p>

          <div className="mt-12 pt-8 border-t border-gray-200 flex flex-col md:flex-row items-center justify-center gap-6 text-sm text-gray-500">
            <span>📍 Coolday Fitness 北屯館</span>
            <span>👤 Howard Chen · CSCS 認證</span>
          </div>
        </div>
      </section>

      {/* 引用 */}
      <section className="max-w-3xl mx-auto px-6 py-16">
        <blockquote className="border-l-4 border-[#2563eb]/30 pl-8 py-4">
          <p className="italic text-gray-600 text-lg leading-relaxed">
            「我曾經也走過發炎、脫髮與迷茫，所以我比任何人都希望這套系統能幫你找回主控權。」
          </p>
          <footer className="mt-4 text-gray-500 text-sm">— Howard Chen</footer>
        </blockquote>
      </section>

      {/* FAQ */}
      <section className="bg-[#f5f7fa] py-16">
        <div className="max-w-3xl mx-auto px-6">
          <h2 className="text-2xl font-bold text-center mb-10" style={{ color: '#1e3a5f' }}>預約前的常見疑問</h2>
          <div className="space-y-4">
            {[
              { q: '評估需要多久時間？', a: '初次評估約 60-90 分鐘，包含體態評估、動作能力測試、訓練目標討論。' },
              { q: '一定要去現場嗎？', a: '是的，初次評估需要現場進行，才能準確評估你的動作模式與體態。後續訓練可討論線上或現場。' },
              { q: '費用如何計算？', a: '初次諮詢免費。正式訓練計畫會根據你的目標與需求客製化報價，透過 LINE 詳談。' },
              { q: '我是完全新手，也適合嗎？', a: '非常適合！我會從基礎動作開始教學，確保你建立正確的動作模式，避免運動傷害。' },
            ].map(({ q, a }) => (
              <div key={q} className="bg-white rounded-xl p-6 border border-gray-200">
                <h3 className="text-base font-bold mb-2" style={{ color: '#1e3a5f' }}>Q: {q}</h3>
                <p className="text-gray-600 text-sm leading-relaxed">{a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 聯絡方式 */}
      <section className="max-w-3xl mx-auto px-6 py-12">
        <div className="grid md:grid-cols-2 gap-8 text-center">
          <div>
            <strong className="block mb-2 text-sm" style={{ color: '#1e3a5f' }}>Instagram</strong>
            <a href="https://www.instagram.com/chenhoward/" target="_blank" rel="noopener noreferrer" className="text-gray-600 hover:text-[#2563eb] transition-colors text-sm">
              @chenhoward →
            </a>
          </div>
          <div>
            <strong className="block mb-2 text-sm" style={{ color: '#1e3a5f' }}>LINE 官方帳號</strong>
            <a href="https://lin.ee/dnbucVw" target="_blank" rel="noopener noreferrer" className="text-gray-600 hover:text-[#2563eb] transition-colors text-sm">
              加入好友 →
            </a>
          </div>
        </div>
      </section>
    </>
  )
}
