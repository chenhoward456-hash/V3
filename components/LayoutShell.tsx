'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import Navigation from '@/components/Navigation'
import Footer from '@/components/Footer'
import ScrollProgress from '@/components/ui/ScrollProgress'
import { ToastProvider } from '@/components/ui/Toast'

export default function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  // 這些路徑是「拿在手上的東西」不是「網站的一頁」，所以不套行銷站的導覽與頁尾：
  //   /c/、/admin  = App 本體
  //   /assessment/ = 入會體測報告（2026-08-20）—— 會員拿到的是一份報告，
  //     套上站台 footer 會多出一堆導向線上方案的連結，跟報告自己的 CTA 打架。
  const isAppPage =
    pathname?.startsWith('/c/') ||
    pathname?.startsWith('/admin') ||
    pathname?.startsWith('/assessment')

  // Register service worker
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }
  }, [])

  return (
    <ToastProvider>
      {!isAppPage && <ScrollProgress />}
      {!isAppPage && <Navigation />}
      <main>{children}</main>
      {!isAppPage && <Footer />}
    </ToastProvider>
  )
}
