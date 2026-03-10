import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'AI 健康顧問 - Howard Protocol | 營養 · 訓練 · 恢復建議',
  description: 'Howard Protocol AI 健康顧問助手，根據你的飲食、訓練與身心數據，提供個人化的營養規劃、訓練建議與恢復策略。',
  alternates: { canonical: 'https://howard456.vercel.app/ai' },
  openGraph: {
    title: 'AI 健康顧問 - Howard Protocol',
    description: '根據你的數據，提供個人化營養與訓練建議。',
    url: 'https://howard456.vercel.app/ai',
  },
  robots: { index: false },
}

export default function AiLayout({ children }: { children: React.ReactNode }) {
  return children
}
