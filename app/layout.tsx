import type { Metadata } from 'next'
import './globals.css'
import Navigation from '@/components/Navigation'
import Footer from '@/components/Footer'

export const metadata: Metadata = {
  title: 'Howard - 台中北屯 CSCS 體能教練 | Coolday Fitness 教練主管',
  description: 'Howard，Coolday Fitness 北屯館教練主管，CSCS 認證體能教練。專精肌力訓練、代謝優化、營養調整。台中北屯一對一客製化訓練指導。',
  keywords: [
    '台中健身教練',
    '北屯健身',
    'Coolday Fitness',
    'CSCS 教練',
    '肌力訓練',
    '體能訓練',
    '一對一教練',
    '台中北屯',
    '代謝優化',
    '營養優化',
    '運動醫學',
    '生物駭客',
    '客製化訓練'
  ],
  authors: [{ name: 'Howard' }],
  openGraph: {
    title: 'Howard - 台中北屯 CSCS 體能教練',
    description: 'Coolday Fitness 北屯館教練主管 | 專精肌力訓練與代謝優化 | 一對一客製化訓練指導',
    type: 'website',
    locale: 'zh_TW',
    url: 'https://howard456.vercel.app',
    siteName: 'The Howard Protocol',
    images: [
      {
        url: '/howard-profile.jpg',
        width: 1200,
        height: 630,
        alt: 'Howard - CSCS 體能教練'
      }
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Howard - 台中北屯 CSCS 體能教練',
    description: 'Coolday Fitness 北屯館教練主管 | 專精肌力訓練與代謝優化',
    images: ['/howard-profile.jpg'],
  },
  icons: {
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🧬</text></svg>",
  },
  metadataBase: new URL('https://howard456.vercel.app'),
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-TW" className="scroll-smooth">
      <head>
        {/* Google Analytics */}
        <script async src="https://www.googletagmanager.com/gtag/js?id=G-8GMW6GH1QB"></script>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', 'G-8GMW6GH1QB');
            `,
          }}
        />
      </head>
      <body>
        <Navigation />
        {children}
        <Footer />
      </body>
    </html>
  )
}
