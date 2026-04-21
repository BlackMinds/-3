import { getPool } from '~/server/database/db'
import { updateSectDailyTask } from '~/server/utils/sect'
import { checkAchievements } from '~/server/engine/achievementData'
import { applyCultivationExp } from '~/server/utils/realm'

export default defineEventHandler(async (event) => {
  const pool = getPool()
  const { hours } = await readBody(event)

  if (!hours || hours < 1 || hours > 8) {
    return { code: 400, message: '修炼时间1-8小时' }
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // FOR UPDATE 锁行，防止并发闭关重复扣/重复加修为
    const { rows } = await client.query(
      'SELECT * FROM characters WHERE user_id = $1 FOR UPDATE',
      [event.context.userId]
    )

    if (rows.length === 0) {
      await client.query('ROLLBACK')
      return { code: 400, message: '角色不存在' }
    }

    const char = rows[0]
    const costPerHour = 100 * char.realm_tier
    const totalCost = costPerHour * hours

    // 闭关修为基础系数: 50 → 80（前期 +60% 提速，配合聚灵阵/洞府加成更显著）
    const expGain = Math.floor(80 * char.realm_tier * hours * (1 + char.realm_stage * 0.1))
    const newExpTotal = Number(char.cultivation_exp || 0) + expGain
    const br = applyCultivationExp(newExpTotal, char.realm_tier || 1, char.realm_stage || 1)

    // 条件扣灵石：WHERE spirit_stone >= $1 避免扣为负数
    const { rowCount } = await client.query(
      `UPDATE characters
       SET spirit_stone = spirit_stone - $1,
           cultivation_exp = $2,
           realm_tier = $3,
           realm_stage = $4,
           last_online = NOW()
       WHERE user_id = $5 AND spirit_stone >= $1`,
      [totalCost, br.cultivation_exp, br.realm_tier, br.realm_stage, event.context.userId]
    )

    if (!rowCount) {
      await client.query('ROLLBACK')
      return { code: 400, message: `灵石不足，需要${totalCost}灵石` }
    }

    await client.query('COMMIT')

    // 事务提交后再做幂等性较弱的旁路操作（任务/成就）
    await updateSectDailyTask(char.id, 'cultivate', 1)
    checkAchievements(char.id, 'cultivate_count', 1).catch(() => {})

    const { rows: updated } = await pool.query(
      'SELECT * FROM characters WHERE user_id = $1',
      [event.context.userId]
    )

    return {
      code: 200,
      message: `闭关${hours}小时，消耗${totalCost}灵石，获得${expGain}修为`,
      data: updated[0],
    }
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    console.error('修炼失败:', error)
    return { code: 500, message: '服务器错误' }
  } finally {
    client.release()
  }
})
