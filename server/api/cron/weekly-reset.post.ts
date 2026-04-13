import { getPool } from '~/server/database/db'

export default defineEventHandler(async (event) => {
  const authHeader = getHeader(event, 'authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const pool = getPool()

  // Reset weekly contribution for all sect members
  await pool.query('UPDATE sect_members SET weekly_contribution = 0')

  return { ok: true }
})
