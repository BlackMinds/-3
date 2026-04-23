import { getPool } from '~/server/database/db'

// 头像上传功能暂时关闭（缺 MIME 校验 + base64 塞库的性能隐患，待改造完再开）
const AVATAR_UPLOAD_DISABLED = true

export default defineEventHandler(async (event) => {
  if (AVATAR_UPLOAD_DISABLED) {
    return { code: 400, message: '头像上传功能暂时关闭' }
  }

  const userId = event.context.userId
  const { avatar } = await readBody(event)

  if (!avatar || typeof avatar !== 'string') {
    return { code: 400, message: '头像数据无效' }
  }
  if (avatar.length > 500000) {
    return { code: 400, message: '头像文件过大(最大500KB)' }
  }

  const pool = getPool()
  await pool.query(
    'UPDATE characters SET avatar = $1 WHERE user_id = $2',
    [avatar, userId]
  )

  return { code: 200, message: '头像已更新' }
})
