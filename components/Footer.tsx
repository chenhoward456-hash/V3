import Link from 'next/link'

export default function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-300">
      <div className="max-w-6xl mx-auto px-6 py-14">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10">
          {/* 欄位一 */}
          <div className="col-span-2 md:col-span-1">
            <h4 className="text-white font-bold text-lg mb-4">Howard Protocol</h4>
            <p className="text-sm leading-relaxed text-gray-400">
              CSCS 認證體能教練<br />
              高雄醫學大學運動醫學系<br />
              專長：代謝優化、生物駭客
            </p>
          </div>

          {/* 欄位二 */}
          <div>
            <h4 className="text-white font-semibold mb-4">服務內容</h4>
            <ul className="space-y-2.5 text-sm">
              <li><Link href="/remote" className="hover:text-white transition-colors">遠端追蹤方案</Link></li>
              <li><Link href="/action" className="hover:text-white transition-colors">實體訓練方案</Link></li>
              <li><Link href="/diagnosis" className="hover:text-white transition-colors">系統診斷</Link></li>
              <li><Link href="/case" className="hover:text-white transition-colors">個案追蹤</Link></li>
            </ul>
          </div>

          {/* 欄位三 */}
          <div>
            <h4 className="text-white font-semibold mb-4">學習資源</h4>
            <ul className="space-y-2.5 text-sm">
              <li><Link href="/blog" className="hover:text-white transition-colors">知識分享</Link></li>
              <li><Link href="/training" className="hover:text-white transition-colors">訓練工程</Link></li>
              <li><Link href="/nutrition" className="hover:text-white transition-colors">營養與恢復</Link></li>
              <li><Link href="/faq" className="hover:text-white transition-colors">常見問題</Link></li>
            </ul>
          </div>

          {/* 欄位四 */}
          <div>
            <h4 className="text-white font-semibold mb-4">聯絡方式</h4>
            <ul className="space-y-2.5 text-sm">
              <li>
                <a href="https://instagram.com/chenhoward" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
                  📷 @chenhoward
                </a>
              </li>
              <li>
                <Link href="/line" className="hover:text-white transition-colors">
                  💬 LINE 官方帳號
                </Link>
              </li>
              <li className="text-gray-400">📍 Coolday Fitness 北屯館</li>
            </ul>
          </div>
        </div>

        {/* 版權 */}
        <div className="border-t border-gray-700 mt-10 pt-6 text-center text-xs text-gray-500">
          <p>&copy; 2026 The Howard Protocol. All rights reserved.</p>
        </div>
      </div>
    </footer>
  )
}
