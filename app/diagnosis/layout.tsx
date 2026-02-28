import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '免費系統分析 - 體驗 AI 引擎 | Howard Protocol',
  description: '30 秒體驗 Howard Protocol AI 引擎。輸入基本資料，系統即時計算你的 TDEE、每日建議熱量、巨量營養素分配。免費、不需註冊。',
}

export default function DiagnosisLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
