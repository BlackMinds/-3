// 离开房间
import { getPool } from '~/server/database/db'
import { getCharacterByUserId } from '~/server/utils/team'

export default defineEventHandler(async (event) => {
  try {
    const pool = getPool()
    const char = await getCharacterByUserId(event.context.userId)
    if (!char) return { code: 400, message: '角色不存在' }

    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      // 查找玩家所在房间
      const { rows: tmRows } = await client.query(
        `SELECT tm.*, tr.status, tr.leader_id FROM team_members tm
         JOIN team_rooms tr ON tm.room_id = tr.id
         WHERE tm.character_id = $1 AND tr.status = 'waiting'`,
        [char.id]
      )
      if (tmRows.length === 0) {
        await client.query('ROLLBACK')
        return { code: 200, data: { left: false } }
      }
      const tm = tmRows[0]
      const roomId = tm.room_id

      await client.query(`DELETE FROM team_members WHERE room_id = $1 AND character_id = $2`, [roomId, char.id])
      await client.query(`UPDATE team_rooms SET current_members = GREATEST(0, current_members - 1) WHERE id = $1`, [roomId])

      // 若剩 0 人，解散房间
      const { rows: cntRows } = await client.query(`SELECT current_members FROM team_rooms WHERE id = $1`, [roomId])
      if (cntRows[0].current_members <= 0) {
        await client.query(`UPDATE team_rooms SET status = 'finished', finished_at = NOW() WHERE id = $1`, [roomId])
      } else if (tm.is_leader) {
        // 转让队长给加入时间最早的成员
        const { rows: newLeader } = await client.query(
          `SELECT character_id FROM team_members WHERE room_id = $1 ORDER BY join_time ASC LIMIT 1`,
          [roomId]
        )
        if (newLeader.length > 0) {
          await client.query(`UPDATE team_members SET is_leader = TRUE WHERE room_id = $1 AND character_id = $2`, [roomId, newLeader[0].character_id])
          await client.query(`UPDATE team_rooms SET leader_id = $1 WHERE id = $2`, [newLeader[0].character_id, roomId])
        }
      }
      await client.query('COMMIT')
      return { code: 200, data: { left: true } }
    } catch (e) {
      await client.query('ROLLBACK')
      throw e
    } finally {
      client.release()
    }
  } catch (e: any) {
    console.error('离开房间失败:', e)
    return { code: 500, message: '服务器错误' }
  }
})
