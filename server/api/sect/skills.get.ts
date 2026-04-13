import { getPool } from '~/server/database/db'
import { getCharByUserId, getMembership } from '~/server/utils/sect'
import { SECT_SKILLS, calcSectSkillEffect } from '~/server/engine/sectData'

export default defineEventHandler(async (event) => {
  try {
    const pool = getPool()
    const char = await getCharByUserId(event.context.userId)
    if (!char) return { code: 400, message: '角色不存在' }

    const membership = await getMembership(char.id)
    if (!membership) return { code: 400, message: '未加入宗门' }

    const { rows: learned } = await pool.query(
      'SELECT * FROM sect_skills WHERE character_id = $1', [char.id]
    )

    const learnedMap: Record<string, { level: number; frozen: boolean }> = {}
    for (const l of learned) learnedMap[l.skill_key] = { level: l.level, frozen: !!l.frozen }

    const skills = SECT_SKILLS.map(s => ({
      ...s,
      learned: !!learnedMap[s.key],
      level: learnedMap[s.key]?.level || 0,
      frozen: learnedMap[s.key]?.frozen || false,
      available: membership.sect_level >= s.requiredSectLevel,
      upgradeCost: learnedMap[s.key] ? s.learnCost * ((learnedMap[s.key].level || 1) + 1) : s.learnCost,
      currentEffects: learnedMap[s.key] ? calcSectSkillEffect(s, learnedMap[s.key].level) : null,
    }))

    return { code: 200, data: skills, contribution: Number(membership.contribution) }
  } catch (error) {
    console.error('宗门功法列表失败:', error)
    return { code: 500, message: '服务器错误' }
  }
})
