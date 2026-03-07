import crypto from 'crypto'

const LINE_CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET!
const LINE_CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN!

/** 驗證 LINE Webhook 簽名 */
export function verifyLineSignature(body: string, signature: string): boolean {
  const hash = crypto
    .createHmac('SHA256', LINE_CHANNEL_SECRET)
    .update(body)
    .digest('base64')
  return hash === signature
}

/** 呼叫 LINE Messaging API */
async function lineAPI(path: string, body?: object): Promise<Response> {
  return fetch(`https://api.line.me/v2/bot${path}`, {
    method: body ? 'POST' : 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
}

/** 回覆訊息 */
export async function replyMessage(replyToken: string, messages: LineMessage[]) {
  return lineAPI('/message/reply', { replyToken, messages })
}

/** 推播訊息給特定用戶 */
export async function pushMessage(to: string, messages: LineMessage[]) {
  return lineAPI('/message/push', { to, messages })
}

/** 取得用戶 profile */
export async function getUserProfile(userId: string): Promise<{ displayName: string; pictureUrl?: string } | null> {
  const res = await lineAPI(`/profile/${userId}`)
  if (!res.ok) return null
  return res.json()
}

export type QuickReplyItem = {
  type: 'action'
  action: { type: 'message'; label: string; text: string }
}

export type LineMessage =
  | { type: 'text'; text: string; quickReply?: { items: QuickReplyItem[] } }
  | { type: 'flex'; altText: string; contents: object; quickReply?: { items: QuickReplyItem[] } }

/** 建立 Quick Reply 按鈕 */
export function qr(label: string, text: string): QuickReplyItem {
  return { type: 'action', action: { type: 'message', label, text } }
}

// ═══════════════════════════════════════
// Rich Menu API
// ═══════════════════════════════════════

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://howard456.vercel.app'
const COOLDAY_LINE_URL = 'https://lin.ee/AVAjZ2n'

/** Rich Menu 定義 (2x3, 2500x1686) */
export function getRichMenuObject() {
  return {
    size: { width: 2500, height: 1686 },
    selected: true,
    name: 'Howard Protocol Main Menu',
    chatBarText: '點我開啟選單',
    areas: [
      // Row 1
      {
        bounds: { x: 0, y: 0, width: 833, height: 843 },
        action: { type: 'postback', label: '免費健身教學', data: 'action=free_tutorial', displayText: '免費健身教學' },
      },
      {
        bounds: { x: 833, y: 0, width: 834, height: 843 },
        action: { type: 'postback', label: '免費體態評估', data: 'action=body_assessment', displayText: '免費體態評估' },
      },
      {
        bounds: { x: 1667, y: 0, width: 833, height: 843 },
        action: { type: 'uri', label: '線上方案', uri: `${SITE_URL}/join` },
      },
      // Row 2
      {
        bounds: { x: 0, y: 843, width: 833, height: 843 },
        action: { type: 'uri', label: '實體教練課', uri: COOLDAY_LINE_URL },
      },
      {
        bounds: { x: 833, y: 843, width: 834, height: 843 },
        action: { type: 'uri', label: '關於我們', uri: SITE_URL },
      },
      {
        bounds: { x: 1667, y: 843, width: 833, height: 843 },
        action: { type: 'postback', label: '聯繫客服', data: 'action=contact_support', displayText: '聯繫客服' },
      },
    ],
  }
}

/** 建立 Rich Menu */
export async function createRichMenu(menuObject: object): Promise<string | null> {
  const res = await lineAPI('/richmenu', menuObject)
  if (!res.ok) {
    console.error('Create rich menu failed:', await res.text())
    return null
  }
  const data = await res.json()
  return data.richMenuId
}

/** 上傳 Rich Menu 圖片 */
export async function uploadRichMenuImage(richMenuId: string, imageBuffer: Blob, contentType: string = 'image/png'): Promise<boolean> {
  const res = await fetch(`https://api-data.line.me/v2/bot/richmenu/${richMenuId}/content`, {
    method: 'POST',
    headers: {
      'Content-Type': contentType,
      Authorization: `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`,
    },
    body: imageBuffer,
  })
  if (!res.ok) {
    console.error('Upload rich menu image failed:', await res.text())
    return false
  }
  return true
}

/** 設定預設 Rich Menu (所有用戶) */
export async function setDefaultRichMenu(richMenuId: string): Promise<boolean> {
  const res = await fetch(`https://api.line.me/v2/bot/user/all/richmenu/${richMenuId}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`,
    },
  })
  if (!res.ok) {
    console.error('Set default rich menu failed:', await res.text())
    return false
  }
  return true
}

/** 刪除 Rich Menu */
export async function deleteRichMenu(richMenuId: string): Promise<boolean> {
  const res = await fetch(`https://api.line.me/v2/bot/richmenu/${richMenuId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`,
    },
  })
  return res.ok
}

/** 取得所有 Rich Menu */
export async function listRichMenus(): Promise<any[]> {
  const res = await lineAPI('/richmenu/list')
  if (!res.ok) return []
  const data = await res.json()
  return data.richmenus || []
}
