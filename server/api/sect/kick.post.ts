import { getPool } from '~/server/database/db'
import { getCharByUserId, getMembership } from '~/server/utils/sect'
import { ROLE_HIERARCHY } from '~/server/engine/sectData'

export default defineEventHandler(async (event) => {
  const pool = getPool()
  const { target_character_id } = await readBody(event)
  const char = await getCharByUserId(event.context.userId)
  if (!char) return { code: 400, message: '角色不存在' }

  const membership = await getMembership(char.id)
  if (!membership || ROLE_HIERARCHY[membership.role] < ROLE_HIERARCHY['vice_leader']) {
    return { code: 403, message: '权限不足' }
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // 锁目标成员行（防并发踢出 or 该成员同时 leave）
    const { rows: targetRows } = await client.query(
      'SELECT * FROM sect_members WHERE sect_id = $1 AND character_id = $2 FOR UPDATE',
      [membership.sect_id, target_character_id]
    )
    if (targetRows.length === 0) {
      await client.query('ROLLBACK')
      return { code: 400, message: '目标不在宗门内' }
    }
    if (targetRows[0].role === 'leader') {
      await client.query('ROLLBACK')
      return { code: 400, message: '不能踢出宗主' }
    }
    if (ROLE_HIERARCHY[targetRows[0].role] >= ROLE_HIERARCHY[membership.role]) {
      await client.query('ROLLBACK')
      return { code: 400, message: '不能踢出同级或更高职位' }
    }

    await client.query('DELETE FROM sect_members WHERE sect_id = $1 AND character_id = $2', [membership.sect_id, target_character_id])
    await client.query('UPDATE sects SET member_count = member_count - 1 WHERE id = $1', [membership.sect_id])
    await client.query('UPDATE characters SET sect_id = NULL, sect_quit_time = NOW() WHERE id = $1', [target_character_id])
    await client.query('UPDATE sect_skills SET frozen = TRUE WHERE character_id = $1', [target_character_id])

    await client.query('COMMIT')
    return { code: 200, message: '已踢出' }
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    console.error('踢出失败:', error)
    return { code: 500, message: '服务器错误' }
  } finally {
    client.release()
  }
})
