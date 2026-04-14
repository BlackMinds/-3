// 查询本人是否有待领取的天道造化事件
import { getPool } from '~/server/database/db'
import { EVENT_MAP } from '~/server/engine/randomEventData'

export default defineEventHandler(async (event) => {
  try {
    const pool = getPool()
    const { rows } = await pool.query(
      `SELECT c.id AS character_id, c.name AS character_name, c.event_pending_id,
              log.id, log.event_id, log.rarity, log.is_positive, log.reward, log.triggered_at, log.claimed
         FROM characters c
         LEFT JOIN character_event_log log ON c.event_pending_id = log.id
        WHERE c.user_id = $1`,
      [event.context.userId]
    )
    if (rows.length === 0) {
      return { code: 400, message: '角色不存在' }
    }
    const row = rows[0]
    if (!row.event_pending_id || !row.id || row.claimed) {
      return { code: 200, data: null }
    }
    const eventDef = EVENT_MAP[row.event_id]
    return {
      code: 200,
      data: {
        logId: row.id,
        eventId: row.event_id,
        eventName: eventDef?.name || row.event_id,
        rarity: row.rarity,
        isPositive: row.is_positive,
        template: eventDef?.template || '',
        reward: row.reward,
        triggeredAt: row.triggered_at,
      },
    }
  } catch (err: any) {
    console.error('[event/pending] 失败:', err)
    return { code: 500, message: '服务器错误' }
  }
})
