import { getPool } from '~/server/database/db'
import { getCharByUserId, getMembership } from '~/server/utils/sect'
import { sendMail } from '~/server/utils/mail'

const IMPEACH_INACTIVE_DAYS = 3

export default defineEventHandler(async (event) => {
  const pool = getPool()
  const char = await getCharByUserId(event.context.userId)
  if (!char) return { code: 400, message: '角色不存在' }

  const membership = await getMembership(char.id)
  if (!membership) return { code: 400, message: '未加入宗门' }
  if (membership.role !== 'vice_leader' && membership.role !== 'elder') {
    return { code: 403, message: '仅副宗主或长老可发起弹劾' }
  }

  const sectId = membership.sect_id
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // 锁宗门行 + 拿到 leader_id（防并发：同一时刻多人弹劾、宗主刚禅让）
    const { rows: sectRows } = await client.query(
      'SELECT leader_id FROM sects WHERE id = $1 FOR UPDATE',
      [sectId]
    )
    if (sectRows.length === 0) {
      await client.query('ROLLBACK')
      return { code: 400, message: '宗门不存在' }
    }
    const leaderId: number = sectRows[0].leader_id
    if (leaderId === char.id) {
      await client.query('ROLLBACK')
      return { code: 400, message: '不能弹劾自己' }
    }

    // 校验宗主未活跃时长（last_active_at 由 auth 中间件每 5 分钟刷新）
    const { rows: leaderRows } = await client.query(
      `SELECT last_active_at,
              EXTRACT(EPOCH FROM (NOW() - last_active_at)) AS inactive_seconds
       FROM characters WHERE id = $1`,
      [leaderId]
    )
    if (leaderRows.length === 0) {
      await client.query('ROLLBACK')
      return { code: 400, message: '宗主信息异常' }
    }
    const lastActive = leaderRows[0].last_active_at
    const inactiveSeconds = Number(leaderRows[0].inactive_seconds ?? 0)
    const thresholdSec = IMPEACH_INACTIVE_DAYS * 86400
    if (lastActive !== null && inactiveSeconds < thresholdSec) {
      await client.query('ROLLBACK')
      return { code: 400, message: `宗主未达 ${IMPEACH_INACTIVE_DAYS} 天未上线，无法弹劾` }
    }

    // 事务转移：原宗主 → 内门弟子；发起人 → 宗主
    await client.query(
      'UPDATE sect_members SET role = $1 WHERE sect_id = $2 AND character_id = $3',
      ['inner', sectId, leaderId]
    )
    await client.query(
      'UPDATE sect_members SET role = $1 WHERE sect_id = $2 AND character_id = $3',
      ['leader', sectId, char.id]
    )
    await client.query('UPDATE sects SET leader_id = $1 WHERE id = $2', [char.id, sectId])

    const inactiveDays = Math.floor(inactiveSeconds / 86400)
    await sendMail({
      characterId: leaderId,
      category: 'system',
      title: '宗主之位被弹劾',
      content: `你因连续 ${inactiveDays} 天未上线，已被【${char.name}】发起弹劾并接任宗主之位。你已降为内门弟子，可重新争取贡献再图复位。`,
    }, client)

    await client.query('COMMIT')
    return { code: 200, message: '弹劾成功，你已成为新宗主' }
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    console.error('弹劾宗主失败:', error)
    return { code: 500, message: '服务器错误' }
  } finally {
    client.release()
  }
})
