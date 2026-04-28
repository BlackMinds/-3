import { getPool } from '~/server/database/db'
import { getCharId, rollSubStats } from '~/server/utils/equipment'
import { rand } from '~/server/utils/random'
import { generateEquipName } from '~/server/engine/equipNameData'
import { EQUIP_SETS } from '~/server/engine/equipSetData'
import { EQUIP_PRIMARY_BASE, RARITY_STAT_MUL, EQUIP_BAG_LIMIT } from '~/shared/balance'

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

    // 背包容量校验：合成是玩家主动行为，满了直接拒绝（不扣碎片，让玩家先清背包）
    const { rows: bagCountRows } = await pool.query(
      'SELECT COUNT(*)::int AS cnt FROM character_equipment WHERE character_id = $1 AND slot IS NULL',
      [charId]
    )
    if ((bagCountRows[0]?.cnt || 0) >= EQUIP_BAG_LIMIT) {
      return { code: 400, message: `背包已满（${EQUIP_BAG_LIMIT}件），请先清理后再合成` }
    }

    // 扣5个碎片
    await pool.query('UPDATE character_pills SET count = count - 5 WHERE id = $1', [fragRows[0].id])
    await pool.query("DELETE FROM character_pills WHERE id = $1 AND count <= 0", [fragRows[0].id])

    // 生成金品装备(随机槽位)
    const slots = ['weapon', 'armor', 'helmet', 'boots', 'treasure', 'ring', 'pendant']
    const slotIdx = rand(0, slots.length - 1)
    const slot = slots[slotIdx]
    const primaryStats: Record<string, string> = { weapon: 'ATK', armor: 'DEF', helmet: 'HP', boots: 'SPD', treasure: 'ATK', ring: 'CRIT_DMG', pendant: 'SPIRIT' }
    const ps = primaryStats[slot]
    const tier = rand(6, 8)
    const pv = Math.max(1, Math.floor((EQUIP_PRIMARY_BASE[ps] || 30) * tier * RARITY_STAT_MUL[4] * 1.10))

    // 4条副属性（金品 rarityIdx=4）
    const subs = rollSubStats(4, tier, 4)

    const tierReqLevels: Record<number, number> = { 1: 1, 2: 15, 3: 35, 4: 55, 5: 80, 6: 110, 7: 140, 8: 170, 9: 185, 10: 195, 11: 215, 12: 240 }
    const weaponType = slot === 'weapon' ? ['sword', 'blade', 'spear', 'fan'][rand(0, 3)] : null

    // 宗门套装碎片合成：从全部 7 套中随机抽一套（保底必出套装）
    // 十三枪要求装备「枪」，若槽位非 weapon 或 weaponType 非 spear 则跳过
    const eligibleSets = EQUIP_SETS.filter(s => {
      const req = (s.tiers[0]?.hooks as any)?.weaponRequired
      if (!req) return true
      return slot === 'weapon' && weaponType === req
    })
    const setKey = eligibleSets[rand(0, eligibleSets.length - 1)].setKey
    const equipName = generateEquipName('gold', slot, weaponType, tier, ps, null, '', setKey)

    await pool.query(
      'INSERT INTO character_equipment (character_id, name, rarity, primary_stat, primary_value, sub_stats, set_id, tier, base_slot, weapon_type, req_level, enhance_level) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 0)',
      [charId, equipName, 'gold', ps, pv, JSON.stringify(subs), setKey, tier, slot, weaponType, tierReqLevels[tier] || 1]
    )

    return { code: 200, message: `合成成功! 获得【${equipName}】`, data: { equipName, tier, rarity: 'gold', set_id: setKey } }
  } catch (error) {
    console.error('合成失败:', error)
    return { code: 500, message: '服务器错误' }
  }
})
