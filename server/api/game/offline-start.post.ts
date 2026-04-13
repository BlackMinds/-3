import { getPool } from '~/server/database/db'

export default defineEventHandler(async (event) => {
  try {
    const pool = getPool()
    const { rows } = await pool.query('SELECT * FROM characters WHERE user_id = $1', [event.context.userId])
    if (rows.length === 0) return { code: 400, message: '角色不存在' }
    const char = rows[0]
    if (char.offline_start) return { code: 400, message: '已在离线挂机中' }
    await pool.query('UPDATE characters SET offline_start = NOW() WHERE id = $1', [char.id])
    return { code: 200, message: '开始离线挂机', data: { startTime: new Date().toISOString() } }
  } catch (error) {
    console.error('开始离线失败:', error)
    return { code: 500, message: '服务器错误' }
  }
})
