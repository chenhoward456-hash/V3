import { NextRequest, NextResponse } from 'next/server'

/**
 * Dynamic manifest for /c/{clientId} pages.
 * Sets start_url to the user's dashboard so PWA opens directly to their page.
 */
export async function GET(request: NextRequest) {
  const clientId = request.nextUrl.searchParams.get('clientId')

  // Validate clientId format
  if (!clientId || !/^[a-zA-Z0-9]{1,20}$/.test(clientId)) {
    return NextResponse.json(
      { error: 'Invalid clientId' },
      { status: 400 }
    )
  }

  const manifest = {
    name: 'Howard Protocol 健康管理',
    short_name: 'Howard',
    description: '你的個人健康追蹤儀表板',
    start_url: `/c/${clientId}`,
    scope: '/',
    display: 'standalone',
    background_color: '#f8fafc',
    theme_color: '#2563eb',
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' },
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  }

  return NextResponse.json(manifest, {
    headers: {
      'Content-Type': 'application/manifest+json',
      'Cache-Control': 'public, max-age=86400',
    },
  })
}
