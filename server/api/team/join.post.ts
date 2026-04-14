// 加入房间
import { getPool } from '~/server/database/db'
import { getCharacterByUserId, ensureDailyReset, validateRealmEntry, getPlayerCurrentRoomId, getRoomDetail } from '~/server/utils/team'

export default defineEventHandler(async (event) => {
  try {
    const pool = getPool()
    const body = await readBody(event)
    const roomId = Number(body.room_id)
    if (!roomId) return { code: 400, message: '房间ID非法' }

    let char = await getCharacterByUserId(event.context.userId)
    if (!char) return { code: 400, message: '角色不存在' }
    char = await ensureDailyReset(char.id, char)

    // 检查是否已在房间
    const existing = await getPlayerCurrentRoomId(char.id)
    if (existing) {
      if (existing === roomId) {
        // 已在这个房间，直接返回详情
        const detail = await getRoomDetail(roomId)
        return { code: 200, data: { room: detail } }
      }
      return { code: 400, message: '你已在其他房间中' }
    }

    // 事务加入
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const { rows: rRows } = await client.query(
        `SELECT * FROM team_rooms WHERE id = $1 FOR UPDATE`, [roomId]
      )
      if (rRows.length === 0) {
        await client.query('ROLLBACK')
        return { code: 404, message: '房间不存在' }
      }
      const room = rRows[0]
      if (room.status !== 'waiting') {
        await client.query('ROLLBACK')
        return { code: 400, message: '房间不可加入' }
      }
      if (room.current_members >= room.max_members) {
        await client.query('ROLLBACK')
        return { code: 400, message: '房间已满' }
      }

      // 校验玩家可否进入
      const check = validateRealmEntry(char, room.secret_realm_id)
      if (!check.ok) {
        await client.query('ROLLBACK')
        return { code: 400, message: check.message }
      }

      await client.query(
        `INSERT INTO team_members (room_id, character_id, is_leader, is_ready)
         VALUES ($1, $2, FALSE, FALSE)
         ON CONFLICT (room_id, character_id) DO NOTHING`,
        [roomId, char.id]
      )
      await client.query(
        `UPDATE team_rooms SET current_members = current_members + 1 WHERE id = $1`,
        [roomId]
      )
      await client.query('COMMIT')

      const detail = await getRoomDetail(roomId)
      return { code: 200, data: { room: detail } }
    } catch (e) {
      await client.query('ROLLBACK')
      throw e
    } finally {
      client.release()
    }
  } catch (e: any) {
    console.error('加入房间失败:', e)
    return { code: 500, message: '服务器错误' }
  }
})
