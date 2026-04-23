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
      const skillSeen: Record<string, boolean> = {}
      for (const item of equipped) {
        const type = String(item.skill_type)
        const slotIdx = Number(item.slot_index)
        const skillId = String(item.skill_id)
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
        // 校验同一功法不能跨槽位重复装备
        if (skillSeen[skillId]) {
          return { code: 400, message: '同一功法不能重复装备' }
        }
        skillSeen[skillId] = true
        counts[type] = (counts[type] || 0) + 1
      }
    }

    // 先把当前已装备表的等级回写到 inventory（兜底：万一有历史数据或别处升级没同步，确保 inventory 是等级主权位置）
    await pool.query(
      `UPDATE character_skill_inventory csi
       SET level = sub.max_lv
       FROM (
         SELECT character_id, skill_id, MAX(level) AS max_lv
         FROM character_skills
         WHERE character_id = $1
         GROUP BY character_id, skill_id
       ) sub
       WHERE csi.character_id = sub.character_id
         AND csi.skill_id = sub.skill_id
         AND csi.level < sub.max_lv`,
      [charId]
    )

    // 从 inventory 读取各 skill 的等级
    const { rows: invRows } = await pool.query(
      'SELECT skill_id, level FROM character_skill_inventory WHERE character_id = $1',
      [charId]
    )
    const invLevelMap: Record<string, number> = {}
    for (const row of invRows) invLevelMap[row.skill_id] = Number(row.level) || 1

    // 先清空旧装备
    await pool.query('DELETE FROM character_skills WHERE character_id = $1', [charId])

    // 插入新装备（等级从 inventory 读取，卸下不会丢失）
    if (Array.isArray(equipped) && equipped.length > 0) {
      for (const item of equipped) {
        const level = invLevelMap[item.skill_id] || 1
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
