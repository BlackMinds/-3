import { getPool } from '~/server/database/db'
import { getCharByUserId } from '~/server/utils/sect'

export default defineEventHandler(async (event) => {
  const char = await getCharByUserId(event.context.userId)
  if (!char) return { code: 400, message: '角色不存在' }
  const pool = getPool()
  const { rows } = await pool.query(
    `SELECT
       SUM(CASE WHEN is_read = FALSE THEN 1 ELSE 0 END)::int AS unread,
       SUM(CASE WHEN is_claimed = FALSE THEN 1 ELSE 0 END)::int AS unclaimed
     FROM mails WHERE character_id = $1 AND expires_at > NOW()`,
    [char.id]
  )
  return {
    code: 200,
    message: 'ok',
    data: {
      unread: rows[0]?.unread || 0,
      unclaimed: rows[0]?.unclaimed || 0,
    },
  }
})
