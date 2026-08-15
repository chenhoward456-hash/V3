import { NextRequest, NextResponse } from 'next/server'
import { verifyCoachAuth } from '@/lib/auth-middleware'
import { createLogger } from '@/lib/logger'

const logger = createLogger('line-quota')

export const dynamic = 'force-dynamic'

/**
 * GET /api/line-quota
 * 給「賴助手」bot 拉的 LINE 學員 OA 推播配額水位（server 對 server）。
 * ⚠️ 免費方案實測是 **200 則/月**（不是註解原本寫的 500，2026-08-15 更正；LINE 台灣
 * Communication Plan 已調降）。2026-06 曾月中爆掉 silent fail — 這支讓 bot
 * 的每日自檢/週報能盯水位，別再等推不出去才發現。
 * 認證：同 coach-digest（verifyCoachAuth）。
 */
export async function GET(request: NextRequest) {
  try {
    const { authorized, error: authError } = await verifyCoachAuth(request)
    if (!authorized) return NextResponse.json({ error: authError || '權限不足' }, { status: 403 })

    const token = process.env.LINE_CHANNEL_ACCESS_TOKEN
    if (!token) return NextResponse.json({ error: 'LINE_CHANNEL_ACCESS_TOKEN 未設定' }, { status: 500 })
    const headers = { Authorization: `Bearer ${token}` }

    const [quotaRes, usageRes] = await Promise.all([
      fetch('https://api.line.me/v2/bot/message/quota', { headers }),
      fetch('https://api.line.me/v2/bot/message/quota/consumption', { headers }),
    ])
    if (!quotaRes.ok || !usageRes.ok) {
      logger.error('LINE quota API 失敗', { quota: quotaRes.status, usage: usageRes.status })
      return NextResponse.json({ error: `LINE API ${quotaRes.status}/${usageRes.status}` }, { status: 502 })
    }

    const quota = (await quotaRes.json()) as { type: string; value?: number }
    const usage = (await usageRes.json()) as { totalUsage: number }
    const limit = quota.type === 'limited' ? (quota.value ?? 0) : null
    const used = usage.totalUsage ?? 0

    return NextResponse.json({
      oa: 'v3-client',
      type: quota.type,
      limit,
      used,
      pct: limit ? Math.round((used / limit) * 100) : 0,
    })
  } catch (e) {
    logger.error('line-quota 錯誤', { error: e })
    return NextResponse.json({ error: '查詢失敗' }, { status: 500 })
  }
}
