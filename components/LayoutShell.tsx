'use client'

import { usePathname } from 'next/navigation'
import Navigation from '@/components/Navigation'
import Footer from '@/components/Footer'
import ScrollProgress from '@/components/ui/ScrollProgress'

export default function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isAppPage = pathname?.startsWith('/c/') || pathname?.startsWith('/admin')

  return (
    <>
      {!isAppPage && <ScrollProgress />}
      {!isAppPage && <Navigation />}
      <main>{children}</main>
      {!isAppPage && <Footer />}
    </>
  )
}
