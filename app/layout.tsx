import type { Metadata } from 'next'
import { Inter, Noto_Sans_TC, Playfair_Display } from 'next/font/google'
import './globals.css'
import LayoutShell from '@/components/LayoutShell'
import ManifestLink from '@/components/ManifestLink'

const inter = Inter({ 
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap'
})

const notoSansTC = Noto_Sans_TC({ 
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-noto-sans-tc',
})

const playfairDisplay = Playfair_Display({
  subsets: ['latin'],
  weight: ['400', '700', '900'],
  display: 'swap',
  variable: '--font-playfair',
})

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover' as const,
}

export const metadata: Metadata = {
  title: 'Howard Protocol - 數據驅動的體態與健康管理 | CSCS 教練監督',
  description: '數據驅動的體態與健康管理系統。自適應 TDEE 自動校正、每週智能分析、Refeed 自動觸發、月經週期濾鏡。CSCS 認證教練監督，運動醫學背景。台中實體 / 全台遠端。',
  verification: {
    google: 'hSS0ZwkqpzzSA8A4RS7RW81CeoR2HOFoT-CkpEFYcf4',
  },
  keywords: [
    '數據化體態管理',
    '自適應TDEE',
    '智能營養系統',
    'CSCS教練',
    '數據化訓練',
    '遠端訓練',
    '科學化減脂',
    '台中教練',
    '體重管理系統',
    '運動醫學',
    '碳循環',
    '自動飲食調整'
  ],
  authors: [{ name: 'Howard Chen' }],
  openGraph: {
    title: 'Howard Protocol - 數據驅動的體態與健康管理',
    description: '智能系統 24 小時分析 × CSCS 教練即時監督。不只是教練服務，是一套會持續進化的系統。',
    type: 'website',
    locale: 'zh_TW',
    url: 'https://howard456.vercel.app',
    siteName: 'Howard Protocol',
    images: [
      {
        url: '/howard-profile.jpg',
        width: 1200,
        height: 630,
        alt: 'Howard Protocol - 數據驅動的體態與健康管理'
      }
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Howard Protocol - 數據驅動的體態與健康管理',
    description: '智能系統 24 小時分析 × CSCS 教練即時監督',
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
    <html lang="zh-TW" className={`scroll-smooth ${inter.variable} ${notoSansTC.variable} ${playfairDisplay.variable}`}>
      <head>
        {/* PWA */}
        <ManifestLink />
        <meta name="theme-color" content="#2563eb" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Howard" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
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
        <LayoutShell>{children}</LayoutShell>
      </body>
    </html>
  )
}
