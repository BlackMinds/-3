import { getPool } from '~/server/database/db'
import { getCharByUserId, getMembership } from '~/server/utils/sect'
import { ROLE_HIERARCHY, ROLE_NAMES, ROLE_MAX_COUNT, ROLE_CONTRIBUTION_REQ } from '~/server/engine/sectData'

export default defineEventHandler(async (event) => {
  try {
    const pool = getPool()
    const { target_character_id, role } = await readBody(event)
    const char = await getCharByUserId(event.context.userId)
    if (!char) return { code: 400, message: '角色不存在' }

    const membership = await getMembership(char.id)
    if (!membership || ROLE_HIERARCHY[membership.role] < ROLE_HIERARCHY['vice_leader']) {
      return { code: 403, message: '权限不足' }
    }

    if (!ROLE_HIERARCHY[role] || role === 'leader') return { code: 400, message: '无效职位' }
    if (ROLE_HIERARCHY[role] >= ROLE_HIERARCHY[membership.role]) return { code: 400, message: '不能任命同级或更高职位' }

    const { rows: targetRows } = await pool.query(
      'SELECT * FROM sect_members WHERE sect_id = $1 AND character_id = $2', [membership.sect_id, target_character_id]
    )
    if (targetRows.length === 0) return { code: 400, message: '目标不在宗门内' }

    // 检查贡献度要求（按累计总贡献，不受消耗影响）
    const reqContrib = ROLE_CONTRIBUTION_REQ[role] || 0
    if (Number(targetRows[0].total_contribution) < reqContrib) {
      return { code: 400, message: `累计贡献不足，需${reqContrib}` }
    }

    // 检查人数限制
    const maxCount = ROLE_MAX_COUNT[role]
    if (maxCount > 0) {
      const { rows: countRows } = await pool.query(
        'SELECT COUNT(*) as cnt FROM sect_members WHERE sect_id = $1 AND role = $2', [membership.sect_id, role]
      )
      if (countRows[0].cnt >= maxCount) return { code: 400, message: `${ROLE_NAMES[role]}已达上限` }
    }

    await pool.query('UPDATE sect_members SET role = $1 WHERE sect_id = $2 AND character_id = $3', [role, membership.sect_id, target_character_id])

    return { code: 200, message: `已任命为${ROLE_NAMES[role]}` }
  } catch (error) {
    console.error('任命失败:', error)
    return { code: 500, message: '服务器错误' }
  }
})
