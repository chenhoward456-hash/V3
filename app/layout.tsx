import type { Metadata } from 'next'
import { Inter, Noto_Sans_TC, Playfair_Display } from 'next/font/google'
import './globals.css'
import Navigation from '@/components/Navigation'
import Footer from '@/components/Footer'
import ScrollProgress from '@/components/ui/ScrollProgress'

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
  title: 'Howard - 台中北屯 CSCS 體能教練 | 數據優化訓練',
  description: 'Howard，CSCS 認證體能教練，高雄醫學大學運動醫學系畢業。專精肌力訓練、代謝優化、營養調整。台中北屯一對一客製化訓練指導。',
  verification: {
    google: 'hSS0ZwkqpzzSA8A4RS7RW81CeoR2HOFoT-CkpEFYcf4',
  },
  keywords: [
    '台中健身教練',
    '北屯健身',
    'CSCS 教練',
    '肌力訓練',
    '體能訓練',
    '代謝優化',
    '營養調整',
    '數據追蹤',
    '個人教練',
    '運動醫學',
    '生物駭客',
    '客製化訓練'
  ],
  authors: [{ name: 'Howard' }],
  openGraph: {
    title: 'Howard - 台中北屯 CSCS 體能教練',
    description: 'CSCS 認證體能教練 | 專精肌力訓練與代謝優化 | 台中北屯一對一客製化訓練指導',
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
    description: 'CSCS 認證體能教練 | 專精肌力訓練與代謝優化',
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
        <ScrollProgress />
        <Navigation />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  )
}
