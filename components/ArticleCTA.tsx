'use client'

import Link from 'next/link'
import LineButton from './LineButton'
import ResourceDownloadButton from './ResourceDownloadButton'

interface ArticleCTAProps {
  articleTitle: string
  slug?: string
  relatedArticles?: {
    title: string
    slug: string
  }[]
  freeResource?: {
    title: string
    description: string
    fileUrl: string
  }
}

export default function ArticleCTA({ articleTitle, slug, relatedArticles, freeResource }: ArticleCTAProps) {
  return (
    <div className="mt-16 space-y-8">
      {/* 免費資源下載 */}
      {freeResource && (
        <div className="bg-gradient-to-br from-success/5 to-success/10 rounded-2xl p-10 border-2 border-success/20">
          <div className="flex items-start gap-6">
            <div className="text-5xl">📥</div>
            <div className="flex-1">
              <h3 className="text-2xl font-bold mb-3" style={{color: '#2D2D2D'}}>
                {freeResource.title}
              </h3>
              <p className="text-gray-600 mb-6">
                {freeResource.description}
              </p>
              <ResourceDownloadButton
                fileUrl={freeResource.fileUrl}
                source="blog_post"
                articleTitle={articleTitle}
                slug={slug}
                className="inline-block bg-success text-white px-8 py-4 rounded-xl font-bold shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all"
              />
              <p className="text-sm text-gray-500 mt-4">
                ✓ 完整 12 週計畫　✓ 訓練動作詳解　✓ 進度追蹤表
              </p>
            </div>
          </div>
        </div>
      )}
      
      {/* 主要 CTA */}
      <div className="bg-gradient-to-br from-primary/5 to-primary/10 rounded-2xl p-10 text-center border-2 border-primary/20">
        <h3 className="text-2xl font-bold mb-4" style={{color: '#2D2D2D'}}>
          想了解個人化的健康優化方案？
        </h3>
        <p className="text-gray-600 mb-6">
          透過 LINE 預約免費諮詢，分享更多實驗心得與數據追蹤經驗。
        </p>
        <LineButton 
          source="blog_post"
          className="inline-block bg-success text-white px-8 py-4 rounded-xl font-bold shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all"
        >
          預約免費諮詢
        </LineButton>
      </div>

      {/* 階梯式選項 */}
      <div className="bg-white rounded-2xl p-8 border-2 border-gray-200">
        <h4 className="text-lg font-semibold mb-6 text-center" style={{color: '#2D2D2D'}}>
          還沒準備好預約？
        </h4>
        
        <div className="grid md:grid-cols-3 gap-6">
          {/* 選項 1：閱讀更多 */}
          <div className="text-center p-6 rounded-xl bg-gray-50 hover:bg-gray-100 transition-all">
            <div className="text-3xl mb-3">📚</div>
            <h5 className="font-semibold mb-2" style={{color: '#2D2D2D'}}>閱讀更多文章</h5>
            <p className="text-sm text-gray-600 mb-4">深入了解訓練與營養知識</p>
            <Link 
              href="/blog"
              className="text-primary hover:underline text-sm font-medium"
            >
              前往部落格 →
            </Link>
          </div>

          {/* 選項 2：系統診斷 */}
          <div className="text-center p-6 rounded-xl bg-gray-50 hover:bg-gray-100 transition-all">
            <div className="text-3xl mb-3">🎯</div>
            <h5 className="font-semibold mb-2" style={{color: '#2D2D2D'}}>快速診斷</h5>
            <p className="text-sm text-gray-600 mb-4">30 秒評估你的身體狀態</p>
            <Link 
              href="/diagnosis"
              className="text-primary hover:underline text-sm font-medium"
            >
              開始診斷 →
            </Link>
          </div>

          {/* 選項 3：追蹤 IG */}
          <div className="text-center p-6 rounded-xl bg-gray-50 hover:bg-gray-100 transition-all">
            <div className="text-3xl mb-3">📱</div>
            <h5 className="font-semibold mb-2" style={{color: '#2D2D2D'}}>追蹤 IG</h5>
            <p className="text-sm text-gray-600 mb-4">獲得每日訓練與營養內容</p>
            <a 
              href="https://www.instagram.com/chenhoward/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline text-sm font-medium"
            >
              @chenhoward →
            </a>
          </div>
        </div>
      </div>

      {/* 相關文章推薦（如果有） */}
      {relatedArticles && relatedArticles.length > 0 && (
        <div className="bg-gray-50 rounded-2xl p-8">
          <h4 className="text-lg font-semibold mb-6" style={{color: '#2D2D2D'}}>
            你可能也會喜歡
          </h4>
          <div className="space-y-4">
            {relatedArticles.map((article) => (
              <Link 
                key={article.slug}
                href={`/blog/${article.slug}`}
                className="block p-4 bg-white rounded-xl border-2 border-gray-200 hover:border-primary transition-all"
              >
                <h5 className="font-semibold text-gray-900 hover:text-primary transition-colors">
                  {article.title}
                </h5>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
