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

    await pool.query(
      'UPDATE character_buffs SET remaining_fights = remaining_fights - 1 WHERE character_id = $1 AND remaining_fights > 0',
      [charRows[0].id]
    )

    // 清理过期buff
    await pool.query(
      'DELETE FROM character_buffs WHERE character_id = $1 AND remaining_fights <= 0',
      [charRows[0].id]
    )

    return { code: 200, message: 'ok' }
  } catch (error) {
    console.error('扣减buff失败:', error)
    return { code: 500, message: '服务器错误' }
  }
})
