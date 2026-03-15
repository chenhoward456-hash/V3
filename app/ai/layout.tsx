import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'AI 私人顧問 - Howard Protocol | 飲食 · 訓練 · 恢復 · 血檢',
  description: 'Howard Protocol AI 私人顧問，根據你的飲食、訓練、睡眠、血檢、體重變化等數據，回答你的健康問題。',
  alternates: { canonical: 'https://howard456.vercel.app/ai' },
  openGraph: {
    title: 'AI 私人顧問 - Howard Protocol',
    description: '根據你的數據，提供個人化營養與訓練建議。',
    url: 'https://howard456.vercel.app/ai',
  },
  robots: { index: false },
}

export default function AiLayout({ children }: { children: React.ReactNode }) {
  return children
}
