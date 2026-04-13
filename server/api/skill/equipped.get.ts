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

    const { rows: skills } = await pool.query(
      'SELECT * FROM character_skills WHERE character_id = $1 AND equipped = TRUE',
      [charRows[0].id]
    )

    return { code: 200, data: skills }
  } catch (error) {
    console.error('获取功法失败:', error)
    return { code: 500, message: '服务器错误' }
  }
})
