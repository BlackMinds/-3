import { getPool } from '~/server/database/db'

const HISTORY_LIMIT = 20

export default defineEventHandler(async (event) => {
  try {
    const pool = getPool()
    const userId = event.context.userId

    const { rows: meRows } = await pool.query(
      'SELECT id FROM characters WHERE user_id = $1',
      [userId]
    )
    if (meRows.length === 0) return { code: 400, message: '角色不存在' }
    const meId = meRows[0].id

    const { rows } = await pool.query(
      `SELECT id, attacker_id, defender_id, attacker_name, defender_name,
              winner_side, cultivation_loss, battle_log, fought_at
         FROM pk_records
        WHERE attacker_id = $1 OR defender_id = $1
        ORDER BY fought_at DESC
        LIMIT $2`,
      [meId, HISTORY_LIMIT]
    )

    // 标准化：标识自己是哪一边、是否赢、是否被扣修为
    const list = rows.map((r: any) => {
      const isAttacker = r.attacker_id === meId
      const myWon = (r.winner_side === 'a' && isAttacker) || (r.winner_side === 'b' && !isAttacker)
      const foeName = isAttacker ? r.defender_name : r.attacker_name
      const myLoss = !myWon ? Number(r.cultivation_loss || 0) : 0
      return {
        id: r.id,
        role: isAttacker ? 'attacker' : 'defender',     // 我作为哪一方
        myWon,
        foeName,
        myLoss,
        battleLog: r.battle_log,
        attackerName: r.attacker_name,
        defenderName: r.defender_name,
        foughtAt: r.fought_at,
      }
    })

    return { code: 200, data: list }
  } catch (error) {
    console.error('查询斗法历史失败:', error)
    return { code: 500, message: '服务器错误' }
  }
})
