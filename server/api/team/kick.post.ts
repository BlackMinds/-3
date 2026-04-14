// 队长踢出成员
import { getPool } from '~/server/database/db'
import { getCharacterByUserId, getRoomDetail } from '~/server/utils/team'

export default defineEventHandler(async (event) => {
  try {
    const pool = getPool()
    const body = await readBody(event)
    const targetCharId = Number(body.character_id)
    if (!targetCharId) return { code: 400, message: '缺少目标角色ID' }

    const char = await getCharacterByUserId(event.context.userId)
    if (!char) return { code: 400, message: '角色不存在' }
    if (char.id === targetCharId) return { code: 400, message: '不能踢自己' }

    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      // 校验：操作者必须是队长
      const { rows: mRows } = await client.query(
        `SELECT tm.*, tr.status FROM team_members tm
         JOIN team_rooms tr ON tm.room_id = tr.id
         WHERE tm.character_id = $1 AND tr.status = 'waiting'`,
        [char.id]
      )
      if (mRows.length === 0 || !mRows[0].is_leader) {
        await client.query('ROLLBACK')
        return { code: 403, message: '只有队长可以踢人' }
      }
      const roomId = mRows[0].room_id

      // 校验目标在房间中且非队长
      const { rows: tRows } = await client.query(
        `SELECT * FROM team_members WHERE room_id = $1 AND character_id = $2`,
        [roomId, targetCharId]
      )
      if (tRows.length === 0) {
        await client.query('ROLLBACK')
        return { code: 400, message: '目标不在房间' }
      }
      if (tRows[0].is_leader) {
        await client.query('ROLLBACK')
        return { code: 400, message: '不能踢队长' }
      }

      await client.query(`DELETE FROM team_members WHERE room_id = $1 AND character_id = $2`, [roomId, targetCharId])
      await client.query(`UPDATE team_rooms SET current_members = GREATEST(0, current_members - 1) WHERE id = $1`, [roomId])
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
    console.error('踢人失败:', e)
    return { code: 500, message: '服务器错误' }
  }
})
