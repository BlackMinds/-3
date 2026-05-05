import { getPool } from '~/server/database/db'
import { dispatchReturnMail } from '~/server/utils/market'

// 每 5 分钟跑一次：把 active 且过期的挂单置为 expired，并通过邮件退回装备
export default defineEventHandler(async (event) => {
  const authHeader = getHeader(event, 'authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const pool = getPool()
  const client = await pool.connect()
  let expired = 0
  try {
    await client.query('BEGIN')
    const { rows } = await client.query(
      `UPDATE market_listings
          SET status = 'expired', closed_at = NOW()
        WHERE status = 'active' AND expires_at < NOW()
        RETURNING id, seller_id, item_snapshot`
    )
    for (const r of rows) {
      try {
        await dispatchReturnMail(client, {
          characterId: r.seller_id,
          snapshot: r.item_snapshot,
          reason: 'expired',
          listingId: Number(r.id),
        })
        expired++
      } catch (e) {
        console.error('[market-expire] mail failed for', r.id, e)
      }
    }
    await client.query('COMMIT')
  } catch (e) {
    await client.query('ROLLBACK')
    throw e
  } finally {
    client.release()
  }

  return { ok: true, expired }
})
