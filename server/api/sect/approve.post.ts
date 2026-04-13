import { getPool } from '~/server/database/db'
import { getCharByUserId, getMembership } from '~/server/utils/sect'
import { ROLE_HIERARCHY, getSectLevelConfig } from '~/server/engine/sectData'

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

    const { rows: appRows } = await pool.query(
      'SELECT * FROM sect_applications WHERE id = $1 AND sect_id = $2 AND status = $3',
      [application_id, membership.sect_id, 'pending']
    )
    if (appRows.length === 0) return { code: 400, message: '申请不存在' }

    const app = appRows[0]

    // 检查人数
    const { rows: sectRows } = await pool.query('SELECT * FROM sects WHERE id = $1', [membership.sect_id])
    const sect = sectRows[0]
    const cfg = getSectLevelConfig(sect.level)
    if (sect.member_count >= cfg.maxMembers) return { code: 400, message: '宗门已满' }

    // 检查申请人是否已有宗门
    const existingMembership = await getMembership(app.character_id)
    if (existingMembership) {
      await pool.query('UPDATE sect_applications SET status = $1, handled_at = NOW(), handled_by = $2 WHERE id = $3', ['rejected', char.id, application_id])
      return { code: 400, message: '该玩家已有宗门' }
    }

    // 加入
    await pool.query('UPDATE sect_applications SET status = $1, handled_at = NOW(), handled_by = $2 WHERE id = $3', ['approved', char.id, application_id])
    await pool.query('INSERT INTO sect_members (sect_id, character_id, role) VALUES ($1, $2, $3)', [membership.sect_id, app.character_id, 'outer'])
    await pool.query('UPDATE sects SET member_count = member_count + 1 WHERE id = $1', [membership.sect_id])
    await pool.query('UPDATE characters SET sect_id = $1, sect_quit_time = NULL WHERE id = $2', [membership.sect_id, app.character_id])

    // 恢复冻结的宗门功法
    await pool.query('UPDATE sect_skills SET frozen = FALSE WHERE character_id = $1', [app.character_id])

    return { code: 200, message: '已批准' }
  } catch (error) {
    console.error('批准申请失败:', error)
    return { code: 500, message: '服务器错误' }
  }
})
