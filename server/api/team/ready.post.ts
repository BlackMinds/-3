// 切换准备状态
import { getPool } from '~/server/database/db'
import { getCharacterByUserId, getRoomDetail } from '~/server/utils/team'

export default defineEventHandler(async (event) => {
  try {
    const pool = getPool()
    const body = await readBody(event)
    const ready = body.ready !== false // 默认 true

    const char = await getCharacterByUserId(event.context.userId)
    if (!char) return { code: 400, message: '角色不存在' }

    const { rows } = await pool.query(
      `SELECT tm.* FROM team_members tm
       JOIN team_rooms tr ON tm.room_id = tr.id
       WHERE tm.character_id = $1 AND tr.status = 'waiting'`,
      [char.id]
    )
    if (rows.length === 0) return { code: 400, message: '你不在任何房间' }
    const roomId = rows[0].room_id

    await pool.query(
      `UPDATE team_members SET is_ready = $1 WHERE room_id = $2 AND character_id = $3`,
      [ready, roomId, char.id]
    )

    const detail = await getRoomDetail(roomId)
    return { code: 200, data: { room: detail } }
  } catch (e: any) {
    console.error('准备状态切换失败:', e)
    return { code: 500, message: '服务器错误' }
  }
})
