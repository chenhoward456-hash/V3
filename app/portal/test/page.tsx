export default function TestPage() {
  return (
    <div className="min-h-screen bg-[#F9F9FB] p-8">
      <h1 className="text-2xl font-bold mb-4">承鈞美麗儀表板 - 測試頁面</h1>
      <p className="text-gray-600 mb-4">如果你能看到這個頁面，表示路由正常工作</p>
      
      <div className="bg-white rounded-xl p-6 border border-gray-200">
        <h2 className="text-xl font-bold mb-4">測試內容</h2>
        <ul className="space-y-2">
          <li>✅ 路由正常</li>
          <li>✅ 樣式正常</li>
          <li>✅ 字體正常</li>
          <li>✅ 背景色正常</li>
        </ul>
      </div>
      
      <div className="mt-8">
        <a href="/portal/cj-beauty" className="bg-blue-500 text-white px-6 py-3 rounded-xl">
          回到完整儀表板
        </a>
      </div>
    </div>
  )
}
