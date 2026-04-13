import { getPool } from '~/server/database/db'
import { getCharByUserId, getMembership } from '~/server/utils/sect'
import { SECT_JOIN_MIN_LEVEL, SECT_QUIT_COOLDOWN_HOURS, getSectLevelConfig } from '~/server/engine/sectData'

export default defineEventHandler(async (event) => {
  try {
    const pool = getPool()
    const { sect_id } = await readBody(event)
    const char = await getCharByUserId(event.context.userId)
    if (!char) return { code: 400, message: '角色不存在' }
    if ((char.level || 1) < SECT_JOIN_MIN_LEVEL) return { code: 400, message: `等级不足，需Lv.${SECT_JOIN_MIN_LEVEL}` }

    const existing = await getMembership(char.id)
    if (existing) return { code: 400, message: '已有宗门' }

    // 退出冷却
    if (char.sect_quit_time) {
      const quitTime = new Date(char.sect_quit_time).getTime()
      const cooldownMs = SECT_QUIT_COOLDOWN_HOURS * 3600 * 1000
      if (Date.now() - quitTime < cooldownMs) {
        const remaining = Math.ceil((cooldownMs - (Date.now() - quitTime)) / 3600000)
        return { code: 400, message: `退出冷却中，还需${remaining}小时` }
      }
    }

    // 检查宗门
    const { rows: sectRows } = await pool.query('SELECT * FROM sects WHERE id = $1', [sect_id])
    if (sectRows.length === 0) return { code: 400, message: '宗门不存在' }
    const sect = sectRows[0]

    const cfg = getSectLevelConfig(sect.level)
    if (sect.member_count >= cfg.maxMembers) return { code: 400, message: '宗门已满' }

    // 自由加入模式
    if (sect.join_mode === 'free') {
      await pool.query('INSERT INTO sect_members (sect_id, character_id, role) VALUES ($1, $2, $3)', [sect_id, char.id, 'outer'])
      await pool.query('UPDATE sects SET member_count = member_count + 1 WHERE id = $1', [sect_id])
      await pool.query('UPDATE characters SET sect_id = $1, sect_quit_time = NULL WHERE id = $2', [sect_id, char.id])
      return { code: 200, message: `已加入【${sect.name}】` }
    }

    // 检查是否已有申请
    const { rows: pendingApp } = await pool.query(
      'SELECT id FROM sect_applications WHERE sect_id = $1 AND character_id = $2 AND status = $3',
      [sect_id, char.id, 'pending']
    )
    if (pendingApp.length > 0) return { code: 400, message: '已有待审批申请' }

    await pool.query('INSERT INTO sect_applications (sect_id, character_id) VALUES ($1, $2)', [sect_id, char.id])

    return { code: 200, message: '申请已提交' }
  } catch (error) {
    console.error('申请加入失败:', error)
    return { code: 500, message: '服务器错误' }
  }
})
