// Google Analytics 事件追蹤函數
export const trackEvent = (eventName: string, eventParams?: Record<string, any>) => {
  if (typeof window !== 'undefined' && (window as any).gtag) {
    (window as any).gtag('event', eventName, eventParams);
  }
};

// 追蹤診斷測驗完成
export const trackDiagnosisComplete = (score: number) => {
  trackEvent('diagnosis_complete', {
    score: score,
    category: score >= 8 ? 'high_risk' : score >= 4 ? 'medium_risk' : 'low_risk'
  });
};

// 追蹤 LINE 預約點擊
export const trackLineClick = (source: string) => {
  trackEvent('line_click', {
    source: source // 'homepage', 'action_page', 'diagnosis_result', 'blog_post' 等
  });
};

// 追蹤頁面瀏覽
export const trackPageView = (pageName: string) => {
  trackEvent('page_view', {
    page_name: pageName
  });
};

// 追蹤文章閱讀
export const trackArticleRead = (articleTitle: string, category: string, readTime: string) => {
  trackEvent('article_read', {
    article_title: articleTitle,
    article_category: category,
    read_time: readTime
  });
};

// 追蹤文章閱讀進度（捲動深度）
export const trackArticleScroll = (articleTitle: string, scrollDepth: number) => {
  trackEvent('article_scroll', {
    article_title: articleTitle,
    scroll_depth: scrollDepth // 25, 50, 75, 100
  });
};

// 追蹤相關文章點擊
export const trackRelatedArticleClick = (fromArticle: string, toArticle: string) => {
  trackEvent('related_article_click', {
    from_article: fromArticle,
    to_article: toArticle
  });
};

// 追蹤外部連結點擊
export const trackExternalLink = (linkUrl: string, linkText: string) => {
  trackEvent('external_link_click', {
    link_url: linkUrl,
    link_text: linkText
  });
};

// 追蹤社群分享
export const trackSocialShare = (platform: string, articleTitle: string) => {
  trackEvent('social_share', {
    platform: platform, // 'line', 'facebook', 'twitter' 等
    article_title: articleTitle
  });
};

// 追蹤導航點擊
export const trackNavigation = (destination: string) => {
  trackEvent('navigation_click', {
    destination: destination
  });
};
