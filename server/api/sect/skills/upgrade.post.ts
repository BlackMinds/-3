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

    const { rows: existing } = await pool.query(
      'SELECT * FROM sect_skills WHERE character_id = $1 AND skill_key = $2', [char.id, skill_key]
    )
    if (existing.length === 0) return { code: 400, message: '未学习该功法' }
    if (existing[0].level >= 5) return { code: 400, message: '已达最高等级' }

    const skillCfg = getSectSkill(skill_key)
    if (!skillCfg) return { code: 400, message: '功法不存在' }

    const cost = skillCfg.learnCost * (existing[0].level + 1)
    if (Number(membership.contribution) < cost) return { code: 400, message: `贡献度不足，需${cost}` }

    await pool.query('UPDATE sect_members SET contribution = contribution - $1 WHERE character_id = $2', [cost, char.id])
    await pool.query('UPDATE sect_skills SET level = level + 1 WHERE character_id = $1 AND skill_key = $2', [char.id, skill_key])

    return { code: 200, message: `【${skillCfg.name}】升至Lv.${existing[0].level + 1}` }
  } catch (error) {
    console.error('升级宗门功法失败:', error)
    return { code: 500, message: '服务器错误' }
  }
})
