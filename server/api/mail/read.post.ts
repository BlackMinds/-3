import { getPool } from '~/server/database/db'
import { getCharByUserId } from '~/server/utils/sect'

export default defineEventHandler(async (event) => {
  const char = await getCharByUserId(event.context.userId)
  if (!char) return { code: 400, message: '角色不存在' }
  const body = await readBody(event)
  const ids: number[] = Array.isArray(body?.ids)
    ? body.ids.filter((x: any) => Number.isInteger(x))
    : (body?.id ? [Number(body.id)] : [])
  const pool = getPool()
  if (ids.length === 0) {
    // 全部标记已读
    const { rowCount } = await pool.query(
      `UPDATE mails SET is_read = TRUE, read_at = NOW()
        WHERE character_id = $1 AND is_read = FALSE`,
      [char.id]
    )
    return { code: 200, message: 'ok', data: { updated: rowCount } }
  }
  const { rowCount } = await pool.query(
    `UPDATE mails SET is_read = TRUE, read_at = NOW()
      WHERE character_id = $1 AND id = ANY($2::int[])`,
    [char.id, ids]
  )
  return { code: 200, message: 'ok', data: { updated: rowCount } }
})
