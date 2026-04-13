import { getPool } from '~/server/database/db'
import { getCharByUserId, getMembership } from '~/server/utils/sect'

export default defineEventHandler(async (event) => {
  try {
    const pool = getPool()
    const char = await getCharByUserId(event.context.userId)
    if (!char) return { code: 400, message: '角色不存在' }

    const membership = await getMembership(char.id)
    if (!membership) return { code: 400, message: '未加入宗门' }

    const { rows } = await pool.query(
      `SELECT sm.character_id, sm.contribution, sm.weekly_contribution, sm.role, c.name, c.level
       FROM sect_members sm JOIN characters c ON sm.character_id = c.id
       WHERE sm.sect_id = $1 ORDER BY sm.contribution DESC`,
      [membership.sect_id]
    )

    return { code: 200, data: rows }
  } catch (error) {
    console.error('排行失败:', error)
    return { code: 500, message: '服务器错误' }
  }
})
