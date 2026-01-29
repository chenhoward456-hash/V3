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
    source: source // 'homepage', 'action_page', 'diagnosis_result' 等
  });
};

// 追蹤頁面瀏覽
export const trackPageView = (pageName: string) => {
  trackEvent('page_view', {
    page_name: pageName
  });
};
