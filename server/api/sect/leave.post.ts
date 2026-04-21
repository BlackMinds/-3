import { getPool } from '~/server/database/db'
import { getCharByUserId } from '~/server/utils/sect'

export default defineEventHandler(async (event) => {
  const pool = getPool()
  const char = await getCharByUserId(event.context.userId)
  if (!char) return { code: 400, message: '角色不存在' }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // 锁成员行（防并发 leave/kick 分裂）
    const { rows } = await client.query(
      'SELECT sect_id, role FROM sect_members WHERE character_id = $1 FOR UPDATE',
      [char.id]
    )
    if (rows.length === 0) {
      await client.query('ROLLBACK')
      return { code: 400, message: '未加入宗门' }
    }
    const membership = rows[0]
    if (membership.role === 'leader') {
      await client.query('ROLLBACK')
      return { code: 400, message: '宗主不能退出，请先转让' }
    }

    await client.query('DELETE FROM sect_members WHERE sect_id = $1 AND character_id = $2', [membership.sect_id, char.id])
    await client.query('UPDATE sects SET member_count = member_count - 1 WHERE id = $1', [membership.sect_id])
    await client.query('UPDATE characters SET sect_id = NULL, sect_quit_time = NOW() WHERE id = $1', [char.id])
    await client.query('UPDATE sect_skills SET frozen = TRUE WHERE character_id = $1', [char.id])

    await client.query('COMMIT')
    return { code: 200, message: '已退出宗门' }
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    console.error('退出宗门失败:', error)
    return { code: 500, message: '服务器错误' }
  } finally {
    client.release()
  }
})
