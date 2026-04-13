import { getPool } from '~/server/database/db'

export default defineEventHandler(async (event) => {
  try {
    const pool = getPool()
    const userId = event.context.userId

    const { rows: charRows } = await pool.query(
      'SELECT * FROM characters WHERE user_id = $1',
      [userId]
    )
    if (charRows.length === 0) return { code: 400, message: '角色不存在' }

    const { rows: buffs } = await pool.query(
      'SELECT id, pill_id, remaining_fights, quality_factor, expire_time FROM character_buffs WHERE character_id = $1 AND (expire_time > NOW() OR remaining_fights > 0)',
      [charRows[0].id]
    )

    return { code: 200, data: buffs }
  } catch (error) {
    console.error('获取buff失败:', error)
    return { code: 500, message: '服务器错误' }
  }
})
