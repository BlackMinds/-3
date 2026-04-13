import { getPool } from '~/server/database/db'

export default defineEventHandler(async (event) => {
  try {
    const pool = getPool()
    const { rows } = await pool.query(
      'SELECT * FROM characters WHERE user_id = $1',
      [event.context.userId]
    )

    if (rows.length === 0) {
      return { code: 200, data: null, message: '未创建角色' }
    }

    return { code: 200, data: rows[0] }
  } catch (error) {
    console.error('获取游戏数据失败:', error)
    return { code: 500, message: '服务器错误' }
  }
})
