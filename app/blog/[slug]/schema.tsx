// 部落格文章結構化資料（Schema.org）
export function generateArticleSchema(article: {
  title: string
  date: string
  category: string
  content: string
  slug: string
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,
    datePublished: article.date,
    dateModified: article.date,
    author: {
      '@type': 'Person',
      name: 'Howard Chen',
      url: 'https://howard456.vercel.app',
      jobTitle: 'CSCS 認證體能教練',
      affiliation: {
        '@type': 'Organization',
        name: 'Coolday Fitness 北屯館',
      },
    },
    publisher: {
      '@type': 'Person',
      name: 'Howard Chen',
      url: 'https://howard456.vercel.app',
    },
    image: 'https://howard456.vercel.app/howard-profile.jpg',
    articleSection: article.category,
    inLanguage: 'zh-TW',
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `https://howard456.vercel.app/blog/${article.slug}`,
    },
    description: article.content.substring(0, 160).replace(/[#*\n]/g, ' ').trim(),
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
      'https://lin.ee/dnbucVw',
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
