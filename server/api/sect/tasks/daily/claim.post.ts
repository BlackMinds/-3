import { getPool } from '~/server/database/db'
import { getCharByUserId } from '~/server/utils/sect'
import { DAILY_TASK_TYPES } from '~/server/engine/sectData'
import { checkAchievements } from '~/server/engine/achievementData'

export default defineEventHandler(async (event) => {
  try {
    const pool = getPool()
    const { task_id } = await readBody(event)
    const char = await getCharByUserId(event.context.userId)
    if (!char) return { code: 400, message: '角色不存在' }

    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      // FOR UPDATE 锁任务行，防并发重复领取
      const { rows: taskRows } = await client.query(
        'SELECT * FROM sect_daily_tasks WHERE id = $1 AND character_id = $2 FOR UPDATE',
        [task_id, char.id]
      )
      if (taskRows.length === 0) {
        await client.query('ROLLBACK')
        return { code: 400, message: '任务不存在' }
      }

      const task = taskRows[0]
      if (task.current_count < task.target_count) {
        await client.query('ROLLBACK')
        return { code: 400, message: '任务未完成' }
      }
      if (task.claimed) {
        await client.query('ROLLBACK')
        return { code: 400, message: '已领取' }
      }

      await client.query('UPDATE sect_daily_tasks SET claimed = TRUE WHERE id = $1', [task_id])

      // 发放贡献
      await client.query(
        'UPDATE sect_members SET contribution = contribution + $1, total_contribution = total_contribution + $1, weekly_contribution = weekly_contribution + $2 WHERE character_id = $3',
        [task.reward_contribution, task.reward_contribution, char.id]
      )

      // 发放额外奖励
      const def = DAILY_TASK_TYPES.find(t => t.type === task.task_type)
      if (def?.extraReward) {
        if (def.extraReward.type === 'spirit_stone') {
          await client.query('UPDATE characters SET spirit_stone = LEAST(70000000000, spirit_stone + $1) WHERE id = $2', [def.extraReward.value, char.id])
        } else if (def.extraReward.type === 'cultivation_exp') {
          await client.query('UPDATE characters SET cultivation_exp = cultivation_exp + $1 WHERE id = $2', [def.extraReward.value, char.id])
        }
      }

      await client.query('COMMIT')

      // 成就：任务狂人 + 贡献良多
      checkAchievements(char.id, 'sect_daily_task', 1).catch(() => {})
      checkAchievements(char.id, 'sect_contribution', task.reward_contribution).catch(() => {})

      return { code: 200, message: `领取成功，+${task.reward_contribution}贡献` }
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {})
      throw e
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('领取任务奖励失败:', error)
    return { code: 500, message: '服务器错误' }
  }
})
