import { getPool } from '~/server/database/db'
import { getCharId, getActiveLoadoutId, syncLoadoutSlot } from '~/server/utils/equipment'
import { checkAchievements } from '~/server/engine/achievementData'

export default defineEventHandler(async (event) => {
  try {
    const pool = getPool()
    const { equip_id, slot } = await readBody(event)
    const char = await getCharId(event.context.userId)
    if (!char) return { code: 400, message: '角色不存在' }

    const charId = char.id

    // 校验装备类型与槽位匹配
    const { rows: eqRows } = await pool.query(
      'SELECT base_slot, req_level FROM character_equipment WHERE id = $1 AND character_id = $2',
      [equip_id, charId]
    )
    if (eqRows.length === 0) {
      return { code: 400, message: '装备不存在' }
    }
    if (eqRows[0].base_slot && eqRows[0].base_slot !== slot) {
      return { code: 400, message: '装备类型不匹配' }
    }
    // 校验等级
    const { rows: charLvRows } = await pool.query(
      'SELECT level FROM characters WHERE id = $1', [charId]
    )
    const charLv = charLvRows.length > 0 ? (charLvRows[0].level || 1) : 1
    if (eqRows[0].req_level && charLv < eqRows[0].req_level) {
      return { code: 400, message: `等级不足,需要 Lv.${eqRows[0].req_level}` }
    }

    // 先把该槽位已有装备卸下
    await pool.query(
      'UPDATE character_equipment SET slot = NULL WHERE character_id = $1 AND slot = $2',
      [charId, slot]
    )

    // 穿上新装备
    await pool.query(
      'UPDATE character_equipment SET slot = $1 WHERE id = $2 AND character_id = $3',
      [slot, equip_id, charId]
    )

    // 同步写当前激活方案：把该 slot 的装备 id 更新为新穿的
    const activeLoadout = await getActiveLoadoutId(charId)
    await syncLoadoutSlot(charId, activeLoadout, slot, equip_id)

    // 成就：穿戴 + 全副武装检查
    checkAchievements(charId, 'equip_wear', 1).catch(() => {})
    const { rows: slotRows } = await pool.query(
      'SELECT COUNT(DISTINCT slot) AS cnt FROM character_equipment WHERE character_id = $1 AND slot IS NOT NULL', [charId]
    )
    if (slotRows[0]?.cnt) checkAchievements(charId, 'equip_slots_filled', slotRows[0].cnt).catch(() => {})

    return { code: 200, message: '装备成功' }
  } catch (error) {
    console.error('穿戴装备失败:', error)
    return { code: 500, message: '服务器错误' }
  }
})
