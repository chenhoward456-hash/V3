'use client'

import { useState } from 'react'
import Link from 'next/link'

interface BlogPost {
  id: string
  title: string
  description: string
  date: string
  category: string
  readTime: string
  slug: string
}

const categories = ['全部', '血檢優化', '營養策略', '訓練方法', '恢復優化', '個案追蹤'] as const

export default function BlogFilter({ posts }: { posts: BlogPost[] }) {
  const [selectedCategory, setSelectedCategory] = useState<string>('全部')

  const filteredPosts = selectedCategory === '全部'
    ? posts
    : posts.filter(post => post.category === selectedCategory)

  return (
    <>
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
              <h2 className="text-2xl font-bold mb-3" style={{ color: '#2D2D2D' }}>
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
    </>
  )
}
