import { getPool } from '~/server/database/db'
import { getCharId } from '~/server/utils/equipment'

export default defineEventHandler(async (event) => {
  try {
    const pool = getPool()
    const { slot: baseSlot, name, rarity, primary_stat, primary_value, sub_stats, set_id, tier, weapon_type, req_level } = await readBody(event)
    const char = await getCharId(event.context.userId)
    if (!char) return { code: 400, message: '角色不存在' }

    await pool.query(
      `INSERT INTO character_equipment (character_id, name, rarity, primary_stat, primary_value, sub_stats, set_id, tier, weapon_type, base_slot, req_level)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [char.id, name, rarity, primary_stat, primary_value, JSON.stringify(sub_stats || []), set_id || null, tier || 1, weapon_type || null, baseSlot || null, req_level || 1]
    )

    return { code: 200, message: '装备已获得' }
  } catch (error) {
    console.error('添加装备失败:', error)
    return { code: 500, message: '服务器错误' }
  }
})
