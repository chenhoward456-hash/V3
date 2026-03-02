'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import LineButton from '@/components/LineButton'

const navItems = [
  { label: '系統介紹', href: '/' },
  { label: '免費體驗', href: '/diagnosis' },
  { label: '知識分享', href: '/blog' },
  { label: '成功案例', href: '/case' },
  { label: '方案說明', href: '/remote' },
]

export default function Navigation() {
  const pathname = usePathname()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <>
      {/* Mobile Menu Overlay */}
      <div
        className={`fixed inset-0 bg-black/50 z-40 lg:hidden transition-opacity duration-300 ${
          mobileMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setMobileMenuOpen(false)}
      >
        <div
          className={`fixed right-0 top-0 h-full w-64 bg-white shadow-2xl p-6 flex flex-col gap-4 transition-transform duration-300 ease-out ${
            mobileMenuOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* 關閉按鈕 */}
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="self-end p-2 text-gray-500 hover:text-gray-800 transition-colors"
            aria-label="關閉選單"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
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
          <LineButton
            source="nav_mobile"
            intent="general"
            className="mt-auto bg-primary text-white py-3 px-4 rounded-lg font-semibold text-center text-sm hover:bg-primary-dark transition-colors"
          >
            加 LINE 諮詢
          </LineButton>
        </div>
      </div>

      {/* Desktop Navigation */}
      <nav className="sticky top-0 z-50 bg-bg-primary/95 backdrop-blur-md border-b border-border/40">
        <div className="max-w-6xl mx-auto px-8">
          <div className="flex items-center justify-between">
            <Link 
              href="/" 
              className="py-6 font-semibold text-lg text-text-primary hover:text-primary transition-colors"
            >
              Howard Protocol
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
              <LineButton
                source="nav_cta"
                intent="general"
                className="hidden lg:inline-block bg-primary text-white px-5 py-2.5 rounded-full font-medium text-sm hover:bg-primary-dark transition-colors"
              >
                加 LINE 諮詢
              </LineButton>

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
