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

    const { rows } = await pool.query(
      "SELECT material_id as herb_id, quality, count FROM character_materials WHERE character_id = $1 AND count > 0 ORDER BY material_id, quality",
      [charRows[0].id]
    )

    return { code: 200, data: rows }
  } catch (error) {
    console.error('获取灵草失败:', error)
    return { code: 500, message: '服务器错误' }
  }
})
