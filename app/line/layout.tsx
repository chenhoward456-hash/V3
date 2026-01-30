import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'LINE 諮詢分流 - 減脂/睡眠/增肌專屬路徑 | Howard',
  description: '選擇你的目標（減脂/睡眠/增肌），我會先給你免費資源再依你的狀況分流引導。台中北屯 CSCS 體能教練 Howard 的個人化諮詢服務。',
}

export default function LineLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
