/**
 * 數據匯出 API — CSV 格式
 *
 * GET /api/admin/export?clientId=xxx&type=body|nutrition|training|wellness|all&days=30
 *
 * 支援匯出：
 * - body: 體重 / 體脂 / 身高
 * - nutrition: 飲食紀錄（熱量、巨量營養素、合規）
 * - training: 訓練紀錄（類型、RPE、備註）
 * - wellness: 每日感受（睡眠、能量、情緒等）
 * - all: 以上全部（多個 sheet 合併為一個 CSV）
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase'
import { verifyAdminSession } from '@/lib/auth-middleware'

const supabase = createServiceSupabase()

function escapeCSV(value: any): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function toCSV(headers: string[], rows: any[][]): string {
  const headerLine = headers.map(escapeCSV).join(',')
  const dataLines = rows.map(row => row.map(escapeCSV).join(','))
  return [headerLine, ...dataLines].join('\n')
}

export async function GET(request: NextRequest) {
  // 驗證 admin session
  const token = request.cookies.get('admin_session')?.value
  if (!token || !verifyAdminSession(token)) {
    return NextResponse.json({ error: '未授權' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const clientId = searchParams.get('clientId')
  const type = searchParams.get('type') || 'all'
  const days = Math.min(365, Math.max(7, parseInt(searchParams.get('days') || '90')))

  if (!clientId) {
    return NextResponse.json({ error: '缺少 clientId' }, { status: 400 })
  }

  // 取得學員資料
  const { data: client, error: clientErr } = await supabase
    .from('clients')
    .select('name, gender, age')
    .eq('id', clientId)
    .single()

  if (clientErr || !client) {
    return NextResponse.json({ error: '找不到學員' }, { status: 404 })
  }

  const sinceDate = new Date()
  sinceDate.setDate(sinceDate.getDate() - days)
  const sinceDateStr = sinceDate.toISOString().split('T')[0]

  const sections: string[] = []
  const clientName = client.name || 'client'

  try {
    // ── 體組成 ──
    if (type === 'body' || type === 'all') {
      const { data } = await supabase
        .from('body_composition')
        .select('date, weight, height, body_fat, muscle_mass, waist, hip, note')
        .eq('client_id', clientId)
        .gte('date', sinceDateStr)
        .order('date', { ascending: true })

      const headers = ['日期', '體重(kg)', '身高(cm)', '體脂率(%)', '肌肉量(kg)', '腰圍(cm)', '臀圍(cm)', '備註']
      const rows = (data || []).map((r: any) => [
        r.date, r.weight, r.height, r.body_fat, r.muscle_mass, r.waist, r.hip, r.note
      ])

      if (type === 'all') sections.push(`\n=== 體組成 ===\n${toCSV(headers, rows)}`)
      else sections.push(toCSV(headers, rows))
    }

    // ── 飲食紀錄 ──
    if (type === 'nutrition' || type === 'all') {
      const { data } = await supabase
        .from('nutrition_logs')
        .select('date, calories, protein_grams, carbs_grams, fat_grams, compliant, note')
        .eq('client_id', clientId)
        .gte('date', sinceDateStr)
        .order('date', { ascending: true })

      const headers = ['日期', '熱量(kcal)', '蛋白質(g)', '碳水(g)', '脂肪(g)', '合規', '備註']
      const rows = (data || []).map((r: any) => [
        r.date, r.calories, r.protein_grams, r.carbs_grams, r.fat_grams,
        r.compliant === true ? '是' : r.compliant === false ? '否' : '', r.note
      ])

      if (type === 'all') sections.push(`\n=== 飲食紀錄 ===\n${toCSV(headers, rows)}`)
      else sections.push(toCSV(headers, rows))
    }

    // ── 訓練紀錄 ──
    if (type === 'training' || type === 'all') {
      const { data } = await supabase
        .from('training_logs')
        .select('date, training_type, rpe, note')
        .eq('client_id', clientId)
        .gte('date', sinceDateStr)
        .order('date', { ascending: true })

      const trainingTypeMap: Record<string, string> = {
        push: '推', pull: '拉', legs: '腿', full_body: '全身',
        cardio: '有氧', rest: '休息', chest: '胸', shoulder: '肩', arms: '手臂',
      }
      const headers = ['日期', '訓練類型', 'RPE', '備註']
      const rows = (data || []).map((r: any) => [
        r.date, trainingTypeMap[r.training_type] || r.training_type, r.rpe, r.note
      ])

      if (type === 'all') sections.push(`\n=== 訓練紀錄 ===\n${toCSV(headers, rows)}`)
      else sections.push(toCSV(headers, rows))
    }

    // ── 每日感受 ──
    if (type === 'wellness' || type === 'all') {
      const { data } = await supabase
        .from('daily_wellness')
        .select('date, sleep_quality, energy_level, mood, training_drive, stress_level, cognitive_clarity, period_start, note')
        .eq('client_id', clientId)
        .gte('date', sinceDateStr)
        .order('date', { ascending: true })

      const headers = ['日期', '睡眠品質(1-5)', '能量(1-5)', '情緒(1-5)', '訓練動力(1-5)', '壓力(1-5)', '認知清晰(1-5)', '經期開始', '備註']
      const rows = (data || []).map((r: any) => [
        r.date, r.sleep_quality, r.energy_level, r.mood, r.training_drive,
        r.stress_level, r.cognitive_clarity,
        r.period_start ? '是' : '', r.note
      ])

      if (type === 'all') sections.push(`\n=== 每日感受 ===\n${toCSV(headers, rows)}`)
      else sections.push(toCSV(headers, rows))
    }

    // 添加 BOM 讓 Excel 正確顯示中文
    const BOM = '\uFEFF'
    const csvContent = BOM + sections.join('\n')
    const filename = `${clientName}_${type}_${new Date().toISOString().split('T')[0]}.csv`

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
      },
    })
  } catch (err: any) {
    console.error('[admin/export] 錯誤:', err)
    return NextResponse.json({ error: '匯出失敗', detail: err.message }, { status: 500 })
  }
}
