import { NextRequest } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase'
import { createErrorResponse, createSuccessResponse, rateLimit, getClientIP } from '@/lib/auth-middleware'
import { resolveActiveClient } from '@/lib/active-client'

export const dynamic = 'force-dynamic'

const supabase = createServiceSupabase()
const BUCKET = 'progress-photos'
const POSES = ['front', 'back_lat', 'side', 'back'] as const
type Pose = typeof POSES[number]
const MAX_BYTES = 10 * 1024 * 1024
const SIGNED_URL_TTL = 60 * 60

const isPose = (v: unknown): v is Pose => typeof v === 'string' && (POSES as readonly string[]).includes(v)
const isISODate = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)

/**
 * 進度照片（備賽的裁判是照片，不是 InBody）
 *
 * GET    ?code=        → 依日期分組的照片（signed URL，1 小時有效）
 * POST   multipart: code, pose, date, file → 同一天同姿勢覆蓋
 * DELETE ?code=&id=
 *
 * 照片放私有 bucket，只走 service_role；學員用 unique_code 存取（與其他學員 API 一致），
 * 停用／過期帳號擋掉（教練身份例外）。
 */
export async function GET(request: NextRequest) {
  const code = new URL(request.url).searchParams.get('code')
  if (!code) return createErrorResponse('缺少 code', 400)
  const resolved = await resolveActiveClient(supabase, code, { request })
  if (resolved.response) return resolved.response

  const { data: rows, error } = await supabase
    .from('progress_photos')
    .select('id, taken_on, pose, storage_path')
    .eq('client_id', resolved.client.id)
    .order('taken_on', { ascending: false })
    .limit(200)
  if (error) return createErrorResponse('讀取照片失敗', 500)

  const paths = (rows ?? []).map(r => r.storage_path)
  const urlByPath = new Map<string, string>()
  if (paths.length) {
    const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrls(paths, SIGNED_URL_TTL)
    for (const s of signed ?? []) if (s.path && s.signedUrl) urlByPath.set(s.path, s.signedUrl)
  }

  const byDate = new Map<string, Partial<Record<Pose, { id: string; url: string }>>>()
  for (const r of rows ?? []) {
    const url = urlByPath.get(r.storage_path)
    if (!url || !isPose(r.pose)) continue
    const day = byDate.get(r.taken_on) ?? {}
    day[r.pose] = { id: r.id, url }
    byDate.set(r.taken_on, day)
  }

  return createSuccessResponse({
    sets: [...byDate.entries()].map(([date, photos]) => ({ date, photos })),
  })
}

export async function POST(request: NextRequest) {
  const { allowed } = await rateLimit(`progress-photos:${getClientIP(request)}`, 20, 60_000)
  if (!allowed) return createErrorResponse('上傳太頻繁，請稍後再試', 429)

  let form: FormData
  try { form = await request.formData() } catch { return createErrorResponse('格式錯誤', 400) }

  const code = form.get('code')
  const pose = form.get('pose')
  const date = form.get('date')
  const file = form.get('file')
  if (typeof code !== 'string' || !code) return createErrorResponse('缺少 code', 400)
  if (!isPose(pose)) return createErrorResponse('姿勢不正確', 400)
  if (!isISODate(date)) return createErrorResponse('日期格式錯誤', 400)
  if (!(file instanceof File)) return createErrorResponse('缺少照片', 400)
  if (file.size > MAX_BYTES) return createErrorResponse('照片超過 10MB', 400)
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return createErrorResponse('只接受 JPG / PNG / WebP', 400)

  const resolved = await resolveActiveClient(supabase, code, { request })
  if (resolved.response) return resolved.response
  const clientId = resolved.client.id

  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
  // 檔名帶時間戳：覆蓋同天同姿勢時不會被 CDN/瀏覽器快取到舊圖
  const path = `${clientId}/${date}_${pose}_${Date.now()}.${ext}`

  const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type })
  if (upErr) return createErrorResponse('上傳失敗', 500)

  // 同天同姿勢已存在 → 換新檔、刪舊檔
  const { data: existing } = await supabase
    .from('progress_photos')
    .select('storage_path')
    .eq('client_id', clientId).eq('taken_on', date).eq('pose', pose)
    .maybeSingle()

  const { error: dbErr } = await supabase
    .from('progress_photos')
    .upsert({ client_id: clientId, taken_on: date, pose, storage_path: path }, { onConflict: 'client_id,taken_on,pose' })
  if (dbErr) {
    await supabase.storage.from(BUCKET).remove([path])
    return createErrorResponse('儲存失敗', 500)
  }
  if (existing?.storage_path && existing.storage_path !== path) {
    await supabase.storage.from(BUCKET).remove([existing.storage_path])
  }

  return createSuccessResponse({ date, pose })
}

export async function DELETE(request: NextRequest) {
  const sp = new URL(request.url).searchParams
  const code = sp.get('code')
  const id = sp.get('id')
  if (!code || !id) return createErrorResponse('缺少參數', 400)
  const resolved = await resolveActiveClient(supabase, code, { request })
  if (resolved.response) return resolved.response

  const { data: row } = await supabase
    .from('progress_photos')
    .select('id, storage_path')
    .eq('id', id).eq('client_id', resolved.client.id)
    .maybeSingle()
  if (!row) return createErrorResponse('找不到照片', 404)

  await supabase.from('progress_photos').delete().eq('id', row.id)
  await supabase.storage.from(BUCKET).remove([row.storage_path])
  return createSuccessResponse({ deleted: row.id })
}
