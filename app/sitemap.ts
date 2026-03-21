import type { MetadataRoute } from 'next'
import { createServerSupabase } from '@/lib/supabase'

const BASE_URL = 'https://howard456.vercel.app'

// 硬編碼文章 slugs
const hardcodedSlugs = [
  'mouth-breathing-fat-loss',
  'sleep-efficiency-protocol',
  'morning-electrolyte-water',
  'zone-2-cardio-benefits',
  'workout-dopamine-better-than-coffee',
  'three-layers-fat-loss-strategy',
  'muscle-building-science-2025',
  'female-menstrual-cycle-training',
  'sleep-quality-hrv-optimization',
  'testosterone-optimization-3-months',
  'back-acne-igg-food-sensitivity',
]

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // 靜態頁面
  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE_URL, lastModified: new Date(), changeFrequency: 'weekly', priority: 1.0 },
    { url: `${BASE_URL}/diagnosis`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.9 },
    { url: `${BASE_URL}/action`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.9 },
    { url: `${BASE_URL}/remote`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.95 },
    { url: `${BASE_URL}/upgrade`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE_URL}/case`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE_URL}/training`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE_URL}/nutrition`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE_URL}/faq`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE_URL}/line`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.9 },
    { url: `${BASE_URL}/blog`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.9 },
    { url: `${BASE_URL}/privacy`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
    { url: `${BASE_URL}/terms`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
    { url: `${BASE_URL}/medical-disclaimer`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
    { url: `${BASE_URL}/refund-policy`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
    { url: `${BASE_URL}/join`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.9 },
    { url: `${BASE_URL}/tools/tdee`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
  ]

  // 硬編碼文章
  const hardcodedBlogPages: MetadataRoute.Sitemap = hardcodedSlugs.map(slug => ({
    url: `${BASE_URL}/blog/${slug}`,
    lastModified: new Date(),
    changeFrequency: 'monthly',
    priority: 0.8,
  }))

  // 從 Supabase 取得動態文章
  let supabaseBlogPages: MetadataRoute.Sitemap = []
  try {
    const supabase = createServerSupabase()
    if (supabase) {
      const { data } = await supabase
        .from('blog_posts')
        .select('slug, date')
        .order('date', { ascending: false })
      if (data) {
        supabaseBlogPages = data
          .filter(p => !hardcodedSlugs.includes(p.slug))
          .map(p => ({
            url: `${BASE_URL}/blog/${p.slug}`,
            lastModified: new Date(p.date),
            changeFrequency: 'monthly' as const,
            priority: 0.8,
          }))
      }
    }
  } catch {
    // Supabase 不可用時只用硬編碼文章
  }

  return [...staticPages, ...hardcodedBlogPages, ...supabaseBlogPages]
}
