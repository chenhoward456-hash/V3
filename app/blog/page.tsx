'use client'

import Link from 'next/link'
import { useState } from 'react'

// 文章資料結構
interface BlogPost {
  id: string
  title: string
  description: string
  date: string
  category: '血檢優化' | '營養策略' | '訓練方法' | '恢復優化' | '個案追蹤'
  readTime: string
  slug: string
}

// 文章列表（之後可以從檔案系統讀取）
const blogPosts: BlogPost[] = [
  {
    id: '4',
    title: '女生必看！月經週期是你的減脂作弊碼：順著週期練才會瘦',
    description: '女性荷爾蒙波動極大，不懂得順著週期練，只是在跟自己的內分泌打架。分享如何利用濾泡期和黃體期優化訓練效果。',
    date: '2026-01-30',
    category: '訓練方法',
    readTime: '6 分鐘',
    slug: 'female-menstrual-cycle-training'
  },
  {
    id: '3',
    title: '為什麼你睡 8 小時還是累？HRV 告訴你睡眠品質的真相',
    description: '睡眠時間不等於睡眠品質。透過追蹤 HRV（心率變異度），我將睡眠品質從紅燈變綠燈，分享 3 個實測有效的習慣。',
    date: '2026-01-30',
    category: '恢復優化',
    readTime: '7 分鐘',
    slug: 'sleep-quality-hrv-optimization'
  },
  {
    id: '2',
    title: '沒用藥，我如何三個月內自然提升 20% 睪固酮？(515→625)',
    description: '透過科學化調整生活型態，三個月內將睪固酮從 515 提升到 625 ng/dL。分享我的實測數據與三個關鍵習慣。',
    date: '2026-01-30',
    category: '血檢優化',
    readTime: '6 分鐘',
    slug: 'testosterone-optimization-3-months'
  },
  // 更多文章會在這裡新增
]

const categories = ['全部', '血檢優化', '營養策略', '訓練方法', '恢復優化', '個案追蹤'] as const

export default function BlogPage() {
  const [selectedCategory, setSelectedCategory] = useState<string>('全部')

  const filteredPosts = selectedCategory === '全部' 
    ? blogPosts 
    : blogPosts.filter(post => post.category === selectedCategory)

  return (
    <div style={{backgroundColor: '#F9F9F7'}} className="min-h-screen">
      <div className="max-w-5xl mx-auto px-6 py-16">
        {/* 標題區 */}
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold mb-4" style={{color: '#2D2D2D'}}>
            知識分享
          </h1>
          <p className="text-gray-600 text-lg max-w-2xl mx-auto">
            個人實驗紀錄、研究心得與學習筆記。<br />
            所有內容均為個人經驗分享，不構成醫療建議。
          </p>
        </div>

        {/* 分類篩選 */}
        <div className="flex flex-wrap justify-center gap-3 mb-12">
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-6 py-2 rounded-full font-medium transition-all ${
                selectedCategory === category
                  ? 'bg-primary text-white shadow-lg'
                  : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
              }`}
            >
              {category}
            </button>
          ))}
        </div>

        {/* 文章列表 */}
        <div className="grid md:grid-cols-2 gap-8">
          {filteredPosts.length > 0 ? (
            filteredPosts.map((post) => (
              <Link
                key={post.id}
                href={`/blog/${post.slug}`}
                className="bg-white rounded-2xl p-8 border border-gray-200 hover:shadow-xl transition-all hover:-translate-y-1"
              >
                <div className="flex items-center gap-3 mb-4">
                  <span className="px-3 py-1 bg-primary/10 text-primary text-sm font-medium rounded-full">
                    {post.category}
                  </span>
                  <span className="text-gray-400 text-sm">{post.readTime}</span>
                </div>
                
                <h2 className="text-2xl font-bold mb-3" style={{color: '#2D2D2D'}}>
                  {post.title}
                </h2>
                
                <p className="text-gray-600 mb-4 leading-relaxed">
                  {post.description}
                </p>
                
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 text-sm">{post.date}</span>
                  <span className="text-primary font-medium">閱讀更多 →</span>
                </div>
              </Link>
            ))
          ) : (
            <div className="col-span-2 text-center py-16">
              <p className="text-gray-400 text-lg">此分類暫無文章</p>
            </div>
          )}
        </div>

        {/* 訂閱提示 */}
        <div className="mt-16 bg-gradient-to-br from-primary/5 to-primary/10 rounded-2xl p-10 text-center border-2 border-primary/20">
          <h3 className="text-2xl font-bold mb-4" style={{color: '#2D2D2D'}}>
            想獲得更深度的內容？
          </h3>
          <p className="text-gray-600 mb-6 max-w-2xl mx-auto">
            透過 LINE 預約免費諮詢，了解個人化的健康優化方案。
          </p>
          <a
            href="https://lin.ee/dnbucVw"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block bg-success text-white px-8 py-4 rounded-xl font-bold shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all"
          >
            預約免費諮詢
          </a>
        </div>
      </div>
    </div>
  )
}
