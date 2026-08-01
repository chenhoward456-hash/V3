import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,

  // 在 production 追蹤 10% 的 transactions
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // 開發環境不送 replay
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: process.env.NODE_ENV === 'production' ? 1.0 : 0,

  // 過濾常見的非 bug 錯誤
  ignoreErrors: [
    'ResizeObserver loop',
    'Non-Error promise rejection',
    /Loading chunk \d+ failed/,
    // IG / FB / LINE 內建瀏覽器注入的腳本自己噴的錯，不是我們的 code
    'webkit.messageHandlers',
    '_AutofillCallbackHandler',
    'instantSearchSDKJSBridgeClearHighlight',
    /^Java(script)? exception occurred/i,
  ],
})
