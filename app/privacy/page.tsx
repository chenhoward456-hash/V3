import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: '隱私政策 - Howard Protocol',
  description: 'Howard Protocol 智能管理系統隱私政策，說明我們如何收集、使用及保護您的個人資料。',
  alternates: { canonical: 'https://howard456.vercel.app/privacy' },
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">隱私政策</h1>
        <p className="text-sm text-gray-400 mb-10">最後更新日期：2026 年 3 月 7 日</p>

        <div className="prose prose-gray prose-sm max-w-none space-y-8">
          {/* 1 */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">1. 總則</h2>
            <p className="text-sm text-gray-700 leading-relaxed">
              Howard Protocol（以下稱「本服務」）重視您的隱私權。本隱私政策說明我們如何收集、使用、儲存及保護您的個人資料，
              並依據中華民國《個人資料保護法》及相關法令辦理。當您使用本服務，即表示您已閱讀並同意本政策內容。
            </p>
          </section>

          {/* 2 */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">2. 我們收集哪些資料</h2>

            <h3 className="text-sm font-semibold text-gray-800 mt-4 mb-2">2.1 帳號與基本資料</h3>
            <ul className="text-sm text-gray-700 space-y-1 list-disc pl-5">
              <li>姓名、電子郵件、電話號碼（訂閱時提供）</li>
              <li>年齡、性別（問卷填寫，可選）</li>
              <li>LINE 帳號識別碼（使用 LINE 機器人時自動取得）</li>
            </ul>

            <h3 className="text-sm font-semibold text-gray-800 mt-4 mb-2">2.2 健康與身體數據</h3>
            <ul className="text-sm text-gray-700 space-y-1 list-disc pl-5">
              <li>體重、身高、體脂率、肌肉量、內臟脂肪、BMI</li>
              <li>血液檢查數值（如您選擇上傳）</li>
              <li>每日營養攝取紀錄（蛋白質、碳水、脂肪、熱量、水分、鈉）</li>
              <li>訓練紀錄（訓練類型、時長、組數、RPE）</li>
              <li>補劑使用紀錄</li>
              <li>每日身心狀態（睡眠品質、精力、情緒、壓力等共 13 項指標）</li>
              <li>穿戴裝置數據（靜息心率、HRV、睡眠分數、恢復分數，由您手動輸入）</li>
              <li>備賽相關資料（比賽日期、目標體重、目標體脂）</li>
            </ul>

            <h3 className="text-sm font-semibold text-gray-800 mt-4 mb-2">2.3 付款資料</h3>
            <ul className="text-sm text-gray-700 space-y-1 list-disc pl-5">
              <li>付款交易由綠界科技（ECPay）處理，本服務不直接儲存您的信用卡號碼</li>
              <li>我們僅儲存交易編號、訂閱方案、付款狀態等必要交易紀錄</li>
            </ul>

            <h3 className="text-sm font-semibold text-gray-800 mt-4 mb-2">2.4 AI 對話</h3>
            <ul className="text-sm text-gray-700 space-y-1 list-disc pl-5">
              <li>AI 聊天對話內容不會永久儲存於資料庫，僅於當次對話期間暫存</li>
              <li>您上傳的餐點照片僅供 AI 即時分析，分析完成後不另行儲存</li>
              <li>我們會記錄每月對話次數，用於額度管理</li>
            </ul>

            <h3 className="text-sm font-semibold text-gray-800 mt-4 mb-2">2.5 自動收集的資料</h3>
            <ul className="text-sm text-gray-700 space-y-1 list-disc pl-5">
              <li>瀏覽行為（透過 Google Analytics）：頁面瀏覽、停留時間、點擊事件</li>
              <li>錯誤紀錄（透過 Sentry）：系統錯誤資訊，用於改善服務品質</li>
              <li>Cookie：管理員登入 Session（HttpOnly、Secure）</li>
            </ul>
          </section>

          {/* 3 */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">3. 資料使用目的</h2>
            <ul className="text-sm text-gray-700 space-y-1 list-disc pl-5">
              <li>提供營養管理、體重趨勢分析、訓練追蹤等核心服務功能</li>
              <li>產生每週智能分析報告與系統建議</li>
              <li>教練審閱您的進度並提供指導</li>
              <li>處理訂閱付款與寄送交易確認信</li>
              <li>改善系統功能與使用者體驗</li>
              <li>系統錯誤偵測與修復</li>
            </ul>
          </section>

          {/* 4 */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">4. 第三方服務</h2>
            <p className="text-sm text-gray-700 leading-relaxed mb-3">
              本服務使用以下第三方服務來運作，這些服務可能在其伺服器上處理您的部分資料：
            </p>
            <div className="overflow-x-auto">
              <table className="text-sm text-gray-700 w-full border-collapse">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 pr-4 font-medium">服務</th>
                    <th className="text-left py-2 pr-4 font-medium">用途</th>
                    <th className="text-left py-2 font-medium">資料類型</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  <tr><td className="py-2 pr-4">Supabase</td><td className="py-2 pr-4">資料庫託管</td><td className="py-2">所有使用者資料</td></tr>
                  <tr><td className="py-2 pr-4">Vercel</td><td className="py-2 pr-4">網站託管</td><td className="py-2">網頁請求資料</td></tr>
                  <tr><td className="py-2 pr-4">LINE Messaging API</td><td className="py-2 pr-4">訊息通知</td><td className="py-2">LINE 帳號 ID、訊息內容</td></tr>
                  <tr><td className="py-2 pr-4">Anthropic (Claude AI)</td><td className="py-2 pr-4">AI 對話分析</td><td className="py-2">對話內容、餐點照片</td></tr>
                  <tr><td className="py-2 pr-4">綠界科技 (ECPay)</td><td className="py-2 pr-4">付款處理</td><td className="py-2">姓名、信箱、交易資料</td></tr>
                  <tr><td className="py-2 pr-4">Resend</td><td className="py-2 pr-4">信件寄送</td><td className="py-2">電子郵件地址</td></tr>
                  <tr><td className="py-2 pr-4">Google Analytics</td><td className="py-2 pr-4">網站分析</td><td className="py-2">匿名瀏覽行為</td></tr>
                  <tr><td className="py-2 pr-4">Sentry</td><td className="py-2 pr-4">錯誤追蹤</td><td className="py-2">系統錯誤紀錄</td></tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* 5 */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">5. 資料保護措施</h2>
            <ul className="text-sm text-gray-700 space-y-1 list-disc pl-5">
              <li>資料庫啟用列層級安全性（Row Level Security），限制存取範圍</li>
              <li>管理員 Session 使用 HMAC 簽章、HttpOnly Cookie</li>
              <li>API 端點實施速率限制（Rate Limiting）</li>
              <li>付款資料由 PCI DSS 合規的綠界科技處理</li>
              <li>網站全程使用 HTTPS 加密傳輸</li>
            </ul>
          </section>

          {/* 6 */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">6. 資料保存期限</h2>
            <p className="text-sm text-gray-700 leading-relaxed">
              您的帳號資料預設保存至訂閱到期後 90 天。付費訂閱期間，資料將持續保存。
              訂閱到期或終止後，我們將於合理期間內刪除或去識別化處理您的個人資料，
              但法律要求保存的交易紀錄除外。
            </p>
          </section>

          {/* 7 */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">7. 您的權利</h2>
            <p className="text-sm text-gray-700 leading-relaxed mb-2">
              依據《個人資料保護法》，您享有以下權利：
            </p>
            <ul className="text-sm text-gray-700 space-y-1 list-disc pl-5">
              <li>查詢或請求閱覽您的個人資料</li>
              <li>請求製給複本</li>
              <li>請求補充或更正</li>
              <li>請求停止蒐集、處理或利用</li>
              <li>請求刪除</li>
            </ul>
            <p className="text-sm text-gray-700 leading-relaxed mt-2">
              如需行使上述權利，請透過 LINE 官方帳號或電子郵件聯繫我們，我們將於 30 日內回覆處理。
            </p>
          </section>

          {/* 8 */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">8. 未成年人保護</h2>
            <p className="text-sm text-gray-700 leading-relaxed">
              本服務不針對未滿 16 歲之未成年人提供。如果我們發現不慎收集了未成年人的資料，將立即刪除。
            </p>
          </section>

          {/* 9 */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">9. 隱私政策修訂</h2>
            <p className="text-sm text-gray-700 leading-relaxed">
              本政策可能隨服務調整而更新。重大變更時，我們會透過網站公告或 LINE 通知您。
              繼續使用本服務即視為同意修訂後的隱私政策。
            </p>
          </section>

          {/* 10 */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">10. 聯絡方式</h2>
            <p className="text-sm text-gray-700 leading-relaxed">
              如對本隱私政策有任何疑問，請透過以下方式聯繫：
            </p>
            <ul className="text-sm text-gray-700 space-y-1 list-disc pl-5 mt-2">
              <li>LINE 官方帳號：@howard456</li>
            </ul>
          </section>
        </div>

        <div className="mt-12 pt-6 border-t border-gray-200">
          <Link href="/" className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
            ← 返回首頁
          </Link>
        </div>
      </div>
    </div>
  )
}
