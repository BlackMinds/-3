import { getPool } from '~/server/database/db'
import { ACHIEVEMENTS_MAP, generateEquipBox, generateSkillBox } from '~/server/engine/achievementData'
import { SKILL_MAP } from '~/server/engine/skillData'

export default defineEventHandler(async (event) => {
  try {
    const pool = getPool()
    const { achievement_id } = await readBody(event)
    if (!achievement_id) return { code: 400, message: '参数错误' }

    const def = ACHIEVEMENTS_MAP[achievement_id]
    if (!def) return { code: 400, message: '成就不存在' }

    const { rows: charRows } = await pool.query(
      'SELECT id, level FROM characters WHERE user_id = $1', [event.context.userId]
    )
    if (charRows.length === 0) return { code: 400, message: '角色不存在' }
    const charId = charRows[0].id
    const charLevel = charRows[0].level || 1

    // 检查是否完成且未领取
    const { rows } = await pool.query(
      'SELECT completed, claimed FROM character_achievements WHERE character_id = $1 AND achievement_id = $2',
      [charId, achievement_id]
    )
    if (rows.length === 0 || !rows[0].completed) return { code: 400, message: '成就未完成' }
    if (rows[0].claimed) return { code: 400, message: '已领取过' }

    // 发放奖励
    const rewards: string[] = []
    const r = def.reward

    // 灵石
    if (r.spirit_stone) {
      await pool.query('UPDATE characters SET spirit_stone = spirit_stone + $1 WHERE id = $2', [r.spirit_stone, charId])
      rewards.push(`灵石 +${r.spirit_stone}`)
    }

    // 装备箱
    if (r.equip_box && r.equip_box_count) {
      for (let i = 0; i < r.equip_box_count; i++) {
        const equip = generateEquipBox(r.equip_box, charLevel)
        await pool.query(
          `INSERT INTO character_equipment (character_id, name, rarity, primary_stat, primary_value, sub_stats, set_id, tier, weapon_type, base_slot, req_level, enhance_level) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 0)`,
          [charId, equip.name, equip.rarity, equip.primary_stat, equip.primary_value, equip.sub_stats, equip.set_id, equip.tier, equip.weapon_type, equip.base_slot, equip.req_level]
        )
        rewards.push(`装备【${equip.name}】`)
      }
    }

    // 功法碎片箱
    if (r.skill_box && r.skill_box_count) {
      for (let i = 0; i < r.skill_box_count; i++) {
        const skillId = generateSkillBox(r.skill_box)
        await pool.query(
          `INSERT INTO character_skill_inventory (character_id, skill_id, count) VALUES ($1, $2, 1)
           ON CONFLICT (character_id, skill_id) DO UPDATE SET count = character_skill_inventory.count + 1`,
          [charId, skillId]
        )
        const skillName = SKILL_MAP[skillId]?.name || skillId
        rewards.push(`功法残页【${skillName}】`)
      }
    }

    // 标记已领取
    await pool.query(
      'UPDATE character_achievements SET claimed = TRUE, claimed_at = NOW() WHERE character_id = $1 AND achievement_id = $2',
      [charId, achievement_id]
    )

    return {
      code: 200,
      data: {
        rewards,
        title: def.title || null,
      },
      message: '领取成功'
    }
  } catch (error) {
    console.error('领取成就奖励失败:', error)
    return { code: 500, message: '服务器错误' }
  }
})
