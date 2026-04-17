import { getPool } from '~/server/database/db'

export default defineEventHandler(async (event) => {
  try {
    const pool = getPool()
    const userId = event.context.userId

    const { rows: charRows } = await pool.query(
      'SELECT id FROM characters WHERE user_id = $1',
      [userId]
    )
    if (charRows.length === 0) return { code: 400, message: '角色不存在' }

    const { rows } = await pool.query(
      'SELECT pill_id FROM character_unlocked_recipes WHERE character_id = $1',
      [charRows[0].id]
    )

    return { code: 200, data: rows.map(r => r.pill_id) }
  } catch (error) {
    console.error('获取已解锁丹方失败:', error)
    return { code: 500, message: '服务器错误' }
  }
})
