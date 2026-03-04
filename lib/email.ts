import { Resend } from 'resend'

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
  const downloadUrl = `${siteUrl}/api/ebook/download?token=${downloadToken}`
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
      console.error('[email] Resend error:', error)
      return { success: false, error: error.message }
    }

    console.log(`[email] Purchase email sent to ${to}`)
    return { success: true }
  } catch (err: any) {
    console.error('[email] Send failed:', err?.message || err)
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
    self_managed: '自主管理方案',
    coached: '教練指導方案',
    combo: '全方位方案',
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
      console.error('[email] Resend error:', error)
      return { success: false, error: error.message }
    }

    console.log(`[email] Welcome email sent to ${to}`)
    return { success: true }
  } catch (err: any) {
    console.error('[email] Welcome send failed:', err?.message || err)
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
        <p style="color:rgba(255,255,255,0.8); font-size:14px; margin:0;">${name}，你的帳號已開通！</p>
      </td>
    </tr>
    <tr>
      <td style="padding: 40px 30px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc; border-radius:12px; border:1px solid #e2e8f0;">
          <tr>
            <td style="padding: 30px; text-align:center;">
              <p style="font-size:13px; color:#64748b; margin:0 0 8px 0;">你的方案</p>
              <p style="font-size:18px; color:#1e3a5f; font-weight:bold; margin:0 0 20px 0;">${tierName}</p>
              <p style="font-size:13px; color:#64748b; margin:0 0 8px 0;">你的專屬代碼</p>
              <p style="font-size:28px; color:#2563eb; font-weight:bold; font-family:monospace; letter-spacing:2px; margin:0 0 24px 0;">${uniqueCode}</p>
              <a href="${dashboardUrl}"
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
