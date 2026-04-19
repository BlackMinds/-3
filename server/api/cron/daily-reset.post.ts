import { getPool } from '~/server/database/db'
import { cleanupExpiredMails } from '~/server/utils/mail'

export default defineEventHandler(async (event) => {
  const authHeader = getHeader(event, 'authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const pool = getPool()

  // Reset daily donation for all sect members
  await pool.query('UPDATE sect_members SET daily_donated = 0')

  // Remove expired buffs
  await pool.query('DELETE FROM character_buffs WHERE expire_time < NOW()')

  // Cleanup expired timed_buffs
  await pool.query('DELETE FROM timed_buffs WHERE expires_at < NOW()')

  // 灵脉偷袭每日计数归档（保留 3 天）
  await pool.query(`DELETE FROM spirit_vein_daily_raid_count WHERE raid_date < CURRENT_DATE - INTERVAL '3 days'`)

  // Cleanup expired mails (auto-grant attachments before deletion)
  const mailStats = await cleanupExpiredMails()

  return { ok: true, mailStats }
})
