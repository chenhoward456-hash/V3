/**
 * Garmin Health API - OAuth 1.0a + Data Sync
 *
 * Garmin 使用 OAuth 1.0a 授權流程：
 * 1. 取得 Request Token
 * 2. 導向用戶到 Garmin 授權頁
 * 3. Callback 取得 Verifier
 * 4. 換取 Access Token
 * 5. 用 Access Token 拉取健康數據
 */

import crypto from 'crypto'

const GARMIN_REQUEST_TOKEN_URL = 'https://connectapi.garmin.com/oauth-service/oauth/request_token'
const GARMIN_AUTHORIZE_URL = 'https://connect.garmin.com/oauthConfirm'
const GARMIN_ACCESS_TOKEN_URL = 'https://connectapi.garmin.com/oauth-service/oauth/access_token'
const GARMIN_API_BASE = 'https://apis.garmin.com/wellness-api/rest'

// ===== OAuth 1.0a Helpers =====

function percentEncode(str: string): string {
  return encodeURIComponent(str)
    .replace(/!/g, '%21')
    .replace(/\*/g, '%2A')
    .replace(/'/g, '%27')
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29')
}

function generateNonce(): string {
  return crypto.randomBytes(16).toString('hex')
}

function generateTimestamp(): string {
  return Math.floor(Date.now() / 1000).toString()
}

function buildBaseString(method: string, url: string, params: Record<string, string>): string {
  const sortedKeys = Object.keys(params).sort()
  const paramString = sortedKeys
    .map(key => `${percentEncode(key)}=${percentEncode(params[key])}`)
    .join('&')
  return `${method.toUpperCase()}&${percentEncode(url)}&${percentEncode(paramString)}`
}

function sign(baseString: string, consumerSecret: string, tokenSecret: string = ''): string {
  const signingKey = `${percentEncode(consumerSecret)}&${percentEncode(tokenSecret)}`
  return crypto.createHmac('sha1', signingKey).update(baseString).digest('base64')
}

function buildAuthHeader(params: Record<string, string>): string {
  const pairs = Object.keys(params)
    .sort()
    .map(key => `${percentEncode(key)}="${percentEncode(params[key])}"`)
    .join(', ')
  return `OAuth ${pairs}`
}

interface OAuthConfig {
  consumerKey: string
  consumerSecret: string
}

function getOAuthConfig(): OAuthConfig {
  const consumerKey = process.env.GARMIN_CONSUMER_KEY
  const consumerSecret = process.env.GARMIN_CONSUMER_SECRET
  if (!consumerKey || !consumerSecret) {
    throw new Error('Garmin API 尚未設定，請在環境變數中設定 GARMIN_CONSUMER_KEY 和 GARMIN_CONSUMER_SECRET')
  }
  return { consumerKey, consumerSecret }
}

// ===== OAuth Flow =====

export interface RequestTokenResult {
  oauthToken: string
  oauthTokenSecret: string
  authorizeUrl: string
}

/**
 * Step 1: 取得 Request Token 並回傳授權 URL
 */
export async function getRequestToken(callbackUrl: string): Promise<RequestTokenResult> {
  const { consumerKey, consumerSecret } = getOAuthConfig()

  const oauthParams: Record<string, string> = {
    oauth_consumer_key: consumerKey,
    oauth_nonce: generateNonce(),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: generateTimestamp(),
    oauth_version: '1.0',
    oauth_callback: callbackUrl,
  }

  const baseString = buildBaseString('POST', GARMIN_REQUEST_TOKEN_URL, oauthParams)
  oauthParams.oauth_signature = sign(baseString, consumerSecret)

  const res = await fetch(GARMIN_REQUEST_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Authorization': buildAuthHeader(oauthParams),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Garmin request token 失敗: ${res.status} ${text}`)
  }

  const body = await res.text()
  const params = new URLSearchParams(body)
  const oauthToken = params.get('oauth_token')
  const oauthTokenSecret = params.get('oauth_token_secret')

  if (!oauthToken || !oauthTokenSecret) {
    throw new Error('Garmin 回傳的 Request Token 格式錯誤')
  }

  return {
    oauthToken,
    oauthTokenSecret,
    authorizeUrl: `${GARMIN_AUTHORIZE_URL}?oauth_token=${oauthToken}`,
  }
}

/**
 * Step 2: 換取 Access Token (callback 回來後呼叫)
 */
export async function getAccessToken(
  oauthToken: string,
  oauthTokenSecret: string,
  oauthVerifier: string
): Promise<{ accessToken: string; accessTokenSecret: string }> {
  const { consumerKey, consumerSecret } = getOAuthConfig()

  const oauthParams: Record<string, string> = {
    oauth_consumer_key: consumerKey,
    oauth_nonce: generateNonce(),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: generateTimestamp(),
    oauth_token: oauthToken,
    oauth_verifier: oauthVerifier,
    oauth_version: '1.0',
  }

  const baseString = buildBaseString('POST', GARMIN_ACCESS_TOKEN_URL, oauthParams)
  oauthParams.oauth_signature = sign(baseString, consumerSecret, oauthTokenSecret)

  const res = await fetch(GARMIN_ACCESS_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Authorization': buildAuthHeader(oauthParams),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Garmin access token 失敗: ${res.status} ${text}`)
  }

  const body = await res.text()
  const params = new URLSearchParams(body)
  const accessToken = params.get('oauth_token')
  const accessTokenSecret = params.get('oauth_token_secret')

  if (!accessToken || !accessTokenSecret) {
    throw new Error('Garmin 回傳的 Access Token 格式錯誤')
  }

  return { accessToken, accessTokenSecret }
}

// ===== API Data Fetch =====

interface GarminApiOptions {
  accessToken: string
  accessTokenSecret: string
}

async function garminApiRequest(
  url: string,
  opts: GarminApiOptions,
  queryParams?: Record<string, string>
): Promise<any> {
  const { consumerKey, consumerSecret } = getOAuthConfig()

  const fullUrl = queryParams
    ? `${url}?${new URLSearchParams(queryParams).toString()}`
    : url

  // For signature, we need the base URL without query params, but include query params in the signing
  const allParams: Record<string, string> = {
    oauth_consumer_key: consumerKey,
    oauth_nonce: generateNonce(),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: generateTimestamp(),
    oauth_token: opts.accessToken,
    oauth_version: '1.0',
    ...(queryParams || {}),
  }

  const baseString = buildBaseString('GET', url, allParams)
  const oauthOnly: Record<string, string> = {
    oauth_consumer_key: consumerKey,
    oauth_nonce: allParams.oauth_nonce,
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: allParams.oauth_timestamp,
    oauth_token: opts.accessToken,
    oauth_version: '1.0',
    oauth_signature: sign(baseString, consumerSecret, opts.accessTokenSecret),
  }

  const res = await fetch(fullUrl, {
    method: 'GET',
    headers: {
      'Authorization': buildAuthHeader(oauthOnly),
    },
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Garmin API 錯誤: ${res.status} ${text}`)
  }

  return res.json()
}

export interface GarminDailySummary {
  date: string
  device_recovery_score: number | null
  resting_hr: number | null
  hrv: number | null
  wearable_sleep_score: number | null
  respiratory_rate: number | null
}

/**
 * 拉取 Garmin 每日健康摘要
 * @param days 拉取天數（預設 30 天）
 */
export async function fetchGarminDailies(
  opts: GarminApiOptions,
  days: number = 30
): Promise<GarminDailySummary[]> {
  const endTime = Math.floor(Date.now() / 1000)
  const startTime = endTime - days * 86400

  // Garmin Wellness API: GET /dailies
  const dailies = await garminApiRequest(
    `${GARMIN_API_BASE}/dailies`,
    opts,
    {
      uploadStartTimeInSeconds: startTime.toString(),
      uploadEndTimeInSeconds: endTime.toString(),
    }
  )

  // Garmin Wellness API: GET /epochs (for HRV, sleep score)
  let sleepData: any[] = []
  try {
    sleepData = await garminApiRequest(
      `${GARMIN_API_BASE}/sleeps`,
      opts,
      {
        uploadStartTimeInSeconds: startTime.toString(),
        uploadEndTimeInSeconds: endTime.toString(),
      }
    )
  } catch {
    // Sleep data may not always be available
  }

  // Build sleep score map by date
  const sleepMap = new Map<string, number>()
  if (Array.isArray(sleepData)) {
    for (const s of sleepData) {
      if (s.calendarDate && s.overallSleepScore != null) {
        sleepMap.set(s.calendarDate, s.overallSleepScore)
      }
    }
  }

  const results: GarminDailySummary[] = []

  if (!Array.isArray(dailies)) return results

  for (const d of dailies) {
    const date = d.calendarDate
    if (!date) continue

    const entry: GarminDailySummary = {
      date,
      // Garmin Body Battery (max value of the day)
      device_recovery_score: d.bodyBatteryChargedValue != null
        ? Math.min(100, Math.max(0, Math.round(d.bodyBatteryChargedValue)))
        : null,
      // Resting Heart Rate
      resting_hr: d.restingHeartRate != null
        ? (d.restingHeartRate >= 30 && d.restingHeartRate <= 150 ? d.restingHeartRate : null)
        : null,
      // HRV (from daily or stress data)
      hrv: d.averageStressLevel != null
        ? null // Stress is not HRV; check if HRV is available separately
        : null,
      // Sleep Score from sleep data
      wearable_sleep_score: sleepMap.get(date) ?? null,
      // Respiratory Rate
      respiratory_rate: d.averageSpo2 != null
        ? null // SPO2 is not respiratory rate
        : (d.respirationAvgBreathingRate != null
          ? (d.respirationAvgBreathingRate >= 5 && d.respirationAvgBreathingRate <= 40
            ? Math.round(d.respirationAvgBreathingRate * 10) / 10
            : null)
          : null),
    }

    // Try to get HRV from the daily data if available
    if (d.hrvSummary?.lastNightAvg != null) {
      entry.hrv = d.hrvSummary.lastNightAvg >= 0 && d.hrvSummary.lastNightAvg <= 300
        ? Math.round(d.hrvSummary.lastNightAvg)
        : null
    } else if (d.averageHrv != null) {
      entry.hrv = d.averageHrv >= 0 && d.averageHrv <= 300
        ? Math.round(d.averageHrv)
        : null
    }

    // Check body battery from different fields
    if (entry.device_recovery_score === null && d.bodyBatteryMostRecentValue != null) {
      entry.device_recovery_score = Math.min(100, Math.max(0, Math.round(d.bodyBatteryMostRecentValue)))
    }

    const hasData = entry.device_recovery_score !== null ||
      entry.resting_hr !== null ||
      entry.hrv !== null ||
      entry.wearable_sleep_score !== null ||
      entry.respiratory_rate !== null

    if (hasData) {
      results.push(entry)
    }
  }

  return results
}
