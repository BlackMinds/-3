import { getPool } from '~/server/database/db'
import { checkAchievements } from '~/server/engine/achievementData'
import { getSkillSlotLimits } from '~/game/data'

export default defineEventHandler(async (event) => {
  try {
    const pool = getPool()
    const userId = event.context.userId
    const { equipped } = await readBody(event)

    const { rows: charRows } = await pool.query(
      'SELECT id, realm_tier FROM characters WHERE user_id = $1',
      [userId]
    )

    if (charRows.length === 0) {
      return { code: 400, message: '角色不存在' }
    }

    const charId = charRows[0].id
    const realmTier = Number(charRows[0].realm_tier) || 1

    // 校验装备槽位数量不超过当前境界上限
    const limits = getSkillSlotLimits(realmTier)
    if (Array.isArray(equipped)) {
      const counts: Record<string, number> = { active: 0, divine: 0, passive: 0 }
      const slotSeen: Record<string, boolean> = {}
      for (const item of equipped) {
        const type = String(item.skill_type)
        const slotIdx = Number(item.slot_index)
        // 校验 slot_index 在上限内
        const max = limits[type as keyof typeof limits]
        if (max === undefined || slotIdx < 0 || slotIdx >= max) {
          return { code: 400, message: `当前境界 ${type} 最多装备 ${max ?? 0} 个（请先突破）` }
        }
        // 校验同槽位不重复
        const key = `${type}_${slotIdx}`
        if (slotSeen[key]) {
          return { code: 400, message: '不能在同一槽位装备多个功法' }
        }
        slotSeen[key] = true
        counts[type] = (counts[type] || 0) + 1
      }
    }

    // 读取已有装备的等级,后续保留
    const { rows: oldEquipped } = await pool.query(
      'SELECT skill_id, skill_type, slot_index, level FROM character_skills WHERE character_id = $1',
      [charId]
    )
    const oldLevelMap: Record<string, number> = {}
    for (const row of oldEquipped) {
      oldLevelMap[`${row.skill_type}_${row.slot_index}_${row.skill_id}`] = row.level
    }

    // 先清空旧装备
    await pool.query('DELETE FROM character_skills WHERE character_id = $1', [charId])

    // 插入新装备(保留同槽位同 skill 的等级)
    if (Array.isArray(equipped) && equipped.length > 0) {
      for (const item of equipped) {
        const key = `${item.skill_type}_${item.slot_index}_${item.skill_id}`
        const level = oldLevelMap[key] || 1
        await pool.query(
          'INSERT INTO character_skills (character_id, skill_id, skill_type, slot_index, level) VALUES ($1, $2, $3, $4, $5)',
          [charId, item.skill_id, item.skill_type, item.slot_index, level]
        )
      }
    }

    checkAchievements(charId, 'skill_equip', 1).catch(() => {})

    return { code: 200, message: '装备保存成功' }
  } catch (error) {
    console.error('保存装备失败:', error)
    return { code: 500, message: '服务器错误' }
  }
})
