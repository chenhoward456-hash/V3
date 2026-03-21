import type { Metadata } from 'next'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://howard456.vercel.app'

export const metadata: Metadata = {
  title: 'TDEE 計算機 — 精準計算你的每日總熱量消耗 | Howard Protocol',
  description:
    '免費 TDEE 計算機，根據你的性別、體重、身高、年齡和活動量精準計算每日總消耗熱量。還能進一步計算減脂/增肌的建議熱量和巨量營養素分配。',
  keywords: [
    'TDEE計算',
    'TDEE計算機',
    '每日總熱量消耗',
    'BMR計算',
    '基礎代謝率',
    '減脂熱量',
    '增肌熱量',
    '巨量營養素',
    'Mifflin-St Jeor',
    '熱量計算',
  ],
  alternates: { canonical: `${SITE_URL}/tools/tdee` },
  openGraph: {
    title: 'TDEE 計算機 — 精準計算你的每日總熱量消耗',
    description:
      '免費 TDEE 計算機，根據你的性別、體重、身高、年齡和活動量精準計算每日總消耗熱量。',
    type: 'website',
    url: `${SITE_URL}/tools/tdee`,
    siteName: 'Howard Protocol',
    locale: 'zh_TW',
    images: [
      {
        url: '/howard-profile.jpg',
        width: 1200,
        height: 630,
        alt: 'TDEE 計算機 — Howard Protocol',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'TDEE 計算機 — 精準計算你的每日總熱量消耗',
    description:
      '免費 TDEE 計算機，根據你的性別、體重、身高、年齡和活動量精準計算每日總消耗熱量。',
    images: ['/howard-profile.jpg'],
  },
}

export default function TdeeLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
