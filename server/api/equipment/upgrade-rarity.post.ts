import { getPool } from '~/server/database/db'
import { getCharId, consumeSpecialItem, SUB_STAT_POOL, rollSubStatValue } from '~/server/utils/equipment'
import { rand } from '~/server/utils/random'
import { generateEquipName } from '~/server/engine/equipNameData'

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

    // 仅紫品/金品可升
    if (eq.rarity !== 'purple' && eq.rarity !== 'gold') {
      return { code: 400, message: '仅灵宝/仙器可升品' }
    }

    const used = await consumeSpecialItem(charId, 'equip_upgrade')
    if (!used) return { code: 400, message: '没有太古精魂' }

    // 主属性按倍率提升
    const newRarity = eq.rarity === 'purple' ? 'gold' : 'red'
    const oldMul = eq.rarity === 'purple' ? 1.18 : 1.25
    const newMul = newRarity === 'gold' ? 1.25 : 1.35
    const newPrimary = Math.floor(eq.primary_value * newMul / oldMul)

    // 副属性数量+1
    let subStats = eq.sub_stats
    if (typeof subStats === 'string') subStats = JSON.parse(subStats)
    if (!Array.isArray(subStats)) subStats = []
    const tier = eq.tier || 1
    const rarityIdx = newRarity === 'gold' ? 4 : 5
    // 选一个未出现的副属性
    const existing = new Set(subStats.map((s: any) => s.stat))
    const available = SUB_STAT_POOL.filter(s => !existing.has(s.stat))
    if (available.length > 0) {
      const newSub = available[rand(0, available.length - 1)]
      subStats.push({
        stat: newSub.stat,
        value: rollSubStatValue(newSub.stat, newSub.min, newSub.max, rarityIdx, tier),
      })
    }

    // 更新装备名(保留原 weapon_type, 替换品质前缀)
    const newName = generateEquipName(newRarity, eq.base_slot || 'weapon', eq.weapon_type, tier, eq.primary_stat, null, '升品')

    await pool.query(
      'UPDATE character_equipment SET rarity = $1, primary_value = $2, sub_stats = $3, name = $4 WHERE id = $5',
      [newRarity, newPrimary, JSON.stringify(subStats), newName, equip_id]
    )

    return { code: 200, message: `升品成功! ${eq.rarity} → ${newRarity}`, data: { newRarity, newPrimary, newName, subStats } }
  } catch (error) {
    console.error('升品失败:', error)
    return { code: 500, message: '服务器错误' }
  }
})
