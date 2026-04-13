import { getPool } from '~/server/database/db'
import { getCharByUserId, getMembership } from '~/server/utils/sect'

export default defineEventHandler(async (event) => {
  try {
    const pool = getPool()
    const char = await getCharByUserId(event.context.userId)
    if (!char) return { code: 400, message: '角色不存在' }

    const membership = await getMembership(char.id)
    if (!membership) return { code: 400, message: '未加入宗门' }
    if (membership.role === 'leader') return { code: 400, message: '宗主不能退出，请先转让' }

    await pool.query('DELETE FROM sect_members WHERE sect_id = $1 AND character_id = $2', [membership.sect_id, char.id])
    await pool.query('UPDATE sects SET member_count = member_count - 1 WHERE id = $1', [membership.sect_id])
    await pool.query('UPDATE characters SET sect_id = NULL, sect_quit_time = NOW() WHERE id = $1', [char.id])
    await pool.query('UPDATE sect_skills SET frozen = TRUE WHERE character_id = $1', [char.id])

    return { code: 200, message: '已退出宗门' }
  } catch (error) {
    console.error('退出宗门失败:', error)
    return { code: 500, message: '服务器错误' }
  }
})
