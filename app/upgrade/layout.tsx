import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '方案比較與升級 - Howard Protocol | 免費體驗 / 自主管理 / 教練指導',
  description: '比較 Howard Protocol 三種方案：免費體驗、自主管理 NT$499/月、教練指導 NT$2,999/月。所有方案皆月繳制不綁約，隨時可升級或取消。',
  alternates: { canonical: 'https://howard456.vercel.app/upgrade' },
  openGraph: {
    title: '方案比較與升級 - Howard Protocol',
    description: '免費體驗 → 自主管理 NT$499/月 → 教練指導 NT$2,999/月。不綁約，隨時升級或取消。',
    url: 'https://howard456.vercel.app/upgrade',
    type: 'website',
    images: [
      {
        url: 'https://howard456.vercel.app/howard-profile.jpg',
        width: 1200,
        height: 630,
        alt: 'Howard Protocol 方案比較',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: '方案比較與升級 - Howard Protocol',
    description: '免費體驗 → 自主管理 NT$499/月 → 教練指導 NT$2,999/月',
    images: ['https://howard456.vercel.app/howard-profile.jpg'],
  },
}

export default function UpgradeLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
