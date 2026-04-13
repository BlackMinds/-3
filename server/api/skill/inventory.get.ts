import { getPool } from '~/server/database/db'

export default defineEventHandler(async (event) => {
  try {
    const pool = getPool()
    const userId = event.context.userId

    const { rows: charRows } = await pool.query(
      'SELECT id FROM characters WHERE user_id = $1',
      [userId]
    )

    if (charRows.length === 0) {
      return { code: 400, message: '角色不存在' }
    }

    const { rows: inventory } = await pool.query(
      'SELECT * FROM character_skill_inventory WHERE character_id = $1',
      [charRows[0].id]
    )

    return { code: 200, data: inventory }
  } catch (error) {
    console.error('获取背包失败:', error)
    return { code: 500, message: '服务器错误' }
  }
})
