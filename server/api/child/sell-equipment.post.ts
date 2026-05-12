// 出售子女装备 - POST /api/child/sell-equipment
// body: { equipment_id }
// 按品质换灵石（不可穿戴中出售）

import { getPool } from '~/server/database/db'
import { getCharacterByUserId } from '~/server/utils/team'

const SELL_PRICE_BY_RARITY: Record<string, number> = {
  white: 50, green: 200, blue: 800, purple: 2500, gold: 8000, red: 30000,
}

export default defineEventHandler(async (event) => {
  try {
    const pool = getPool()
    const body = await readBody(event)
    const equipId = Number(body?.equipment_id)
    if (!equipId) return { code: 400, message: '参数错误' }

    const char = await getCharacterByUserId(event.context.userId)
    if (!char) return { code: 400, message: '角色不存在' }

    const { rows } = await pool.query(
      `SELECT ce.id, ce.rarity, ce.is_equipped, ce.name
         FROM child_equipment ce
         JOIN children c ON c.id = ce.child_id
        WHERE ce.id = $1 AND c.character_id = $2`,
      [equipId, char.id]
    )
    if (rows.length === 0) return { code: 404, message: '装备不存在' }
    if (rows[0].is_equipped) return { code: 400, message: '请先卸下再出售' }

    const price = SELL_PRICE_BY_RARITY[rows[0].rarity] || 50

    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query('DELETE FROM child_equipment WHERE id = $1', [equipId])
      await client.query('UPDATE characters SET spirit_stone = spirit_stone + $1 WHERE id = $2', [price, char.id])
      await client.query('COMMIT')
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }

    return { code: 200, message: `已出售「${rows[0].name}」，获得 ${price} 灵石`, data: { stone: price } }
  } catch (error) {
    console.error('出售装备失败:', error)
    return { code: 500, message: '服务器错误' }
  }
})
