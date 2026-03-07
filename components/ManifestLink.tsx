'use client'

import { usePathname } from 'next/navigation'

export default function ManifestLink() {
  const pathname = usePathname()

  // Dashboard pages: dynamic manifest with start_url = /c/{clientId}
  const match = pathname.match(/^\/c\/([a-zA-Z0-9]+)/)
  if (match) {
    return <link rel="manifest" href={`/api/manifest?clientId=${match[1]}`} />
  }

  // Other pages: static manifest
  return <link rel="manifest" href="/manifest.json" />
}
