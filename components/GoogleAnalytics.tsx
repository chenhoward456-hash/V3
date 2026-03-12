'use client'

import Script from 'next/script'
import { useEffect, useState } from 'react'

const GA_ID = 'G-8GMW6GH1QB'

export default function GoogleAnalytics() {
  const [consented, setConsented] = useState(false)

  useEffect(() => {
    const consent = localStorage.getItem('cookie_consent')
    setConsented(consent === 'accepted')

    const handleConsentChange = () => {
      const updated = localStorage.getItem('cookie_consent')
      setConsented(updated === 'accepted')
    }
    window.addEventListener('cookie-consent-changed', handleConsentChange)
    return () => window.removeEventListener('cookie-consent-changed', handleConsentChange)
  }, [])

  if (!consented) return null

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
        strategy="afterInteractive"
      />
      <Script id="google-analytics" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GA_ID}');
        `}
      </Script>
    </>
  )
}
