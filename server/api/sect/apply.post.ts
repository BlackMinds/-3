import { getPool } from '~/server/database/db'
import { getCharByUserId } from '~/server/utils/sect'
import { SECT_JOIN_MIN_LEVEL, SECT_QUIT_COOLDOWN_HOURS, getSectLevelConfig } from '~/server/engine/sectData'

export default defineEventHandler(async (event) => {
  const pool = getPool()
  const { sect_id } = await readBody(event)
  const char = await getCharByUserId(event.context.userId)
  if (!char) return { code: 400, message: '角色不存在' }
  if ((char.level || 1) < SECT_JOIN_MIN_LEVEL) return { code: 400, message: `等级不足，需Lv.${SECT_JOIN_MIN_LEVEL}` }

  // 退出冷却（char 数据来自事务外预读，读到的 sect_quit_time 够用）
  if (char.sect_quit_time) {
    const quitTime = new Date(char.sect_quit_time).getTime()
    const cooldownMs = SECT_QUIT_COOLDOWN_HOURS * 3600 * 1000
    if (Date.now() - quitTime < cooldownMs) {
      const remaining = Math.ceil((cooldownMs - (Date.now() - quitTime)) / 3600000)
      return { code: 400, message: `退出冷却中，还需${remaining}小时` }
    }
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // 锁宗门行（防止并发加入超人数上限）
    const { rows: sectRows } = await client.query('SELECT * FROM sects WHERE id = $1 FOR UPDATE', [sect_id])
    if (sectRows.length === 0) {
      await client.query('ROLLBACK')
      return { code: 400, message: '宗门不存在' }
    }
    const sect = sectRows[0]

    // 事务内复查已加入（防并发重复加入）
    const { rows: exist } = await client.query(
      'SELECT sect_id FROM sect_members WHERE character_id = $1', [char.id]
    )
    if (exist.length > 0) {
      await client.query('ROLLBACK')
      return { code: 400, message: '已有宗门' }
    }

    const cfg = getSectLevelConfig(sect.level)
    if (sect.member_count >= cfg.maxMembers) {
      await client.query('ROLLBACK')
      return { code: 400, message: '宗门已满' }
    }

    // 自由加入模式
    if (sect.join_mode === 'free') {
      await client.query('INSERT INTO sect_members (sect_id, character_id, role) VALUES ($1, $2, $3)', [sect_id, char.id, 'outer'])
      await client.query('UPDATE sects SET member_count = member_count + 1 WHERE id = $1', [sect_id])
      await client.query('UPDATE characters SET sect_id = $1, sect_quit_time = NULL WHERE id = $2', [sect_id, char.id])
      await client.query('COMMIT')
      return { code: 200, message: `已加入【${sect.name}】` }
    }

    // 申请模式：检查是否已有 pending 申请
    const { rows: pendingApp } = await client.query(
      'SELECT id FROM sect_applications WHERE sect_id = $1 AND character_id = $2 AND status = $3',
      [sect_id, char.id, 'pending']
    )
    if (pendingApp.length > 0) {
      await client.query('ROLLBACK')
      return { code: 400, message: '已有待审批申请' }
    }

    await client.query('INSERT INTO sect_applications (sect_id, character_id) VALUES ($1, $2)', [sect_id, char.id])
    await client.query('COMMIT')
    return { code: 200, message: '申请已提交' }
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    console.error('申请加入失败:', error)
    return { code: 500, message: '服务器错误' }
  } finally {
    client.release()
  }
})
