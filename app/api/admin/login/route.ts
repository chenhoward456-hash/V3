import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json()
    
    // 驗證密碼（實際應該用環境變數）
    const correctPassword = process.env.ADMIN_PASSWORD || 'howard123'
    
    if (password === correctPassword) {
      return NextResponse.json({ success: true })
    } else {
      return NextResponse.json({ error: '密碼錯誤' }, { status: 401 })
    }
  } catch (error) {
    return NextResponse.json({ error: '請求錯誤' }, { status: 400 })
  }
}
