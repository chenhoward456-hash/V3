'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'

const navItems = [
  { label: '關於我', href: '/' },
  { label: '個案追蹤', href: '/case' },
  { label: '訓練工程', href: '/training' },
  { label: '營養恢復', href: '/nutrition' },
  { label: '工具資源', href: '/tools' },
  { label: '常見問題', href: '/faq' },
  { label: '預約諮詢', href: '/action' },
]

export default function Navigation() {
  const pathname = usePathname()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <>
      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        >
          <div 
            className="fixed right-0 top-0 h-full w-64 bg-white shadow-2xl p-6 flex flex-col gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`text-base font-semibold py-3 px-4 rounded-lg transition-colors ${
                  pathname === item.href
                    ? 'bg-primary/10 text-primary'
                    : 'text-text-secondary hover:bg-bg-tertiary'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Desktop Navigation */}
      <nav className="sticky top-0 z-50 bg-bg-primary/95 backdrop-blur-md border-b border-border/40">
        <div className="max-w-6xl mx-auto px-8">
          <div className="flex items-center justify-between">
            <Link 
              href="/" 
              className="py-6 font-semibold text-lg text-text-primary hover:text-primary transition-colors"
            >
              Howard Chen<span className="text-text-muted ml-2 font-normal text-base">人體效能優化</span>
            </Link>

            {/* Desktop Menu */}
            <div className="hidden lg:flex items-center gap-1">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`py-6 px-4 font-medium text-[14px] transition-colors ${
                    pathname === item.href
                      ? 'text-primary'
                      : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </div>

            <div className="flex items-center gap-4">
              <Link
                href="/action"
                className="hidden lg:inline-block bg-primary text-white px-5 py-2.5 rounded-full font-medium text-sm hover:bg-primary-dark transition-colors"
              >
                預約諮詢
              </Link>

              {/* Mobile Menu Button */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="lg:hidden flex flex-col gap-1.5 p-2"
                aria-label="Toggle menu"
              >
                <span className="w-6 h-0.5 bg-text-primary rounded-full"></span>
                <span className="w-6 h-0.5 bg-text-primary rounded-full"></span>
                <span className="w-6 h-0.5 bg-text-primary rounded-full"></span>
              </button>
            </div>
          </div>
        </div>
      </nav>
    </>
  )
}
