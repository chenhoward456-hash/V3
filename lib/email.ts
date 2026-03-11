import { Resend } from 'resend'
import { createLogger } from '@/lib/logger'

const log = createLogger('email')

function escapeHTML(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// Lazy init：避免 build time 沒有 API key 導致 constructor 拋錯
let _resend: Resend | null = null
function getResend(): Resend {
  if (!_resend) {
    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) {
      throw new Error('RESEND_API_KEY is not set')
    }
    _resend = new Resend(apiKey)
  }
  return _resend
}

interface SendPurchaseEmailParams {
  to: string
  downloadToken: string
  merchantTradeNo: string
}

/**
 * 付款成功後寄送下載連結信
 */
export async function sendPurchaseEmail({
  to,
  downloadToken,
  merchantTradeNo,
}: SendPurchaseEmailParams): Promise<{ success: boolean; error?: string }> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://howardprotocol.com'
  const downloadUrl = `${siteUrl}/api/ebook/download?token=${encodeURIComponent(downloadToken)}`
  const successUrl = `${siteUrl}/diagnosis/success?order_id=${merchantTradeNo}`

  try {
    const resend = getResend()
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'Howard Protocol <onboarding@resend.dev>'

    const { error } = await resend.emails.send({
      from: fromEmail,
      to,
      subject: '你的《System Reboot》電子書已準備好 📥',
      html: buildPurchaseEmailHTML({ downloadUrl, successUrl }),
    })

    if (error) {
      log.error('Resend error', error)
      return { success: false, error: error.message }
    }

    log.info('Purchase email sent', { to })
    return { success: true }
  } catch (err: any) {
    log.error('Send failed', err)
    return { success: false, error: err?.message || 'Unknown error' }
  }
}

// ===== 訂閱歡迎信 =====

interface SendWelcomeEmailParams {
  to: string
  name: string
  uniqueCode: string
  tier: string
}

export async function sendWelcomeEmail({
  to,
  name,
  uniqueCode,
  tier,
}: SendWelcomeEmailParams): Promise<{ success: boolean; error?: string }> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://howardprotocol.com'
  const dashboardUrl = `${siteUrl}/c/${uniqueCode}`

  const tierNames: Record<string, string> = {
    free: '免費體驗',
    self_managed: '自主管理方案',
    coached: '教練指導方案',
  }

  try {
    const resend = getResend()
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'Howard Protocol <onboarding@resend.dev>'

    const { error } = await resend.emails.send({
      from: fromEmail,
      to,
      subject: `歡迎加入 Howard Protocol！你的專屬儀表板已開通`,
      html: buildWelcomeEmailHTML({
        name,
        uniqueCode,
        dashboardUrl,
        tierName: tierNames[tier] || tier,
      }),
    })

    if (error) {
      log.error('Resend error', error)
      return { success: false, error: error.message }
    }

    log.info('Welcome email sent', { to })
    return { success: true }
  } catch (err: any) {
    log.error('Welcome send failed', err)
    return { success: false, error: err?.message || 'Unknown error' }
  }
}

function buildWelcomeEmailHTML({
  name,
  uniqueCode,
  dashboardUrl,
  tierName,
}: {
  name: string
  uniqueCode: string
  dashboardUrl: string
  tierName: string
}): string {
  return `<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>歡迎加入</title>
</head>
<body style="margin:0; padding:0; background-color:#f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px; margin:0 auto; background-color:#ffffff;">
    <tr>
      <td style="background: linear-gradient(135deg, #1e3a5f, #2563eb); padding: 40px 30px; text-align: center;">
        <h1 style="color:#ffffff; font-size:24px; margin:0 0 8px 0;">歡迎加入 Howard Protocol</h1>
        <p style="color:rgba(255,255,255,0.8); font-size:14px; margin:0;">${escapeHTML(name)}，你的帳號已開通！</p>
      </td>
    </tr>
    <tr>
      <td style="padding: 40px 30px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc; border-radius:12px; border:1px solid #e2e8f0;">
          <tr>
            <td style="padding: 30px; text-align:center;">
              <p style="font-size:13px; color:#64748b; margin:0 0 8px 0;">你的方案</p>
              <p style="font-size:18px; color:#1e3a5f; font-weight:bold; margin:0 0 20px 0;">${escapeHTML(tierName)}</p>
              <p style="font-size:13px; color:#64748b; margin:0 0 8px 0;">你的專屬代碼</p>
              <p style="font-size:28px; color:#2563eb; font-weight:bold; font-family:monospace; letter-spacing:2px; margin:0 0 24px 0;">${escapeHTML(uniqueCode)}</p>
              <a href="${escapeHTML(dashboardUrl)}"
                 style="display:inline-block; background:linear-gradient(135deg, #1e3a5f, #2563eb); color:#ffffff; padding:14px 40px; border-radius:10px; text-decoration:none; font-weight:bold; font-size:16px;">
                進入你的儀表板
              </a>
              <p style="font-size:11px; color:#94a3b8; margin:16px 0 0 0;">
                請保存此代碼，之後登入只需在網址列輸入即可
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding: 0 30px 30px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0fdf4; border-radius:12px; border:1px solid #bbf7d0;">
          <tr>
            <td style="padding: 20px 24px; text-align:center;">
              <p style="font-size:14px; color:#166534; margin:0 0 4px 0; font-weight:500;">
                有任何問題？加 LINE 直接聊
              </p>
              <p style="font-size:12px; color:#4ade80; margin:0;">
                LINE ID: @chenhoward
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding: 20px 30px; border-top: 1px solid #e2e8f0; text-align:center;">
        <p style="font-size:11px; color:#94a3b8; margin:0;">
          &copy; Howard Protocol &middot; howardprotocol.com
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`
}

/**
 * 購買成功信 HTML 模板
 */
function buildPurchaseEmailHTML({
  downloadUrl,
  successUrl,
}: {
  downloadUrl: string
  successUrl: string
}): string {
  return `<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>購買成功</title>
</head>
<body style="margin:0; padding:0; background-color:#f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px; margin:0 auto; background-color:#ffffff;">
    <!-- Header -->
    <tr>
      <td style="background: linear-gradient(135deg, #1e3a5f, #2563eb); padding: 40px 30px; text-align: center;">
        <h1 style="color:#ffffff; font-size:24px; margin:0 0 8px 0;">購買成功 ✅</h1>
        <p style="color:rgba(255,255,255,0.8); font-size:14px; margin:0;">感謝你的支持！你的電子書已準備好下載。</p>
      </td>
    </tr>

    <!-- Download Section -->
    <tr>
      <td style="padding: 40px 30px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc; border-radius:12px; border:1px solid #e2e8f0;">
          <tr>
            <td style="padding: 30px; text-align:center;">
              <p style="font-size:16px; color:#334155; margin:0 0 8px 0; font-weight:600;">
                System Reboot
              </p>
              <p style="font-size:13px; color:#64748b; margin:0 0 24px 0;">
                睡眠與神經系統優化實戰手冊
              </p>
              <a href="${downloadUrl}"
                 style="display:inline-block; background:linear-gradient(135deg, #1e3a5f, #2563eb); color:#ffffff; padding:14px 40px; border-radius:10px; text-decoration:none; font-weight:bold; font-size:16px;">
                📥 下載電子書
              </a>
              <p style="font-size:11px; color:#94a3b8; margin:16px 0 0 0;">
                PDF · 11 頁 · 可下載 20 次
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Full Report Link -->
    <tr>
      <td style="padding: 0 30px 30px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#eff6ff; border-radius:12px; border:1px solid #bfdbfe;">
          <tr>
            <td style="padding: 20px 24px; text-align:center;">
              <p style="font-size:14px; color:#1e40af; margin:0 0 12px 0; font-weight:500;">
                📊 你的完整分析報告也可以在這裡查看
              </p>
              <a href="${successUrl}"
                 style="display:inline-block; background:#ffffff; color:#2563eb; padding:10px 24px; border-radius:8px; text-decoration:none; font-weight:600; font-size:14px; border:1px solid #bfdbfe;">
                查看分析報告 →
              </a>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- LINE Upsell -->
    <tr>
      <td style="padding: 0 30px 40px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0fdf4; border-radius:12px; border:1px solid #bbf7d0;">
          <tr>
            <td style="padding: 20px 24px; text-align:center;">
              <p style="font-size:14px; color:#166534; margin:0 0 4px 0; font-weight:500;">
                想讓數據每週自動校正？
              </p>
              <p style="font-size:12px; color:#4ade80; margin:0;">
                加 LINE 了解訂閱方案，搭配 CSCS 教練每週監督 💬
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Footer -->
    <tr>
      <td style="padding: 20px 30px; border-top: 1px solid #e2e8f0; text-align:center;">
        <p style="font-size:11px; color:#94a3b8; margin:0 0 4px 0;">
          此為系統自動發送的信件，請勿直接回覆。
        </p>
        <p style="font-size:11px; color:#94a3b8; margin:0;">
          © Howard Protocol · howardprotocol.com
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`
}

// ===== Day 3 參與提醒信 =====

interface SendDay3EmailParams {
  to: string
  name: string
  uniqueCode: string
}

/**
 * Day 3：提醒持續記錄體重，TDEE 校正在第 14 天後啟動
 */
export async function sendDay3Email({
  to,
  name,
  uniqueCode,
}: SendDay3EmailParams): Promise<{ success: boolean; error?: string }> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://howardprotocol.com'
  const dashboardUrl = `${siteUrl}/c/${uniqueCode}`

  try {
    const resend = getResend()
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'Howard Protocol <onboarding@resend.dev>'

    const { error } = await resend.emails.send({
      from: fromEmail,
      to,
      subject: `${name}，第 3 天了！持續記錄是關鍵`,
      html: buildDay3EmailHTML({ name, dashboardUrl }),
    })

    if (error) {
      log.error('Resend error', error)
      return { success: false, error: error.message }
    }

    log.info('Day3 email sent', { to })
    return { success: true }
  } catch (err: any) {
    log.error('Day3 send failed', err)
    return { success: false, error: err?.message || 'Unknown error' }
  }
}

function buildDay3EmailHTML({
  name,
  dashboardUrl,
}: {
  name: string
  dashboardUrl: string
}): string {
  return `<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>第 3 天提醒</title>
</head>
<body style="margin:0; padding:0; background-color:#f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px; margin:0 auto; background-color:#ffffff;">
    <tr>
      <td style="background: linear-gradient(135deg, #1e3a5f, #2563eb); padding: 40px 30px; text-align: center;">
        <h1 style="color:#ffffff; font-size:24px; margin:0 0 8px 0;">第 3 天，做得好！</h1>
        <p style="color:rgba(255,255,255,0.8); font-size:14px; margin:0;">${escapeHTML(name)}，持續記錄就是最大的進步</p>
      </td>
    </tr>
    <tr>
      <td style="padding: 40px 30px;">
        <p style="font-size:15px; color:#334155; line-height:1.7; margin:0 0 16px 0;">
          嗨 ${escapeHTML(name)}，
        </p>
        <p style="font-size:15px; color:#334155; line-height:1.7; margin:0 0 16px 0;">
          你已經加入 Howard Protocol 第 3 天了。不管你目前記錄了幾天，最重要的是<strong>每天記錄體重</strong>——這是所有數據分析的基礎。
        </p>
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#eff6ff; border-radius:12px; border:1px solid #bfdbfe; margin:0 0 24px 0;">
          <tr>
            <td style="padding: 20px 24px;">
              <p style="font-size:14px; color:#1e40af; margin:0 0 8px 0; font-weight:600;">
                為什麼前 14 天很重要？
              </p>
              <p style="font-size:13px; color:#334155; line-height:1.6; margin:0;">
                系統需要至少 14 天的體重數據來校正你的 TDEE（每日總消耗熱量）。數據越完整，校正結果越準確。堅持記錄，第 14 天後系統將自動啟動 TDEE 校正。
              </p>
            </td>
          </tr>
        </table>
        <p style="text-align:center;">
          <a href="${escapeHTML(dashboardUrl)}"
             style="display:inline-block; background:linear-gradient(135deg, #1e3a5f, #2563eb); color:#ffffff; padding:14px 40px; border-radius:10px; text-decoration:none; font-weight:bold; font-size:16px;">
            前往記錄體重
          </a>
        </p>
      </td>
    </tr>
    <tr>
      <td style="padding: 0 30px 30px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0fdf4; border-radius:12px; border:1px solid #bbf7d0;">
          <tr>
            <td style="padding: 20px 24px; text-align:center;">
              <p style="font-size:14px; color:#166534; margin:0 0 4px 0; font-weight:500;">
                有任何問題？加 LINE 直接聊
              </p>
              <p style="font-size:12px; color:#4ade80; margin:0;">
                LINE ID: @chenhoward
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding: 20px 30px; border-top: 1px solid #e2e8f0; text-align:center;">
        <p style="font-size:11px; color:#94a3b8; margin:0;">
          &copy; Howard Protocol &middot; howardprotocol.com
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`
}

// ===== Day 7 里程碑信 =====

interface SendDay7EmailParams {
  to: string
  name: string
  uniqueCode: string
}

/**
 * Day 7：恭喜一週里程碑，介紹升級方案的好處（AI 教練、訓練追蹤）
 */
export async function sendDay7Email({
  to,
  name,
  uniqueCode,
}: SendDay7EmailParams): Promise<{ success: boolean; error?: string }> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://howardprotocol.com'
  const dashboardUrl = `${siteUrl}/c/${uniqueCode}`

  try {
    const resend = getResend()
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'Howard Protocol <onboarding@resend.dev>'

    const { error } = await resend.emails.send({
      from: fromEmail,
      to,
      subject: `恭喜 ${name}！你已持續追蹤一週`,
      html: buildDay7EmailHTML({ name, dashboardUrl }),
    })

    if (error) {
      log.error('Resend error', error)
      return { success: false, error: error.message }
    }

    log.info('Day7 email sent', { to })
    return { success: true }
  } catch (err: any) {
    log.error('Day7 send failed', err)
    return { success: false, error: err?.message || 'Unknown error' }
  }
}

function buildDay7EmailHTML({
  name,
  dashboardUrl,
}: {
  name: string
  dashboardUrl: string
}): string {
  return `<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>一週里程碑</title>
</head>
<body style="margin:0; padding:0; background-color:#f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px; margin:0 auto; background-color:#ffffff;">
    <tr>
      <td style="background: linear-gradient(135deg, #1e3a5f, #2563eb); padding: 40px 30px; text-align: center;">
        <h1 style="color:#ffffff; font-size:24px; margin:0 0 8px 0;">一週達成！</h1>
        <p style="color:rgba(255,255,255,0.8); font-size:14px; margin:0;">${escapeHTML(name)}，你已經比大多數人更有紀律</p>
      </td>
    </tr>
    <tr>
      <td style="padding: 40px 30px;">
        <p style="font-size:15px; color:#334155; line-height:1.7; margin:0 0 16px 0;">
          嗨 ${escapeHTML(name)}，
        </p>
        <p style="font-size:15px; color:#334155; line-height:1.7; margin:0 0 24px 0;">
          恭喜你完成了第一週的追蹤！持續記錄本身就是一種成就。再堅持一週，系統就能開始為你校正 TDEE。
        </p>
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc; border-radius:12px; border:1px solid #e2e8f0; margin:0 0 24px 0;">
          <tr>
            <td style="padding: 24px;">
              <p style="font-size:15px; color:#1e3a5f; margin:0 0 16px 0; font-weight:600;">
                想讓進步更快？升級方案解鎖更多功能：
              </p>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:8px 0;">
                    <p style="font-size:14px; color:#334155; margin:0;">
                      <span style="color:#2563eb; font-weight:bold;">AI 教練回饋</span> — 根據你的數據趨勢，自動給出飲食與訓練建議
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:8px 0;">
                    <p style="font-size:14px; color:#334155; margin:0;">
                      <span style="color:#2563eb; font-weight:bold;">訓練追蹤</span> — 記錄每次訓練，搭配體重與熱量數據做全面分析
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:8px 0;">
                    <p style="font-size:14px; color:#334155; margin:0;">
                      <span style="color:#2563eb; font-weight:bold;">進階圖表</span> — 7 天移動平均、體重變化率等深度分析
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
        <p style="text-align:center;">
          <a href="${escapeHTML(dashboardUrl)}"
             style="display:inline-block; background:linear-gradient(135deg, #1e3a5f, #2563eb); color:#ffffff; padding:14px 40px; border-radius:10px; text-decoration:none; font-weight:bold; font-size:16px;">
            查看你的儀表板
          </a>
        </p>
      </td>
    </tr>
    <tr>
      <td style="padding: 0 30px 30px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0fdf4; border-radius:12px; border:1px solid #bbf7d0;">
          <tr>
            <td style="padding: 20px 24px; text-align:center;">
              <p style="font-size:14px; color:#166534; margin:0 0 4px 0; font-weight:500;">
                有任何問題？加 LINE 直接聊
              </p>
              <p style="font-size:12px; color:#4ade80; margin:0;">
                LINE ID: @chenhoward
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding: 20px 30px; border-top: 1px solid #e2e8f0; text-align:center;">
        <p style="font-size:11px; color:#94a3b8; margin:0;">
          &copy; Howard Protocol &middot; howardprotocol.com
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`
}

// ===== 訂閱到期提醒信 =====

interface SendExpiryWarningEmailParams {
  to: string
  name: string
  daysLeft: number
  tier: string
}

/**
 * 訂閱即將自動續訂提醒（到期前 7 天 / 3 天 / 1 天）
 */
export async function sendExpiryWarningEmail({
  to,
  name,
  daysLeft,
  tier,
}: SendExpiryWarningEmailParams): Promise<{ success: boolean; error?: string }> {
  const tierNames: Record<string, string> = {
    free: '免費體驗',
    self_managed: '自主管理方案',
    coached: '教練指導方案',
  }

  try {
    const resend = getResend()
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'Howard Protocol <onboarding@resend.dev>'

    const renewLabel = daysLeft <= 1 ? '明天' : `${daysLeft} 天後`

    const { error } = await resend.emails.send({
      from: fromEmail,
      to,
      subject: `${name}，你的方案將在${renewLabel}自動續訂`,
      html: buildExpiryWarningEmailHTML({
        name,
        daysLeft,
        tierName: tierNames[tier] || tier,
      }),
    })

    if (error) {
      log.error('Resend error', error)
      return { success: false, error: error.message }
    }

    log.info('Expiry warning email sent', { to, daysLeft })
    return { success: true }
  } catch (err: any) {
    log.error('Expiry warning send failed', err)
    return { success: false, error: err?.message || 'Unknown error' }
  }
}

function buildExpiryWarningEmailHTML({
  name,
  daysLeft,
  tierName,
}: {
  name: string
  daysLeft: number
  tierName: string
}): string {
  const renewLabel = daysLeft <= 1 ? '明天' : `${daysLeft} 天後`

  return `<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>自動續訂通知</title>
</head>
<body style="margin:0; padding:0; background-color:#f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px; margin:0 auto; background-color:#ffffff;">
    <tr>
      <td style="background: linear-gradient(135deg, #1e3a5f, #2563eb); padding: 40px 30px; text-align: center;">
        <h1 style="color:#ffffff; font-size:24px; margin:0 0 8px 0;">自動續訂通知</h1>
        <p style="color:rgba(255,255,255,0.8); font-size:14px; margin:0;">${escapeHTML(name)}，你的方案即將自動續訂</p>
      </td>
    </tr>
    <tr>
      <td style="padding: 40px 30px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc; border-radius:12px; border:1px solid #e2e8f0; margin:0 0 24px 0;">
          <tr>
            <td style="padding: 30px; text-align:center;">
              <p style="font-size:13px; color:#64748b; margin:0 0 8px 0;">目前方案</p>
              <p style="font-size:18px; color:#1e3a5f; font-weight:bold; margin:0 0 16px 0;">${escapeHTML(tierName)}</p>
              <p style="font-size:13px; color:#64748b; margin:0 0 8px 0;">下次扣款</p>
              <p style="font-size:32px; color:#2563eb; font-weight:bold; margin:0;">${escapeHTML(renewLabel)}</p>
            </td>
          </tr>
        </table>
        <p style="font-size:15px; color:#334155; line-height:1.7; margin:0 0 16px 0;">
          系統將自動從你的信用卡扣款，無需手動操作。扣款成功後方案會自動延長一個月。
        </p>
        <p style="font-size:15px; color:#334155; line-height:1.7; margin:0 0 24px 0;">
          如需取消自動扣款，請至儀表板右上角設定中操作。取消後仍可使用至當期到期日。
        </p>
      </td>
    </tr>
    <tr>
      <td style="padding: 0 30px 30px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0fdf4; border-radius:12px; border:1px solid #bbf7d0;">
          <tr>
            <td style="padding: 20px 24px; text-align:center;">
              <p style="font-size:14px; color:#166534; margin:0 0 4px 0; font-weight:500;">
                有任何問題？加 LINE 直接聊
              </p>
              <p style="font-size:12px; color:#4ade80; margin:0;">
                LINE ID: @chenhoward
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding: 20px 30px; border-top: 1px solid #e2e8f0; text-align:center;">
        <p style="font-size:11px; color:#94a3b8; margin:0;">
          &copy; Howard Protocol &middot; howardprotocol.com
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`
}

// ===== 取消訂閱確認信 =====

interface SendCancellationEmailParams {
  to: string
  name: string
  tier: string
  expiresAt: string
}

export async function sendCancellationEmail({
  to,
  name,
  tier,
  expiresAt,
}: SendCancellationEmailParams): Promise<{ success: boolean; error?: string }> {
  const tierNames: Record<string, string> = {
    free: '免費體驗',
    self_managed: '自主管理方案',
    coached: '教練指導方案',
  }

  const expiryDate = new Date(expiresAt).toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' })

  try {
    const resend = getResend()
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'Howard Protocol <onboarding@resend.dev>'

    const { error } = await resend.emails.send({
      from: fromEmail,
      to,
      subject: `已取消定期扣款 — 帳號可使用至 ${expiryDate}`,
      html: buildCancellationEmailHTML({
        name,
        tierName: tierNames[tier] || tier,
        expiryDate,
      }),
    })

    if (error) {
      log.error('Resend error', error)
      return { success: false, error: error.message }
    }

    log.info('Cancellation email sent', { to })
    return { success: true }
  } catch (err: any) {
    log.error('Cancellation send failed', err)
    return { success: false, error: err?.message || 'Unknown error' }
  }
}

function buildCancellationEmailHTML({
  name,
  tierName,
  expiryDate,
}: {
  name: string
  tierName: string
  expiryDate: string
}): string {
  return `<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>取消訂閱確認</title>
</head>
<body style="margin:0; padding:0; background-color:#f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px; margin:0 auto; background-color:#ffffff;">
    <tr>
      <td style="background: linear-gradient(135deg, #1e3a5f, #2563eb); padding: 40px 30px; text-align: center;">
        <h1 style="color:#ffffff; font-size:24px; margin:0 0 8px 0;">已取消定期扣款</h1>
        <p style="color:rgba(255,255,255,0.8); font-size:14px; margin:0;">${escapeHTML(name)}，你的帳號仍可繼續使用</p>
      </td>
    </tr>
    <tr>
      <td style="padding: 40px 30px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc; border-radius:12px; border:1px solid #e2e8f0; margin:0 0 24px 0;">
          <tr>
            <td style="padding: 30px; text-align:center;">
              <p style="font-size:13px; color:#64748b; margin:0 0 8px 0;">原訂閱方案</p>
              <p style="font-size:18px; color:#1e3a5f; font-weight:bold; margin:0 0 16px 0;">${escapeHTML(tierName)}</p>
              <p style="font-size:13px; color:#64748b; margin:0 0 8px 0;">可使用至</p>
              <p style="font-size:24px; color:#2563eb; font-weight:bold; margin:0;">${escapeHTML(expiryDate)}</p>
            </td>
          </tr>
        </table>
        <p style="font-size:15px; color:#334155; line-height:1.7; margin:0 0 16px 0;">
          已停止自動扣款，之後不會再從你的信用卡扣款。
        </p>
        <p style="font-size:15px; color:#334155; line-height:1.7; margin:0 0 16px 0;">
          在到期日之前，你仍可正常使用所有功能。到期後帳號會降級為免費方案，<strong>所有歷史數據都會完整保留</strong>。
        </p>
        <p style="font-size:15px; color:#334155; line-height:1.7; margin:0 0 24px 0;">
          如果改變主意，隨時可以重新訂閱，資料會立即恢復。
        </p>
      </td>
    </tr>
    <tr>
      <td style="padding: 0 30px 30px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0fdf4; border-radius:12px; border:1px solid #bbf7d0;">
          <tr>
            <td style="padding: 20px 24px; text-align:center;">
              <p style="font-size:14px; color:#166534; margin:0 0 4px 0; font-weight:500;">
                有任何問題？加 LINE 直接聊
              </p>
              <p style="font-size:12px; color:#4ade80; margin:0;">
                LINE ID: @chenhoward
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding: 20px 30px; border-top: 1px solid #e2e8f0; text-align:center;">
        <p style="font-size:11px; color:#94a3b8; margin:0;">
          &copy; Howard Protocol &middot; howardprotocol.com
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`
}

// ===== 流失用戶挽回信 =====

interface SendWinBackEmailParams {
  to: string
  name: string
}

/**
 * Win-back：流失用戶挽回，強調數據仍保留，歡迎回來繼續
 */
export async function sendWinBackEmail({
  to,
  name,
}: SendWinBackEmailParams): Promise<{ success: boolean; error?: string }> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://howardprotocol.com'
  const pricingUrl = `${siteUrl}/pricing`

  try {
    const resend = getResend()
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'Howard Protocol <onboarding@resend.dev>'

    const { error } = await resend.emails.send({
      from: fromEmail,
      to,
      subject: `${name}，你的數據還在等你回來`,
      html: buildWinBackEmailHTML({ name, pricingUrl }),
    })

    if (error) {
      log.error('Resend error', error)
      return { success: false, error: error.message }
    }

    log.info('Win-back email sent', { to })
    return { success: true }
  } catch (err: any) {
    log.error('Win-back send failed', err)
    return { success: false, error: err?.message || 'Unknown error' }
  }
}

function buildWinBackEmailHTML({
  name,
  pricingUrl,
}: {
  name: string
  pricingUrl: string
}): string {
  return `<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>歡迎回來</title>
</head>
<body style="margin:0; padding:0; background-color:#f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px; margin:0 auto; background-color:#ffffff;">
    <tr>
      <td style="background: linear-gradient(135deg, #1e3a5f, #2563eb); padding: 40px 30px; text-align: center;">
        <h1 style="color:#ffffff; font-size:24px; margin:0 0 8px 0;">我們幫你保留了一切</h1>
        <p style="color:rgba(255,255,255,0.8); font-size:14px; margin:0;">${escapeHTML(name)}，你的數據隨時可以繼續使用</p>
      </td>
    </tr>
    <tr>
      <td style="padding: 40px 30px;">
        <p style="font-size:15px; color:#334155; line-height:1.7; margin:0 0 16px 0;">
          嗨 ${escapeHTML(name)}，
        </p>
        <p style="font-size:15px; color:#334155; line-height:1.7; margin:0 0 16px 0;">
          好一陣子沒看到你了。想讓你知道，你之前記錄的所有體重、飲食和訓練數據都完整保留著，隨時可以繼續。
        </p>
        <p style="font-size:15px; color:#334155; line-height:1.7; margin:0 0 24px 0;">
          體態管理是一場長期的過程，中間暫停完全沒關係。重要的是，當你準備好了，一切都還在原地等你。
        </p>
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc; border-radius:12px; border:1px solid #e2e8f0; margin:0 0 24px 0;">
          <tr>
            <td style="padding: 24px;">
              <p style="font-size:15px; color:#1e3a5f; margin:0 0 16px 0; font-weight:600;">
                回來後你可以：
              </p>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:6px 0;">
                    <p style="font-size:14px; color:#334155; margin:0;">
                      &#10003; 接續之前的數據繼續追蹤
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:6px 0;">
                    <p style="font-size:14px; color:#334155; margin:0;">
                      &#10003; 立即恢復 TDEE 校正與趨勢分析
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:6px 0;">
                    <p style="font-size:14px; color:#334155; margin:0;">
                      &#10003; 使用 AI 教練獲得個人化建議
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
        <p style="text-align:center;">
          <a href="${escapeHTML(pricingUrl)}"
             style="display:inline-block; background:linear-gradient(135deg, #1e3a5f, #2563eb); color:#ffffff; padding:14px 40px; border-radius:10px; text-decoration:none; font-weight:bold; font-size:16px;">
            重新開始
          </a>
        </p>
      </td>
    </tr>
    <tr>
      <td style="padding: 0 30px 30px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0fdf4; border-radius:12px; border:1px solid #bbf7d0;">
          <tr>
            <td style="padding: 20px 24px; text-align:center;">
              <p style="font-size:14px; color:#166534; margin:0 0 4px 0; font-weight:500;">
                有任何問題？加 LINE 直接聊
              </p>
              <p style="font-size:12px; color:#4ade80; margin:0;">
                LINE ID: @chenhoward
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding: 20px 30px; border-top: 1px solid #e2e8f0; text-align:center;">
        <p style="font-size:11px; color:#94a3b8; margin:0;">
          &copy; Howard Protocol &middot; howardprotocol.com
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`
}
