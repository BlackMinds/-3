import { getPool } from '~/server/database/db'
import { getCharByUserId, getMembership } from '~/server/utils/sect'

export default defineEventHandler(async (event) => {
  try {
    const pool = getPool()
    const { announcement, join_mode } = await readBody(event)
    const char = await getCharByUserId(event.context.userId)
    if (!char) return { code: 400, message: '角色不存在' }

    const membership = await getMembership(char.id)
    if (!membership || membership.role !== 'leader') return { code: 403, message: '仅宗主可操作' }

    const updates: string[] = []
    const params: any[] = []
    let paramIdx = 1
    if (announcement !== undefined) { updates.push(`announcement = $${paramIdx++}`); params.push(String(announcement).slice(0, 50)) }
    if (join_mode === 'approval' || join_mode === 'free') { updates.push(`join_mode = $${paramIdx++}`); params.push(join_mode) }
    if (updates.length === 0) return { code: 400, message: '无修改项' }

    params.push(membership.sect_id)
    await pool.query(`UPDATE sects SET ${updates.join(', ')} WHERE id = $${paramIdx}`, params)

    return { code: 200, message: '设置已更新' }
  } catch (error) {
    console.error('修改宗门设置失败:', error)
    return { code: 500, message: '服务器错误' }
  }
})
