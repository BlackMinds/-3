import { getPool } from '~/server/database/db'
import { getCharByUserId, getMembership, generateWeeklyTask, weekStartStr } from '~/server/utils/sect'
import { WEEKLY_TASK_TYPES } from '~/server/engine/sectData'

export default defineEventHandler(async (event) => {
  try {
    const pool = getPool()
    const char = await getCharByUserId(event.context.userId)
    if (!char) return { code: 400, message: '角色不存在' }

    const membership = await getMembership(char.id)
    if (!membership) return { code: 400, message: '未加入宗门' }

    await generateWeeklyTask(membership.sect_id, membership.sect_level)

    const { rows } = await pool.query(
      'SELECT * FROM sect_weekly_tasks WHERE sect_id = $1 AND week_start = $2',
      [membership.sect_id, weekStartStr()]
    )

    // 检查是否已领取
    const enriched = []
    for (const r of rows) {
      const def = WEEKLY_TASK_TYPES.find(t => t.type === r.task_type)
      const { rows: claimed } = await pool.query(
        'SELECT id FROM sect_weekly_claims WHERE weekly_task_id = $1 AND character_id = $2', [r.id, char.id]
      )
      enriched.push({ ...r, name: def?.name || r.task_type, description: def?.description || '', claimed: claimed.length > 0 })
    }

    return { code: 200, data: enriched }
  } catch (error) {
    console.error('获取周常任务失败:', error)
    return { code: 500, message: '服务器错误' }
  }
})
