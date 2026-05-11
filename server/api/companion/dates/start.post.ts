// 启动约会事件 - POST /api/companion/dates/start
// 触发后返回随机一个事件，玩家选择选项调用 /choose 完成

import { getPool } from '~/server/database/db'
import { getCharacterByUserId } from '~/server/utils/team'
import { getOfficialCompanion } from '~/server/utils/companion'
import { rollDateEvent, type DateEvent } from '~/server/engine/dateEventData'

export default defineEventHandler(async (event) => {
  try {
    const pool = getPool()
    const char = await getCharacterByUserId(event.context.userId)
    if (!char) return { code: 400, message: '角色不存在' }

    const c = await getOfficialCompanion(pool, char.id)
    if (!c) return { code: 400, message: '需先正式结侣才能约会' }
    if (c.intimacy < 250) return { code: 400, message: '亲密度不足，需达 250「心动」阶段' }

    // 检查今日剩余
    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS cnt FROM companion_dates
        WHERE companion_id = $1 AND occurred_at::date = CURRENT_DATE`,
      [c.id]
    )
    const usedToday = rows[0]?.cnt || 0
    if (usedToday >= 3) return { code: 400, message: '今日约会次数已用完' }

    // 滚一个事件
    const dateEvent = rollDateEvent()

    return {
      code: 200,
      data: {
        event: {
          id: dateEvent.id,
          title: dateEvent.title,
          type: dateEvent.type,
          scene: dateEvent.scene,
          choices: dateEvent.choices.map((c, i) => ({
            index: i,
            label: c.label,
          })),
        },
        remaining: 3 - usedToday - 1,  // 选完才扣，但提示
      },
    }
  } catch (error) {
    console.error('启动约会失败:', error)
    return { code: 500, message: '服务器错误' }
  }
})
