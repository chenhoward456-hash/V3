import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: '服務條款 - Howard Protocol',
  description: 'Howard Protocol 智能管理系統服務條款，使用本服務前請詳閱。',
  alternates: { canonical: 'https://howard456.vercel.app/terms' },
}

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">服務條款</h1>
        <p className="text-sm text-gray-400 mb-10">最後更新日期：2026 年 3 月 7 日</p>

        <div className="prose prose-gray prose-sm max-w-none space-y-8">
          {/* 1 */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">1. 服務說明</h2>
            <p className="text-sm text-gray-700 leading-relaxed">
              Howard Protocol（以下稱「本服務」）提供數據驅動的體態與營養管理工具，
              包含但不限於：自適應 TDEE 校正、體重趨勢分析、每週智能報告、AI 對話顧問、
              血檢數據紀錄、備賽 Peak Week 計畫產生等功能。本服務由 CSCS 認證教練監督運作。
            </p>
          </section>

          {/* 2 — 核心免責 */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">2. 非醫療服務聲明</h2>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <p className="text-sm text-amber-900 leading-relaxed font-medium mb-2">
                請特別注意以下事項：
              </p>
              <ul className="text-sm text-amber-800 space-y-2 list-disc pl-5">
                <li>
                  <strong>本服務不是醫療服務。</strong>所有系統產生的分析、建議、報告及 AI 回覆，
                  均為基於公開研究文獻與演算法的<strong>參考資訊</strong>，不構成醫療診斷、治療建議或個人化營養處方。
                </li>
                <li>
                  <strong>血檢數據紀錄功能</strong>僅供您記錄與追蹤趨勢，系統提供的飲食方向建議僅供參考。
                  數值判讀與健康評估請以您的醫師意見為準。
                </li>
                <li>
                  <strong>備賽 Peak Week 計畫</strong>涉及碳水操作、水分與鈉調整，具有一定健康風險。
                  此計畫僅供教練與選手參考，必須在專業教練監督下執行。如有任何身體不適，應立即停止並就醫。
                </li>
                <li>
                  <strong>AI 對話顧問</strong>的回覆為演算法自動產生，可能存在不準確之處，不應作為健康決策的唯一依據。
                </li>
                <li>
                  如您有任何健康疑慮、正在接受醫療治療、懷孕或哺乳中，
                  請<strong>務必先諮詢合格醫師</strong>後再使用本服務。
                </li>
              </ul>
            </div>
          </section>

          {/* 3 */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">3. 效果聲明</h2>
            <p className="text-sm text-gray-700 leading-relaxed">
              訓練與營養管理的效果因個人體質、配合度、生活習慣、遺傳因素等而異。
              本服務<strong>不保證任何特定成效</strong>，包括但不限於特定的體重變化、體脂變化或健康改善。
              網站上的案例分享僅為個人經驗紀錄，不代表所有使用者均能達到相同效果。
            </p>
          </section>

          {/* 4 */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">4. 訂閱與付款</h2>
            <ul className="text-sm text-gray-700 space-y-2 list-disc pl-5">
              <li>訂閱費用依所選方案收取，付款由綠界科技（ECPay）處理。</li>
              <li>訂閱期間您可完整使用該方案對應的所有功能。</li>
              <li>訂閱到期後，系統將停止更新分析報告，但您仍可查看歷史紀錄。</li>
              <li>由於數位服務的性質，訂閱付款後原則上不提供退款。如有特殊情況，請聯繫我們協商處理。</li>
            </ul>
          </section>

          {/* 5 */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">5. 使用者義務</h2>
            <ul className="text-sm text-gray-700 space-y-2 list-disc pl-5">
              <li>您應提供真實、準確的個人資料與健康數據。不實資料可能影響系統分析的準確性。</li>
              <li>您的帳號存取碼僅供個人使用，請勿分享給第三方。</li>
              <li>請勿以任何方式濫用、攻擊或干擾本服務的正常運作。</li>
              <li>您了解並同意，使用本服務的健康相關功能需自行承擔風險。</li>
            </ul>
          </section>

          {/* 6 */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">6. 智慧財產權</h2>
            <p className="text-sm text-gray-700 leading-relaxed">
              本服務的演算法、系統介面、報告格式、文章內容及相關智慧財產權均屬本服務所有。
              您上傳的個人數據之所有權歸您所有，但您同意授權本服務在提供服務範圍內使用這些數據。
            </p>
          </section>

          {/* 7 */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">7. 責任限制</h2>
            <p className="text-sm text-gray-700 leading-relaxed">
              在法律允許的最大範圍內，本服務對於因使用或無法使用本服務所導致的任何直接、間接、
              附帶、特殊或衍生性損害，不承擔賠償責任。本服務的最大賠償責任以您過去 12 個月內
              實際支付的訂閱費用總額為上限。
            </p>
          </section>

          {/* 8 */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">8. 服務中斷與終止</h2>
            <ul className="text-sm text-gray-700 space-y-2 list-disc pl-5">
              <li>我們可能因系統維護、升級或不可抗力因素暫時中斷服務，將盡力提前通知。</li>
              <li>如您違反本條款，我們保留暫停或終止您帳號的權利。</li>
              <li>您可隨時透過聯繫我們來終止使用本服務並要求刪除個人資料。</li>
            </ul>
          </section>

          {/* 9 */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">9. 準據法與管轄</h2>
            <p className="text-sm text-gray-700 leading-relaxed">
              本條款以中華民國法律為準據法。因本條款所生之爭議，雙方同意以臺灣臺中地方法院為第一審管轄法院。
            </p>
          </section>

          {/* 10 */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">10. 條款修訂</h2>
            <p className="text-sm text-gray-700 leading-relaxed">
              本服務保留隨時修訂本條款的權利。修訂後的條款將公告於本頁面，
              重大變更時會透過 LINE 或網站通知。繼續使用本服務即視為同意修訂後的條款。
            </p>
          </section>

          {/* 11 */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">11. 聯絡方式</h2>
            <p className="text-sm text-gray-700 leading-relaxed">
              如對本服務條款有任何疑問，請透過以下方式聯繫：
            </p>
            <ul className="text-sm text-gray-700 space-y-1 list-disc pl-5 mt-2">
              <li>LINE 官方帳號：@howard456</li>
            </ul>
          </section>
        </div>

        <div className="mt-12 pt-6 border-t border-gray-200 flex gap-4">
          <Link href="/privacy" className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
            隱私政策
          </Link>
          <Link href="/" className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
            ← 返回首頁
          </Link>
        </div>
      </div>
    </div>
  )
}
