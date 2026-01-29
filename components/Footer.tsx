export default function Footer() {
  return (
    <footer style={{backgroundColor: '#F9F9F7'}} className="border-t border-gray-200 mt-20">
      <div className="max-w-5xl mx-auto px-6 py-12">
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
            <p className="text-text-secondary text-sm leading-relaxed mb-3">
              📍 Coolday Fitness 北屯館<br />
              🏋️ 教練主管 Howard Chen<br />
              📋 一對一訓練指導 • 客製化計畫
            </p>
            <a 
              href="https://www.instagram.com/coolday.fitness.bt/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-text-secondary hover:text-primary transition-colors text-sm"
            >
              📷 @coolday.fitness.bt →
            </a>
          </div>
        </div>

        {/* 版權 */}
        <div className="border-t border-border pt-6 text-center text-text-muted text-sm">
          <p>© {new Date().getFullYear()} The Howard Protocol. All rights reserved.</p>
          <p className="mt-2">本網站內容受著作權法保護，未經授權不得轉載或商業使用。</p>
          <p className="mt-4 text-xs text-gray-400">
            本網站內容僅供教育與資訊分享，不構成醫療建議。如有健康疑慮請諮詢專業醫療人員。
          </p>
        </div>
      </div>
    </footer>
  )
}
