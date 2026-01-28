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
    <section className="section-container">
      <h1 className="doc-title">
        👋 歡迎來到<br />
        <span className="text-primary">The Howard Protocol</span>
      </h1>
      <p className="doc-subtitle">
        我是 Howard Chen，CSCS 認證體能教練，高雄醫學大學運動醫學系畢業。<br />
        這套系統整合了我在肌力訓練、運動醫學與生物駭客領域的實戰經驗。
      </p>

      <div className="mission-box">
        <h3>✨ 為什麼不一樣？</h3>
        <p>
          大多數「健身教練」只會帶你練。我的工作是：<br />
          ✓ 用運動科學原理設計訓練計畫<br />
          ✓ 用系統化方法優化營養與恢復<br />
          ✓ 解決姿勢問題與預防運動傷害
        </p>
      </div>

      <div className="my-20">
        <h3 className="text-3xl font-semibold mb-12">為什麼選擇 Howard？</h3>
        <div className="grid md:grid-cols-3 gap-8">
          <div className="bg-white/50 rounded-[2rem] p-10" style={{boxShadow: '0 1px 3px rgba(0, 0, 0, 0.02), 0 8px 20px rgba(0, 0, 0, 0.02)'}}>
            <div className="text-4xl mb-5">📊</div>
            <h4 className="text-xl font-medium mb-4 text-text-primary">6年個人實驗數據</h4>
            <p className="text-text-secondary leading-relaxed">
              從 2020 年系統崩潰到 2026 年完全重生，完整記錄每一步調整與數據變化。不是理論，是親身實踐。
            </p>
          </div>

          <div className="bg-white/50 rounded-[2rem] p-10" style={{boxShadow: '0 1px 3px rgba(0, 0, 0, 0.02), 0 8px 20px rgba(0, 0, 0, 0.02)'}}>
            <div className="text-4xl mb-5">🎓</div>
            <h4 className="text-xl font-medium mb-4 text-text-primary">CSCS 認證 + 運動醫學背景</h4>
            <p className="text-text-secondary leading-relaxed">
              高雄醫學大學運動醫學系畢業，CSCS 國際認證體能教練。懂解剖學、生物力學，不只是憑感覺練。
            </p>
          </div>

          <div className="bg-white/50 rounded-[2rem] p-10" style={{boxShadow: '0 1px 3px rgba(0, 0, 0, 0.02), 0 8px 20px rgba(0, 0, 0, 0.02)'}}>
            <div className="text-4xl mb-5"></div>
            <h4 className="text-xl font-medium mb-4 text-text-primary">系統化訓練方法</h4>
            <p className="text-text-secondary leading-relaxed">
              整合訓練、營養、恢復的完整系統。不是單純帶練，而是陪你建立長期健康的生活方式。
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

      <div className="text-center my-16">
        <Link 
          href="/action"
          className="inline-block bg-primary text-white px-10 py-4 rounded-full font-medium text-lg hover:bg-primary-dark transition-colors"
          style={{boxShadow: '0 4px 16px rgba(37, 99, 235, 0.2)'}}
        >
          預約免費諮詢
        </Link>
        <p className="text-text-muted text-sm mt-4">台中市北屯區 • 一對一訓練指導</p>
      </div>
    </section>
  )
}
