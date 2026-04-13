import { getPool } from '~/server/database/db'
import { getCharByUserId, getMembership } from '~/server/utils/sect'
import { ROLE_HIERARCHY } from '~/server/engine/sectData'

export default defineEventHandler(async (event) => {
  try {
    const pool = getPool()
    const char = await getCharByUserId(event.context.userId)
    if (!char) return { code: 400, message: '角色不存在' }

    const membership = await getMembership(char.id)
    if (!membership || ROLE_HIERARCHY[membership.role] < ROLE_HIERARCHY['elder']) {
      return { code: 403, message: '权限不足' }
    }

    const { rows } = await pool.query(
      `SELECT sa.id, sa.character_id, sa.applied_at, c.name, c.level, c.realm_tier
       FROM sect_applications sa JOIN characters c ON sa.character_id = c.id
       WHERE sa.sect_id = $1 AND sa.status = $2 ORDER BY sa.applied_at DESC`,
      [membership.sect_id, 'pending']
    )

    return { code: 200, data: rows }
  } catch (error) {
    console.error('获取申请列表失败:', error)
    return { code: 500, message: '服务器错误' }
  }
})
