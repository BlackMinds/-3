import { getPool } from '~/server/database/db'
import { getCharByUserId, getMembership } from '~/server/utils/sect'

export default defineEventHandler(async (event) => {
  try {
    const pool = getPool()
    const char = await getCharByUserId(event.context.userId)
    if (!char) return { code: 400, message: '角色不存在' }

    const membership = await getMembership(char.id)
    if (!membership || membership.role !== 'leader') return { code: 403, message: '仅宗主可操作' }

    const sectId = membership.sect_id

    // 冻结所有成员宗门功法
    const { rows: allMembers } = await pool.query('SELECT character_id FROM sect_members WHERE sect_id = $1', [sectId])
    for (const m of allMembers) {
      await pool.query('UPDATE sect_skills SET frozen = TRUE WHERE character_id = $1', [m.character_id])
      await pool.query('UPDATE characters SET sect_id = NULL, sect_quit_time = NOW() WHERE id = $1', [m.character_id])
    }

    await pool.query('DELETE FROM sects WHERE id = $1', [sectId])

    return { code: 200, message: '宗门已解散' }
  } catch (error) {
    console.error('解散宗门失败:', error)
    return { code: 500, message: '服务器错误' }
  }
})
