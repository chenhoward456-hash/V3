// Google Analytics 事件追蹤函數
export const trackEvent = (eventName: string, eventParams?: Record<string, any>) => {
  if (typeof window !== 'undefined' && (window as any).gtag) {
    (window as any).gtag('event', eventName, eventParams);
  }
};

export const trackArticleView = (articleTitle: string, category: string, readTime: string, slug?: string) => {
  trackEvent('article_view', {
    article_title: articleTitle,
    article_category: category,
    read_time: readTime,
    slug,
  })
}

export const trackScroll75 = (articleTitle: string, slug?: string) => {
  trackEvent('scroll_75', {
    article_title: articleTitle,
    slug,
  })
}

export const trackResourceDownload = (fileUrl: string, source: string, options?: {
  articleTitle?: string
  slug?: string
  variant?: string
}) => {
  trackEvent('resource_download', {
    file_url: fileUrl,
    source,
    article_title: options?.articleTitle,
    slug: options?.slug,
    variant: options?.variant,
  })
}

// 追蹤診斷測驗完成
export const trackDiagnosisComplete = (score: number) => {
  trackEvent('diagnosis_complete', {
    score: score,
    category: score >= 8 ? 'high_risk' : score >= 4 ? 'medium_risk' : 'low_risk'
  });
};

// 追蹤 LINE 預約點擊
export const trackLineClick = (source: string, options?: { intent?: string; slug?: string; articleTitle?: string; variant?: string }) => {
  trackEvent('line_click', {
    source: source,
    intent: options?.intent,
    slug: options?.slug,
    article_title: options?.articleTitle,
    variant: options?.variant,
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

// 自定義事件類型
export const AnalyticsEvents = {
  // 診斷相關
  DIAGNOSIS_STARTED: 'diagnosis_started',
  DIAGNOSIS_COMPLETED: 'diagnosis_completed',
  DIAGNOSIS_QUESTION_ANSWERED: 'diagnosis_question_answered',
  
  // 服務相關
  SERVICE_VIEWED: 'service_viewed',
  SERVICE_INQUIRY: 'service_inquiry',
  LINE_CLICKED: 'line_clicked',
  
  // 使用者行為
  CTA_CLICKED: 'cta_clicked',
  SCROLL_DEPTH: 'scroll_depth',
  TIME_ON_PAGE: 'time_on_page',
  
  // 商業轉換
  CONSULTATION_REQUESTED: 'consultation_requested',
  SUBSCRIPTION_INQUIRED: 'subscription_inquired'
} as const;
