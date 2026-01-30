import Link from 'next/link'

export default function NotFound() {
  return (
    <div style={{backgroundColor: '#F9F9F7'}} className="min-h-screen flex items-center justify-center px-6">
      <div className="text-center max-w-2xl">
        <h1 className="text-6xl font-bold mb-6" style={{color: '#2D2D2D'}}>404</h1>
        <h2 className="text-3xl font-semibold mb-4" style={{color: '#2D2D2D'}}>找不到這個頁面</h2>
        <p className="text-gray-600 mb-8 text-lg leading-relaxed">
          抱歉，你要找的頁面不存在或已被移除。
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
          <Link 
            href="/"
            className="inline-block text-white px-8 py-3 rounded-full font-medium transition-all hover:opacity-90"
            style={{backgroundColor: '#2D2D2D'}}
          >
            回到首頁
          </Link>
          <Link 
            href="/blog"
            className="inline-block px-8 py-3 rounded-full font-medium border-2 transition-all hover:bg-gray-50"
            style={{borderColor: '#2D2D2D', color: '#2D2D2D'}}
          >
            瀏覽文章
          </Link>
        </div>

        {/* 推薦連結 */}
        <div className="mt-16 text-left">
          <h3 className="text-xl font-semibold mb-6" style={{color: '#2D2D2D'}}>你可能在找：</h3>
          <div className="grid md:grid-cols-2 gap-4">
            <Link 
              href="/diagnosis"
              className="block bg-white rounded-xl p-6 border-2 border-gray-200 hover:border-primary transition-all"
            >
              <h4 className="font-semibold mb-2" style={{color: '#2D2D2D'}}>系統診斷</h4>
              <p className="text-gray-600 text-sm">30 秒快速評估你的健康狀態</p>
            </Link>
            <Link 
              href="/training"
              className="block bg-white rounded-xl p-6 border-2 border-gray-200 hover:border-primary transition-all"
            >
              <h4 className="font-semibold mb-2" style={{color: '#2D2D2D'}}>訓練系統</h4>
              <p className="text-gray-600 text-sm">了解 Howard 的訓練方法</p>
            </Link>
            <Link 
              href="/nutrition"
              className="block bg-white rounded-xl p-6 border-2 border-gray-200 hover:border-primary transition-all"
            >
              <h4 className="font-semibold mb-2" style={{color: '#2D2D2D'}}>營養協議</h4>
              <p className="text-gray-600 text-sm">血檢數據優化旅程</p>
            </Link>
            <Link 
              href="/action"
              className="block bg-white rounded-xl p-6 border-2 border-gray-200 hover:border-primary transition-all"
            >
              <h4 className="font-semibold mb-2" style={{color: '#2D2D2D'}}>開始行動</h4>
              <p className="text-gray-600 text-sm">預約免費諮詢</p>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
