import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin/', '/api/', '/c/'],
    },
    sitemap: 'https://howard456.vercel.app/sitemap.xml',
  }
}
