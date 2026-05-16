// 子女自定义头像上传 - POST /api/child/upload-avatar
// body: { child_id, image_data: 'data:image/...;base64,...' }
// 限制: 600KB 原图（base64 < 800000 字符）/ png|jpeg|webp
// 落库到 children.custom_avatar_url（TEXT, 直接存 data URL）
// 与 /api/companion/upload-avatar 同构

import { getPool } from '~/server/database/db'
import { getCharacterByUserId } from '~/server/utils/team'

const MAX_BASE64_LEN = 800_000          // base64 字符数 ≈ 原图 600KB (×3/4)
const ALLOWED_MIME = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp']

export default defineEventHandler(async (event) => {
  try {
    const pool = getPool()
    const body = await readBody(event)
    const childId = Number(body?.child_id)
    const imageData = String(body?.image_data || '')

    if (!childId) return { code: 400, message: '参数错误' }
    if (!imageData) return { code: 400, message: '图片为空' }
    if (!imageData.startsWith('data:')) return { code: 400, message: '图片格式错误，必须是 base64 data URL' }

    const m = /^data:([^;]+);base64,/i.exec(imageData)
    if (!m) return { code: 400, message: '图片格式错误' }
    const mime = m[1].toLowerCase()
    if (!ALLOWED_MIME.includes(mime)) {
      return { code: 400, message: '仅支持 png / jpg / webp 格式' }
    }

    if (imageData.length > MAX_BASE64_LEN) {
      const kb = Math.floor((imageData.length * 0.75) / 1024)
      return { code: 400, message: `图片过大（约 ${kb}KB），上限 600KB` }
    }

    const char = await getCharacterByUserId(event.context.userId)
    if (!char) return { code: 400, message: '角色不存在' }

    const { rows } = await pool.query(
      'SELECT id FROM children WHERE id = $1 AND character_id = $2',
      [childId, char.id]
    )
    if (rows.length === 0) return { code: 404, message: '子女不存在' }

    await pool.query(
      'UPDATE children SET custom_avatar_url = $1 WHERE id = $2',
      [imageData, childId]
    )

    return {
      code: 200,
      message: '头像上传成功',
      data: { childId, sizeKB: Math.floor((imageData.length * 0.75) / 1024) },
    }
  } catch (error) {
    console.error('子女头像上传失败:', error)
    return { code: 500, message: '服务器错误' }
  }
})
