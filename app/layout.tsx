import type { Metadata } from 'next'
import './globals.css'
import Navigation from '@/components/Navigation'
import Footer from '@/components/Footer'

export const metadata: Metadata = {
  title: 'Howard Chen - 台中 CSCS 體能教練',
  description: 'Howard Chen，CSCS 認證體能教練，高雄醫學大學運動醫學系畢業。整合肌力訓練與營養優化，提供系統化的訓練指導。',
  keywords: ['肌力訓練', '運動醫學', '生物駭客', 'CSCS', '體能訓練', '營養優化', '代謝健康'],
  authors: [{ name: 'Howard Chen' }],
  openGraph: {
    title: 'The Howard Protocol v3.0',
    description: '人體效能優化系統 - 整合肌力訓練、運動醫學與生物駭客',
    type: 'website',
    locale: 'zh_TW',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'The Howard Protocol v3.0',
    description: '人體效能優化系統 - 整合肌力訓練、運動醫學與生物駭客',
  },
  icons: {
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🧬</text></svg>",
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-TW" className="scroll-smooth">
      <body>
        <Navigation />
        {children}
        <Footer />
      </body>
    </html>
  )
}
