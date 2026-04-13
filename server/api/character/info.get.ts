import { getPool } from '~/server/database/db'

export default defineEventHandler(async (event) => {
  const userId = event.context.userId
  const pool = getPool()

  const { rows } = await pool.query(
    'SELECT * FROM characters WHERE user_id = $1',
    [userId]
  )

  if (rows.length === 0) {
    return { code: 200, data: null, message: '未创建角色' }
  }

  return { code: 200, data: rows[0] }
})
