import { getPool } from '~/server/database/db'

const DAILY_CHALLENGE_LIMIT = 10

export default defineEventHandler(async (event) => {
  try {
    const pool = getPool()
    const userId = event.context.userId

    const { rows: meRows } = await pool.query(
      'SELECT id FROM characters WHERE user_id = $1',
      [userId]
    )
    if (meRows.length === 0) return { code: 400, message: '角色不存在' }

    const { rows: cntRows } = await pool.query(
      `SELECT COUNT(*)::int AS cnt FROM pk_records
       WHERE attacker_id = $1 AND fought_at >= CURRENT_DATE`,
      [meRows[0].id]
    )
    const used = cntRows[0].cnt
    return {
      code: 200,
      data: {
        used,
        limit: DAILY_CHALLENGE_LIMIT,
        remaining: Math.max(0, DAILY_CHALLENGE_LIMIT - used),
      },
    }
  } catch (error) {
    console.error('查询斗法次数失败:', error)
    return { code: 500, message: '服务器错误' }
  }
})
