'use client'

export default function CJBeautyPortal() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-md border-b border-gray-200/50 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-light text-gray-900 tracking-tight">承鈞 美麗儀表板</h1>
              <p className="text-gray-600 mt-1">個人化健康優化系統</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500">最後更新</p>
              <p className="text-sm font-medium text-gray-900">{new Date().toLocaleDateString('zh-TW')}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* 關鍵指標 */}
        <div className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-light text-gray-900">關鍵指標</h2>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-red-500 rounded-full"></div>
              <span className="text-sm text-gray-600">需改善</span>
              <div className="w-2 h-2 bg-yellow-500 rounded-full ml-4"></div>
              <span className="text-sm text-gray-600">接近目標</span>
              <div className="w-2 h-2 bg-green-500 rounded-full ml-4"></div>
              <span className="text-sm text-gray-600">達標</span>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* 膠原蛋白指數 */}
            <div className="group relative">
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-green-50 to-green-100"></div>
              <div className="relative bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-gray-200/50 shadow-lg hover:shadow-xl transition-all duration-300">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900">膠原蛋白指數</h3>
                  <span className="text-3xl">🟢</span>
                </div>
                <div className="mb-4">
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-light text-gray-900">65</span>
                    <span className="text-sm text-gray-500">/ 80 指數</span>
                  </div>
                  <div className="mt-3 w-full bg-gray-200 rounded-full h-2">
                    <div className="h-2 rounded-full bg-green-500" style={{ width: '81%' }} />
                  </div>
                </div>
                <p className="text-sm text-gray-600">皮膚彈性與緊緻度指標，影響皮膚年輕感</p>
              </div>
            </div>

            {/* 抗氧化能力 */}
            <div className="group relative">
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-yellow-50 to-yellow-100"></div>
              <div className="relative bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-gray-200/50 shadow-lg hover:shadow-xl transition-all duration-300">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900">抗氧化能力</h3>
                  <span className="text-3xl">🟡</span>
                </div>
                <div className="mb-4">
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-light text-gray-900">45</span>
                    <span className="text-sm text-gray-500">/ 70 指數</span>
                  </div>
                  <div className="mt-3 w-full bg-gray-200 rounded-full h-2">
                    <div className="h-2 rounded-full bg-yellow-500" style={{ width: '64%' }} />
                  </div>
                </div>
                <p className="text-sm text-gray-600">身體抗氧化能力，影響皮膚老化速度</p>
              </div>
            </div>

            {/* 皮膚含水量 */}
            <div className="group relative">
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-yellow-50 to-yellow-100"></div>
              <div className="relative bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-gray-200/50 shadow-lg hover:shadow-xl transition-all duration-300">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900">皮膚含水量</h3>
                  <span className="text-3xl">🟡</span>
                </div>
                <div className="mb-4">
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-light text-gray-900">55</span>
                    <span className="text-sm text-gray-500">/ 65 %</span>
                  </div>
                  <div className="mt-3 w-full bg-gray-200 rounded-full h-2">
                    <div className="h-2 rounded-full bg-yellow-500" style={{ width: '85%' }} />
                  </div>
                </div>
                <p className="text-sm text-gray-600">皮膚水分含量，影響皮膚光澤與彈性</p>
              </div>
            </div>

            {/* 荷爾蒙平衡 */}
            <div className="group relative">
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-yellow-50 to-yellow-100"></div>
              <div className="relative bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-gray-200/50 shadow-lg hover:shadow-xl transition-all duration-300">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900">荷爾蒙平衡</h3>
                  <span className="text-3xl">🟡</span>
                </div>
                <div className="mb-4">
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-light text-gray-900">70</span>
                    <span className="text-sm text-gray-500">/ 85 指數</span>
                  </div>
                  <div className="mt-3 w-full bg-gray-200 rounded-full h-2">
                    <div className="h-2 rounded-full bg-yellow-500" style={{ width: '82%' }} />
                  </div>
                </div>
                <p className="text-sm text-gray-600">內分泌系統平衡，影響整體狀態</p>
              </div>
            </div>

            {/* 代謝年齡 */}
            <div className="group relative">
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-red-50 to-red-100"></div>
              <div className="relative bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-gray-200/50 shadow-lg hover:shadow-xl transition-all duration-300">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900">代謝年齡</h3>
                  <span className="text-3xl">🔴</span>
                </div>
                <div className="mb-4">
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-light text-gray-900">32</span>
                    <span className="text-sm text-gray-500">/ 28 歲</span>
                  </div>
                  <div className="mt-3 w-full bg-gray-200 rounded-full h-2">
                    <div className="h-2 rounded-full bg-red-500" style={{ width: '87%' }} />
                  </div>
                </div>
                <p className="text-sm text-gray-600">身體代謝年齡，反映身體健康狀態</p>
              </div>
            </div>

            {/* 鐵蛋白 */}
            <div className="group relative">
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-yellow-50 to-yellow-100"></div>
              <div className="relative bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-gray-200/50 shadow-lg hover:shadow-xl transition-all duration-300">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900">鐵蛋白</h3>
                  <span className="text-3xl">🟡</span>
                </div>
                <div className="mb-4">
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-light text-gray-900">45</span>
                    <span className="text-sm text-gray-500">/ 50 ng/mL</span>
                  </div>
                  <div className="mt-3 w-full bg-gray-200 rounded-full h-2">
                    <div className="h-2 rounded-full bg-yellow-500" style={{ width: '90%' }} />
                  </div>
                </div>
                <p className="text-sm text-gray-600">鐵質儲存指標，影響能量代謝與免疫</p>
              </div>
            </div>
          </div>
        </div>
        
        {/* 今日任務 */}
        <div className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-light text-gray-900">今日任務</h2>
            <div className="text-sm text-gray-600">
              已完成 0 / 8
            </div>
          </div>
          
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-gray-200/50 shadow-lg">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {/* 葉酸 */}
              <button className="relative group transition-all duration-300 bg-white border-gray-200 hover:border-blue-300 hover:shadow-md rounded-xl p-4 text-left">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-blue-500">
                    <span className="text-white text-lg">💊</span>
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium text-sm text-gray-900">葉酸</h4>
                    <p className="text-xs text-gray-500 mt-1">800mcg</p>
                    <p className="text-xs text-gray-400">早餐後</p>
                  </div>
                </div>
              </button>

              {/* 維生素 B12 */}
              <button className="relative group transition-all duration-300 bg-white border-gray-200 hover:border-blue-300 hover:shadow-md rounded-xl p-4 text-left">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-blue-500">
                    <span className="text-white text-lg">💊</span>
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium text-sm text-gray-900">維生素 B12</h4>
                    <p className="text-xs text-gray-500 mt-1">1000mcg</p>
                    <p className="text-xs text-gray-400">早餐後</p>
                  </div>
                </div>
              </button>

              {/* 維生素 C */}
              <button className="relative group transition-all duration-300 bg-white border-gray-200 hover:border-blue-300 hover:shadow-md rounded-xl p-4 text-left">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-blue-500">
                    <span className="text-white text-lg">💊</span>
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium text-sm text-gray-900">維生素 C</h4>
                    <p className="text-xs text-gray-500 mt-1">1000mg</p>
                    <p className="text-xs text-gray-400">早餐後</p>
                  </div>
                </div>
              </button>

              {/* 維生素 D */}
              <button className="relative group transition-all duration-300 bg-white border-gray-200 hover:border-blue-300 hover:shadow-md rounded-xl p-4 text-left">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-blue-500">
                    <span className="text-white text-lg">💊</span>
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium text-sm text-gray-900">維生素 D</h4>
                    <p className="text-xs text-gray-500 mt-1">2000IU</p>
                    <p className="text-xs text-gray-400">早餐後</p>
                  </div>
                </div>
              </button>

              {/* 鎂 */}
              <button className="relative group transition-all duration-300 bg-white border-gray-200 hover:border-blue-300 hover:shadow-md rounded-xl p-4 text-left">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-blue-500">
                    <span className="text-white text-lg">💊</span>
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium text-sm text-gray-900">鎂</h4>
                    <p className="text-xs text-gray-500 mt-1">400mg</p>
                    <p className="text-xs text-gray-400">晚餐後</p>
                  </div>
                </div>
              </button>

              {/* 鋅 */}
              <button className="relative group transition-all duration-300 bg-white border-gray-200 hover:border-blue-300 hover:shadow-md rounded-xl p-4 text-left">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-blue-500">
                    <span className="text-white text-lg">💊</span>
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium text-sm text-gray-900">鋅</h4>
                    <p className="text-xs text-gray-500 mt-1">30mg</p>
                    <p className="text-xs text-gray-400">晚餐後</p>
                  </div>
                </div>
              </button>

              {/* Omega-3 */}
              <button className="relative group transition-all duration-300 bg-white border-gray-200 hover:border-blue-300 hover:shadow-md rounded-xl p-4 text-left">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-blue-500">
                    <span className="text-white text-lg">🐟</span>
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium text-sm text-gray-900">Omega-3</h4>
                    <p className="text-xs text-gray-500 mt-1">2000mg</p>
                    <p className="text-xs text-gray-400">晚餐後</p>
                  </div>
                </div>
              </button>

              {/* 膠原蛋白 */}
              <button className="relative group transition-all duration-300 bg-white border-gray-200 hover:border-blue-300 hover:shadow-md rounded-xl p-4 text-left">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-blue-500">
                    <span className="text-white text-lg">💎</span>
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium text-sm text-gray-900">膠原蛋白</h4>
                    <p className="text-xs text-gray-500 mt-1">10g</p>
                    <p className="text-xs text-gray-400">睡前</p>
                  </div>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
