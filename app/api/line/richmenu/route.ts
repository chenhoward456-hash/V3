import { NextRequest, NextResponse } from 'next/server'
import {
  getRichMenuObject,
  createRichMenu,
  uploadRichMenuImage,
  setDefaultRichMenu,
  listRichMenus,
  deleteRichMenu,
} from '@/lib/line'

/**
 * GET /api/line/richmenu — 查看目前所有 Rich Menu
 */
export async function GET() {
  const menus = await listRichMenus()
  return NextResponse.json({ menus, count: menus.length })
}

/**
 * POST /api/line/richmenu — 建立 Rich Menu 並上傳圖片
 *
 * Body: multipart/form-data with 'image' file
 * 或 JSON { deleteOld?: boolean } (不含圖片時僅建立 menu 結構)
 */
export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || ''

    let imageBuffer: Blob | null = null
    let imageContentType = 'image/png'
    let deleteOld = true

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData()
      const file = formData.get('image') as File | null
      deleteOld = formData.get('deleteOld') !== 'false'

      if (file) {
        imageBuffer = file
        imageContentType = file.type || 'image/png'
      }
    }

    // Step 1: 刪除舊的 Rich Menu（可選）
    if (deleteOld) {
      const existingMenus = await listRichMenus()
      for (const menu of existingMenus) {
        await deleteRichMenu(menu.richMenuId)
      }
    }

    // Step 2: 建立 Rich Menu
    const menuObject = getRichMenuObject()
    const richMenuId = await createRichMenu(menuObject)
    if (!richMenuId) {
      return NextResponse.json({ error: 'Failed to create rich menu' }, { status: 500 })
    }

    // Step 3: 上傳圖片（如果有提供）
    let imageUploaded = false
    if (imageBuffer) {
      imageUploaded = await uploadRichMenuImage(richMenuId, imageBuffer, imageContentType)
      if (!imageUploaded) {
        return NextResponse.json({
          error: 'Rich menu created but image upload failed',
          richMenuId,
        }, { status: 500 })
      }

      // Step 4: 設定為預設（只有在圖片上傳成功後才設定）
      const defaultSet = await setDefaultRichMenu(richMenuId)
      if (!defaultSet) {
        return NextResponse.json({
          error: 'Rich menu created and image uploaded, but failed to set as default',
          richMenuId,
        }, { status: 500 })
      }
    }

    return NextResponse.json({
      success: true,
      richMenuId,
      imageUploaded,
      isDefault: imageUploaded,
      message: imageUploaded
        ? 'Rich Menu 建立完成並已設為預設！'
        : 'Rich Menu 結構已建立，請上傳圖片後才能設為預設。',
    })

  } catch (error) {
    console.error('Rich menu setup error:', error)
    return NextResponse.json({ error: `Internal error: ${error}` }, { status: 500 })
  }
}
