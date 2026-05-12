// 子女装备列表 - GET /api/child/equipment?child_id=N
// 返回该子女的所有装备（已穿戴 + 背包内）

import { getPool } from '~/server/database/db'
import { getCharacterByUserId } from '~/server/utils/team'
import { getSlotDisplay, RARITY_DISPLAY } from '~/server/engine/childEquipData'

export default defineEventHandler(async (event) => {
  try {
    const pool = getPool()
    const q = getQuery(event)
    const childId = Number(q.child_id)
    if (!childId) return { code: 400, message: '参数错误' }

    const char = await getCharacterByUserId(event.context.userId)
    if (!char) return { code: 400, message: '角色不存在' }

    // 校验子女归属
    const { rows: chRows } = await pool.query(
      'SELECT id FROM children WHERE id = $1 AND character_id = $2',
      [childId, char.id]
    )
    if (chRows.length === 0) return { code: 404, message: '子女不存在' }

    const { rows } = await pool.query(
      `SELECT id, slot, name, rarity, tier, primary_stat, sub_stats, is_equipped
         FROM child_equipment WHERE child_id = $1
        ORDER BY is_equipped DESC, rarity DESC, obtained_at DESC`,
      [childId]
    )

    const list = rows.map((r: any) => ({
      id: r.id,
      slot: r.slot,
      slotName: getSlotDisplay(r.slot),
      name: r.name,
      rarity: r.rarity,
      rarityName: (RARITY_DISPLAY as any)[r.rarity] || r.rarity,
      tier: r.tier,
      primaryStat: r.primary_stat,
      subStats: r.sub_stats,
      isEquipped: r.is_equipped,
    }))

    return { code: 200, data: { equipments: list } }
  } catch (error) {
    console.error('子女装备列表失败:', error)
    return { code: 500, message: '服务器错误' }
  }
})
