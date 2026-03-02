import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'LINE 諮詢分流 - 減脂/睡眠/增肌專屬路徑 | Howard',
  description: '選擇你的目標（減脂/睡眠/增肌），我會先給你免費資源再依你的狀況分流引導。台中北屯 CSCS 體能教練 Howard 的個人化諮詢服務。',
  alternates: { canonical: 'https://howard456.vercel.app/line' },
  openGraph: {
    title: 'LINE 諮詢分流 - Howard Protocol',
    description: '選擇你的健康目標，獲得個人化免費資源與諮詢引導。',
    url: 'https://howard456.vercel.app/line',
  },
}

export default function LineLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
