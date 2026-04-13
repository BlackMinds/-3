import { getPool } from '~/server/database/db'

export default defineEventHandler(async (event) => {
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
