import { getPool } from '~/server/database/db'
import { updateSectDailyTask } from '~/server/utils/sect'
import { checkAchievements } from '~/server/engine/achievementData'
import { applyCultivationExp } from '~/server/utils/realm'

export default defineEventHandler(async (event) => {
  try {
    const pool = getPool()
    const { hours } = await readBody(event)

    if (!hours || hours < 1 || hours > 8) {
      return { code: 400, message: '修炼时间1-8小时' }
    }

    const { rows } = await pool.query(
      'SELECT * FROM characters WHERE user_id = $1',
      [event.context.userId]
    )

    if (rows.length === 0) {
      return { code: 400, message: '角色不存在' }
    }

    const char = rows[0]
    const costPerHour = 100 * char.realm_tier
    const totalCost = costPerHour * hours

    if (char.spirit_stone < totalCost) {
      return { code: 400, message: `灵石不足，需要${totalCost}灵石` }
    }

    // 闭关修为基础系数: 50 → 80（前期 +60% 提速，配合聚灵阵/洞府加成更显著）
    const expGain = Math.floor(80 * char.realm_tier * hours * (1 + char.realm_stage * 0.1))

    // 累加 cultivation_exp 并自动扣除突破
    const newExpTotal = Number(char.cultivation_exp || 0) + expGain
    const br = applyCultivationExp(newExpTotal, char.realm_tier || 1, char.realm_stage || 1)

    await pool.query(
      `UPDATE characters
       SET spirit_stone = spirit_stone - $1,
           cultivation_exp = $2,
           realm_tier = $3,
           realm_stage = $4,
           last_online = NOW()
       WHERE user_id = $5`,
      [totalCost, br.cultivation_exp, br.realm_tier, br.realm_stage, event.context.userId]
    )

    // 宗门任务
    await updateSectDailyTask(char.id, 'cultivate', 1)
    // 成就：闭关
    checkAchievements(char.id, 'cultivate_count', 1).catch(() => {})

    // 返回更新后的数据
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
    console.error('修炼失败:', error)
    return { code: 500, message: '服务器错误' }
  }
})
