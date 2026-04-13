import { getPool } from '~/server/database/db'
import { getSectBoss } from '~/server/engine/sectData'

export default defineEventHandler(async (event) => {
  const authHeader = getHeader(event, 'authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const pool = getPool()

  // Expire bosses where status = 'active' AND expires_at < NOW()
  const result = await pool.query(
    "UPDATE sect_bosses SET status = 'expired' WHERE status = 'active' AND expires_at < NOW()"
  )

  // Refund 50% cost to sect fund for expired bosses
  if (result.rowCount && result.rowCount > 0) {
    const { rows: expiredBosses } = await pool.query(
      "SELECT sb.sect_id, sb.boss_key FROM sect_bosses sb WHERE sb.status = 'expired' AND sb.finished_at IS NULL"
    )
    for (const eb of expiredBosses) {
      const cfg = getSectBoss(eb.boss_key)
      if (cfg) {
        await pool.query('UPDATE sects SET fund = fund + $1 WHERE id = $2', [Math.floor(cfg.startCost * 0.5), eb.sect_id])
      }
    }
  }

  return { ok: true }
})
