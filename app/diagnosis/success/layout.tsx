import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '購買成功 - Howard Protocol',
  description: '感謝購買 System Reboot 電子書。你的完整分析報告和電子書已準備好下載。',
  robots: { index: false, follow: false },
}

export default function SuccessLayout({ children }: { children: React.ReactNode }) {
  return children
}
