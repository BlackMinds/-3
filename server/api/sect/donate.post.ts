import { getPool } from '~/server/database/db'
import { getCharByUserId, getMembership, updateWeeklyTask } from '~/server/utils/sect'
import { getDailyDonateLimit } from '~/server/engine/sectData'

export default defineEventHandler(async (event) => {
  try {
    const pool = getPool()
    const { amount } = await readBody(event)
    if (!amount || amount < 1000) return { code: 400, message: '最低捐献1000灵石' }

    const char = await getCharByUserId(event.context.userId)
    if (!char) return { code: 400, message: '角色不存在' }

    const membership = await getMembership(char.id)
    if (!membership) return { code: 400, message: '未加入宗门' }

    if (Number(char.spirit_stone) < amount) return { code: 400, message: '灵石不足' }

    const dailyLimit = getDailyDonateLimit(membership.sect_level)
    const todayDonated = Number(membership.daily_donated) || 0
    const canDonate = dailyLimit - todayDonated
    if (canDonate <= 0) return { code: 400, message: '今日捐献已达上限' }

    const actualAmount = Math.min(amount, canDonate)
    const contribution = Math.floor(actualAmount * 0.5)

    await pool.query('UPDATE characters SET spirit_stone = spirit_stone - $1 WHERE id = $2', [actualAmount, char.id])
    await pool.query('UPDATE sects SET fund = fund + $1 WHERE id = $2', [actualAmount, membership.sect_id])
    await pool.query(
      'UPDATE sect_members SET contribution = contribution + $1, weekly_contribution = weekly_contribution + $2, daily_donated = daily_donated + $3 WHERE sect_id = $4 AND character_id = $5',
      [contribution, contribution, actualAmount, membership.sect_id, char.id]
    )

    // 更新周常任务进度
    await updateWeeklyTask(membership.sect_id, 'weekly_donate', actualAmount)

    return { code: 200, message: `捐献${actualAmount}灵石，获得${contribution}贡献`, data: { donated: actualAmount, contribution } }
  } catch (error) {
    console.error('捐献失败:', error)
    return { code: 500, message: '服务器错误' }
  }
})
