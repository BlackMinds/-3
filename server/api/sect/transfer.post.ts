import { getPool } from '~/server/database/db'
import { getCharByUserId, getMembership } from '~/server/utils/sect'

export default defineEventHandler(async (event) => {
  try {
    const pool = getPool()
    const { target_character_id } = await readBody(event)
    const char = await getCharByUserId(event.context.userId)
    if (!char) return { code: 400, message: '角色不存在' }

    const membership = await getMembership(char.id)
    if (!membership || membership.role !== 'leader') return { code: 403, message: '仅宗主可操作' }

    const sectId = membership.sect_id

    // 检查目标是否在宗门内
    const { rows: targetRows } = await pool.query(
      'SELECT * FROM sect_members WHERE sect_id = $1 AND character_id = $2', [sectId, target_character_id]
    )
    if (targetRows.length === 0) return { code: 400, message: '目标不在宗门内' }

    // 转让
    await pool.query('UPDATE sect_members SET role = $1 WHERE sect_id = $2 AND character_id = $3', ['vice_leader', sectId, char.id])
    await pool.query('UPDATE sect_members SET role = $1 WHERE sect_id = $2 AND character_id = $3', ['leader', sectId, target_character_id])
    await pool.query('UPDATE sects SET leader_id = $1 WHERE id = $2', [target_character_id, sectId])

    return { code: 200, message: '宗主已转让' }
  } catch (error) {
    console.error('转让宗主失败:', error)
    return { code: 500, message: '服务器错误' }
  }
})
