import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Howard Chen - 台中 CSCS 體能教練',
  description: 'Howard Chen，CSCS 認證體能教練，高雄醫學大學運動醫學系畢業。整合肌力訓練與營養優化。',
  openGraph: {
    title: 'Howard Chen - 台中 CSCS 體能教練',
    description: '整合肌力訓練與營養優化的系統化訓練指導',
  },
}

export default function HomePage() {
  return (
    <section className="section-container" style={{backgroundColor: '#F9F9F7'}}>
      <h1 className="doc-title" style={{color: '#2D2D2D', letterSpacing: '0.08em', lineHeight: '1.3'}}>
        <span style={{fontSize: '0.6em', fontWeight: 'normal', display: 'block', marginBottom: '1rem', letterSpacing: '0.02em'}}>從系統崩潰到完全重生</span>
        <span style={{color: '#2D2D2D'}}>The Howard Protocol</span>
      </h1>
      <p className="doc-subtitle" style={{color: '#2D2D2D', maxWidth: '700px', margin: '0 auto 3rem', lineHeight: '1.8'}}>
        你的身體，需要一套精準的操作協定。<br /><br />
        我是 Howard Chen，Coolday Fitness 北屯館教練主管，CSCS 認證體能教練，高雄醫學大學運動醫學系畢業。
      </p>

      {/* 30 秒身體效能快篩 - 互動區塊 */}
      <div className="my-20 max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h3 className="text-3xl font-semibold mb-4" style={{color: '#2D2D2D', letterSpacing: '0.03em'}}>你的身體系統，現在處於什麼狀態？</h3>
          <p className="text-gray-600 text-[15px] leading-relaxed">
            4 個問題，30 秒快速評估你的健康風險與效能指標
          </p>
        </div>
        
        <div className="bg-gradient-to-br from-gray-50 to-white rounded-[2rem] p-10 border-2 border-gray-200" style={{boxShadow: '0 4px 20px rgba(0, 0, 0, 0.04)'}}>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="text-5xl">🎯</div>
              <div>
                <h4 className="text-xl font-semibold" style={{color: '#2D2D2D'}}>系統診斷測驗</h4>
                <p className="text-gray-500 text-sm">領先指標評估 • 即時結果</p>
              </div>
            </div>
          </div>
          
          <div className="space-y-4 mb-8 text-gray-600 text-sm">
            <div className="flex items-start gap-3">
              <span className="text-green-600 font-bold">✓</span>
              <span>睡眠品質與恢復能力評估</span>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-green-600 font-bold">✓</span>
              <span>代謝效率與體態警訊檢測</span>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-green-600 font-bold">✓</span>
              <span>壓力荷爾蒙與發炎指標篩查</span>
            </div>
          </div>

          <Link 
            href="/diagnosis"
            className="block w-full text-center text-white px-8 py-4 rounded-full font-medium text-lg transition-all hover:opacity-90"
            style={{backgroundColor: '#2D2D2D', letterSpacing: '0.05em'}}
          >
            開始 30 秒快篩 →
          </Link>
          
          <p className="text-center text-gray-400 text-xs mt-4">
            完全免費 • 無需註冊 • 即時查看結果
          </p>
        </div>
      </div>

      {/* 真誠區塊 - 6年實驗數據 */}
      <div className="my-20 max-w-4xl mx-auto" style={{borderLeft: '4px solid #8B7355', paddingLeft: '2rem', backgroundColor: 'rgba(139, 115, 85, 0.03)', padding: '2rem 2rem 2rem 3rem', borderRadius: '0.5rem'}}>
        <div className="flex items-start gap-4 mb-4">
          <span className="text-5xl">📊</span>
          <div>
            <h3 className="text-2xl font-semibold mb-3" style={{color: '#2D2D2D', letterSpacing: '0.02em'}}>6年個人實驗數據</h3>
            <p className="text-gray-600 leading-relaxed text-[15px] mb-4">
              從 2020 年系統崩潰到 2026 年完全重生，完整記錄每一步調整與數據變化。
            </p>
            <p className="italic text-gray-500 text-sm leading-relaxed" style={{fontFamily: 'Georgia, serif'}}>
              「這不是理論，是我在 2020 年身體系統崩潰後，花了六年時間，用自己的數據一點一滴換來的重生記錄。」
            </p>
          </div>
        </div>
      </div>

      {/* 無邊框卡片設計 - 去 AI 化 */}
      <div className="my-24 max-w-5xl mx-auto">
        <h3 className="text-3xl font-semibold mb-16 text-center" style={{color: '#2D2D2D', letterSpacing: '0.03em'}}>核心能力</h3>
        <div className="grid md:grid-cols-3 gap-16">
          <div className="text-center">
            <div className="text-4xl mb-6" style={{color: '#8B7355'}}>🎓</div>
            <h4 className="text-xl font-medium mb-4" style={{color: '#2D2D2D', letterSpacing: '0.02em'}}>CSCS 認證<br />運動醫學背景</h4>
            <p className="text-gray-600 leading-relaxed text-[15px]">
              高雄醫學大學運動醫學系畢業，CSCS 國際認證體能教練。懂解剖學、生物力學。
            </p>
          </div>

          <div className="text-center">
            <div className="text-4xl mb-6" style={{color: '#8B7355'}}>🔬</div>
            <h4 className="text-xl font-medium mb-4" style={{color: '#2D2D2D', letterSpacing: '0.02em'}}>系統化<br />訓練方法</h4>
            <p className="text-gray-600 leading-relaxed text-[15px]">
              整合訓練、營養、恢復的完整系統。不是單純帶練，而是建立長期健康習慣。
            </p>
          </div>

          <div className="text-center">
            <div className="text-4xl mb-6" style={{color: '#8B7355'}}>📈</div>
            <h4 className="text-xl font-medium mb-4" style={{color: '#2D2D2D', letterSpacing: '0.02em'}}>數據驅動<br />持續優化</h4>
            <p className="text-gray-600 leading-relaxed text-[15px]">
              不靠感覺，靠數據說話。定期追蹤進度，根據反應調整協定。
            </p>
          </div>
        </div>
      </div>

      <div className="my-20">
        <h3 className="text-2xl font-semibold mb-8 text-center">從這裡開始</h3>
        <div className="action-grid">
          <Link href="/diagnosis" className="action-card">
            <h4>� 系統診斷</h4>
            <p>4 個問題，快速評估你的健康風險</p>
          </Link>
          <Link href="/case" className="action-card">
            <h4>📊 個案追蹤</h4>
            <p>看看我如何從系統崩潰到完全重生</p>
          </Link>
          <Link href="/faq" className="action-card">
            <h4>💬 常見問題</h4>
            <p>關於訓練、營養的常見疑問</p>
          </Link>
        </div>
      </div>

      <div className="text-center my-20">
        <Link 
          href="/action"
          className="inline-block text-white px-12 py-4 rounded-full font-medium text-lg transition-all hover:opacity-90"
          style={{backgroundColor: '#2D2D2D', letterSpacing: '0.05em'}}
        >
          與 Howard 開啟對話
        </Link>
        <p className="text-gray-500 text-sm mt-4">Coolday Fitness 北屯館 • 一對一訓練指導</p>
      </div>
    </section>
  )
}
