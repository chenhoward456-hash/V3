'use client'

import { usePathname } from 'next/navigation'
import Navigation from '@/components/Navigation'
import Footer from '@/components/Footer'
import ScrollProgress from '@/components/ui/ScrollProgress'
import { ToastProvider } from '@/components/ui/Toast'

export default function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isAppPage = pathname?.startsWith('/c/') || pathname?.startsWith('/admin')

  return (
    <ToastProvider>
      {!isAppPage && <ScrollProgress />}
      {!isAppPage && <Navigation />}
      <main>{children}</main>
      {!isAppPage && <Footer />}
    </ToastProvider>
  )
}
