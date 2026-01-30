import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '營養與恢復 - The Howard Protocol',
  description: '代謝靈活性優化、MTHFR 甲基化修復、睡眠優化指南。訓練只是刺激，真正的成長發生在休息與營養補充階段。',
  openGraph: {
    title: '營養與恢復 - The Howard Protocol',
    description: '代謝優化、基因修復、睡眠協議',
  },
}

export default function NutritionPage() {
  return (
    <section className="section-container" style={{backgroundColor: '#F9F9F7'}}>
      <h2 className="text-3xl md:text-4xl font-bold text-center mb-6" style={{color: '#2D2D2D', letterSpacing: '0.05em'}}>The Howard Nutrition Protocol</h2>
      <p className="doc-subtitle" style={{color: '#2D2D2D', maxWidth: '800px', margin: '0 auto 3rem', lineHeight: '1.8'}}>
        我不相信「乾淨飲食」。我用數據追蹤代謝，用血檢驗證效果。這是我 6 年的優化旅程。
      </p>

      {/* 血檢數據優化旅程 */}
      <div className="my-20 max-w-4xl mx-auto" style={{borderLeft: '4px solid #8B7355', paddingLeft: '2rem', backgroundColor: 'rgba(139, 115, 85, 0.03)', padding: '2rem 2rem 2rem 3rem', borderRadius: '0.5rem'}}>
        <div className="flex items-start gap-4 mb-4">
          <div className="w-12 h-12 rounded-full border-2 border-gray-900 flex items-center justify-center text-gray-900 font-bold text-sm flex-shrink-0">DATA</div>
          <div>
            <h3 className="text-2xl font-semibold mb-3" style={{color: '#2D2D2D', letterSpacing: '0.02em'}}>我的血檢優化旅程</h3>
            <p className="text-gray-600 leading-relaxed text-[15px] mb-4">
              2020 年系統崩潰後，我開始用血檢數據追蹤身體變化。6 年來，我記錄了每一次調整、每一個數據變化。
            </p>
            <div className="grid md:grid-cols-3 gap-6 mt-6">
              <div className="bg-white p-4 rounded-xl border border-gray-200">
                <p className="text-gray-400 text-xs mb-1">同半胱氨酸</p>
                <p className="text-2xl font-bold" style={{color: '#2D2D2D'}}>15 → 9</p>
                <p className="text-gray-500 text-xs mt-1">μmol/L 心血管風險</p>
              </div>
              <div className="bg-white p-4 rounded-xl border border-gray-200">
                <p className="text-gray-400 text-xs mb-1">睪固酮</p>
                <p className="text-2xl font-bold" style={{color: '#2D2D2D'}}>515 → 625</p>
                <p className="text-gray-500 text-xs mt-1">ng/dL</p>
              </div>
              <div className="bg-white p-4 rounded-xl border border-gray-200">
                <p className="text-gray-400 text-xs mb-1">CRP</p>
                <p className="text-2xl font-bold" style={{color: '#2D2D2D'}}>2.5 → 0.8</p>
                <p className="text-gray-500 text-xs mt-1">mg/L 發炎指標</p>
              </div>
            </div>
            <p className="italic text-gray-500 text-sm leading-relaxed mt-6" style={{fontFamily: 'Georgia, serif'}}>
              「數據不會說謊。每一個改變都有跡可循。」
            </p>
          </div>
        </div>
      </div>

      {/* 三大營養策略 */}
      <div className="my-24 max-w-5xl mx-auto">
        <h3 className="text-3xl font-semibold mb-16 text-center" style={{color: '#2D2D2D', letterSpacing: '0.03em'}}>三大營養策略</h3>
        <div className="space-y-12">
          
          {/* 策略 1 */}
          <div className="bg-white rounded-2xl p-10 border-2 border-gray-200" style={{boxShadow: '0 4px 20px rgba(0, 0, 0, 0.04)'}}>
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-full bg-gray-900 flex items-center justify-center text-white font-bold text-sm">01</div>
              <h4 className="text-2xl font-semibold" style={{color: '#2D2D2D'}}>代謝靈活性：碳水循環</h4>
            </div>
            <p className="text-gray-600 leading-relaxed text-[15px] mb-4">
              人體就像油電混合車。目標不是「少吃」，而是教會身體自由切換「燃糖」或「燃脂」模式。
            </p>
            <div className="bg-gray-50 p-6 rounded-xl mt-4">
              <p className="text-gray-700 text-sm leading-relaxed mb-3"><strong>我的做法：</strong></p>
              <p className="text-gray-600 text-sm leading-relaxed">
                • 訓練日：攝取 200-250g 碳水（地瓜、白飯）<br />
                • 休息日：限制碳水少於 50g，增加好油<br />
                • 間歇性斷食：進食窗口 12pm-8pm
              </p>
            </div>
            <div className="mt-6 text-gray-600 text-sm leading-relaxed">
              <strong className="block mb-2">效果：</strong>
              體脂從 18% 降到 12%，代謝靈活性明顯提升。
            </div>
          </div>

          
          {/* 策略 2 */}
          <div className="bg-white rounded-2xl p-10 border-2 border-gray-200" style={{boxShadow: '0 4px 20px rgba(0, 0, 0, 0.04)'}}>
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-full bg-gray-900 flex items-center justify-center text-white font-bold text-sm">02</div>
              <h4 className="text-2xl font-semibold" style={{color: '#2D2D2D'}}>補劑使用：個人經驗分享</h4>
            </div>
            <p className="text-gray-600 leading-relaxed text-[15px] mb-4">
              我個人使用這些補劑後，感覺精神狀態與恢復能力有改善。這只是個人經驗，不是醫療建議。
            </p>
            <div className="bg-gray-50 p-6 rounded-xl mt-4">
              <p className="text-gray-700 text-sm leading-relaxed mb-3"><strong>我的補劑組合：</strong></p>
              <p className="text-gray-600 text-sm leading-relaxed">
                • 維生素 D3 5000 IU（每天）<br />
                • Omega-3 2000mg（降低 CRP）<br />
                • 活性 B 群（Methylfolate、Methylcobalamin）<br />
                • 鎂 300mg + 甘氨酸 3g（睡前）
              </p>
            </div>
            <div className="mt-6 bg-yellow-50 p-4 rounded-xl border border-yellow-200">
              <p className="text-yellow-800 text-xs leading-relaxed">
                <strong>重要提醒：</strong>這只是個人經驗分享，不是醫療建議。補劑使用前請諮詢醫師或營養師。
              </p>
            </div>
          </div>

          
          {/* 策略 3 */}
          <div className="bg-white rounded-2xl p-10 border-2 border-gray-200" style={{boxShadow: '0 4px 20px rgba(0, 0, 0, 0.04)'}}>
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-full bg-gray-900 flex items-center justify-center text-white font-bold text-sm">03</div>
              <h4 className="text-2xl font-semibold" style={{color: '#2D2D2D'}}>睡眠優化：HRV 追蹤</h4>
            </div>
            <p className="text-gray-600 leading-relaxed text-[15px] mb-4">
              睡眠是肌肉生長與荷爾蒙分泌的黃金時間。我用 HRV（心率變異度）追蹤恢復狀態。
            </p>
            <div className="bg-gray-50 p-6 rounded-xl mt-4">
              <p className="text-gray-700 text-sm leading-relaxed mb-3"><strong>我的睡眠協議：</strong></p>
              <p className="text-gray-600 text-sm leading-relaxed">
                • 目標睡眠時間：7-9 小時<br />
                • 睡前 2 小時避免藍光<br />
                • 咖啡因截止時間：下午 2 點<br />
                • 睡前補劑：鎂 + 甘氨酸<br />
                • 用 Oura Ring 追蹤 HRV
              </p>
            </div>
            <div className="mt-6 text-gray-600 text-sm leading-relaxed">
              <strong className="block mb-2">效果：</strong>
              HRV 從平均 45ms 提升到 65ms，睡眠品質明顯改善。
            </div>
          </div>
        </div>
      </div>

      {/* CTA 區塊 */}
      <div className="my-20 text-center max-w-3xl mx-auto">
        <h3 className="text-3xl mb-6 font-semibold" style={{color: '#2D2D2D', letterSpacing: '0.03em'}}>想看完整數據？</h3>
        <p className="text-gray-600 mb-8 leading-relaxed">
          我在部落格分享完整的血檢數據和優化過程。
        </p>
        <div className="flex gap-4 justify-center mb-12">
          <a
            href="/blog"
            className="inline-block px-8 py-3 rounded-full font-medium text-white transition-all hover:opacity-90"
            style={{backgroundColor: '#2D2D2D', letterSpacing: '0.05em'}}
          >
            閱讀血檢優化文章
          </a>
          <a
            href="https://lin.ee/dnbucVw"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block px-8 py-3 rounded-full font-medium border-2 transition-all hover:bg-gray-50"
            style={{borderColor: '#2D2D2D', color: '#2D2D2D', letterSpacing: '0.05em'}}
          >
            預約營養諮詢
          </a>
        </div>
        <p className="text-gray-400 text-sm">
          個人經驗分享 • 不構成醫療建議
        </p>
      </div>
    </section>
  )
}
