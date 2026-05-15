import { getPool } from '~/server/database/db'
import { getCharId, consumeSpecialItem, rollSubStatsV4, RARITY_SUB_COUNT } from '~/server/utils/equipment'
import { EQUIP_SUB_POOL_V4 } from '~/shared/balance'
import { rollV5EnhanceAffixes, getV5SlotIndexByBaseSlot } from '~/server/utils/equipment-v5'
import { getV5EnhanceAffixCount, type V5Rarity, type V5BaseSlot } from '~/shared/balance-v5'

const V5_RARITIES = new Set<string>(['blue', 'purple', 'gold', 'red'])

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

    const isV5 = eq.equipment_version === 5
    const tier = eq.tier || 1
    const slotKey = eq.base_slot

    let newSubs: { stat: string; value: number }[]

    if (isV5) {
      // V5 装备：按 V5.0.3 权重池重 roll 强化副词条
      if (!V5_RARITIES.has(eq.rarity)) {
        return { code: 400, message: '该品质 V5 装备没有副属性' }
      }
      if (!slotKey) {
        return { code: 400, message: '装备槽位信息缺失，无法洗练' }
      }
      const enhanceLevel = eq.enhance_level || 0
      const subCount = getV5EnhanceAffixCount(eq.rarity as V5Rarity, enhanceLevel)
      if (subCount === 0) {
        return { code: 400, message: '该装备没有副属性' }
      }
      const used = await consumeSpecialItem(charId, 'reroll_sub_stat')
      if (!used) return { code: 400, message: '没有装备鉴定符' }

      const slotIndex = getV5SlotIndexByBaseSlot(slotKey as V5BaseSlot)
      newSubs = rollV5EnhanceAffixes(slotIndex, eq.rarity as V5Rarity, enhanceLevel, tier)
    } else {
      // V4 装备：旧路径
      const subCount = RARITY_SUB_COUNT[eq.rarity] || 0
      if (subCount === 0) return { code: 400, message: '该品质装备没有副属性' }

      if (!slotKey || !EQUIP_SUB_POOL_V4[slotKey]) {
        return { code: 400, message: '装备槽位信息缺失，无法洗练' }
      }

      const used = await consumeSpecialItem(charId, 'reroll_sub_stat')
      if (!used) return { code: 400, message: '没有装备鉴定符' }

      // v4.0: 从对应部位的新版词条池抽取，按词条位分桶；保留原副词条数量
      newSubs = rollSubStatsV4(slotKey, eq.rarity, tier, subCount)
    }

    await pool.query('UPDATE character_equipment SET sub_stats = $1 WHERE id = $2', [JSON.stringify(newSubs), equip_id])
    return { code: 200, message: '副属性已重随', data: { sub_stats: newSubs } }
  } catch (error) {
    console.error('鉴定失败:', error)
    return { code: 500, message: '服务器错误' }
  }
})
