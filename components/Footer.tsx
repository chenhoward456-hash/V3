export default function Footer() {
  return (
    <footer className="bg-white border-t border-border mt-20">
      <div className="max-w-5xl mx-auto px-6 py-12">
        {/* 免責聲明 */}
        <div className="bg-warning/5 border-2 border-warning/30 rounded-xl p-6 mb-8">
          <h3 className="text-warning font-bold text-lg mb-3">⚠️ 免責聲明</h3>
          <div className="text-text-secondary text-sm leading-relaxed space-y-2">
            <p>
              本網站內容僅供<strong>教育與資訊分享</strong>之用，不構成任何醫療建議、診斷或治療方案。
            </p>
            <p>
              所有訓練、營養與補劑建議均基於個人經驗與研究，<strong>不應取代專業醫療人員的意見</strong>。
            </p>
            <p>
              在開始任何訓練計畫、飲食調整或補劑使用前，請務必諮詢合格的醫師、營養師或運動專業人員。
            </p>
            <p>
              個案追蹤結果為個人經驗，<strong>不保證適用於所有人</strong>。每個人的身體狀況、基因、生活型態皆不相同，效果因人而異。
            </p>
            <p className="text-danger font-semibold">
              若您有任何健康疑慮或慢性疾病，請在執行任何建議前先徵詢您的醫療團隊。
            </p>
          </div>
        </div>

        {/* 聯絡資訊 */}
        <div className="grid md:grid-cols-3 gap-8 mb-8">
          <div>
            <h4 className="font-bold text-text-primary mb-3">關於 Howard</h4>
            <p className="text-text-secondary text-sm leading-relaxed">
              CSCS 認證體能教練<br />
              高雄醫學大學運動醫學系<br />
              專長：代謝優化、生物駭客
            </p>
          </div>
          
          <div>
            <h4 className="font-bold text-text-primary mb-3">聯絡方式</h4>
            <div className="space-y-2 text-sm">
              <a 
                href="https://www.instagram.com/chenhoward/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="block text-text-secondary hover:text-primary transition-colors"
              >
                📷 Instagram: @chenhoward
              </a>
              <a 
                href="https://lin.ee/dnbucVw" 
                target="_blank" 
                rel="noopener noreferrer"
                className="block text-text-secondary hover:text-success transition-colors"
              >
                💬 LINE 官方帳號
              </a>
            </div>
          </div>
          
          <div>
            <h4 className="font-bold text-text-primary mb-3">服務地點</h4>
            <p className="text-text-secondary text-sm leading-relaxed">
              📍 台中市北屯區<br />
              🏋️ 一對一訓練指導<br />
              � 客製化訓練計畫
            </p>
          </div>
        </div>

        {/* 版權 */}
        <div className="border-t border-border pt-6 text-center text-text-muted text-sm">
          <p>© {new Date().getFullYear()} The Howard Protocol. All rights reserved.</p>
          <p className="mt-2">本網站內容受著作權法保護，未經授權不得轉載或商業使用。</p>
        </div>
      </div>
    </footer>
  )
}
