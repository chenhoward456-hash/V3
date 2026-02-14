import { NextRequest, NextResponse } from 'next/server'
import { parseMetricsFromCSV, parseSupplementsFromCSV, parseProgressFromCSV } from '@/lib/csv-parser'
import { verifyCoachAuth } from '@/lib/auth-middleware'

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB

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

    const formData = await request.formData()
    const metricsFile = formData.get('metrics') as File
    const supplementsFile = formData.get('supplements') as File
    const progressFile = formData.get('progress') as File

    // 驗證檔案大小
    const files = [metricsFile, supplementsFile, progressFile].filter(Boolean)
    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: `檔案 ${file.name} 超過 5MB 大小限制` },
          { status: 400 }
        )
      }
    }

    const data: any = {}

    // 解析指標數據
    if (metricsFile) {
      const metricsText = await metricsFile.text()
      data.metrics = parseMetricsFromCSV(metricsText)
    }

    // 解析補品數據
    if (supplementsFile) {
      const supplementsText = await supplementsFile.text()
      data.supplements = parseSupplementsFromCSV(supplementsText)
    }

    // 解析進度數據
    if (progressFile) {
      const progressText = await progressFile.text()
      data.progress = parseProgressFromCSV(progressText)
    }

    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to parse CSV files' },
      { status: 500 }
    )
  }
}
