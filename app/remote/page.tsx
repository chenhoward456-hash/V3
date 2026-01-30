import type { Metadata } from 'next'
import Link from 'next/link'
import LineButton from '@/components/LineButton'

export const metadata: Metadata = {
  title: '遠端數據追蹤訂閱 - 24 小時健康監控 | Howard',
  description: '月費 5000 元，包含 LINE 即時諮詢、每月視訊、血檢報告解讀、吃睡練補品全方位監控。不用進健身房，用數據優化你的身體系統。',
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
          月費 <span className="text-3xl font-bold text-primary">5,000 元</span>
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

      {/* 方案內容 */}
      <div className="my-20 max-w-5xl mx-auto">
        <h2 className="text-3xl font-bold text-center mb-12" style={{color: '#2D2D2D'}}>
          訂閱包含什麼？
        </h2>

        <div className="grid md:grid-cols-2 gap-8">
          {/* 1. LINE 即時諮詢 */}
          <div className="bg-white rounded-2xl p-8 border-2 border-gray-200">
            <div className="w-12 h-12 rounded-full bg-success/10 flex items-center justify-center text-success font-bold text-lg mb-4">
              01
            </div>
            <h3 className="text-xl font-bold mb-3" style={{color: '#2D2D2D'}}>
              LINE 即時諮詢
            </h3>
            <p className="text-gray-600 mb-4">
              24 小時內回覆，隨時解答你的疑問
            </p>
            <ul className="space-y-2 text-sm text-gray-600">
              <li className="flex items-start gap-2">
                <span className="text-success">✓</span>
                <span>訓練動作調整建議</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-success">✓</span>
                <span>飲食策略即時優化</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-success">✓</span>
                <span>補品使用時機指導</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-success">✓</span>
                <span>睡眠品質問題排查</span>
              </li>
            </ul>
          </div>

          {/* 2. 每月視訊諮詢 */}
          <div className="bg-white rounded-2xl p-8 border-2 border-gray-200">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg mb-4">
              02
            </div>
            <h3 className="text-xl font-bold mb-3" style={{color: '#2D2D2D'}}>
              每月視訊諮詢
            </h3>
            <p className="text-gray-600 mb-4">
              每月 1 次深度對談（60 分鐘）
            </p>
            <ul className="space-y-2 text-sm text-gray-600">
              <li className="flex items-start gap-2">
                <span className="text-success">✓</span>
                <span>檢視當月數據變化</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-success">✓</span>
                <span>調整下個月協定</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-success">✓</span>
                <span>動作品質影片檢視</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-success">✓</span>
                <span>長期目標規劃</span>
              </li>
            </ul>
          </div>

          {/* 3. 血檢報告解讀 */}
          <div className="bg-white rounded-2xl p-8 border-2 border-gray-200">
            <div className="w-12 h-12 rounded-full bg-warning/10 flex items-center justify-center text-warning font-bold text-lg mb-4">
              03
            </div>
            <h3 className="text-xl font-bold mb-3" style={{color: '#2D2D2D'}}>
              血檢報告解讀
            </h3>
            <p className="text-gray-600 mb-4">
              基於個人經驗的數據優化建議
            </p>
            <ul className="space-y-2 text-sm text-gray-600">
              <li className="flex items-start gap-2">
                <span className="text-success">✓</span>
                <span>睪固酮、甲狀腺、發炎指標</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-success">✓</span>
                <span>營養素缺乏判斷</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-success">✓</span>
                <span>補品策略建議</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-warning">⚠️</span>
                <span className="text-xs">抽血費用需自付，建議 3-6 個月檢測一次</span>
              </li>
            </ul>
          </div>

          {/* 4. 吃睡練全方位監控 */}
          <div className="bg-white rounded-2xl p-8 border-2 border-gray-200">
            <div className="w-12 h-12 rounded-full bg-danger/10 flex items-center justify-center text-danger font-bold text-lg mb-4">
              04
            </div>
            <h3 className="text-xl font-bold mb-3" style={{color: '#2D2D2D'}}>
              吃睡練全方位監控
            </h3>
            <p className="text-gray-600 mb-4">
              每週數據追蹤與協定調整
            </p>
            <ul className="space-y-2 text-sm text-gray-600">
              <li className="flex items-start gap-2">
                <span className="text-success">✓</span>
                <span>HRV 睡眠品質追蹤</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-success">✓</span>
                <span>訓練量與恢復平衡</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-success">✓</span>
                <span>飲食熱量與營養素配比</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-success">✓</span>
                <span>補品使用時機優化</span>
              </li>
            </ul>
          </div>
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
          月費 5,000 元 • 隨時可取消 • 不綁約
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
              Q: 需要綁約嗎？
            </h3>
            <p className="text-gray-600">
              A: 不需要。採月繳制，隨時可以取消，不會有違約金。
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
              Q: 血檢費用包含在月費裡嗎？
            </h3>
            <p className="text-gray-600">
              A: 不包含。抽血費用需自付（約 2000-5000 元，依檢測項目而定）。我會提供報告解讀與優化建議，但不包含抽血本身的費用。
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
