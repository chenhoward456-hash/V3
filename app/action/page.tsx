import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '與 Howard 開啟對話 - The Howard Protocol',
  description: '優化，從理解自己的數據開始。這不是另一套健身課程，而是針對你身體系統的工程調校。',
  openGraph: {
    title: '與 Howard 開啟對話 - The Howard Protocol',
    description: '系統性評估、協定開發、數據追蹤',
  },
}

export default function ActionPage() {
  return (
    <section className="section-container" style={{backgroundColor: '#F9F9F7'}}>
      <h2 className="doc-title" style={{color: '#2D2D2D', letterSpacing: '0.05em'}}>優化，從理解自己的數據開始</h2>
      <p className="doc-subtitle" style={{color: '#2D2D2D', maxWidth: '800px', margin: '0 auto 3rem'}}>
        這不是另一套健身課程，而是針對你身體系統的工程調校。<br />
        我們不靠感覺，我們靠數據說話。
      </p>

      {/* Howard 實戰工作照 */}
      <div className="mb-16 flex justify-center">
        <div className="w-full max-w-2xl h-[400px] rounded-[2rem] overflow-hidden" style={{boxShadow: '0 4px 20px rgba(0, 0, 0, 0.06)'}}>
          <img 
            src="/howard-training.jpg" 
            alt="Howard Chen 指導學員動作矯正" 
            className="w-full h-full object-cover"
            style={{objectPosition: 'center 30%'}}
          />
        </div>
      </div>

      {/* 工作流程 - 去除方塊感 */}
      <div className="my-20 max-w-4xl mx-auto">
        <div className="space-y-16">
          {/* 步驟 1 */}
          <div className="flex gap-8 items-start border-l-2 border-gray-300 pl-8">
            <div className="text-6xl font-serif text-gray-300 leading-none" style={{fontFamily: 'Georgia, serif'}}>1</div>
            <div className="flex-1">
              <h4 className="text-2xl mb-4 font-semibold" style={{color: '#2D2D2D', letterSpacing: '0.03em'}}>系統性評估</h4>
              <p className="text-gray-600 leading-relaxed mb-4 text-[15px]">
                透過 ZOA 呼吸力學與生理數據，找出你效能卡關的真正原因。
              </p>
              <ul className="text-gray-600 leading-loose space-y-2 text-[15px]">
                <li>• 體態評估（圓肩？骨盆前傾？）</li>
                <li>• 動作能力測試（能否正確深蹲、硬舉？）</li>
                <li>• 訓練目標與生活作息評估</li>
              </ul>
            </div>
          </div>

          {/* 步驟 2 */}
          <div className="flex gap-8 items-start border-l-2 border-gray-300 pl-8">
            <div className="text-6xl font-serif text-gray-300 leading-none" style={{fontFamily: 'Georgia, serif'}}>2</div>
            <div className="flex-1">
              <h4 className="text-2xl mb-4 font-semibold" style={{color: '#2D2D2D', letterSpacing: '0.03em'}}>協定開發 (Protocol Design)</h4>
              <p className="text-gray-600 leading-relaxed mb-4 text-[15px]">
                這份計畫是專屬於你的『操作手冊』，不再是盲目訓練。
              </p>
              <ul className="text-gray-600 leading-loose space-y-2 text-[15px]">
                <li>• 客製化訓練計畫（週期化編排、RPE 管理）</li>
                <li>• 動作技術指導（深蹲、硬舉、臥推矯正）</li>
                <li>• 營養策略建議（增肌 / 減脂飲食設計）</li>
              </ul>
            </div>
          </div>

          {/* 步驟 3 */}
          <div className="flex gap-8 items-start border-l-2 border-gray-300 pl-8">
            <div className="text-6xl font-serif text-gray-300 leading-none" style={{fontFamily: 'Georgia, serif'}}>3</div>
            <div className="flex-1">
              <h4 className="text-2xl mb-4 font-semibold" style={{color: '#2D2D2D', letterSpacing: '0.03em'}}>持續追蹤與調整</h4>
              <p className="text-gray-600 leading-relaxed text-[15px]">
                數據不會說謊。定期追蹤進度，根據你的反應調整協定。
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* CTA 區塊 - 去除鮮豔色彩 */}
      <div className="my-20 text-center max-w-3xl mx-auto">
        <h3 className="text-3xl mb-6 font-semibold" style={{color: '#2D2D2D', letterSpacing: '0.03em'}}>適合以下情況</h3>
        <div className="text-left space-y-3 mb-12 text-gray-600 text-[15px] leading-relaxed">
          <p>→ 想開始肌力訓練，但不知道從何開始</p>
          <p>→ 自己練一陣子了，但進步停滯</p>
          <p>→ 有圓肩、駝背等姿勢問題</p>
          <p>→ 需要專業指導避免運動傷害</p>
        </div>

        <a
          href="https://lin.ee/dnbucVw"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block px-12 py-4 rounded-full font-medium text-white transition-all hover:opacity-90"
          style={{backgroundColor: '#2D2D2D', letterSpacing: '0.05em'}}
        >
          與 Howard 開啟對話
        </a>

        <div className="mt-12 pt-8 border-t border-gray-300">
          <p className="text-gray-500 text-sm leading-relaxed">
            📍 台中市北屯區<br />
            🎓 CSCS 認證 • 運動醫學背景
          </p>
        </div>
      </div>

      {/* 真心話引用 */}
      <div className="my-20 max-w-3xl mx-auto">
        <blockquote className="border-l-4 border-gray-300 pl-8 py-4">
          <p className="italic text-gray-600 text-lg leading-relaxed" style={{fontFamily: 'Georgia, serif'}}>
            「我曾經也走過發炎、脫髮與迷茫，所以我比任何人都希望這套系統能幫你找回主控權。」
          </p>
          <footer className="mt-4 text-gray-500 text-sm">— Howard Chen</footer>
        </blockquote>
      </div>

      {/* 其他聯絡方式 - 簡化設計 */}
      <div className="mt-16 pt-12 border-t border-gray-300 max-w-3xl mx-auto">
        <h3 className="mb-8 text-center font-semibold" style={{color: '#2D2D2D', letterSpacing: '0.03em'}}>其他聯絡方式</h3>
        
        <div className="grid md:grid-cols-2 gap-8 text-center">
          <div>
            <strong className="block mb-3 text-base" style={{color: '#2D2D2D'}}>Instagram</strong>
            <a
              href="https://www.instagram.com/chenhoward/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-600 hover:text-gray-900 transition-colors text-[15px]"
            >
              @chenhoward →
            </a>
            <p className="text-gray-400 text-sm mt-2">協議更新、案例分享</p>
          </div>
          
          <div>
            <strong className="block mb-3 text-base" style={{color: '#2D2D2D'}}>LINE 官方帳號</strong>
            <a
              href="https://lin.ee/dnbucVw"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-600 hover:text-gray-900 transition-colors text-[15px]"
            >
              加入好友 →
            </a>
            <p className="text-gray-400 text-sm mt-2">快速諮詢、預約排程</p>
          </div>
        </div>
      </div>
    </section>
  )
}
