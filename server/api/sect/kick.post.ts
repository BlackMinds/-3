import { getPool } from '~/server/database/db'
import { getCharByUserId, getMembership } from '~/server/utils/sect'
import { ROLE_HIERARCHY } from '~/server/engine/sectData'

export default defineEventHandler(async (event) => {
  try {
    const pool = getPool()
    const { target_character_id } = await readBody(event)
    const char = await getCharByUserId(event.context.userId)
    if (!char) return { code: 400, message: '角色不存在' }

    const membership = await getMembership(char.id)
    if (!membership || ROLE_HIERARCHY[membership.role] < ROLE_HIERARCHY['vice_leader']) {
      return { code: 403, message: '权限不足' }
    }

    // 不能踢宗主
    const { rows: targetRows } = await pool.query(
      'SELECT * FROM sect_members WHERE sect_id = $1 AND character_id = $2', [membership.sect_id, target_character_id]
    )
    if (targetRows.length === 0) return { code: 400, message: '目标不在宗门内' }
    if (targetRows[0].role === 'leader') return { code: 400, message: '不能踢出宗主' }
    if (ROLE_HIERARCHY[targetRows[0].role] >= ROLE_HIERARCHY[membership.role]) return { code: 400, message: '不能踢出同级或更高职位' }

    await pool.query('DELETE FROM sect_members WHERE sect_id = $1 AND character_id = $2', [membership.sect_id, target_character_id])
    await pool.query('UPDATE sects SET member_count = member_count - 1 WHERE id = $1', [membership.sect_id])
    await pool.query('UPDATE characters SET sect_id = NULL, sect_quit_time = NOW() WHERE id = $1', [target_character_id])
    await pool.query('UPDATE sect_skills SET frozen = TRUE WHERE character_id = $1', [target_character_id])

    return { code: 200, message: '已踢出' }
  } catch (error) {
    console.error('踢出失败:', error)
    return { code: 500, message: '服务器错误' }
  }
})
