import { getPool } from '~/server/database/db'
import { getCharByUserId, getMembership, generateDailyTasks, todayStr } from '~/server/utils/sect'
import { DAILY_TASK_TYPES } from '~/server/engine/sectData'

export default defineEventHandler(async (event) => {
  try {
    const pool = getPool()
    const char = await getCharByUserId(event.context.userId)
    if (!char) return { code: 400, message: '角色不存在' }

    const membership = await getMembership(char.id)
    if (!membership) return { code: 400, message: '未加入宗门' }

    await generateDailyTasks(char.id, membership.sect_id, membership.sect_level)

    const { rows } = await pool.query(
      'SELECT * FROM sect_daily_tasks WHERE character_id = $1 AND task_date = $2 ORDER BY id',
      [char.id, todayStr()]
    )

    const enriched = rows.map(r => {
      const def = DAILY_TASK_TYPES.find(t => t.type === r.task_type)
      return { ...r, name: def?.name || r.task_type, description: def?.description || '' }
    })

    return { code: 200, data: enriched }
  } catch (error) {
    console.error('获取每日任务失败:', error)
    return { code: 500, message: '服务器错误' }
  }
})
