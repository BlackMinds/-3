// GET /api/tower/battles
// 个人通天塔战斗历史（默认最近 20 条）
import { getPool } from '~/server/database/db'

export default defineEventHandler(async (event) => {
  try {
    const pool = getPool()
    const q = getQuery(event)
    const limit = Math.min(Math.max(Number(q.limit) || 20, 1), 100)

    const { rows: charRows } = await pool.query(
      'SELECT id FROM characters WHERE user_id = $1', [event.context.userId]
    )
    if (charRows.length === 0) return { code: 400, message: '角色不存在' }

    const { rows } = await pool.query(
      `SELECT id, floor, result, total_turns, damage_dealt, damage_taken, created_at
         FROM tower_battles WHERE character_id = $1
         ORDER BY id DESC LIMIT $2`,
      [charRows[0].id, limit]
    )

    return {
      code: 200,
      data: {
        battles: rows.map(r => ({
          id: r.id,
          floor: r.floor,
          result: r.result,
          total_turns: r.total_turns,
          damage_dealt: Number(r.damage_dealt),
          damage_taken: Number(r.damage_taken),
          created_at: r.created_at,
        })),
      }
    }
  } catch (err: any) {
    console.error('通天塔 battles 接口错误:', err)
    return { code: 500, message: '服务器错误' }
  }
})
