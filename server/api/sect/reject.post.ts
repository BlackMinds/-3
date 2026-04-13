import { getPool } from '~/server/database/db'
import { getCharByUserId, getMembership } from '~/server/utils/sect'
import { ROLE_HIERARCHY } from '~/server/engine/sectData'

export default defineEventHandler(async (event) => {
  try {
    const pool = getPool()
    const { application_id } = await readBody(event)
    const char = await getCharByUserId(event.context.userId)
    if (!char) return { code: 400, message: '角色不存在' }

    const membership = await getMembership(char.id)
    if (!membership || ROLE_HIERARCHY[membership.role] < ROLE_HIERARCHY['elder']) {
      return { code: 403, message: '权限不足' }
    }

    await pool.query(
      'UPDATE sect_applications SET status = $1, handled_at = NOW(), handled_by = $2 WHERE id = $3 AND sect_id = $4 AND status = $5',
      ['rejected', char.id, application_id, membership.sect_id, 'pending']
    )

    return { code: 200, message: '已拒绝' }
  } catch (error) {
    console.error('拒绝申请失败:', error)
    return { code: 500, message: '服务器错误' }
  }
})
