import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '訓練工程 - The Howard Protocol',
  description: '肌力訓練三大原則：機械張力、神經適應、結構優化。CSCS 系統化訓練設計，從動作力學到週期化編排。',
  openGraph: {
    title: '訓練工程 - The Howard Protocol',
    description: '機械張力、神經適應、結構優化三大訓練原則',
  },
}

export default function TrainingPage() {
  return (
    <section className="section-container" style={{backgroundColor: '#F9F9F7'}}>
      <h2 className="doc-title" style={{color: '#2D2D2D', letterSpacing: '0.05em'}}>The Howard Training System</h2>
      <p className="doc-subtitle" style={{color: '#2D2D2D', maxWidth: '800px', margin: '0 auto 3rem', lineHeight: '1.8'}}>
        我不用傳統的「胸背腿」分化。我的訓練系統建立在結構優化、神經適應和數據追蹤之上。
      </p>

      {/* 個人訓練哲學 */}
      <div className="my-20 max-w-4xl mx-auto" style={{borderLeft: '4px solid #2D2D2D', paddingLeft: '2rem', backgroundColor: 'rgba(45, 45, 45, 0.03)', padding: '2rem 2rem 2rem 3rem', borderRadius: '0.5rem'}}>
        <div className="flex items-start gap-4 mb-4">
          <div className="w-12 h-12 rounded-full bg-gray-900 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">WHY</div>
          <div>
            <h3 className="text-2xl font-semibold mb-3" style={{color: '#2D2D2D', letterSpacing: '0.02em'}}>我的訓練哲學</h3>
            <p className="text-gray-600 leading-relaxed text-[15px] mb-4">
              2020 年，我的身體系統崩潰。當時我以為「練得越累越有效」，結果換來慢性發炎、掉髮、睡眠障礙。
            </p>
            <p className="text-gray-600 leading-relaxed text-[15px] mb-4">
              後來我發現問題不在訓練量，而在<strong>結構失衡</strong>。肋骨外翻導致核心無法穩定，再多的腹肌訓練都是白費。
            </p>
            <p className="italic text-gray-500 text-sm leading-relaxed" style={{fontFamily: 'Georgia, serif'}}>
              「真正的訓練，是先修復結構，再談負荷。」
            </p>
          </div>
        </div>
      </div>

      {/* 三大核心原則 */}
      <div className="my-24 max-w-5xl mx-auto">
        <h3 className="text-3xl font-semibold mb-16 text-center" style={{color: '#2D2D2D', letterSpacing: '0.03em'}}>三大核心原則</h3>
        <div className="space-y-12">
          
          {/* 原則 1 */}
          <div className="bg-white rounded-2xl p-10 border-2 border-gray-200" style={{boxShadow: '0 4px 20px rgba(0, 0, 0, 0.04)'}}>
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-full bg-gray-900 flex items-center justify-center text-white font-bold text-sm">01</div>
              <h4 className="text-2xl font-semibold" style={{color: '#2D2D2D'}}>結構優先：ZOA 呼吸力學</h4>
            </div>
            <p className="text-gray-600 leading-relaxed text-[15px] mb-4">
              如果肋骨外翻，橫膈膜無法與骨盆底肌平行對齊，核心就失去剛性。再多的棒式、捲腹都無法解決問題。
            </p>
            <div className="bg-gray-50 p-6 rounded-xl mt-4">
              <p className="text-gray-700 text-sm leading-relaxed mb-3"><strong>什麼是 ZOA？</strong></p>
              <p className="text-gray-600 text-sm leading-relaxed">
                Zone of Apposition（對位區）：橫膈膜與肋骨接觸的區域。當 ZOA 最大化時，核心才能產生真正的穩定性。
              </p>
            </div>
            <div className="mt-6 text-gray-600 text-sm leading-relaxed">
              <strong className="block mb-2">我的做法：</strong>
              • 每次訓練前先做 5 分鐘呼吸矯正<br />
              • 吐氣時將肋骨下沈，建立 IAP（腹內壓）<br />
              • 確保核心穩定後，才開始大重量訓練
            </div>
          </div>

          
          {/* 原則 2 */}
          <div className="bg-white rounded-2xl p-10 border-2 border-gray-200" style={{boxShadow: '0 4px 20px rgba(0, 0, 0, 0.04)'}}>
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-full bg-gray-900 flex items-center justify-center text-white font-bold text-sm">02</div>
              <h4 className="text-2xl font-semibold" style={{color: '#2D2D2D'}}>神經適應：動作模式優先</h4>
            </div>
            <p className="text-gray-600 leading-relaxed text-[15px] mb-4">
              新手的力量進步 80% 來自神經系統學習，不是肌肉變大。大腦需要學會如何徵召更多肌纖維。
            </p>
            <div className="bg-gray-50 p-6 rounded-xl mt-4">
              <p className="text-gray-700 text-sm leading-relaxed mb-3"><strong>為什麼不追求重量？</strong></p>
              <p className="text-gray-600 text-sm leading-relaxed">
                錯誤的動作模式 + 大重量 = 受傷。先學會正確的深蹲、硬舉模式，力量自然會進步。
              </p>
            </div>
            <div className="mt-6 text-gray-600 text-sm leading-relaxed">
              <strong className="block mb-2">我的做法：</strong>
              • 用 RPE 7-8 訓練（還能做 2-3 下）<br />
              • 同一動作每週練 2-3 次（頻率大於單次訓練量）<br />
              • 每週嘗試增加 2.5kg 或 1-2 次
            </div>
          </div>

          
          {/* 原則 3 */}
          <div className="bg-white rounded-2xl p-10 border-2 border-gray-200" style={{boxShadow: '0 4px 20px rgba(0, 0, 0, 0.04)'}}>
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-full bg-gray-900 flex items-center justify-center text-white font-bold text-sm">03</div>
              <h4 className="text-2xl font-semibold" style={{color: '#2D2D2D'}}>數據追蹤：漸進式超負荷</h4>
            </div>
            <p className="text-gray-600 leading-relaxed text-[15px] mb-4">
              不靠感覺，靠數據說話。每次訓練都記錄重量、次數、RPE，確保持續進步。
            </p>
            <div className="bg-gray-50 p-6 rounded-xl mt-4">
              <p className="text-gray-700 text-sm leading-relaxed mb-3"><strong>什麼是漸進式超負荷？</strong></p>
              <p className="text-gray-600 text-sm leading-relaxed">
                每週嘗試增加負荷（重量、次數或組數）。這是肌肉生長的唯一途徑。
              </p>
            </div>
            <div className="mt-6 text-gray-600 text-sm leading-relaxed">
              <strong className="block mb-2">我的做法：</strong>
              • 用 Google Sheets 記錄每次訓練<br />
              • 追蹤深蹲、硬舉、臥推的 1RM<br />
              • 每 4 週檢視進步幅度，調整計畫
            </div>
          </div>
        </div>
      </div>

      {/* 我的訓練演變 */}
      <div className="my-20 max-w-4xl mx-auto">
        <h3 className="text-3xl font-semibold mb-12 text-center" style={{color: '#2D2D2D', letterSpacing: '0.03em'}}>我的訓練演變</h3>
        
        <div className="space-y-8">
          <div className="border-l-4 border-gray-900 pl-8 py-4">
            <p className="text-gray-400 text-sm mb-2">2020 年</p>
            <h4 className="text-xl font-semibold mb-3" style={{color: '#2D2D2D'}}>系統崩潰期</h4>
            <p className="text-gray-600 text-sm leading-relaxed">
              每天練 2 小時，追求「練到力竭」。結果換來慢性發炎、掉髮、睡眠障礙。當時不知道問題出在肋骨外翻和過度訓練。
            </p>
          </div>

          <div className="border-l-4 border-gray-900 pl-8 py-4">
            <p className="text-gray-400 text-sm mb-2">2023 年</p>
            <h4 className="text-xl font-semibold mb-3" style={{color: '#2D2D2D'}}>發現 ZOA 的轉折點</h4>
            <p className="text-gray-600 text-sm leading-relaxed">
              接觸 PRI（Postural Restoration Institute）呼吸力學後，才發現核心問題在結構失衡。開始每次訓練前做呼吸矯正，腰痛問題在 2 週內改善。
            </p>
          </div>

          <div className="border-l-4 border-gray-900 pl-8 py-4">
            <p className="text-gray-400 text-sm mb-2">2026 年</p>
            <h4 className="text-xl font-semibold mb-3" style={{color: '#2D2D2D'}}>現在的訓練模式</h4>
            <p className="text-gray-600 text-sm leading-relaxed">
              每週 3-4 次訓練，每次 60-90 分鐘。專注在深蹲、硬舉、臥推三大動作。用 RPE 管理強度，追蹤數據，持續進步。
            </p>
          </div>
        </div>
      </div>

      {/* CTA 區塊 */}
      <div className="my-20 text-center max-w-3xl mx-auto">
        <h3 className="text-3xl mb-6 font-semibold" style={{color: '#2D2D2D', letterSpacing: '0.03em'}}>想了解更多？</h3>
        <p className="text-gray-600 mb-8 leading-relaxed">
          我在部落格分享更多訓練心得和實戰經驗。
        </p>
        <div className="flex gap-4 justify-center mb-12">
          <a
            href="/blog"
            className="inline-block px-8 py-3 rounded-full font-medium text-white transition-all hover:opacity-90"
            style={{backgroundColor: '#2D2D2D', letterSpacing: '0.05em'}}
          >
            閱讀部落格文章
          </a>
          <a
            href="https://lin.ee/dnbucVw"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block px-8 py-3 rounded-full font-medium border-2 transition-all hover:bg-gray-50"
            style={{borderColor: '#2D2D2D', color: '#2D2D2D', letterSpacing: '0.05em'}}
          >
            預約訓練評估
          </a>
        </div>
        <p className="text-gray-400 text-sm">
          Coolday Fitness 北屯館 • 一對一訓練指導
        </p>
      </div>
    </section>
  )
}
