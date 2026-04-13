import { getPool } from '~/server/database/db'

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

  return { ok: true }
})
