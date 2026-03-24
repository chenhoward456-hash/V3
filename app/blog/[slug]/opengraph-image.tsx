import { ImageResponse } from 'next/og'
import { blogContent } from '@/data/blog-content'

// Route segment config
export const runtime = 'edge'
export const alt = 'Howard Protocol Blog'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

// Category → emoji + accent color
const CATEGORY_MAP: Record<string, { emoji: string; color: string }> = {
  '減脂策略': { emoji: '🔥', color: '#ef4444' },
  '恢復優化': { emoji: '💤', color: '#8b5cf6' },
  '增肌策略': { emoji: '💪', color: '#f59e0b' },
  '營養策略': { emoji: '🥗', color: '#22c55e' },
  '訓練方法': { emoji: '🏋️', color: '#3b82f6' },
  '血檢優化': { emoji: '🩸', color: '#dc2626' },
  '運動科學': { emoji: '🧠', color: '#6366f1' },
  '系統更新': { emoji: '⚙️', color: '#64748b' },
}

export default async function Image({ params }: { params: { slug: string } }) {
  const post = blogContent[params.slug]
  const title = post?.title || '文章'
  const category = post?.category || ''
  const readTime = post?.readTime || ''

  const cat = CATEGORY_MAP[category] || { emoji: '📝', color: '#2563eb' }

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '60px 70px',
          background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
          fontFamily: 'sans-serif',
        }}
      >
        {/* Top: Category badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: cat.color + '18',
              color: cat.color,
              fontSize: '22px',
              fontWeight: 700,
              padding: '8px 20px',
              borderRadius: '50px',
            }}
          >
            <span>{cat.emoji}</span>
            <span>{category || 'Howard Protocol'}</span>
          </div>
          {readTime && (
            <div
              style={{
                fontSize: '18px',
                color: '#94a3b8',
                fontWeight: 500,
              }}
            >
              {readTime}
            </div>
          )}
        </div>

        {/* Middle: Title */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            flex: 1,
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              fontSize: title.length > 25 ? '48px' : '56px',
              fontWeight: 800,
              color: '#1e293b',
              lineHeight: 1.3,
              maxWidth: '900px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {title}
          </div>
        </div>

        {/* Bottom: Author bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div
              style={{
                width: '52px',
                height: '52px',
                borderRadius: '50%',
                background: '#1e3a5f',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: '22px',
                fontWeight: 800,
              }}
            >
              H
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '20px', fontWeight: 700, color: '#1e3a5f' }}>
                Howard Chen
              </span>
              <span style={{ fontSize: '15px', color: '#94a3b8' }}>
                CSCS 認證體能教練
              </span>
            </div>
          </div>
          <div
            style={{
              fontSize: '18px',
              fontWeight: 700,
              color: '#1e3a5f',
              background: '#1e3a5f15',
              padding: '8px 20px',
              borderRadius: '12px',
            }}
          >
            Howard Protocol
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    },
  )
}
