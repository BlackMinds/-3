import { getPool } from '~/server/database/db'
import { getCharId, consumeSpecialItem, rollSubStats, RARITY_SUB_COUNT } from '~/server/utils/equipment'

export default defineEventHandler(async (event) => {
  try {
    const pool = getPool()
    const { equip_id } = await readBody(event)
    const char = await getCharId(event.context.userId)
    if (!char) return { code: 400, message: '角色不存在' }
    const charId = char.id

    const { rows: eqRows } = await pool.query(
      'SELECT * FROM character_equipment WHERE id = $1 AND character_id = $2', [equip_id, charId]
    )
    if (eqRows.length === 0) return { code: 400, message: '装备不存在' }
    const eq = eqRows[0]

    const subCount = RARITY_SUB_COUNT[eq.rarity] || 0
    if (subCount === 0) return { code: 400, message: '该品质装备没有副属性' }

    const used = await consumeSpecialItem(charId, 'reroll_sub_stat')
    if (!used) return { code: 400, message: '没有装备鉴定符' }

    const tier = eq.tier || 1
    const rarityIdx = ['white', 'green', 'blue', 'purple', 'gold', 'red'].indexOf(eq.rarity)
    const newSubs = rollSubStats(rarityIdx, tier, subCount)

    await pool.query('UPDATE character_equipment SET sub_stats = $1 WHERE id = $2', [JSON.stringify(newSubs), equip_id])
    return { code: 200, message: '副属性已重随', data: { sub_stats: newSubs } }
  } catch (error) {
    console.error('鉴定失败:', error)
    return { code: 500, message: '服务器错误' }
  }
})
