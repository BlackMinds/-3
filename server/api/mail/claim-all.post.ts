import { getPool } from '~/server/database/db'
import { getCharByUserId } from '~/server/utils/sect'
import { claimMailAttachments } from '~/server/utils/mail'

export default defineEventHandler(async (event) => {
  const char = await getCharByUserId(event.context.userId)
  if (!char) return { code: 400, message: '角色不存在' }
  const pool = getPool()
  const { rows } = await pool.query(
    `SELECT id FROM mails
      WHERE character_id = $1 AND is_claimed = FALSE AND expires_at > NOW()
      ORDER BY id ASC LIMIT 100`,
    [char.id]
  )
  let claimed = 0
  const granted: any[] = []
  for (const r of rows) {
    try {
      const res = await claimMailAttachments(char.id, r.id)
      if (res.ok) {
        claimed++
        if (res.granted) granted.push(...res.granted)
      }
    } catch (e) {
      console.error('[mail claim-all] failed', r.id, e)
    }
  }
  return { code: 200, message: `成功领取 ${claimed} 封`, data: { claimed, granted } }
})
