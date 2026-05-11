// 约会事件状态 - GET /api/companion/dates/status
// 返回今日剩余约会次数 + 当前是否有 pending 事件

import { getPool } from '~/server/database/db'
import { getCharacterByUserId } from '~/server/utils/team'
import { getOfficialCompanion } from '~/server/utils/companion'
import { INTIMACY_CONFIG } from '~/server/engine/companionData'

export default defineEventHandler(async (event) => {
  try {
    const pool = getPool()
    const char = await getCharacterByUserId(event.context.userId)
    if (!char) return { code: 400, message: '角色不存在' }

    const c = await getOfficialCompanion(pool, char.id)
    if (!c) return { code: 400, message: '需先正式结侣才能约会' }
    if (c.intimacy < 250) return { code: 400, message: '亲密度不足，需达 250「心动」阶段' }

    // 今日已用约会次数
    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS cnt FROM companion_dates
        WHERE companion_id = $1 AND occurred_at::date = CURRENT_DATE`,
      [c.id]
    )
    const usedToday = rows[0]?.cnt || 0
    const dailyMax = 3
    const remaining = Math.max(0, dailyMax - usedToday)

    return {
      code: 200,
      data: {
        companionId: c.id,
        usedToday,
        dailyMax,
        remaining,
      },
    }
  } catch (error) {
    console.error('获取约会状态失败:', error)
    return { code: 500, message: '服务器错误' }
  }
})
