import { processSurge, purgeExpiredGuards, restoreNpcNodes } from '~/server/utils/spiritVeinEngine'
import { getPool } from '~/server/database/db'

/**
 * DEV ONLY - 强制触发一次涌灵（绕过 next_surge_at 时间判断）
 */
export default defineEventHandler(async (event) => {
  const authHeader = getHeader(event, 'authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }
  const pool = getPool()
  // 把所有节点的 next_surge_at 设为"现在 - 1 秒"以强制触发
  await pool.query(`UPDATE spirit_vein_occupation SET next_surge_at = NOW() - INTERVAL '1 second'`)
  const surge = await processSurge()
  const purge = await purgeExpiredGuards()
  const restore = await restoreNpcNodes()
  return { ok: true, surge, purge, restore }
})
