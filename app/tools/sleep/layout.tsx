import type { Metadata } from 'next'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://howard456.vercel.app'

const TITLE = '作息規律檢查表 — 你這週的起床時間漂了幾小時？'
const DESC =
  '免費作息規律檢查表：填入這週的上床與起床時間，算出你的作息漂移有幾小時。研究指出，作息規律比睡眠時數更能預測健康結果。資料只在你的瀏覽器裡計算，不會上傳。'

export const metadata: Metadata = {
  title: `${TITLE} | Howard Protocol`,
  description: DESC,
  keywords: [
    '作息規律',
    '睡眠規律',
    '生理時鐘',
    '社交時差',
    '補眠',
    '起床時間',
    '睡眠品質',
    '睡眠檢查表',
    'sleep regularity',
  ],
  alternates: { canonical: `${SITE_URL}/tools/sleep` },
  openGraph: {
    title: TITLE,
    description: DESC,
    type: 'website',
    url: `${SITE_URL}/tools/sleep`,
    siteName: 'Howard Protocol',
    locale: 'zh_TW',
    images: [{ url: '/howard-profile.jpg', width: 1200, height: 630, alt: TITLE }],
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESC,
    images: ['/howard-profile.jpg'],
  },
}

export default function SleepToolLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
