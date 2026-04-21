import { getPool } from '~/server/database/db'
import { getCharId, rollSubStats } from '~/server/utils/equipment'
import { rand } from '~/server/utils/random'
import { generateEquipName } from '~/server/engine/equipNameData'

export default defineEventHandler(async (event) => {
  try {
    const pool = getPool()
    const char = await getCharId(event.context.userId)
    if (!char) return { code: 400, message: '角色不存在' }
    const charId = char.id

    // 检查碎片数量
    const { rows: fragRows } = await pool.query(
      "SELECT id, count FROM character_pills WHERE character_id = $1 AND pill_id = 'set_fragment' LIMIT 1",
      [charId]
    )
    const totalFrags = fragRows.length > 0 ? Number(fragRows[0].count) : 0
    if (totalFrags < 5) return { code: 400, message: `套装碎片不足,需5个(当前${totalFrags})` }

    // 扣5个碎片
    await pool.query('UPDATE character_pills SET count = count - 5 WHERE id = $1', [fragRows[0].id])
    await pool.query("DELETE FROM character_pills WHERE id = $1 AND count <= 0", [fragRows[0].id])

    // 生成金品装备(随机槽位)
    const slots = ['weapon', 'armor', 'helmet', 'boots', 'treasure', 'ring', 'pendant']
    const slotIdx = rand(0, slots.length - 1)
    const slot = slots[slotIdx]
    const primaryStats: Record<string, string> = { weapon: 'ATK', armor: 'DEF', helmet: 'HP', boots: 'SPD', treasure: 'ATK', ring: 'CRIT_RATE', pendant: 'SPIRIT' }
    const primaryBases: Record<string, number> = { ATK: 30, DEF: 20, HP: 200, SPD: 15, CRIT_RATE: 1, SPIRIT: 8 }
    const ps = primaryStats[slot]
    const tier = rand(6, 8)
    const pv = Math.floor((primaryBases[ps] || 30) * tier * 1.25)

    // 4条副属性（金品 rarityIdx=4）
    const subs = rollSubStats(4, tier, 4)

    const tierReqLevels: Record<number, number> = { 1: 1, 2: 15, 3: 35, 4: 55, 5: 80, 6: 110, 7: 140, 8: 170, 9: 185, 10: 195 }
    const weaponType = slot === 'weapon' ? ['sword', 'blade', 'spear', 'fan'][rand(0, 3)] : null
    const equipName = generateEquipName('gold', slot, weaponType, tier, ps, null, '宗门套装')

    await pool.query(
      'INSERT INTO character_equipment (character_id, name, rarity, primary_stat, primary_value, sub_stats, tier, base_slot, weapon_type, req_level, enhance_level) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 0)',
      [charId, equipName, 'gold', ps, pv, JSON.stringify(subs), tier, slot, weaponType, tierReqLevels[tier] || 1]
    )

    return { code: 200, message: `合成成功! 获得【${equipName}】`, data: { equipName, tier, rarity: 'gold' } }
  } catch (error) {
    console.error('合成失败:', error)
    return { code: 500, message: '服务器错误' }
  }
})
