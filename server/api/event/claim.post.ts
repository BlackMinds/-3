// 领取事件：标记已读（奖励已在 cron 抽奖时入库，这里只清理 pending 状态）
import { getPool } from '~/server/database/db'

export default defineEventHandler(async (event) => {
  try {
    const pool = getPool()
    const { rows: charRows } = await pool.query(
      'SELECT id, event_pending_id FROM characters WHERE user_id = $1',
      [event.context.userId]
    )
    if (charRows.length === 0) {
      return { code: 400, message: '角色不存在' }
    }
    const char = charRows[0]
    if (!char.event_pending_id) {
      return { code: 200, message: '无待领取事件' }
    }

    await pool.query(
      'UPDATE character_event_log SET claimed = TRUE WHERE id = $1 AND character_id = $2',
      [char.event_pending_id, char.id]
    )
    await pool.query(
      'UPDATE characters SET event_pending_id = NULL WHERE id = $1',
      [char.id]
    )

    // 返回最新角色数据供前端刷新
    const { rows: updated } = await pool.query(
      'SELECT * FROM characters WHERE id = $1',
      [char.id]
    )
    return { code: 200, message: '已领取', data: updated[0] }
  } catch (err: any) {
    console.error('[event/claim] 失败:', err)
    return { code: 500, message: '服务器错误' }
  }
})
