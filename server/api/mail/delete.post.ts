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
    // 一键清空：只删除已读且无附件/已领取的
    const { rowCount } = await pool.query(
      `DELETE FROM mails
        WHERE character_id = $1 AND is_read = TRUE AND is_claimed = TRUE`,
      [char.id]
    )
    return { code: 200, message: `已清理 ${rowCount} 封`, data: { deleted: rowCount } }
  }
  const { rowCount } = await pool.query(
    `DELETE FROM mails
      WHERE character_id = $1 AND id = ANY($2::int[])
        AND is_claimed = TRUE`,
    [char.id, ids]
  )
  return { code: 200, message: 'ok', data: { deleted: rowCount } }
})
