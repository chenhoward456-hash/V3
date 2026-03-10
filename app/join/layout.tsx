import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '選擇方案 - Howard Protocol | 免費體驗 / 自主管理 / 教練指導',
  description: '免費體驗 Howard Protocol 智能體態管理系統，不需信用卡。升級自主管理版（NT$499/月）享 AI 完整功能，或選教練指導版（NT$2,999/月）獲得 CSCS 教練每週指導。',
  alternates: { canonical: 'https://howard456.vercel.app/join' },
  openGraph: {
    title: '選擇方案 - Howard Protocol',
    description: '免費體驗系統，滿意再升級。AI 智能追蹤 × CSCS 教練監督。',
    url: 'https://howard456.vercel.app/join',
  },
}

export default function JoinLayout({ children }: { children: React.ReactNode }) {
  return children
}
