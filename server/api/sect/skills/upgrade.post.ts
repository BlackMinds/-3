import { getPool } from '~/server/database/db'
import { getCharByUserId, getMembership } from '~/server/utils/sect'
import { getSectSkill } from '~/server/engine/sectData'

export default defineEventHandler(async (event) => {
  try {
    const pool = getPool()
    const { skill_key } = await readBody(event)
    const char = await getCharByUserId(event.context.userId)
    if (!char) return { code: 400, message: '角色不存在' }

    const client = await pool.connect()
    let oldLevel = 0
    let skillName = skill_key
    try {
      await client.query('BEGIN')

      // 事务内复查：贡献 + 技能等级，防并发重复升级
      const { rows: memberRows } = await client.query(
        'SELECT contribution FROM sect_members WHERE character_id = $1 FOR UPDATE',
        [char.id]
      )
      if (memberRows.length === 0) {
        await client.query('ROLLBACK')
        return { code: 400, message: '未加入宗门' }
      }

      const { rows: existing } = await client.query(
        'SELECT level FROM sect_skills WHERE character_id = $1 AND skill_key = $2 FOR UPDATE',
        [char.id, skill_key]
      )
      if (existing.length === 0) {
        await client.query('ROLLBACK')
        return { code: 400, message: '未学习该功法' }
      }
      oldLevel = existing[0].level
      if (oldLevel >= 5) {
        await client.query('ROLLBACK')
        return { code: 400, message: '已达最高等级' }
      }

      const skillCfg = getSectSkill(skill_key)
      if (!skillCfg) {
        await client.query('ROLLBACK')
        return { code: 400, message: '功法不存在' }
      }
      skillName = skillCfg.name

      const cost = skillCfg.learnCost * (oldLevel + 1)
      if (Number(memberRows[0].contribution) < cost) {
        await client.query('ROLLBACK')
        return { code: 400, message: `贡献度不足，需${cost}` }
      }

      // 条件扣贡献
      await client.query(
        'UPDATE sect_members SET contribution = contribution - $1 WHERE character_id = $2 AND contribution >= $1',
        [cost, char.id]
      )
      await client.query(
        'UPDATE sect_skills SET level = level + 1 WHERE character_id = $1 AND skill_key = $2',
        [char.id, skill_key]
      )

      await client.query('COMMIT')
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {})
      throw e
    } finally {
      client.release()
    }

    return { code: 200, message: `【${skillName}】升至Lv.${oldLevel + 1}` }
  } catch (error) {
    console.error('升级宗门功法失败:', error)
    return { code: 500, message: '服务器错误' }
  }
})
