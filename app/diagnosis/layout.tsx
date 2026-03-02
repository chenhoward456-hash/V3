import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '免費系統分析 - 體驗智能引擎 | Howard Protocol',
  description: '30 秒體驗 Howard Protocol 智能引擎。輸入基本資料，系統即時估算你的 TDEE、每日參考熱量、巨量營養素分配。免費、不需註冊。',
  alternates: { canonical: 'https://howard456.vercel.app/diagnosis' },
  openGraph: {
    title: '免費系統分析 - 體驗 Howard Protocol 智能引擎',
    description: '30 秒體驗智能引擎，即時估算 TDEE、每日參考熱量、巨量營養素分配。免費、不需註冊。',
    url: 'https://howard456.vercel.app/diagnosis',
  },
}

export default function DiagnosisLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
