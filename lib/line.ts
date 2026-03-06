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

export type LineMessage =
  | { type: 'text'; text: string }
  | { type: 'flex'; altText: string; contents: object }
