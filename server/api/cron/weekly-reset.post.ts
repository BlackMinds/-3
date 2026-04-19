import { getPool } from '~/server/database/db'
import { weeklyResetMap, settleJackpot } from '~/server/utils/spiritVeinEngine'

export default defineEventHandler(async (event) => {
  const authHeader = getHeader(event, 'authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const pool = getPool()

  // Reset weekly contribution for all sect members
  await pool.query('UPDATE sect_members SET weekly_contribution = 0')

  // 灵脉奖池结算（本周结果）
  const jackpotRes = await settleJackpot()

  // 灵脉全图重置
  const veinReset = await weeklyResetMap()

  return { ok: true, jackpot: jackpotRes, veinReset }
})
