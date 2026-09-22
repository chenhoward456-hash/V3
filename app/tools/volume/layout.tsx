import type { Metadata } from 'next'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://howard456.vercel.app'

const TITLE = '課表週組數對帳 — 貼上課表，看每個部位練了幾組'
const DESC =
  '把課表貼進來，馬上看到每個部位一週實際練了幾組、哪個部位掛零、哪一對肌群失衡。教練寫課表時最常漏掉的不是動作，是某個部位根本沒被排到——那件事用眼睛看不出來，要加總才會現形。純前端計算，不上傳不儲存。'

export const metadata: Metadata = {
  title: `${TITLE} | Howard Protocol`,
  description: DESC,
  keywords: [
    '課表',
    '訓練量',
    '週組數',
    '訓練計畫',
    '健身課表',
    '增肌',
    '健美',
    '健體',
    '教練',
    '訓練量對帳',
  ],
  alternates: { canonical: `${SITE_URL}/tools/volume` },
  openGraph: {
    title: TITLE,
    description: DESC,
    type: 'website',
    url: `${SITE_URL}/tools/volume`,
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

export default function VolumeToolLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
