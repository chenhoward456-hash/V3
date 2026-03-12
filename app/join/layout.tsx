import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '加入 Howard Protocol — 選擇你的方案',
  description: '免費開始使用 Howard Protocol 體態管理系統。提供免費、自主管理、教練指導三種方案。',
}

export default function JoinLayout({ children }: { children: React.ReactNode }) {
  return children
}
