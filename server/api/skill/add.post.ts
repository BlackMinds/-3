import { getPool } from '~/server/database/db'

export default defineEventHandler(async (event) => {
  try {
    const pool = getPool()
    const userId = event.context.userId
    const { skill_id } = await readBody(event)

    const { rows: charRows } = await pool.query(
      'SELECT id FROM characters WHERE user_id = $1',
      [userId]
    )

    if (charRows.length === 0) {
      return { code: 400, message: '角色不存在' }
    }

    await pool.query(
      `INSERT INTO character_skill_inventory (character_id, skill_id, count)
       VALUES ($1, $2, 1)
       ON CONFLICT (character_id, skill_id) DO UPDATE SET count = character_skill_inventory.count + 1`,
      [charRows[0].id, skill_id]
    )

    return { code: 200, message: '功法已添加' }
  } catch (error) {
    console.error('添加功法失败:', error)
    return { code: 500, message: '服务器错误' }
  }
})
