import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '退費政策 - Howard Protocol',
  description: '了解 Howard Protocol 的退費規則，涵蓋訂閱服務及數位商品之退費說明。',
  alternates: { canonical: 'https://howard456.vercel.app/refund-policy' },
  openGraph: {
    title: '退費政策 - Howard Protocol',
    description: '了解 Howard Protocol 的退費規則，保障您的消費權益。',
    url: 'https://howard456.vercel.app/refund-policy',
  },
}

export default function RefundPolicyPage() {
  return (
    <section className="section-container">
      <h2 className="doc-title">退費政策</h2>
      <p className="doc-subtitle">
        我們重視每位客戶的權益，以下退費政策依據中華民國消費者保護法制定。
      </p>

      <div className="space-y-8">

        {/* 台灣消保法說明 */}
        <div
          className="bg-blue-50 border border-blue-200 rounded-3xl p-8"
          style={{ boxShadow: '0 2px 12px rgba(0, 0, 0, 0.04)' }}
        >
          <h3 className="text-xl font-bold mb-4 text-blue-800">
            台灣消費者保護法說明
          </h3>
          <p className="text-blue-700 leading-relaxed">
            根據中華民國《消費者保護法》第 19 條規定，通訊交易或訪問交易之消費者，得於收受商品或接受服務後七日內，以退回商品或書面通知方式解除契約，無須說明理由及負擔任何費用或對價。本退費政策依據上述法規精神制定，確保您的消費權益受到完整保障。
          </p>
        </div>

        {/* 訂閱方案 */}
        <div
          className="bg-white/60 backdrop-blur-sm rounded-3xl p-8"
          style={{ boxShadow: '0 2px 12px rgba(0, 0, 0, 0.04)' }}
        >
          <h3 className="text-2xl font-bold mb-6 text-primary">
            一、訂閱服務退費
          </h3>

          <div className="mb-6">
            <h4 className="text-lg font-semibold mb-3 text-text-primary">適用方案</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b-2 border-gray-200">
                    <th className="py-3 pr-4 text-text-primary font-semibold">方案</th>
                    <th className="py-3 pr-4 text-text-primary font-semibold">費用</th>
                    <th className="py-3 text-text-primary font-semibold">說明</th>
                  </tr>
                </thead>
                <tbody className="text-text-secondary">
                  <tr className="border-b border-gray-100">
                    <td className="py-3 pr-4 font-medium text-text-primary">免費體驗</td>
                    <td className="py-3 pr-4">免費</td>
                    <td className="py-3 text-sm">基礎功能，不需綁卡</td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="py-3 pr-4 font-medium text-text-primary">自主管理版</td>
                    <td className="py-3 pr-4">NT$499 / 月</td>
                    <td className="py-3 text-sm">智能引擎全功能</td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="py-3 pr-4 font-medium text-text-primary">教練指導版</td>
                    <td className="py-3 pr-4">NT$2,999 / 月</td>
                    <td className="py-3 text-sm">自主管理 + CSCS 教練監督</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <h4 className="text-lg font-semibold mb-2 text-text-primary">退費規則</h4>
              <ul className="list-disc list-inside space-y-2 text-text-secondary leading-relaxed">
                <li>
                  所有付費方案皆為<span className="font-medium text-text-primary">月繳制</span>，當月已繳費用不予退還。
                </li>
                <li>
                  您可<span className="font-medium text-text-primary">隨時取消訂閱</span>，取消後下個月起不再扣款，當月服務使用至計費週期結束。
                </li>
                <li>
                  自主管理版可隨時升級教練指導版，補差額即可。
                </li>
                <li>
                  免費體驗方案無費用產生，無退費問題。
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-6">
            <h4 className="text-lg font-semibold mb-3 text-text-primary">七日鑑賞期</h4>
            <ul className="list-disc list-inside space-y-2 text-text-secondary leading-relaxed">
              <li>
                依據《消費者保護法》第 19 條，您於<span className="font-medium text-text-primary">首次付款後七日內</span>得以書面或 LINE 通知方式解除契約，無須說明理由。
              </li>
              <li>
                七日鑑賞期內申請退費，我們將<span className="font-medium text-text-primary">全額退還</span>已收取之費用。
              </li>
              <li>
                超過七日後，當月已繳費用不予退還，但您可隨時取消下期續約。
              </li>
            </ul>
          </div>

        </div>

        {/* 電子書與數位商品 */}
        <div
          className="bg-white/60 backdrop-blur-sm rounded-3xl p-8"
          style={{ boxShadow: '0 2px 12px rgba(0, 0, 0, 0.04)' }}
        >
          <h3 className="text-2xl font-bold mb-6 text-primary">
            二、電子書與數位商品
          </h3>
          <p className="text-text-secondary leading-relaxed mb-4">
            適用商品：System Reboot 電子書（NT$299）及其他數位內容商品。
          </p>
          <ul className="list-disc list-inside space-y-3 text-text-secondary leading-relaxed">
            <li>
              <span className="font-medium text-text-primary">已下載之數位商品：</span>
              依據消費者保護法第 19 條第 1 項但書規定，經消費者事先同意始提供之數位內容，一經下載即不適用七天鑑賞期，恕不退費。
            </li>
            <li>
              <span className="font-medium text-text-primary">未下載之數位商品：</span>
              購買後 7 天內且尚未下載，可申請全額退費。
            </li>
            <li>
              <span className="font-medium text-text-primary">技術問題：</span>
              若因技術問題導致無法下載或開啟檔案，請聯繫客服，我們將協助您重新下載或提供替代方案。
            </li>
          </ul>
        </div>

        {/* 退款程序 */}
        <div
          className="bg-white/60 backdrop-blur-sm rounded-3xl p-8"
          style={{ boxShadow: '0 2px 12px rgba(0, 0, 0, 0.04)' }}
        >
          <h3 className="text-2xl font-bold mb-6 text-primary">
            三、退款程序
          </h3>
          <div className="space-y-4">
            <div className="flex items-start gap-4">
              <span className="flex-shrink-0 w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center font-bold text-sm">1</span>
              <div>
                <h4 className="font-semibold text-text-primary">提交退費申請</h4>
                <p className="text-text-secondary leading-relaxed">
                  透過 LINE 官方帳號傳送退費申請，請提供訂單編號、購買日期及退費原因。
                </p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <span className="flex-shrink-0 w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center font-bold text-sm">2</span>
              <div>
                <h4 className="font-semibold text-text-primary">審核確認</h4>
                <p className="text-text-secondary leading-relaxed">
                  我們將透過 LINE 通知您審核結果。
                </p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <span className="flex-shrink-0 w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center font-bold text-sm">3</span>
              <div>
                <h4 className="font-semibold text-text-primary">退款到帳</h4>
                <p className="text-text-secondary leading-relaxed">
                  審核通過後，退款將退還至您的原付款帳戶。實際到帳時間可能因金融機構處理流程而略有差異。
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 聯繫方式 */}
        <div
          className="bg-white/60 backdrop-blur-sm rounded-3xl p-8"
          style={{ boxShadow: '0 2px 12px rgba(0, 0, 0, 0.04)' }}
        >
          <h3 className="text-2xl font-bold mb-6 text-primary">
            四、聯繫方式
          </h3>
          <p className="text-text-secondary leading-relaxed mb-4">
            如有任何退費相關問題，歡迎透過以下方式聯繫：
          </p>
          <p>
            <span className="font-medium text-text-primary">LINE 官方帳號：</span>
            <a
              href="https://lin.ee/dnbucVw"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              點此加入
            </a>
          </p>
        </div>

        {/* 法律聲明 */}
        <div
          className="bg-white/60 backdrop-blur-sm rounded-3xl p-8"
          style={{ boxShadow: '0 2px 12px rgba(0, 0, 0, 0.04)' }}
        >
          <h3 className="text-2xl font-bold mb-6 text-primary">
            五、法律聲明
          </h3>
          <ul className="list-disc list-inside space-y-3 text-text-secondary leading-relaxed">
            <li>
              本退費政策如與中華民國《消費者保護法》及相關法規有所牴觸，以法規之規定為準。
            </li>
            <li>
              Howard Protocol 保留修改本退費政策之權利，修改後將於本頁面公告。
            </li>
            <li>
              本政策之解釋與適用，以中華民國法律為準據法，如有爭議，雙方同意以台灣台中地方法院為第一審管轄法院。
            </li>
          </ul>
        </div>

        <div className="text-center text-sm text-text-secondary pt-4">
          <p>最後更新日期：2026 年 3 月 10 日</p>
        </div>

      </div>
    </section>
  )
}
