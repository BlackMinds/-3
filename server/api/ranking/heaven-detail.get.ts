import { getPool } from '~/server/database/db'
import { SKILL_MAP } from '~/server/engine/skillData'

const SKILL_TYPE_LABEL: Record<string, string> = {
  active: '主修',
  divine: '神通',
  passive: '被动',
}

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event)
    const characterId = Number(query.characterId)
    if (!characterId || Number.isNaN(characterId)) {
      return { code: 400, message: '缺少 characterId' }
    }

    const pool = getPool()

    // 已穿戴装备（slot 不为空）
    const { rows: equipRows } = await pool.query(
      `SELECT slot, base_slot, weapon_type, name, rarity, primary_stat, primary_value,
              enhance_level, tier
         FROM character_equipment
        WHERE character_id = $1 AND slot IS NOT NULL
        ORDER BY slot ASC`,
      [characterId]
    )

    const equipments = equipRows.map(r => ({
      slot: r.slot,
      baseSlot: r.base_slot || r.slot,
      weaponType: r.weapon_type || null,
      name: r.name,
      rarity: r.rarity,
      tier: r.tier || 1,
      enhance: r.enhance_level || 0,
      primaryStat: r.primary_stat,
      primaryValue: r.primary_value,
    }))

    // 已装备功法
    const { rows: skillRows } = await pool.query(
      `SELECT cs.skill_id, cs.skill_type, cs.slot_index,
              COALESCE(csi.level, cs.level, 1) AS level
         FROM character_skills cs
         LEFT JOIN character_skill_inventory csi
                ON csi.character_id = cs.character_id AND csi.skill_id = cs.skill_id
        WHERE cs.character_id = $1 AND cs.equipped = TRUE
        ORDER BY
          CASE cs.skill_type WHEN 'active' THEN 0 WHEN 'divine' THEN 1 ELSE 2 END,
          cs.slot_index ASC`,
      [characterId]
    )

    const skills = skillRows.map(r => {
      const meta = SKILL_MAP[r.skill_id]
      return {
        skillId: r.skill_id,
        skillType: r.skill_type,
        skillTypeLabel: SKILL_TYPE_LABEL[r.skill_type] || r.skill_type,
        slotIndex: r.slot_index,
        level: r.level,
        name: meta?.name || r.skill_id,
        rarity: meta?.rarity || 'white',
        element: meta?.element || null,
      }
    })

    return { code: 200, data: { equipments, skills } }
  } catch (error) {
    console.error('通天榜详情查询失败:', error)
    return { code: 500, message: '服务器错误' }
  }
})
