import crypto from 'crypto'

function getLineChannelSecret(): string {
  const secret = process.env.LINE_CHANNEL_SECRET
  if (!secret) throw new Error('LINE_CHANNEL_SECRET 環境變數未設定')
  return secret
}

function getLineChannelAccessToken(): string {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN
  if (!token) throw new Error('LINE_CHANNEL_ACCESS_TOKEN 環境變數未設定')
  return token
}

/** 驗證 LINE Webhook 簽名 */
export function verifyLineSignature(body: string, signature: string): boolean {
  const hash = crypto
    .createHmac('SHA256', getLineChannelSecret())
    .update(body)
    .digest('base64')
  // 使用 timing-safe 比較防止 timing attack
  if (hash.length !== signature.length) return false
  try {
    return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(signature))
  } catch {
    return false
  }
}

/** 呼叫 LINE Messaging API（含重試機制） */
async function lineAPI(path: string, body?: object): Promise<Response> {
  const maxRetries = 3
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const res = await fetch(`https://api.line.me/v2/bot${path}`, {
      method: body ? 'POST' : 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getLineChannelAccessToken()}`,
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    })
    // Don't retry client errors (4xx) except 429 (rate limit)
    if (res.ok) {
      return res
    }
    if (res.status >= 400 && res.status < 500 && res.status !== 429) {
      console.error(`[LINE API] ${path} failed with status ${res.status}`)
      return res
    }
    // Retry on 429, 5xx with exponential backoff
    if (attempt < maxRetries - 1) {
      const delay = Math.min(1000 * Math.pow(2, attempt), 4000)
      await new Promise(resolve => setTimeout(resolve, delay))
    } else {
      console.error(`[LINE API] ${path} failed after ${maxRetries} retries, status ${res.status}`)
      return res // Return last failed response
    }
  }
  // TypeScript: unreachable but satisfy compiler
  throw new Error('LINE API retry exhausted')
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

/** Rich Menu — 行銷版 (未綁定/免費用戶) */
export function getMarketingRichMenuObject() {
  return {
    size: { width: 2500, height: 1686 },
    selected: true,
    name: 'Howard Protocol — 行銷版',
    chatBarText: '點我開啟選單',
    areas: [
      // Row 1
      {
        bounds: { x: 0, y: 0, width: 833, height: 843 },
        action: { type: 'uri', label: '免費健身教學', uri: `${SITE_URL}/blog` },
      },
      {
        bounds: { x: 833, y: 0, width: 834, height: 843 },
        action: { type: 'uri', label: '免費評估', uri: `${SITE_URL}/diagnosis` },
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

/** Rich Menu — 日常操作版 (已綁定付費用戶) */
export function getMemberRichMenuObject() {
  return {
    size: { width: 2500, height: 1686 },
    selected: true,
    name: 'Howard Protocol — 學員版',
    chatBarText: '📋 快速記錄',
    areas: [
      // Row 1: 記錄動作 + 儀表板
      {
        bounds: { x: 0, y: 0, width: 833, height: 843 },
        action: { type: 'message', label: '記體重', text: '記體重' },
      },
      {
        bounds: { x: 833, y: 0, width: 834, height: 843 },
        action: { type: 'message', label: '記飲食', text: '記飲食' },
      },
      {
        bounds: { x: 1667, y: 0, width: 833, height: 843 },
        action: {
          type: 'uri',
          label: '我的儀表板',
          uri: 'https://howard456.vercel.app/?pwa=1&openExternalBrowser=1',
        },
      },
      // Row 2: 狀態 + 趨勢 + 客服
      {
        bounds: { x: 0, y: 843, width: 833, height: 843 },
        action: { type: 'message', label: '今日狀態', text: '狀態' },
      },
      {
        bounds: { x: 833, y: 843, width: 834, height: 843 },
        action: { type: 'message', label: '7天趨勢', text: '趨勢' },
      },
      {
        bounds: { x: 1667, y: 843, width: 833, height: 843 },
        action: { type: 'postback', label: '聯繫客服', data: 'action=contact_support', displayText: '聯繫客服' },
      },
    ],
  }
}

// 向下相容：舊的 getRichMenuObject 指向行銷版
export const getRichMenuObject = getMarketingRichMenuObject

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

/** 上傳 Rich Menu 圖片，成功回傳 true，失敗回傳錯誤訊息 */
export async function uploadRichMenuImage(richMenuId: string, imageBuffer: Blob, contentType: string = 'image/png'): Promise<true | string> {
  // LINE API 需要 raw binary，將 Blob 轉成 ArrayBuffer
  const arrayBuffer = await imageBuffer.arrayBuffer()

  // LINE 只接受 image/jpeg 或 image/png
  const safeContentType = contentType.includes('jpeg') || contentType.includes('jpg')
    ? 'image/jpeg'
    : 'image/png'

  const res = await fetch(`https://api-data.line.me/v2/bot/richmenu/${richMenuId}/content`, {
    method: 'POST',
    headers: {
      'Content-Type': safeContentType,
      'Content-Length': String(arrayBuffer.byteLength),
      Authorization: `Bearer ${getLineChannelAccessToken()}`,
    },
    body: arrayBuffer,
  })
  if (!res.ok) {
    const errorText = await res.text()
    console.error('Upload rich menu image failed:', res.status, errorText)
    return `HTTP ${res.status}: ${errorText}`
  }
  return true
}

/** 設定預設 Rich Menu (所有用戶) */
export async function setDefaultRichMenu(richMenuId: string): Promise<boolean> {
  const res = await fetch(`https://api.line.me/v2/bot/user/all/richmenu/${richMenuId}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${getLineChannelAccessToken()}`,
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
      Authorization: `Bearer ${getLineChannelAccessToken()}`,
    },
  })
  return res.ok
}

/** Rich Menu record from LINE API */
export interface LineRichMenu {
  richMenuId: string
  name?: string
  size?: { width: number; height: number }
  chatBarText?: string
  selected?: boolean
  areas?: Array<{ bounds: { x: number; y: number; width: number; height: number }; action: Record<string, string> }>
}

/** 取得所有 Rich Menu */
export async function listRichMenus(): Promise<LineRichMenu[]> {
  const res = await lineAPI('/richmenu/list')
  if (!res.ok) return []
  const data = await res.json()
  return data.richmenus || []
}

/** 綁定特定 Rich Menu 給某用戶 */
export async function linkRichMenuToUser(userId: string, richMenuId: string): Promise<boolean> {
  const res = await fetch(`https://api.line.me/v2/bot/user/${userId}/richmenu/${richMenuId}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${getLineChannelAccessToken()}`,
    },
  })
  if (!res.ok) {
    console.error('Link rich menu to user failed:', await res.text())
    return false
  }
  return true
}

/** 解除用戶的個人 Rich Menu（會回到預設 Rich Menu） */
export async function unlinkRichMenuFromUser(userId: string): Promise<boolean> {
  const res = await fetch(`https://api.line.me/v2/bot/user/${userId}/richmenu`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${getLineChannelAccessToken()}`,
    },
  })
  if (!res.ok) {
    console.error('Unlink rich menu from user failed:', await res.text())
    return false
  }
  return true
}

/** Rich Menu — 教練指導版 (coached 用戶專屬) */
export function getCoachedRichMenuObject() {
  return {
    size: { width: 2500, height: 1686 },
    selected: true,
    name: 'Howard Protocol — 教練版',
    chatBarText: '📋 教練專屬選單',
    areas: [
      // Row 1: 記錄動作
      {
        bounds: { x: 0, y: 0, width: 833, height: 843 },
        action: { type: 'message', label: '記體重', text: '記體重' },
      },
      {
        bounds: { x: 833, y: 0, width: 834, height: 843 },
        action: { type: 'message', label: '記飲食', text: '記飲食' },
      },
      {
        bounds: { x: 1667, y: 0, width: 833, height: 843 },
        action: { type: 'message', label: '記訓練', text: '記訓練' },
      },
      // Row 2: 教練專屬功能
      {
        bounds: { x: 0, y: 843, width: 833, height: 843 },
        action: { type: 'message', label: '補品打卡', text: '補品打卡' },
      },
      {
        bounds: { x: 833, y: 843, width: 834, height: 843 },
        action: { type: 'message', label: '問教練', text: '我想詢問問題' },
      },
      {
        bounds: { x: 1667, y: 843, width: 833, height: 843 },
        action: { type: 'uri', label: '我的儀表板', uri: `${SITE_URL}/dashboard` },
      },
    ],
  }
}

/**
 * 根據訂閱方案自動切換用戶的 Rich Menu
 *
 * 優先使用環境變數 RICH_MENU_MEMBER_ID / RICH_MENU_COACHED_ID，
 * 若未設定則自動搜尋已建立的 Rich Menu（用名稱比對）。
 *
 * - coached/self_managed: 綁定學員版（或教練版）Rich Menu
 * - free / 其他: 解除個人 Rich Menu，回到預設行銷版
 *
 * 此函式不會拋出錯誤（non-blocking），僅 console.error 記錄。
 */
export async function switchRichMenuForUser(lineUserId: string, tier: string): Promise<void> {
  try {
    if (tier === 'free' || (!tier)) {
      await unlinkRichMenuFromUser(lineUserId)
      return
    }

    // 優先用環境變數
    let menuId = tier === 'coached'
      ? (process.env.RICH_MENU_COACHED_ID || process.env.RICH_MENU_MEMBER_ID)
      : process.env.RICH_MENU_MEMBER_ID

    // 沒有環境變數 → 搜尋已建立的 Rich Menu（用名稱比對）
    if (!menuId) {
      const menus = await listRichMenus()
      if (tier === 'coached') {
        const coached = menus.find((m) => m.name?.includes('教練版'))
        const member = menus.find((m) => m.name?.includes('學員版'))
        menuId = coached?.richMenuId || member?.richMenuId
      } else {
        const member = menus.find((m) => m.name?.includes('學員版'))
        menuId = member?.richMenuId
      }
    }

    if (menuId) {
      await linkRichMenuToUser(lineUserId, menuId)
    }
  } catch (err) {
    console.error('[Rich Menu] Switch failed for user', lineUserId, 'tier', tier, ':', err)
  }
}
