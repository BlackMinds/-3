// 合并接口：天道造化轮询专用，一次返回 pending 事件 + 风云阁广播
// 替代 stores/event.ts 中每 120s 跑两次的 event/pending + event/broadcast
// 不带 query：固定走 scope=all、limit=50，正是前端定时轮询的默认参数
import { getPool } from '~/server/database/db'
import { EVENT_MAP } from '~/server/engine/randomEventData'

export default defineEventHandler(async (event) => {
  try {
    const pool = getPool()

    // 并发跑 2 个查询
    const pendingQ = pool.query(
      `SELECT c.id AS character_id, c.event_pending_id,
              log.id, log.event_id, log.rarity, log.is_positive, log.reward, log.triggered_at, log.claimed
         FROM characters c
         LEFT JOIN character_event_log log ON c.event_pending_id = log.id
        WHERE c.user_id = $1`,
      [event.context.userId]
    )

    const broadcastQ = pool.query(
      `SELECT id, character_id, character_name, sect_id, event_id, rarity, is_positive,
              rendered_text, created_at
         FROM world_broadcast
        ORDER BY created_at DESC
        LIMIT 50`
    )

    const [pendingRes, broadcastRes] = await Promise.all([pendingQ, broadcastQ])

    // === 处理 pending ===
    let pending: any = null
    if (pendingRes.rows.length > 0) {
      const row = pendingRes.rows[0]
      if (row.event_pending_id && row.id && !row.claimed) {
        const eventDef = EVENT_MAP[row.event_id]
        pending = {
          logId: row.id,
          eventId: row.event_id,
          eventName: eventDef?.name || row.event_id,
          rarity: row.rarity,
          isPositive: row.is_positive,
          template: eventDef?.template || '',
          reward: row.reward,
          triggeredAt: row.triggered_at,
        }
      }
    }

    // === 处理 broadcasts ===
    const broadcasts = broadcastRes.rows.map((r: any) => ({
      id: r.id,
      characterId: r.character_id,
      characterName: r.character_name,
      sectId: r.sect_id,
      eventId: r.event_id,
      rarity: r.rarity,
      isPositive: r.is_positive,
      text: r.rendered_text,
      createdAt: r.created_at,
    }))

    return { code: 200, data: { pending, broadcasts } }
  } catch (err: any) {
    console.error('[event/poll] 失败:', err)
    return { code: 500, message: '服务器错误' }
  }
})
