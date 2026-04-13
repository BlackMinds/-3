import { getPool } from '~/server/database/db'
import { getCharByUserId } from '~/server/utils/sect'
import { DAILY_TASK_TYPES } from '~/server/engine/sectData'

export default defineEventHandler(async (event) => {
  try {
    const pool = getPool()
    const { task_id } = await readBody(event)
    const char = await getCharByUserId(event.context.userId)
    if (!char) return { code: 400, message: '角色不存在' }

    const { rows: taskRows } = await pool.query(
      'SELECT * FROM sect_daily_tasks WHERE id = $1 AND character_id = $2', [task_id, char.id]
    )
    if (taskRows.length === 0) return { code: 400, message: '任务不存在' }

    const task = taskRows[0]
    if (task.current_count < task.target_count) return { code: 400, message: '任务未完成' }
    if (task.claimed) return { code: 400, message: '已领取' }

    await pool.query('UPDATE sect_daily_tasks SET claimed = TRUE WHERE id = $1', [task_id])

    // 发放贡献
    await pool.query(
      'UPDATE sect_members SET contribution = contribution + $1, weekly_contribution = weekly_contribution + $2 WHERE character_id = $3',
      [task.reward_contribution, task.reward_contribution, char.id]
    )

    // 发放额外奖励
    const def = DAILY_TASK_TYPES.find(t => t.type === task.task_type)
    if (def?.extraReward) {
      if (def.extraReward.type === 'spirit_stone') {
        await pool.query('UPDATE characters SET spirit_stone = spirit_stone + $1 WHERE id = $2', [def.extraReward.value, char.id])
      } else if (def.extraReward.type === 'cultivation_exp') {
        await pool.query('UPDATE characters SET cultivation_exp = cultivation_exp + $1 WHERE id = $2', [def.extraReward.value, char.id])
      }
    }

    return { code: 200, message: `领取成功，+${task.reward_contribution}贡献` }
  } catch (error) {
    console.error('领取任务奖励失败:', error)
    return { code: 500, message: '服务器错误' }
  }
})
