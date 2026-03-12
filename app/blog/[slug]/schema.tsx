// 部落格文章結構化資料（Schema.org）
export function generateArticleSchema(article: {
  title: string
  date: string
  dateModified?: string
  category: string
  content: string
  slug: string
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,
    datePublished: article.date,
    dateModified: article.dateModified || article.date,
    author: {
      '@type': 'Person',
      name: 'Howard Chen',
      url: 'https://howard456.vercel.app',
      jobTitle: 'CSCS 認證體能教練',
      image: 'https://howard456.vercel.app/howard-profile.jpg',
      affiliation: {
        '@type': 'Organization',
        name: 'Howard Protocol',
      },
    },
    publisher: {
      '@type': 'Organization',
      name: 'Howard Protocol',
      url: 'https://howard456.vercel.app',
      logo: {
        '@type': 'ImageObject',
        url: 'https://howard456.vercel.app/icon-192.png',
        width: 192,
        height: 192,
      },
    },
    image: {
      '@type': 'ImageObject',
      url: 'https://howard456.vercel.app/howard-profile.jpg',
      width: 1200,
      height: 630,
    },
    articleSection: article.category,
    inLanguage: 'zh-TW',
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `https://howard456.vercel.app/blog/${article.slug}`,
    },
    description: article.content.substring(0, 160).replace(/[#*\n]/g, ' ').trim(),
  }
}

// 麵包屑結構化資料（BreadcrumbList）
export function generateBreadcrumbSchema(article: {
  title: string
  slug: string
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: '首頁',
        item: 'https://howard456.vercel.app',
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: '部落格',
        item: 'https://howard456.vercel.app/blog',
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: article.title,
        item: `https://howard456.vercel.app/blog/${article.slug}`,
      },
    ],
  }
}

// 個人資料結構化資料
export function generatePersonSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: 'Howard Chen',
    alternateName: 'Howard',
    jobTitle: 'CSCS 認證體能教練',
    description: '台中北屯 CSCS 體能教練，專精肌力訓練、代謝優化、營養調整',
    url: 'https://howard456.vercel.app',
    image: 'https://howard456.vercel.app/howard-profile.jpg',
    sameAs: [
      'https://www.instagram.com/chenhoward/',
      'https://lin.ee/LP65rCc',
    ],
    worksFor: {
      '@type': 'Organization',
      name: 'Coolday Fitness 北屯館',
      address: {
        '@type': 'PostalAddress',
        addressLocality: '台中市',
        addressRegion: '北屯區',
        addressCountry: 'TW',
      },
    },
    knowsAbout: [
      '肌力訓練',
      '體能訓練',
      '代謝優化',
      '營養優化',
      '血檢優化',
      '運動科學',
      'CSCS',
    ],
  }
}
