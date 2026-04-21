import { getPool } from '~/server/database/db'
import { getCharByUserId, getMembership } from '~/server/utils/sect'

export default defineEventHandler(async (event) => {
  const pool = getPool()
  const char = await getCharByUserId(event.context.userId)
  if (!char) return { code: 400, message: '角色不存在' }

  const membership = await getMembership(char.id)
  if (!membership || membership.role !== 'leader') return { code: 403, message: '仅宗主可操作' }

  const sectId = membership.sect_id

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // 锁宗门行（防并发解散/加入冲突）
    const { rows: sectRows } = await client.query(
      'SELECT id FROM sects WHERE id = $1 FOR UPDATE', [sectId]
    )
    if (sectRows.length === 0) {
      await client.query('ROLLBACK')
      return { code: 400, message: '宗门不存在' }
    }

    // 清理所有成员：冻结功法 + 清空 characters.sect_id（批量化，避免 50 人宗门跑 100 次 query）
    const { rows: allMembers } = await client.query(
      'SELECT character_id FROM sect_members WHERE sect_id = $1 FOR UPDATE', [sectId]
    )
    if (allMembers.length > 0) {
      const memberIds = allMembers.map((m: any) => m.character_id)
      await client.query(
        'UPDATE sect_skills SET frozen = TRUE WHERE character_id = ANY($1::int[])',
        [memberIds]
      )
      await client.query(
        'UPDATE characters SET sect_id = NULL, sect_quit_time = NOW() WHERE id = ANY($1::int[])',
        [memberIds]
      )
    }

    // 显式删除 sect_members（避免 ON DELETE CASCADE 未配置时的孤儿数据）
    await client.query('DELETE FROM sect_members WHERE sect_id = $1', [sectId])
    await client.query('DELETE FROM sects WHERE id = $1', [sectId])

    await client.query('COMMIT')
    return { code: 200, message: '宗门已解散' }
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    console.error('解散宗门失败:', error)
    return { code: 500, message: '服务器错误' }
  } finally {
    client.release()
  }
})
