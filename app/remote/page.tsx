import type { Metadata } from 'next'
import Link from 'next/link'
import LineButton from '@/components/LineButton'

export const metadata: Metadata = {
  title: '遠端數據追蹤訂閱 - 入門版3800元起 | Howard',
  description: '兩種方案任選：入門版月費3800元（LINE諮詢+月視訊）、進階版季度18000元（含血檢解讀+補品建議）。不用進健身房，用數據優化你的身體系統。',
}

export default function RemotePage() {
  return (
    <section className="section-container">
      {/* Hero 區塊 */}
      <div className="max-w-4xl mx-auto text-center mb-16">
        <div className="inline-block px-4 py-2 bg-primary/10 rounded-full text-primary text-sm font-medium mb-6">
          遠端數據追蹤訂閱制
        </div>
        <h1 className="text-4xl md:text-5xl font-bold mb-6" style={{color: '#2D2D2D', letterSpacing: '0.05em'}}>
          24 小時健康監控
        </h1>
        <p className="text-xl text-gray-600 mb-4 leading-relaxed">
          不用每週進健身房，用數據優化你的身體系統
        </p>
        <p className="text-gray-500 text-lg">
          入門版 <span className="text-2xl font-bold text-primary">3,800 元/月</span> 起
        </p>
      </div>

      {/* 核心價值主張 */}
      <div className="my-20 max-w-4xl mx-auto" style={{borderLeft: '4px solid #8B7355', paddingLeft: '2rem', backgroundColor: 'rgba(139, 115, 85, 0.03)', padding: '2rem 2rem 2rem 3rem', borderRadius: '0.5rem'}}>
        <h2 className="text-2xl font-bold mb-4" style={{color: '#2D2D2D'}}>
          為什麼選擇遠端追蹤？
        </h2>
        <p className="text-gray-600 leading-relaxed mb-4">
          健身房只是工具，真正影響你身體的是「24 小時的生活型態」。
        </p>
        <p className="text-gray-600 leading-relaxed mb-4">
          我用 6 年時間實測發現：<strong>睡眠品質、壓力管理、營養時機、補品策略</strong>，這些才是決定你進步速度的關鍵。
        </p>
        <p className="italic text-gray-500 text-sm leading-relaxed" style={{fontFamily: 'Georgia, serif'}}>
          「一週見面 2 小時，不如每天追蹤你的數據 24 小時。」
        </p>
      </div>

      {/* 方案選擇 */}
      <div className="my-20 max-w-5xl mx-auto">
        <h2 className="text-3xl font-bold text-center mb-4" style={{color: '#2D2D2D'}}>
          選擇適合你的方案
        </h2>
        <p className="text-center text-gray-600 mb-12">
          兩種方案都包含遠端數據追蹤，差別在於深度與頻率
        </p>

        <div className="grid md:grid-cols-2 gap-8">
          {/* 入門版 */}
          <div className="bg-white rounded-2xl p-8 border-2 border-primary/30 relative">
            <div className="absolute -top-4 left-8 bg-primary text-white px-4 py-1 rounded-full text-sm font-bold">
              推薦新手
            </div>
            <h3 className="text-2xl font-bold mb-2" style={{color: '#2D2D2D'}}>
              入門版
            </h3>
            <div className="mb-6">
              <span className="text-4xl font-bold text-primary">3,800</span>
              <span className="text-gray-600"> 元/月</span>
            </div>
            
            <div className="space-y-3 mb-8">
              <div className="flex items-start gap-2">
                <span className="text-success text-lg">✓</span>
                <span className="text-gray-700">LINE 諮詢（48 小時內回覆）</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-success text-lg">✓</span>
                <span className="text-gray-700">每月 1 次視訊（30 分鐘）</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-success text-lg">✓</span>
                <span className="text-gray-700">訓練計畫調整</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-success text-lg">✓</span>
                <span className="text-gray-700">飲食策略建議</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-success text-lg">✓</span>
                <span className="text-gray-700">每週數據追蹤</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-gray-400 text-lg">✗</span>
                <span className="text-gray-400 line-through">血檢報告解讀</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-gray-400 text-lg">✗</span>
                <span className="text-gray-400 line-through">補品策略建議</span>
              </div>
            </div>

            <div className="bg-gray-50 rounded-xl p-4 mb-6">
              <p className="text-sm text-gray-600">
                <strong>適合：</strong>有訓練基礎、想要遠端指導、預算有限的人
              </p>
            </div>

            <LineButton
              source="remote_page"
              intent="starter"
              className="block w-full text-center bg-primary text-white px-8 py-4 rounded-xl font-bold shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all"
            >
              選擇入門版
            </LineButton>
          </div>

          {/* 進階版 */}
          <div className="bg-gradient-to-br from-warning/5 to-warning/10 rounded-2xl p-8 border-2 border-warning/50 relative">
            <div className="absolute -top-4 left-8 bg-warning text-white px-4 py-1 rounded-full text-sm font-bold">
              完整優化
            </div>
            <h3 className="text-2xl font-bold mb-2" style={{color: '#2D2D2D'}}>
              進階版
            </h3>
            <div className="mb-6">
              <span className="text-4xl font-bold text-warning">18,000</span>
              <span className="text-gray-600"> 元/季</span>
              <span className="block text-sm text-gray-500 mt-1">平均 6,000 元/月</span>
            </div>
            
            <div className="space-y-3 mb-8">
              <div className="flex items-start gap-2">
                <span className="text-success text-lg">✓</span>
                <span className="text-gray-700"><strong>LINE 即時諮詢</strong>（24 小時內回覆）</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-success text-lg">✓</span>
                <span className="text-gray-700"><strong>每月 1 次視訊</strong>（60 分鐘）</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-success text-lg">✓</span>
                <span className="text-gray-700">訓練計畫調整</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-success text-lg">✓</span>
                <span className="text-gray-700">飲食策略建議</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-success text-lg">✓</span>
                <span className="text-gray-700">每週數據追蹤</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-warning text-lg">★</span>
                <span className="text-gray-700"><strong>血檢報告解讀</strong>（1 次）</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-warning text-lg">★</span>
                <span className="text-gray-700"><strong>補品策略建議</strong></span>
              </div>
            </div>

            <div className="bg-white rounded-xl p-4 mb-6">
              <p className="text-sm text-gray-600">
                <strong>適合：</strong>認真想優化、對血檢數據有興趣、願意投資 3 個月完整療程的人
              </p>
            </div>

            <LineButton
              source="remote_page"
              intent="advanced"
              className="block w-full text-center bg-warning text-white px-8 py-4 rounded-xl font-bold shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all"
            >
              選擇進階版
            </LineButton>
          </div>
        </div>

        <div className="text-center mt-8 text-sm text-gray-500">
          <p>💡 入門版可隨時升級進階版，補差額即可</p>
        </div>
      </div>

      {/* 適合對象 */}
      <div className="my-20 max-w-4xl mx-auto">
        <h2 className="text-3xl font-bold text-center mb-12" style={{color: '#2D2D2D'}}>
          這個方案適合你嗎？
        </h2>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-success/5 border-2 border-success/20 rounded-xl p-6">
            <h3 className="text-lg font-bold mb-3 text-success">✓ 適合</h3>
            <ul className="space-y-2 text-sm text-gray-700">
              <li>• 想優化但沒時間每週進健身房</li>
              <li>• 已經有訓練基礎，想更精準優化</li>
              <li>• 重視數據追蹤與系統化方法</li>
              <li>• 想改善睡眠、壓力、恢復問題</li>
              <li>• 對血檢數據優化有興趣</li>
            </ul>
          </div>

          <div className="bg-gray-50 border-2 border-gray-200 rounded-xl p-6">
            <h3 className="text-lg font-bold mb-3 text-gray-600">✗ 不適合</h3>
            <ul className="space-y-2 text-sm text-gray-600">
              <li>• 完全沒有訓練經驗的新手</li>
              <li>• 需要每週實體指導動作</li>
              <li>• 不習慣用數據追蹤進度</li>
              <li>• 只想要訓練菜單不想溝通</li>
              <li>• 無法配合每週回報數據</li>
            </ul>
          </div>
        </div>
      </div>

      {/* 免責聲明 */}
      <div className="my-12 max-w-4xl mx-auto">
        <div className="bg-warning/5 border-2 border-warning/30 rounded-xl p-6">
          <h3 className="text-lg font-bold mb-3 text-warning">⚠️ 重要聲明</h3>
          <p className="text-gray-600 text-sm leading-relaxed">
            此服務提供的是教練個人經驗整理與訓練指導，<strong>不構成醫療建議或診斷</strong>。血檢報告解讀僅為個人經驗分享，非醫療行為。如有健康疑慮請先諮詢合格醫師。補品使用建議僅供參考，使用前請自行評估風險。
          </p>
        </div>
      </div>

      {/* CTA 區塊 */}
      <div className="my-20 max-w-3xl mx-auto text-center">
        <h2 className="text-3xl font-bold mb-6" style={{color: '#2D2D2D'}}>
          準備好開始了嗎？
        </h2>
        <p className="text-gray-600 mb-8">
          加 LINE 跟我聊聊你的目標，我會先了解你的狀況，確認這個方案適不適合你。
        </p>

        <LineButton
          source="remote_page"
          intent="performance"
          className="inline-block bg-primary text-white px-12 py-4 rounded-full font-bold text-lg shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all"
        >
          加 LINE 諮詢訂閱方案
        </LineButton>

        <p className="text-gray-500 text-sm mt-6">
          入門版隨時可取消 • 進階版 3 個月完整療程
        </p>
      </div>

      {/* FAQ */}
      <div className="my-20 max-w-4xl mx-auto">
        <h2 className="text-3xl font-bold text-center mb-12" style={{color: '#2D2D2D'}}>
          常見問題
        </h2>

        <div className="space-y-6">
          <div className="bg-white rounded-xl p-6 border-2 border-gray-200">
            <h3 className="text-lg font-bold mb-2" style={{color: '#2D2D2D'}}>
              Q: 入門版和進階版差在哪？
            </h3>
            <p className="text-gray-600">
              A: 入門版適合想要遠端指導的人，月費 3,800 元，不含血檢解讀和補品建議。進階版是 3 個月完整療程，季費 18,000 元，包含血檢解讀和補品策略，適合認真想優化的人。
            </p>
          </div>

          <div className="bg-white rounded-xl p-6 border-2 border-gray-200">
            <h3 className="text-lg font-bold mb-2" style={{color: '#2D2D2D'}}>
              Q: 可以先試入門版再升級嗎？
            </h3>
            <p className="text-gray-600">
              A: 可以。入門版隨時可以升級進階版，補差額即可。建議先做 1-2 個月入門版，確認適合後再升級。
            </p>
          </div>

          <div className="bg-white rounded-xl p-6 border-2 border-gray-200">
            <h3 className="text-lg font-bold mb-2" style={{color: '#2D2D2D'}}>
              Q: 進階版需要綁約嗎？
            </h3>
            <p className="text-gray-600">
              A: 進階版是 3 個月完整療程，一次性收費 18,000 元。因為血檢優化需要完整週期才能看到效果，所以建議至少做滿 3 個月。
            </p>
          </div>

          <div className="bg-white rounded-xl p-6 border-2 border-gray-200">
            <h3 className="text-lg font-bold mb-2" style={{color: '#2D2D2D'}}>
              Q: 我完全沒有訓練經驗可以嗎？
            </h3>
            <p className="text-gray-600">
              A: 建議先有 3-6 個月的訓練基礎。如果是完全新手，建議先從實體一對一教練開始，學會基本動作後再轉遠端追蹤。
            </p>
          </div>

          <div className="bg-white rounded-xl p-6 border-2 border-gray-200">
            <h3 className="text-lg font-bold mb-2" style={{color: '#2D2D2D'}}>
              Q: 血檢費用包含在方案裡嗎？
            </h3>
            <p className="text-gray-600">
              A: 入門版不包含血檢解讀。進階版包含 1 次血檢報告解讀，但抽血費用需自付（約 3,000-5,000 元，依檢測項目而定）。建議在第 3 個月抽血，這樣才能看到優化成效。
            </p>
          </div>

          <div className="bg-white rounded-xl p-6 border-2 border-gray-200">
            <h3 className="text-lg font-bold mb-2" style={{color: '#2D2D2D'}}>
              Q: 如果我在台中，可以偶爾約實體見面嗎？
            </h3>
            <p className="text-gray-600">
              A: 可以，但需要另外約時間。遠端訂閱不包含實體見面，如需實體指導可以單次預約（費用另計）。
            </p>
          </div>

          <div className="bg-white rounded-xl p-6 border-2 border-gray-200">
            <h3 className="text-lg font-bold mb-2" style={{color: '#2D2D2D'}}>
              Q: 我需要準備什麼設備或 App？
            </h3>
            <p className="text-gray-600">
              A: 建議準備：智慧手環或手錶（追蹤 HRV 與睡眠）、體重體脂計、捲尺（量腰圍）。App 部分我會依你的需求推薦，不強制使用特定品牌。
            </p>
          </div>
        </div>
      </div>

      {/* 最後 CTA */}
      <div className="text-center my-20">
        <p className="text-gray-600 mb-6">
          還有其他問題？直接加 LINE 問我
        </p>
        <Link 
          href="/line"
          className="text-primary hover:underline font-medium"
        >
          或先看看其他人怎麼開始 →
        </Link>
      </div>
    </section>
  )
}
