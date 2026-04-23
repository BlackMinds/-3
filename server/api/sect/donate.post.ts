import { getPool } from '~/server/database/db'
import { getCharByUserId, updateWeeklyTask } from '~/server/utils/sect'
import { getDailyDonateLimit } from '~/server/engine/sectData'
import { checkAchievements } from '~/server/engine/achievementData'

export default defineEventHandler(async (event) => {
  const pool = getPool()
  const { amount: rawAmount } = await readBody(event)
  const amount = Number(rawAmount)
  if (!Number.isFinite(amount) || amount < 1000) return { code: 400, message: '最低捐献1000灵石' }

  const char = await getCharByUserId(event.context.userId)
  if (!char) return { code: 400, message: '角色不存在' }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // 锁成员行，防止并发捐献绕过每日上限
    const { rows: memberRows } = await client.query(
      `SELECT sm.sect_id, sm.daily_donated, s.level AS sect_level
       FROM sect_members sm JOIN sects s ON s.id = sm.sect_id
       WHERE sm.character_id = $1 FOR UPDATE OF sm`,
      [char.id]
    )
    if (memberRows.length === 0) {
      await client.query('ROLLBACK')
      return { code: 400, message: '未加入宗门' }
    }
    const membership = memberRows[0]

    const dailyLimit = getDailyDonateLimit(membership.sect_level)
    const todayDonated = Number(membership.daily_donated) || 0
    const canDonate = dailyLimit - todayDonated
    if (canDonate <= 0) {
      await client.query('ROLLBACK')
      return { code: 400, message: '今日捐献已达上限' }
    }

    const actualAmount = Math.min(amount, canDonate)
    // 捐献贡献换算: 0.5 → 0.3，防止富豪玩家秒刷满贡献
    const contribution = Math.floor(actualAmount * 0.3)

    // 条件扣灵石：避免扣为负数
    const { rowCount: deducted } = await client.query(
      'UPDATE characters SET spirit_stone = spirit_stone - $1 WHERE id = $2 AND spirit_stone >= $1',
      [actualAmount, char.id]
    )
    if (!deducted) {
      await client.query('ROLLBACK')
      return { code: 400, message: '灵石不足' }
    }

    await client.query('UPDATE sects SET fund = fund + $1 WHERE id = $2', [actualAmount, membership.sect_id])
    await client.query(
      'UPDATE sect_members SET contribution = contribution + $1, weekly_contribution = weekly_contribution + $2, daily_donated = daily_donated + $3 WHERE sect_id = $4 AND character_id = $5',
      [contribution, contribution, actualAmount, membership.sect_id, char.id]
    )

    await client.query('COMMIT')

    // 周常任务：事务提交后再更新（本身独立事务，不影响主流程）
    await updateWeeklyTask(membership.sect_id, 'weekly_donate', actualAmount)

    // 成就：贡献良多 / 宗门栋梁
    checkAchievements(char.id, 'sect_contribution', contribution).catch(() => {})

    return { code: 200, message: `捐献${actualAmount}灵石，获得${contribution}贡献`, data: { donated: actualAmount, contribution } }
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    console.error('捐献失败:', error)
    return { code: 500, message: '服务器错误' }
  } finally {
    client.release()
  }
})
