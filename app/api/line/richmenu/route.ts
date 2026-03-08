import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'
import { createLogger } from '@/lib/logger'
import { verifyAdminSession } from '@/lib/auth-middleware'
import {
  getMarketingRichMenuObject,
  getMemberRichMenuObject,
  createRichMenu,
  uploadRichMenuImage,
  setDefaultRichMenu,
  listRichMenus,
  deleteRichMenu,
} from '@/lib/line'

const logger = createLogger('line-richmenu')

function getAdminSession(request: NextRequest): boolean {
  const token = request.cookies.get('admin_session')?.value
  return !!token && verifyAdminSession(token)
}

/**
 * GET /api/line/richmenu — 查看目前所有 Rich Menu
 */
export async function GET(request: NextRequest) {
  if (!getAdminSession(request)) {
    return NextResponse.json({ error: '未授權' }, { status: 401 })
  }
  const menus = await listRichMenus()
  return NextResponse.json({ menus, count: menus.length })
}

/**
 * POST /api/line/richmenu — 建立 Rich Menu 並上傳圖片
 *
 * Body: multipart/form-data with 'image' file
 */
export async function POST(request: NextRequest) {
  if (!getAdminSession(request)) {
    return NextResponse.json({ error: '未授權' }, { status: 401 })
  }

  try {
    const contentType = request.headers.get('content-type') || ''

    // 支援 menuType 參數：'marketing'（預設）或 'member'
    let marketingImage: Blob | null = null
    let memberImage: Blob | null = null
    let menuType = 'marketing' // 單張上傳時的類型
    let deleteOld = true

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData()
      deleteOld = formData.get('deleteOld') !== 'false'
      menuType = (formData.get('menuType') as string) || 'marketing'

      // 支援兩種模式：單張上傳 or 雙張上傳
      const singleFile = formData.get('image') as File | null
      const mktFile = formData.get('marketingImage') as File | null
      const memFile = formData.get('memberImage') as File | null

      if (mktFile) marketingImage = mktFile
      if (memFile) memberImage = memFile

      // 單張上傳模式
      if (singleFile && !mktFile && !memFile) {
        if (menuType === 'member') {
          memberImage = singleFile
        } else {
          marketingImage = singleFile
        }
      }
    }

    // Step 1: 只刪除即將被替換的 Rich Menu（避免誤刪另一套）
    if (deleteOld) {
      const existingMenus = await listRichMenus()
      for (const menu of existingMenus) {
        const isMarketing = menu.name?.includes('行銷版')
        const isMember = menu.name?.includes('學員版')
        if ((marketingImage && isMarketing) || (memberImage && isMember)) {
          await deleteRichMenu(menu.richMenuId)
        }
        // 如果兩張都上傳，或名稱不匹配任一版本，也刪除
        if (marketingImage && memberImage && !isMarketing && !isMember) {
          await deleteRichMenu(menu.richMenuId)
        }
      }
    }

    const results: any = { success: true }

    // Helper: 壓縮、建立、上傳一套 Rich Menu
    async function setupMenu(menuObject: object, image: Blob, setAsDefault: boolean) {
      const richMenuId = await createRichMenu(menuObject)
      if (!richMenuId) throw new Error('Failed to create rich menu')

      const rawBuffer = Buffer.from(await image.arrayBuffer())
      let quality = 85
      let compressedBuffer: Buffer = rawBuffer
      while (quality >= 30) {
        compressedBuffer = await sharp(rawBuffer)
          .resize(2500, 1686, { fit: 'fill' })
          .jpeg({ quality })
          .toBuffer()
        if (compressedBuffer.length <= 1024 * 1024) break
        quality -= 10
      }

      const compressedBlob = new Blob([new Uint8Array(compressedBuffer)], { type: 'image/jpeg' })
      const uploadResult = await uploadRichMenuImage(richMenuId, compressedBlob, 'image/jpeg')
      if (typeof uploadResult === 'string') {
        throw new Error(`Image upload failed: ${uploadResult}`)
      }

      if (setAsDefault) {
        const ok = await setDefaultRichMenu(richMenuId)
        if (!ok) throw new Error('Failed to set as default')
      }

      return richMenuId
    }

    // 建立行銷版（設為預設 → 所有未綁定用戶看到）
    if (marketingImage) {
      try {
        const id = await setupMenu(getMarketingRichMenuObject(), marketingImage, true)
        results.marketingMenuId = id
        results.marketingStatus = 'ok'
      } catch (err: any) {
        results.marketingStatus = `error: ${err.message}`
      }
    }

    // 建立學員版（不設為預設 → 透過 linkRichMenuToUser 指派）
    if (memberImage) {
      try {
        const id = await setupMenu(getMemberRichMenuObject(), memberImage, false)
        results.memberMenuId = id
        results.memberStatus = 'ok'
      } catch (err: any) {
        results.memberStatus = `error: ${err.message}`
      }
    }

    if (!marketingImage && !memberImage) {
      // 沒圖片 → 只建結構
      const mktId = await createRichMenu(getMarketingRichMenuObject())
      const memId = await createRichMenu(getMemberRichMenuObject())
      results.marketingMenuId = mktId
      results.memberMenuId = memId
      results.message = 'Rich Menu 結構已建立，請上傳圖片後才能啟用。'
    } else {
      results.message = 'Rich Menu 設定完成！'
    }

    return NextResponse.json(results)

  } catch (error) {
    logger.error('Rich menu setup error', error as Error)
    return NextResponse.json({ error: 'Rich Menu 設定失敗' }, { status: 500 })
  }
}
