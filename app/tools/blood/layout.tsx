import type { Metadata } from 'next'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://howard456.vercel.app'

const TITLE = '健保沒驗的 5 個血檢 — 自費加驗清單'
const DESC =
  '健保健檢說「正常」，但有 5 個數字它通常沒幫你驗：ApoB、同半胱胺酸、hs-CRP、HOMA-IR、維生素 D。這頁列出每一項是什麼、健保為何略過、以及可以帶去問醫師的問題。不做個人判讀，數字交給醫師。'

export const metadata: Metadata = {
  title: `${TITLE} | Howard Protocol`,
  description: DESC,
  keywords: [
    '血檢',
    '自費健檢',
    '健康檢查',
    '預防醫學',
    'ApoB',
    '胰島素阻抗',
    'HOMA-IR',
    'hs-CRP',
    '同半胱胺酸',
    '維生素D',
  ],
  alternates: { canonical: `${SITE_URL}/tools/blood` },
  openGraph: {
    title: TITLE,
    description: DESC,
    type: 'website',
    url: `${SITE_URL}/tools/blood`,
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

export default function BloodToolLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
