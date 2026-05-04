import { getPool } from '~/server/database/db'
import { getCharId, EQUIP_SELL_PRICES, removeEquipsFromAllLoadouts } from '~/server/utils/equipment'
import { updateSectDailyTask } from '~/server/utils/sect'
import { checkAchievements } from '~/server/engine/achievementData'

export default defineEventHandler(async (event) => {
  try {
    const pool = getPool()
    const { equip_id } = await readBody(event)
    const char = await getCharId(event.context.userId)
    if (!char) return { code: 400, message: '角色不存在' }

    const charId = char.id

    const { rows: equipRows } = await pool.query(
      'SELECT * FROM character_equipment WHERE id = $1 AND character_id = $2 AND slot IS NULL',
      [equip_id, charId]
    )

    if (equipRows.length === 0) return { code: 400, message: '装备不存在或已穿戴' }

    // slot=NULL 的装备仍可能挂在非激活方案里（切方案时 slot 字段会被清空）
    const { rows: refRows } = await pool.query(
      `SELECT loadout_id FROM character_equipment_loadouts l, jsonb_each(l.slots) AS s(k, v)
       WHERE l.character_id = $1 AND (v)::text::int = $2
       ORDER BY loadout_id`,
      [charId, equip_id]
    )
    if (refRows.length > 0) {
      const ids = refRows.map(r => r.loadout_id).join('/')
      return { code: 400, message: `装备已挂在方案 ${ids}，请先在方案中取下` }
    }

    const enhLv = equipRows[0].enhance_level || 0
    const price = Math.floor((EQUIP_SELL_PRICES[equipRows[0].rarity] || 10) * equipRows[0].tier * (1 + enhLv * 0.1))

    // 删装备前清掉所有装备方案中的引用，避免 loadout 指向已删除装备
    await removeEquipsFromAllLoadouts(charId, [equip_id])
    await pool.query('DELETE FROM character_equipment WHERE id = $1', [equip_id])
    const { rows: updRows } = await pool.query(
      'UPDATE characters SET spirit_stone = spirit_stone + $1 WHERE id = $2 RETURNING spirit_stone',
      [price, charId]
    )
    const newSpiritStone = updRows[0]?.spirit_stone

    // 宗门任务
    await updateSectDailyTask(charId, 'sell', 1)
    // 成就：出售
    checkAchievements(charId, 'equip_sell', 1).catch(() => {})

    return { code: 200, message: `出售获得 ${price} 灵石`, data: { price, newSpiritStone } }
  } catch (error) {
    console.error('出售装备失败:', error)
    return { code: 500, message: '服务器错误' }
  }
})
