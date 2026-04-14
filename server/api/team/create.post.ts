// 创建房间
import { getPool } from '~/server/database/db'
import { getCharacterByUserId, ensureDailyReset, validateRealmEntry, getPlayerCurrentRoomId, getRoomDetail } from '~/server/utils/team'

export default defineEventHandler(async (event) => {
  try {
    const pool = getPool()
    const body = await readBody(event)
    const { secret_realm_id, difficulty } = body
    if (!secret_realm_id || !difficulty) return { code: 400, message: '参数缺失' }
    if (![1, 2, 3].includes(Number(difficulty))) return { code: 400, message: '难度非法' }

    let char = await getCharacterByUserId(event.context.userId)
    if (!char) return { code: 400, message: '角色不存在' }
    char = await ensureDailyReset(char.id, char)

    // 校验
    const check = validateRealmEntry(char, secret_realm_id)
    if (!check.ok) return { code: 400, message: check.message }

    // 检查是否已在其他房间
    const existingRoom = await getPlayerCurrentRoomId(char.id)
    if (existingRoom) return { code: 400, message: '你已在其他房间中' }

    // 创建房间 + 加入成员（事务）
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const { rows: roomRows } = await client.query(
        `INSERT INTO team_rooms (leader_id, secret_realm_id, difficulty, status, max_members, current_members)
         VALUES ($1, $2, $3, 'waiting', 4, 1) RETURNING id`,
        [char.id, secret_realm_id, Number(difficulty)]
      )
      const roomId = roomRows[0].id
      await client.query(
        `INSERT INTO team_members (room_id, character_id, is_leader, is_ready)
         VALUES ($1, $2, TRUE, FALSE)`,
        [roomId, char.id]
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
    console.error('创建房间失败:', e)
    return { code: 500, message: '服务器错误' }
  }
})
