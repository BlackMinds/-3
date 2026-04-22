import { getPool } from '~/server/database/db'
import { getCharId } from '~/server/utils/equipment'
import { SKILL_MAP } from '~/server/engine/skillData'

const SKILL_SELL_PRICES: Record<string, number> = {
  white: 10, green: 50, blue: 200, purple: 1000, gold: 5000, red: 20000,
}

export default defineEventHandler(async (event) => {
  const pool = getPool()
  const { skill_id, count: rawCount } = await readBody(event)
  const count = Math.max(1, Math.floor(Number(rawCount) || 1))

  const char = await getCharId(event.context.userId)
  if (!char) return { code: 400, message: '角色不存在' }
  const charId = char.id

  const skillDef = SKILL_MAP[skill_id]
  if (!skillDef) return { code: 400, message: '功法不存在' }
  const unitPrice = SKILL_SELL_PRICES[skillDef.rarity] || 10

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const { rows: invRows } = await client.query(
      'SELECT count FROM character_skill_inventory WHERE character_id = $1 AND skill_id = $2 FOR UPDATE',
      [charId, skill_id]
    )
    if (invRows.length === 0 || invRows[0].count <= 0) {
      await client.query('ROLLBACK')
      return { code: 400, message: '背包中没有该功法' }
    }
    const available = Number(invRows[0].count)

    // 若该功法已装备，最后一份不能卖（和装备出售的"已穿戴不可卖"保持一致）
    const { rows: eqRows } = await client.query(
      'SELECT 1 FROM character_skills WHERE character_id = $1 AND skill_id = $2 LIMIT 1',
      [charId, skill_id]
    )
    const isEquipped = eqRows.length > 0
    const maxSellable = available - (isEquipped ? 1 : 0)
    if (count > maxSellable) {
      await client.query('ROLLBACK')
      return {
        code: 400,
        message: isEquipped ? '功法已装备，请先卸下再出售最后一份' : '功法数量不足',
      }
    }

    const newCount = available - count
    if (newCount <= 0) {
      await client.query(
        'DELETE FROM character_skill_inventory WHERE character_id = $1 AND skill_id = $2',
        [charId, skill_id]
      )
    } else {
      await client.query(
        'UPDATE character_skill_inventory SET count = $1 WHERE character_id = $2 AND skill_id = $3',
        [newCount, charId, skill_id]
      )
    }

    const total = unitPrice * count
    const { rows: updRows } = await client.query(
      'UPDATE characters SET spirit_stone = spirit_stone + $1 WHERE id = $2 RETURNING spirit_stone',
      [total, charId]
    )

    await client.query('COMMIT')

    return {
      code: 200,
      message: `出售 ${count} 份，获得 ${total} 灵石`,
      data: { price: total, count, newCount, newSpiritStone: updRows[0]?.spirit_stone },
    }
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    console.error('出售功法失败:', error)
    return { code: 500, message: '服务器错误' }
  } finally {
    client.release()
  }
})
