import Link from 'next/link'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'The Howard Protocol - 系統化身體優化協定 | Howard',
  description: '從系統崩潰到完全重生的完整協定。數據追蹤、訓練系統、營養介入三大支柱，打造可持續的身體優化系統。',
}

export default function ProtocolPage() {
  return (
    <section className="section-container">
      <div className="text-center mb-16">
        <div className="inline-block px-4 py-2 bg-primary/10 rounded-full text-primary text-sm font-medium mb-6">
          The Howard Protocol
        </div>
        <h1 className="text-4xl md:text-5xl font-bold mb-6" style={{color: '#2D2D2D', letterSpacing: '0.05em'}}>
          系統化身體優化協定
        </h1>
        <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
          這不是一套訓練課程，而是一套完整的身體系統優化協定。<br />
          從數據追蹤、訓練設計到營養介入，用科學方法重建你的身體系統。
        </p>
      </div>

      {/* 核心理念 */}
      <div className="my-20 max-w-4xl mx-auto" style={{borderLeft: '4px solid #8B7355', paddingLeft: '2rem', backgroundColor: 'rgba(139, 115, 85, 0.03)', padding: '2rem 2rem 2rem 3rem', borderRadius: '0.5rem'}}>
        <h2 className="text-2xl font-bold mb-4" style={{color: '#2D2D2D'}}>
          為什麼需要「系統化」？
        </h2>
        <p className="text-gray-600 leading-relaxed mb-4">
          大多數人的身體優化失敗，不是因為不夠努力，而是因為缺乏系統。
        </p>
        <p className="text-gray-600 leading-relaxed mb-4">
          你可能：
        </p>
        <ul className="space-y-2 text-gray-600 mb-4">
          <li>• 訓練很認真，但沒有追蹤數據，不知道是否有進步</li>
          <li>• 飲食很嚴格，但沒有考慮睡眠和壓力，效果打折</li>
          <li>• 補品吃很多，但沒有數據追蹤，不知道是否真的需要</li>
          <li>• 目標很明確，但沒有系統化執行，最後半途而廢</li>
        </ul>
        <p className="italic text-gray-500 text-sm leading-relaxed" style={{fontFamily: 'Georgia, serif'}}>
          「The Howard Protocol 不是教你怎麼練，而是教你如何建立一套可持續的優化系統。」
        </p>
      </div>

      {/* 三大支柱 */}
      <div className="my-20 max-w-5xl mx-auto">
        <h2 className="text-3xl font-bold text-center mb-12" style={{color: '#2D2D2D'}}>
          The Howard Protocol 三大支柱
        </h2>

        <div className="grid md:grid-cols-3 gap-8">
          {/* 支柱 1：數據追蹤 */}
          <div className="bg-white rounded-2xl p-8 border-2 border-primary/20">
            <div className="text-5xl mb-4">📊</div>
            <h3 className="text-2xl font-bold mb-4" style={{color: '#2D2D2D'}}>
              數據追蹤
            </h3>
            <p className="text-gray-600 text-sm mb-6 leading-relaxed">
              用數據找出系統瓶頸，而不是憑感覺猜測
            </p>
            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-2">
                <span className="text-primary">▸</span>
                <span className="text-gray-700">HRV 睡眠品質追蹤</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-primary">▸</span>
                <span className="text-gray-700">體組成分析（InBody）</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-primary">▸</span>
                <span className="text-gray-700">訓練量與強度記錄</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-primary">▸</span>
                <span className="text-gray-700">血檢數據經驗分享</span>
              </div>
            </div>
            <div className="mt-6">
              <Link href="/blog/zone-2-cardio-benefits" className="text-primary hover:underline text-sm">
                → 閱讀：Zone 2 訓練實測數據
              </Link>
            </div>
          </div>

          {/* 支柱 2：訓練系統 */}
          <div className="bg-white rounded-2xl p-8 border-2 border-success/20">
            <div className="text-5xl mb-4">⚙️</div>
            <h3 className="text-2xl font-bold mb-4" style={{color: '#2D2D2D'}}>
              訓練系統
            </h3>
            <p className="text-gray-600 text-sm mb-6 leading-relaxed">
              根據數據設計訓練，而不是照抄網路課表
            </p>
            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-2">
                <span className="text-success">▸</span>
                <span className="text-gray-700">肌力訓練量化設計</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-success">▸</span>
                <span className="text-gray-700">Zone 2 有氧優化</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-success">▸</span>
                <span className="text-gray-700">動作評估與矯正</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-success">▸</span>
                <span className="text-gray-700">恢復策略管理</span>
              </div>
            </div>
            <div className="mt-6">
              <Link href="/training" className="text-success hover:underline text-sm">
                → 了解訓練系統
              </Link>
            </div>
          </div>

          {/* 支柱 3：營養介入 */}
          <div className="bg-white rounded-2xl p-8 border-2 border-warning/20">
            <div className="text-5xl mb-4">🍽️</div>
            <h3 className="text-2xl font-bold mb-4" style={{color: '#2D2D2D'}}>
              營養介入
            </h3>
            <p className="text-gray-600 text-sm mb-6 leading-relaxed">
              根據目標調整營養，而不是盲目節食
            </p>
            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-2">
                <span className="text-warning">▸</span>
                <span className="text-gray-700">熱量與營養素配置</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-warning">▸</span>
                <span className="text-gray-700">飲食時機優化</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-warning">▸</span>
                <span className="text-gray-700">補品使用經驗分享</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-warning">▸</span>
                <span className="text-gray-700">代謝優化策略</span>
              </div>
            </div>
            <div className="mt-6">
              <Link href="/nutrition" className="text-warning hover:underline text-sm">
                → 了解營養協議
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* 執行流程 */}
      <div className="my-20 max-w-4xl mx-auto">
        <h2 className="text-3xl font-bold text-center mb-12" style={{color: '#2D2D2D'}}>
          如何執行 Howard Protocol？
        </h2>

        <div className="space-y-6">
          <div className="flex gap-6">
            <div className="flex-shrink-0">
              <div className="w-12 h-12 rounded-full bg-primary text-white flex items-center justify-center font-bold">
                01
              </div>
            </div>
            <div className="flex-1">
              <h4 className="text-lg font-bold mb-2" style={{color: '#2D2D2D'}}>
                系統診斷
              </h4>
              <p className="text-gray-600 text-sm leading-relaxed mb-3">
                完成 30 秒診斷測驗，了解你的系統狀態與優化需求
              </p>
              <Link 
                href="/diagnosis"
                className="inline-block text-primary hover:underline text-sm font-medium"
              >
                → 開始診斷測驗
              </Link>
            </div>
          </div>

          <div className="flex gap-6">
            <div className="flex-shrink-0">
              <div className="w-12 h-12 rounded-full bg-success text-white flex items-center justify-center font-bold">
                02
              </div>
            </div>
            <div className="flex-1">
              <h4 className="text-lg font-bold mb-2" style={{color: '#2D2D2D'}}>
                數據採集
              </h4>
              <p className="text-gray-600 text-sm leading-relaxed">
                建立你的身體基線數據：HRV、體組成、訓練能力、飲食記錄、血檢數據（選配）
              </p>
            </div>
          </div>

          <div className="flex gap-6">
            <div className="flex-shrink-0">
              <div className="w-12 h-12 rounded-full bg-warning text-white flex items-center justify-center font-bold">
                03
              </div>
            </div>
            <div className="flex-1">
              <h4 className="text-lg font-bold mb-2" style={{color: '#2D2D2D'}}>
                協定設計
              </h4>
              <p className="text-gray-600 text-sm leading-relaxed">
                根據數據設計專屬的優化協定：訓練量化、營養介入、恢復優化、補品策略
              </p>
            </div>
          </div>

          <div className="flex gap-6">
            <div className="flex-shrink-0">
              <div className="w-12 h-12 rounded-full bg-gray-900 text-white flex items-center justify-center font-bold">
                04
              </div>
            </div>
            <div className="flex-1">
              <h4 className="text-lg font-bold mb-2" style={{color: '#2D2D2D'}}>
                持續監控
              </h4>
              <p className="text-gray-600 text-sm leading-relaxed">
                24 小時 LINE 諮詢、月視訊追蹤、根據數據反饋動態調整協定
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 真實案例 */}
      <div className="my-20 max-w-4xl mx-auto bg-gradient-to-br from-gray-50 to-white rounded-2xl p-10 border-2 border-gray-200">
        <h2 className="text-3xl font-bold text-center mb-8" style={{color: '#2D2D2D'}}>
          真實案例：從系統崩潰到完全重生
        </h2>
        <div className="grid md:grid-cols-2 gap-8 mb-8">
          <div>
            <h4 className="font-bold mb-3 text-danger">❌ 2020 年系統崩潰</h4>
            <ul className="space-y-2 text-sm text-gray-700">
              <li>• 嚴重落髮（頭頂明顯稀疏）</li>
              <li>• 全身性慢性發炎</li>
              <li>• 持續疲勞、無動力</li>
              <li>• hs-CRP 發炎指標異常</li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold mb-3 text-success">✓ 2026 年完全重生</h4>
            <ul className="space-y-2 text-sm text-gray-700">
              <li>• 頭髮恢復濃密</li>
              <li>• 精實體態（FFMI 23.6）</li>
              <li>• 精力充沛、高效能</li>
              <li>• HRV 達到菁英等級（91ms）</li>
            </ul>
          </div>
        </div>
        <div className="text-center">
          <Link 
            href="/case"
            className="inline-block text-primary hover:underline font-medium"
          >
            查看完整案例追蹤 →
          </Link>
        </div>
      </div>

      {/* CTA */}
      <div className="my-20 text-center max-w-3xl mx-auto">
        <h3 className="text-3xl font-bold mb-6" style={{color: '#2D2D2D'}}>
          準備好開始了嗎？
        </h3>
        <p className="text-gray-600 mb-8 leading-relaxed">
          完成 30 秒系統診斷，我會根據你的狀態推薦最適合的優化方案
        </p>
        <Link
          href="/diagnosis"
          className="inline-block bg-primary text-white px-12 py-4 rounded-xl font-bold text-lg hover:opacity-90 transition-all hover:scale-105"
        >
          開始系統診斷 →
        </Link>
        <p className="text-gray-500 text-sm mt-6">
          診斷完成後，你會看到專屬的優化建議
        </p>
      </div>

      {/* 免責聲明 */}
      <div className="my-12 max-w-4xl mx-auto bg-gray-50 rounded-xl p-6 border-l-4 border-gray-400">
        <p className="text-gray-600 text-sm leading-relaxed">
          ⚠️ <strong>重要聲明</strong>：The Howard Protocol 是基於個人 6 年實驗經驗的系統化方法分享，
          不構成任何醫療建議或診斷。所有健康相關決策請諮詢專業醫療人員。
          本協定強調的是系統化思維與數據追蹤方法，而非醫療處置。
        </p>
      </div>
    </section>
  )
}
