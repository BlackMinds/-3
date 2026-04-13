import { getPool } from '~/server/database/db'
import { getCharByUserId, getMembership } from '~/server/utils/sect'
import { getSectSkill } from '~/server/engine/sectData'

export default defineEventHandler(async (event) => {
  try {
    const pool = getPool()
    const { skill_key } = await readBody(event)
    const char = await getCharByUserId(event.context.userId)
    if (!char) return { code: 400, message: '角色不存在' }

    const membership = await getMembership(char.id)
    if (!membership) return { code: 400, message: '未加入宗门' }

    const skillCfg = getSectSkill(skill_key)
    if (!skillCfg) return { code: 400, message: '功法不存在' }
    if (membership.sect_level < skillCfg.requiredSectLevel) return { code: 400, message: '宗门等级不足' }
    if (Number(membership.contribution) < skillCfg.learnCost) return { code: 400, message: '贡献度不足' }

    // 检查是否已学
    const { rows: existing } = await pool.query(
      'SELECT id FROM sect_skills WHERE character_id = $1 AND skill_key = $2', [char.id, skill_key]
    )
    if (existing.length > 0) return { code: 400, message: '已学习该功法' }

    await pool.query(
      'UPDATE sect_members SET contribution = contribution - $1 WHERE character_id = $2',
      [skillCfg.learnCost, char.id]
    )
    await pool.query(
      'INSERT INTO sect_skills (character_id, skill_key, level) VALUES ($1, $2, 1)',
      [char.id, skill_key]
    )

    return { code: 200, message: `学习【${skillCfg.name}】成功` }
  } catch (error) {
    console.error('学习宗门功法失败:', error)
    return { code: 500, message: '服务器错误' }
  }
})
