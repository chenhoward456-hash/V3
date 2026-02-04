import { NextRequest, NextResponse } from 'next/server'
import { parseMetricsFromCSV, parseSupplementsFromCSV, parseProgressFromCSV } from '@/lib/csv-parser'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const metricsFile = formData.get('metrics') as File
    const supplementsFile = formData.get('supplements') as File
    const progressFile = formData.get('progress') as File

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
    console.error('CSV Upload Error:', error)
    return NextResponse.json(
      { error: 'Failed to parse CSV files' },
      { status: 500 }
    )
  }
}
