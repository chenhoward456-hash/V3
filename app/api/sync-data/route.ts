import { NextRequest, NextResponse } from 'next/server'
import { verifyCoachAuth } from '@/lib/auth-middleware'

export async function POST(request: NextRequest) {
  try {
    // 驗證教練權限
    const { authorized, error: authError } = await verifyCoachAuth(request)
    if (!authorized) {
      return NextResponse.json(
        { error: authError || '權限不足' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { data, source } = body

    // 驗證來源（可選）
    const validSources = ['google-sheets', 'manual']
    if (!validSources.includes(source)) {
      return NextResponse.json(
        { error: 'Invalid source' },
        { status: 403 }
      )
    }

    // 解析數據
    const metrics = data.map((row: any[]) => ({
      id: row[0] || '',
      name: row[1] || '',
      current: parseFloat(row[2]) || 0,
      target: parseFloat(row[3]) || 0,
      unit: row[4] || '',
      description: row[5] || ''
    }))

    // 保存到 localStorage（通過 API 返回）
    return NextResponse.json({
      success: true,
      metrics,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to sync data' },
      { status: 500 }
    )
  }
}
