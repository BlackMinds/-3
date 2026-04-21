import { getPool } from '~/server/database/db'
import { getCharByUserId, getMembership } from '~/server/utils/sect'
import { ROLE_HIERARCHY, getSectLevelConfig } from '~/server/engine/sectData'

export default defineEventHandler(async (event) => {
  const pool = getPool()
  const { application_id } = await readBody(event)
  const char = await getCharByUserId(event.context.userId)
  if (!char) return { code: 400, message: '角色不存在' }

  const membership = await getMembership(char.id)
  if (!membership || ROLE_HIERARCHY[membership.role] < ROLE_HIERARCHY['elder']) {
    return { code: 403, message: '权限不足' }
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // 锁申请行（防并发重复审批）
    const { rows: appRows } = await client.query(
      'SELECT * FROM sect_applications WHERE id = $1 AND sect_id = $2 AND status = $3 FOR UPDATE',
      [application_id, membership.sect_id, 'pending']
    )
    if (appRows.length === 0) {
      await client.query('ROLLBACK')
      return { code: 400, message: '申请不存在' }
    }
    const app = appRows[0]

    // 锁宗门行，事务内读最新人数
    const { rows: sectRows } = await client.query(
      'SELECT * FROM sects WHERE id = $1 FOR UPDATE', [membership.sect_id]
    )
    const sect = sectRows[0]
    const cfg = getSectLevelConfig(sect.level)
    if (sect.member_count >= cfg.maxMembers) {
      await client.query('ROLLBACK')
      return { code: 400, message: '宗门已满' }
    }

    // 事务内复查申请人是否已加入其他宗门
    const { rows: existRows } = await client.query(
      'SELECT sect_id FROM sect_members WHERE character_id = $1 FOR UPDATE', [app.character_id]
    )
    if (existRows.length > 0) {
      // 标记拒绝（仍在事务内，保证原子）
      await client.query(
        'UPDATE sect_applications SET status = $1, handled_at = NOW(), handled_by = $2 WHERE id = $3',
        ['rejected', char.id, application_id]
      )
      await client.query('COMMIT')
      return { code: 400, message: '该玩家已有宗门' }
    }

    // 加入：标记批准 + INSERT 成员 + 宗门人数 +1 + 角色 sect_id + 解冻功法
    await client.query(
      'UPDATE sect_applications SET status = $1, handled_at = NOW(), handled_by = $2 WHERE id = $3',
      ['approved', char.id, application_id]
    )
    await client.query(
      'INSERT INTO sect_members (sect_id, character_id, role) VALUES ($1, $2, $3)',
      [membership.sect_id, app.character_id, 'outer']
    )
    await client.query('UPDATE sects SET member_count = member_count + 1 WHERE id = $1', [membership.sect_id])
    await client.query(
      'UPDATE characters SET sect_id = $1, sect_quit_time = NULL WHERE id = $2',
      [membership.sect_id, app.character_id]
    )
    await client.query('UPDATE sect_skills SET frozen = FALSE WHERE character_id = $1', [app.character_id])

    await client.query('COMMIT')
    return { code: 200, message: '已批准' }
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    console.error('批准申请失败:', error)
    return { code: 500, message: '服务器错误' }
  } finally {
    client.release()
  }
})
