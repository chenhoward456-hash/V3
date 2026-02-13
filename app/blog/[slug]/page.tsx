import { notFound } from 'next/navigation'
import Link from 'next/link'
import { generateArticleSchema } from './schema'
import Breadcrumb from '@/components/Breadcrumb'
import ArticleTracker from './ArticleTracker'
import ArticleCTA from '@/components/ArticleCTA'
import StickyCTA from '@/components/StickyCTA'
import { blogContent } from '@/data/blog-content'

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const post = blogContent[params.slug]

  if (!post) {
    return {
      title: '文章不存在 - Howard',
    }
  }

  return {
    title: `${post.title} - Howard`,
    description: post.content.substring(0, 160).replace(/[#*\n]/g, ' ').trim() + '...',
    keywords: [
      post.category,
      'Howard',
      '台中健身教練',
      'CSCS',
      '運動科學',
      '訓練方法',
      '營養優化',
      '血檢優化',
    ],
    authors: [{ name: 'Howard' }],
    openGraph: {
      title: post.title,
      description: post.content.substring(0, 160).replace(/[#*\n]/g, ' ').trim(),
      type: 'article',
      publishedTime: post.date,
      authors: ['Howard'],
      tags: [post.category],
      locale: 'zh_TW',
      url: `https://howard456.vercel.app/blog/${params.slug}`,
      images: [
        {
          url: 'https://howard456.vercel.app/howard-profile.jpg',
          width: 1200,
          height: 630,
          alt: post.title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.content.substring(0, 160).replace(/[#*\n]/g, ' ').trim(),
      images: ['https://howard456.vercel.app/howard-profile.jpg'],
    },
  }
}

export async function generateStaticParams() {
  return Object.keys(blogContent).map((slug) => ({
    slug: slug,
  }))
}

export default function BlogPostPage({ params }: { params: { slug: string } }) {
  const post = blogContent[params.slug]

  if (!post) {
    notFound()
  }

  const intent = params.slug === 'three-layers-fat-loss-strategy'
    ? 'fat_loss'
    : params.slug === 'sleep-quality-hrv-optimization'
    ? 'recovery'
    : params.slug === 'muscle-building-science-2025'
    ? 'muscle_gain'
    : 'performance'

  const resource = params.slug === 'three-layers-fat-loss-strategy'
    ? {
        title: '三層脂肪攻克計畫表（PDF）',
        fileUrl: '/resources/three-layers-fat-loss-plan.pdf',
      }
    : undefined

  const articleSchema = generateArticleSchema({
    title: post.title,
    date: post.date,
    category: post.category,
    content: post.content,
    slug: params.slug,
  })

  return (
    <div style={{backgroundColor: '#F9F9F7'}} className="min-h-screen">
      <StickyCTA
        articleTitle={post.title}
        slug={params.slug}
        intent={intent}
        resource={resource}
      />

      {/* GA 追蹤 */}
      <ArticleTracker
        title={post.title}
        category={post.category}
        readTime={post.readTime}
        slug={params.slug}
      />

      {/* 結構化資料 */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
      />

      <article className="max-w-3xl mx-auto px-6 py-16">
        {/* 麵包屑導航 */}
        <Breadcrumb
          items={[
            { label: '部落格', href: '/blog' },
            { label: post.title }
          ]}
        />

        {/* 返回按鈕 */}
        <Link
          href="/blog"
          className="inline-flex items-center text-gray-600 hover:text-primary mb-8 transition-colors"
        >
          ← 返回文章列表
        </Link>

        {/* 文章標題 */}
        <header className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <span className="px-3 py-1 bg-primary/10 text-primary text-sm font-medium rounded-full">
              {post.category}
            </span>
            <span className="text-gray-400 text-sm">{post.readTime}</span>
          </div>

          <h1 className="text-2xl md:text-4xl font-bold mb-4" style={{color: '#2D2D2D'}}>
            {post.title}
          </h1>

          <div className="text-gray-500 text-sm">
            發布於 {post.date}
          </div>
        </header>

        {/* 文章內容 */}
        <div
          className="prose prose-lg max-w-none"
          style={{
            color: '#2D2D2D',
            lineHeight: '1.8'
          }}
          dangerouslySetInnerHTML={{
            __html: post.content
              .split('\n')
              .map(line => {
                // 標題
                if (line.startsWith('## ')) {
                  return `<h2 style="font-size: 1.8rem; font-weight: bold; margin-top: 2rem; margin-bottom: 1rem; color: #2D2D2D;">${line.replace('## ', '')}</h2>`
                }
                if (line.startsWith('### ')) {
                  return `<h3 style="font-size: 1.4rem; font-weight: bold; margin-top: 1.5rem; margin-bottom: 0.75rem; color: #2D2D2D;">${line.replace('### ', '')}</h3>`
                }
                // 粗體
                if (line.includes('**')) {
                  line = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                }
                // 連結
                if (line.includes('[') && line.includes('](')) {
                  line = line.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" class="text-primary hover:underline" target="_blank" rel="noopener noreferrer">$1</a>')
                }
                // 分隔線
                if (line === '---') {
                  return '<hr style="margin: 2rem 0; border-color: #E5E5E5;" />'
                }
                // 列表
                if (line.startsWith('- ')) {
                  return `<li style="margin-bottom: 0.5rem;">${line.replace('- ', '')}</li>`
                }
                // 表格（簡化處理）
                if (line.startsWith('|')) {
                  return line
                }
                // 一般段落
                if (line.trim()) {
                  return `<p style="margin-bottom: 1rem;">${line}</p>`
                }
                return ''
              })
              .join('')
          }}
        />

        {/* 相關文章推薦 */}
        <div className="mt-16 border-t-2 border-gray-200 pt-12">
          <h3 className="text-2xl font-bold mb-8" style={{color: '#2D2D2D'}}>相關文章推薦</h3>
          <div className="grid md:grid-cols-2 gap-6">
            {Object.entries(blogContent)
              .filter(([slug, article]) =>
                slug !== params.slug && article.category === post.category
              )
              .slice(0, 2)
              .map(([slug, article]) => (
                <Link
                  key={slug}
                  href={`/blog/${slug}`}
                  className="block bg-white rounded-xl p-6 border-2 border-gray-200 hover:border-primary transition-all hover:shadow-lg"
                >
                  <span className="text-xs text-primary font-medium">{article.category}</span>
                  <h4 className="text-lg font-semibold mt-2 mb-2" style={{color: '#2D2D2D'}}>
                    {article.title}
                  </h4>
                  <p className="text-gray-500 text-sm">{article.readTime}</p>
                </Link>
              ))}
          </div>
        </div>

        {/* 階梯式 CTA */}
        <ArticleCTA
          articleTitle={post.title}
          slug={params.slug}
          freeResource={params.slug === 'three-layers-fat-loss-strategy' ? {
            title: '免費下載：三層脂肪攻克計畫表',
            description: '完整 12 週執行計畫，包含訓練動作、飲食策略、進度追蹤表。立即下載開始你的減脂之旅！',
            fileUrl: '/resources/three-layers-fat-loss-plan.pdf'
          } : undefined}
          relatedArticles={
            Object.entries(blogContent)
              .filter(([slug]) => slug !== params.slug && blogContent[slug].category === post.category)
              .slice(0, 2)
              .map(([slug, article]) => ({
                title: article.title,
                slug: slug
              }))
          }
        />
      </article>
    </div>
  )
}
