import { getPool } from '~/server/database/db'
import { getExpRequired } from '~/server/utils/realm'

export default defineEventHandler(async (event) => {
  try {
    const pool = getPool()
    const { rows } = await pool.query(
      `SELECT *, EXTRACT(EPOCH FROM battle_end_at) * 1000 AS battle_end_at_ms,
              EXTRACT(EPOCH FROM NOW()) * 1000 AS server_now_ms
         FROM characters WHERE user_id = $1`,
      [event.context.userId]
    )

    if (rows.length === 0) {
      return { code: 200, data: null, message: '未创建角色' }
    }

    const row = rows[0]
    row.cultivation_exp_required = getExpRequired(row.realm_tier || 1, row.realm_stage || 1)

    return { code: 200, data: row }
  } catch (error) {
    console.error('获取游戏数据失败:', error)
    return { code: 500, message: '服务器错误' }
  }
})
